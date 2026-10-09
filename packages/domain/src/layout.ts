/**
 * 版式模型 —— 求解器的输入配置与输出结果。
 *
 * 关键约定：**所有矩形都是 0..1 的归一化坐标**，字号是**真实像素**。
 * 这样一套解可以直接用在 300×50 的小横幅和 1125×2436 的开屏上，
 * 渲染层只负责乘以自己的显示尺寸。求解结果与显示大小完全无关。
 */

import type { QualityReport, RecipeLayer, RecipeTrace } from "./layout-recipe";

/** 归一化矩形，x/y/w/h 都是 0..1，相对于画板 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 画板上可以出现的元素 */
export type ElementKey = "kv" | "logo" | "badge" | "sub" | "title" | "cta" | "disc" | "extra";

export type ShowConfig = Record<ElementKey, boolean>;

export const SHOW_ALL: ShowConfig = {
  kv: true,
  logo: true,
  badge: true,
  sub: true,
  title: true,
  cta: true,
  disc: true,
  extra: false,
};

export const ELEMENT_LABEL: Record<ElementKey, string> = {
  kv: "主视觉",
  logo: "Logo",
  badge: "角标",
  sub: "副标题",
  title: "主标题",
  cta: "按钮",
  disc: "免责",
  extra: "新增（如有）",
};

/** 垂直流里的默认顺序 */
export const ELEMENT_ORDER: ElementKey[] = [
  "logo",
  "kv",
  "title",
  "sub",
  "cta",
  "badge",
  "disc",
  "extra",
];

/** 面板上的开关顺序：副标题不单独列，它是标题组里的次级开关 */
export const TOGGLE_ORDER: ElementKey[] = ["logo", "kv", "title", "cta", "badge", "disc", "extra"];

/* ------------------------------------------------------------------ */
/* 边距                                                                */
/* ------------------------------------------------------------------ */

/**
 * 边距按板的**短边**算 —— 这样 970×250 那种扁板不会被一个按宽度算的大边距压死。
 * x / y 是占短边的百分比；bias 是竖向位置，-100 贴顶、0 默认、+100 贴底。
 */
export interface MarginConfig {
  x: number;
  y: number;
  bias: number;
}

export const MARGIN_DEFAULT: MarginConfig = { x: 7, y: 7, bias: 0 };

/* ------------------------------------------------------------------ */
/* 新增元素（额外插槽）                                                 */
/* ------------------------------------------------------------------ */

export type ExtraKind = "empty" | "qr" | "partner" | "timer";

export type ExtraAnchor = "auto" | "tl" | "tc" | "tr" | "ml" | "mc" | "mr" | "bl" | "bc" | "br";

export type ExtraAlign = "start" | "center" | "end";

/** 插槽里放什么，决定它的长宽比 —— 求解器靠这个给它留位置 */
export const EXTRA_KIND_META: Record<ExtraKind, { label: string; aspect: number }> = {
  empty: { label: "空插槽（还没识别）", aspect: 2.4 },
  qr: { label: "二维码", aspect: 1 },
  partner: { label: "合作方 Logo", aspect: 3.4 },
  timer: { label: "倒计时", aspect: 2.8 },
};

export const ANCHOR_GRID: ExtraAnchor[] = ["tl", "tc", "tr", "ml", "mc", "mr", "bl", "bc", "br"];

export const ANCHOR_LABEL: Record<string, string> = {
  tl: "左上",
  tc: "上中",
  tr: "右上",
  ml: "左中",
  mc: "居中",
  mr: "右中",
  bl: "左下",
  bc: "下中",
  br: "右下",
};

/**
 * 新增元素的两种归属 —— 这是整套规则里唯一需要人回答的问题。
 * `flow` 进垂直流，跟其他元素抢空间；`pin` 是浮层，不参与流，只找一个没被占用的角。
 */
export interface ExtraConfig {
  place: "flow" | "pin";
  /** 进流时排在谁之后 */
  after: ElementKey;
  kind: ExtraKind;
  /** 浮层锚在哪个角/边；auto = 让求解器自己找空位 */
  anchor: ExtraAnchor;
  /** 大小，占板短边的百分比 */
  size: number;
  /** 进流时在文案栏里靠哪边 */
  align: ExtraAlign;
  /** 在锚点基础上左右微调，占板宽的百分比 */
  dx: number;
  /** 在锚点基础上上下微调，占板高的百分比（只对浮层生效） */
  dy: number;
}

export const EXTRA_DEFAULT: ExtraConfig = {
  place: "flow",
  after: "title",
  kind: "empty",
  anchor: "auto",
  size: 15,
  align: "center",
  dx: 0,
  dy: 0,
};

/** 一块板的完整版式配置 */
export interface BoardConfig {
  margin: MarginConfig;
  show: ShowConfig;
  extra: ExtraConfig;
}

export const BOARD_CONFIG_DEFAULT: BoardConfig = {
  margin: MARGIN_DEFAULT,
  show: SHOW_ALL,
  extra: EXTRA_DEFAULT,
};

/* ------------------------------------------------------------------ */
/* 求解结果                                                            */
/* ------------------------------------------------------------------ */

export type LayoutKind = "单行条幅" | "左文右图" | "极窄竖幅" | "居中 · 竖版" | "居中 · 方版";

/**
 * 求解器的一条决策记录。
 * 做成结构化而不是拼字符串，是为了 UI 能按级别分色、能筛、以后能做诊断面板。
 */
export interface SolveNote {
  level: "info" | "lock" | "warn";
  text: string;
}

export interface Solution {
  layout: LayoutKind;
  /** 画板真实尺寸，回带出来方便渲染层换算 */
  board: { w: number; h: number };

  kv: Rect | null;
  logo: Rect | null;
  badge: Rect | null;
  badgeSide: "left" | "right";

  sub: Rect | null;
  /** 真实像素字号 */
  subPx: number;

  title: Rect | null;
  /** 断好行的主标题，每个元素是一行 */
  titleLines: string[];
  titlePx: number;

  align: "left" | "center";

  cta: Rect | null;
  /** 实际用的是长版还是短版，由求解器决定 */
  ctaLabel: string;
  ctaPx: number;

  disc: Rect | null;
  discPx: number;
  /** 免责实际折了几行 */
  discLineCount: number;

  extra: Rect | null;

  notes: SolveNote[];
  /** 命中训练配方时回带完整追溯；没有时表示走通用启发式。 */
  recipeTrace?: RecipeTrace;
  /** 写回端消费的结构与样式；Web 预览和 Figma 写回必须共用。 */
  resolvedLayers?: RecipeLayer[];
  quality?: QualityReport;
}
