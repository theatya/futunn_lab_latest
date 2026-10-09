/**
 * 端口层 —— 只有接口，没有实现。
 *
 * 这是整个架构里最重要的一层：核心逻辑（solver / specs / orchestrator）
 * 只依赖这里的接口，从不 import 浏览器 API、Node API 或 Next.js。
 *
 * 迁桌面端时要做的事只有一件：新增一个 adapters-node 实现这些接口。
 * 核心逻辑一行都不用改 —— 这就是「禁止核心业务逻辑与页面层强耦合」的落地方式。
 */

import type { AssetRef, BadgeStyle, CtaStyle, GenerateRun, Project, Solution } from "@futu/domain";

/* ------------------------------------------------------------------ */
/* 基础设施                                                            */
/* ------------------------------------------------------------------ */

/** 键值存储。Web 用 localStorage / IndexedDB，桌面端用 SQLite 或文件。 */
export interface StoragePort {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keys(prefix?: string): Promise<string[]>;
}

export interface HttpPort {
  request<T>(input: {
    url: string;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    headers?: Record<string, string>;
    body?: unknown;
    signal?: AbortSignal;
  }): Promise<T>;
}

/**
 * 文件系统。Web 端只有「下载到浏览器」这一种能力，
 * 桌面端才有真正的读写 —— 所以接口按最小公倍数设计。
 */
export interface FileSystemPort {
  /** 把二进制内容交付给用户（Web = 触发下载，桌面 = 写盘） */
  deliver(input: { name: string; mime: string; data: Blob | ArrayBuffer }): Promise<void>;
  /** 桌面端才有；Web 端实现应抛 UnsupportedError */
  readText?(path: string): Promise<string>;
  writeText?(path: string, content: string): Promise<void>;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerPort {
  log(level: LogLevel, message: string, meta?: Record<string, unknown>): void;
}

export interface ConfigPort {
  get(key: string): string | undefined;
  require(key: string): string;
}

/* ------------------------------------------------------------------ */
/* 业务能力                                                            */
/* ------------------------------------------------------------------ */

export interface ProjectRepository {
  list(): Promise<Project[]>;
  load(id: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  remove(id: string): Promise<void>;
}

/** 一块要写进 Figma 的画板 */
export interface BoardPlan {
  /** `${w}×${h}` */
  key: string;
  lang: string;
  /** 画板名，会成为 Figma 里的 Frame 名 */
  name: string;
  solution: Solution;
  /** 第一阶段确认的主视觉组件引用。 */
  visualComponent?: AssetRef;
  /** 第一阶段确认的母版背景色。 */
  backgroundColor?: string;
  subLabel?: string;
  badgeLabel?: string;
  disclaimerLabel?: string;
  /** 这种语言自己的 Logo，生成时按语种换 */
  logo?: AssetRef;
  /** 第二步设定的 CTA 全局默认视觉，供最终写入端复现。 */
  ctaStyle?: CtaStyle;
  /** 第二步设定或第三步按画幅覆盖的角标样式。 */
  badgeStyle?: BadgeStyle;
}

export interface FigmaWriteOptions {
  fileKey?: string;
  /** 已在第一步识别的主视觉组件；写入端必须创建其 Instance，而非复制图层。 */
  visualComponent?: AssetRef;
  /** 建新页还是写当前页 */
  page: "new" | "current";
  pageName: string;
  /** 画板怎么排：按尺寸分组 / 按语种分组 / 平铺 */
  arrange: "group" | "lang" | "flat";
}

export interface FigmaWriteResult {
  ok: boolean;
  /** 成功写入的节点 */
  nodes: Array<{ key: string; lang: string; nodeId: string; recipeId?: string; validated?: boolean }>;
  /** 失败的板，带原因 */
  failures: Array<{ key: string; lang: string; error: string }>;
}

/**
 * 往 Figma 写画板。
 *
 * 当前唯一可行的实现路径是 A 方案：平台 → Cursor SDK 云端 agent → Figma MCP。
 * 直连 Figma MCP 走不通，因为它有客户端白名单。
 * 这个接口把那条链路整个藏在后面，将来换成 D 方案（自建插件 + 本地桥接）也不影响调用方。
 */
export interface FigmaWriterPort {
  write(boards: BoardPlan[], options: FigmaWriteOptions): Promise<FigmaWriteResult>;
  /** 当前用哪个身份写。界面上要如实告诉用户。 */
  identity(): Promise<{ kind: "user" | "service" | "mock"; label: string }>;
}

/** 跑云端 agent（Cursor SDK）。编排层通过它把任务派出去。 */
export interface AgentRunnerPort {
  run(input: { prompt: string; signal?: AbortSignal }): Promise<{ runId: string; output: string }>;
}

/** AI 出图 / 背景外扩。现在还没接，先把位置留出来。 */
export interface ImageProviderPort {
  outpaint(input: {
    image: Blob;
    targetRatio: number;
    prompt?: string;
  }): Promise<Blob>;
}

/* ------------------------------------------------------------------ */
/* 容器                                                                */
/* ------------------------------------------------------------------ */

/**
 * 所有端口的集合。应用启动时组装一次，往下传。
 * 不用 DI 框架 —— 依赖数量可控，显式传递更好读也更好测。
 */
export interface Ports {
  storage: StoragePort;
  http: HttpPort;
  files: FileSystemPort;
  logger: LoggerPort;
  config: ConfigPort;
  projects: ProjectRepository;
  figma: FigmaWriterPort;
}

export class UnsupportedError extends Error {
  constructor(what: string) {
    super(`当前运行环境不支持：${what}`);
    this.name = "UnsupportedError";
  }
}

export type { GenerateRun };
