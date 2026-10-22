/**
 * 端口层 —— 只有接口，没有实现。
 *
 * 这是整个架构里最重要的一层：核心逻辑（solver / specs / orchestrator）
 * 只依赖这里的接口，从不 import 浏览器 API、Node API 或 Next.js。
 *
 * 迁桌面端时要做的事只有一件：新增一个 adapters-node 实现这些接口。
 * 核心逻辑一行都不用改 —— 这就是「禁止核心业务逻辑与页面层强耦合」的落地方式。
 */

import type { AssetRef, BadgeStyle, CtaStyle, GenerateRun, NativeBoard, Project, SceneBoard, Solution } from "@futu/domain";

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
  /** 写入 Figma 时用于 Section 分类、标签和稳定命名的展示信息。 */
  figmaLayout?: {
    boardName: string;
    size: string;
    language: string;
    languageGroup?: string;
    languageSection?: string;
    /** 写入 Figma 时的大类标签，如站内、官网、站外、线下、仿原生。 */
    channel?: string;
    /** 渠道内部的排列分组；闪屏单独一行，其余避免横、方、竖版混排。 */
    layoutGroup?: "landscape" | "square" | "portrait" | "splash";
  };
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
  /** 四步流程的逐层场景；存在时写入端按图层逐个落位，不走 recipe 结构。 */
  scene?: SceneBoard;
  /** 预设 Logo 的矢量源，写入端用 createNodeFromSvg 还原，不退化成文字。 */
  logoSvg?: string;
  /** Logo 源组件；同文件按 nodeId 创建实例，发布后可跨文件按 key 导入。 */
  logoComponent?: { fileKey: string; nodeId: string; key?: string };
  /**
   * 联动画板（如闪屏各设备尺寸）：不独立排版，写入端把同语种母版画板转成组件，
   * 这里放它的实例（按 scale 缩放、x 偏移、贴顶），再铺底部白条与 Logo。
   */
  /**
   * 仿原生固定模板：写入端按图元逐个落位，不用主视觉组件。
   * assets 按图元 url 存 SVG 文本或 PNG base64（不带 data: 前缀）。
   */
  native?: NativeBoard & { assets: Record<string, string> };
  linked?: {
    masterKey: string;
    scale: number;
    x: number;
    bar: number;
    logo: { x: number; y: number; w: number; h: number };
    logoSvg?: string;
    logoComponent?: { fileKey: string; nodeId: string; key?: string };
  };
}

export interface FigmaWriteOptions {
  fileKey: string;
  /** 目标链接中的节点；插件用它确认自己确实运行在目标文件中。 */
  targetNodeId: string;
  /** 一次完整写入任务的稳定标识；同一任务重试时保持不变。 */
  runId: string;
  /** 重试同一任务时，先移除该 runId 上一次未完成的输出。 */
  replaceRun?: boolean;
  /** 已在第一步识别的主视觉组件；写入端必须创建其 Instance，而非复制图层。 */
  visualComponent?: AssetRef;
  /** 上传图片转组件时的边缘过渡：强度 0..3 与过渡到的底色。 */
  uploadFeather?: { level: number; color: string };
  /** 建新页还是写当前页 */
  page: "new" | "current";
  pageName: string;
  /** Section 名称的项目部分；与用户可编辑的页面名分开。 */
  sectionName?: string;
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
  write(boards: BoardPlan[], options: FigmaWriteOptions, signal?: AbortSignal): Promise<FigmaWriteResult>;
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
