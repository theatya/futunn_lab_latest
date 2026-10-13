/**
 * 端口的浏览器实现。
 *
 * 这一层是**唯一**允许直接碰 window / localStorage / fetch 的地方。
 * 迁桌面端时整包换掉即可，核心逻辑不受影响。
 */

import type { Project } from "@futu/domain";
import {
  UnsupportedError,
  type BoardPlan,
  type ConfigPort,
  type FigmaWriteOptions,
  type FigmaWriteResult,
  type FigmaWriterPort,
  type FileSystemPort,
  type HttpPort,
  type LoggerPort,
  type LogLevel,
  type Ports,
  type ProjectRepository,
  type StoragePort,
} from "@futu/ports";

/* ------------------------------------------------------------------ */

export class LocalStorageAdapter implements StoragePort {
  constructor(private prefix = "futu:") {}

  private k(key: string) {
    return this.prefix + key;
  }

  async get<T>(key: string): Promise<T | null> {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(this.k(key));
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(this.k(key), JSON.stringify(value));
    } catch {
      // 配额满或隐私模式：不让存储失败拖垮整个应用
    }
  }

  async remove(key: string): Promise<void> {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(this.k(key));
  }

  async keys(prefix = ""): Promise<string[]> {
    if (typeof window === "undefined") return [];
    const full = this.k(prefix);
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(full)) out.push(k.slice(this.prefix.length));
    }
    return out;
  }
}

/* ------------------------------------------------------------------ */

export class FetchHttpAdapter implements HttpPort {
  async request<T>(input: {
    url: string;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
    signal?: AbortSignal;
  }): Promise<T> {
    const res = await fetch(input.url, {
      method: input.method ?? "GET",
      headers: { "content-type": "application/json", ...input.headers },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      signal: input.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${input.url}`);
    return (await res.json()) as T;
  }
}

/* ------------------------------------------------------------------ */

export class BrowserFileAdapter implements FileSystemPort {
  async deliver(input: { name: string; mime: string; data: Blob | ArrayBuffer }): Promise<void> {
    const blob = input.data instanceof Blob ? input.data : new Blob([input.data], { type: input.mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = input.name;
    a.click();
    // 立刻 revoke 会让部分浏览器下载不到，延后释放
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async readText(): Promise<string> {
    throw new UnsupportedError("在浏览器里读取本地文件");
  }

  async writeText(): Promise<void> {
    throw new UnsupportedError("在浏览器里写入本地文件");
  }
}

/* ------------------------------------------------------------------ */

export class ConsoleLogger implements LoggerPort {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    if (meta) fn(`[${level}] ${message}`, meta);
    else fn(`[${level}] ${message}`);
  }
}

export class EnvConfig implements ConfigPort {
  constructor(private values: Record<string, string | undefined> = {}) {}

  get(key: string): string | undefined {
    return this.values[key];
  }

  require(key: string): string {
    const v = this.get(key);
    if (v === undefined) throw new Error(`缺少配置项 ${key}`);
    return v;
  }
}

/* ------------------------------------------------------------------ */

export class StorageProjectRepository implements ProjectRepository {
  constructor(private storage: StoragePort) {}

  async list(): Promise<Project[]> {
    const keys = await this.storage.keys("project:");
    const out: Project[] = [];
    for (const k of keys) {
      const p = await this.storage.get<Project>(k);
      if (p) out.push(p);
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async load(id: string): Promise<Project | null> {
    return this.storage.get<Project>(`project:${id}`);
  }

  async save(project: Project): Promise<void> {
    await this.storage.set(`project:${project.id}`, {
      ...project,
      updatedAt: new Date().toISOString(),
    });
  }

  async remove(id: string): Promise<void> {
    await this.storage.remove(`project:${id}`);
  }
}

/* ------------------------------------------------------------------ */

/**
 * 通过本地 Figma 开发插件写入。
 *
 * REST API 不能修改画布；浏览器把任务交给同一网络下的插件，插件再调用
 * Figma Plugin API 创建 Frame 和主视觉 Instance。
 */
function stableFigmaSessionId() {
  const fallback = typeof crypto === "undefined" ? `session-${Date.now()}` : crypto.randomUUID();
  if (typeof window === "undefined") return fallback;
  const key = "futu:figma-bridge-session";
  const saved = window.localStorage.getItem(key);
  if (saved) return saved;
  const created = fallback.slice(0, 8);
  window.localStorage.setItem(key, created);
  return created;
}

export class LocalPluginFigmaWriter implements FigmaWriterPort {
  readonly sessionId = stableFigmaSessionId();

  async identity() {
    return { kind: "user" as const, label: `本地 Figma 插件 · ${this.sessionId.slice(0, 8)}` };
  }

  async write(boards: BoardPlan[], options: FigmaWriteOptions): Promise<FigmaWriteResult> {
    const uploaded = options.visualComponent?.source === "upload" && options.visualComponent.previewUrl?.startsWith("data:");
    if (boards.some((board) => !board.native) && !options.visualComponent?.figmaUrl && !uploaded) {
      throw new Error("请先在第一步识别主视觉组件或上传图片");
    }
    const created = await fetch("/api/figma/write", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "create", sessionId: this.sessionId, boards, options }),
    });
    const job = (await created.json()) as { jobId?: string; error?: string };
    if (!created.ok || !job.jobId) throw new Error(job.error ?? "无法创建 Figma 写入任务");

    const expiresAt = Date.now() + 120_000;
    while (Date.now() < expiresAt) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      const response = await fetch(`/api/figma/write?jobId=${encodeURIComponent(job.jobId)}`);
      const status = (await response.json()) as { status?: string; result?: FigmaWriteResult; error?: string };
      if (status.status === "completed" && status.result) return status.result;
      if (status.status === "failed") throw new Error(status.error ?? "Figma 插件写入失败");
    }
    throw new Error("等待 Figma 插件超时。请确认插件已打开、配对码正确，并运行在目标文件中。");
  }
}

/* ------------------------------------------------------------------ */

/** 组装浏览器环境下的全套端口 */
export function createWebPorts(env: Record<string, string | undefined> = {}): Ports {
  const storage = new LocalStorageAdapter();
  return {
    storage,
    http: new FetchHttpAdapter(),
    files: new BrowserFileAdapter(),
    logger: new ConsoleLogger(),
    config: new EnvConfig(env),
    projects: new StorageProjectRepository(storage),
    figma: new LocalPluginFigmaWriter(),
  };
}
