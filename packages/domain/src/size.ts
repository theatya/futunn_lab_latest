/**
 * 尺寸与站内规范的类型定义。
 * 具体数据在 `@futu/specs`（会持续录入），这里只定形状。
 */

export type SizeChannel = "inapp" | "web" | "external" | "native" | "custom" | "paid" | "kol" | "partner" | "owned";

/** 规范标注区，真实 px，相对画板左上角。reserved = 不放内容的保留区；safe = 内容必须落在框内。 */
export interface SizeZone {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "reserved" | "safe";
  label?: string;
}

export interface SizeBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 由母版联动生成的画板（如闪屏各设备尺寸）：母版按 (h - bar) 等比缩放、水平居中裁切，底部白条放 Logo。 */
export interface SizeLinked {
  master: string;
  bar: number;
  logo: SizeBox;
  /** 系统控件，只在预览里示意，不输出 */
  skip?: SizeBox;
  control?: SizeBox;
}

/** 规范可隐藏的元素；主视觉不会被隐藏。 */
export type SizeHideRole = "cta" | "logo" | "badge" | "kicker" | "title" | "subtitle" | "custom" | "disclaimer";

/** 规范示例稿里量到的锚点，真实 px：left / right 对齐时 x 为该侧边缘，center 为中心；y 为垂直中心。 */
export interface SizeAnchor {
  x: number;
  y: number;
  align: "left" | "center" | "right";
}

/**
 * 资源位规范版式：示例稿明确给出的位置，优先于版式族默认值与族内调整（单板手动调整仍可覆盖）。
 * 没给出的项沿用版式族。
 */
export interface SizeLayout {
  /** 标题组（小标题＋主标题＋副标题）整体锚点。 */
  group?: SizeAnchor;
  /** 示例稿主标题字号；与版式族默认字号差得多时给出，标题组按它换算整体比例。 */
  titlePx?: number;
  /** CTA 锚点；afterSubtitle 表示紧跟副标题右侧、间距为该值，与副标题垂直居中。 */
  cta?: SizeAnchor | { afterSubtitle: number };
  /** 主视觉锚点；scale 是相对版式族默认大小的倍数。 */
  visual?: { x: number; y: number; scale?: number };
  /** 只出主视觉的资源位：主视觉居中铺满画板。 */
  visualFill?: boolean;
  /** 示例稿节点，便于回查。 */
  source: string;
}

export interface SizeItem {
  id: string;
  w: number;
  h: number;
  /** 资源位命名，给人看的 */
  use: string;
  /** 站外子分类 id */
  sub?: string;
  /** 同一资源位的版式，如「有 CTA」「无 CTA」 */
  variant?: string;
  zones?: SizeZone[];
  notes?: string[];
  linked?: SizeLinked;
  /** 规范要求不出现的元素 */
  hide?: SizeHideRole[];
  layout?: SizeLayout;
  /** 选择资源位时跟在命名后的小字备注。 */
  hint?: string;
  /** 两侧会延展成纯色底：左右各留这么宽（px）的过渡，渐变到画板底色。 */
  edgeFade?: number;
  /** 仿原生固定模板：不按主视觉延展，第三步单独编辑。 */
  native?: boolean;
}

export interface SizeGroup {
  id: SizeChannel;
  name: string;
  note: string;
  items: SizeItem[];
  subs?: Array<{ id: string; name: string }>;
}

/**
 * 站内规范 —— 尺寸**自带的硬约束**，不是版式偏好。
 *
 * 和「共用设置」的区别：共用设置是意愿，规范是边界。
 * 两者冲突时规范赢，并且必须在 UI 上明确告诉用户「你要的没生效，因为规范」。
 */
export interface SizeSpec {
  /** 从哪份文件读出来的，出了事能追溯 */
  source: string;
  /** 读取时间/版本 */
  version: string;
  /** 左右安全边距下限，真实 px */
  minPadX?: number;
  /** CTA 几何规范。宽度随文案伸缩，高度、字号、Padding 与锚点由资源位决定。 */
  cta?: {
    height: number;
    fontPx: number;
    paddingX: number;
    minWidth: number;
    maxWidth: number;
    anchor: "left" | "center" | "right";
    gapX: number;
    /** 宽度在上下限内可选短/中/长（如弹窗按钮 480–680） */
    lengths?: { short: number; medium: number; long: number };
  };
  /** 主标题最多几行 */
  maxTitleLines?: number;
  /**
   * 录入时**没定死、等人确认**的点。
   * 故意保留而不是猜一个值填上 —— 假装有规范比没有规范更危险。
   */
  todo: string[];
}

/** 查规范的结果 */
export interface SpecLookup {
  item: SizeItem;
  spec: SizeSpec | null;
  /** 是不是站内位。站内位即便没录规范，也要在 UI 上提示人工核对 */
  isInApp: boolean;
}

export const sizeKey = (w: number, h: number) => `${w}×${h}`;

/** 联动画板里母版的摆放：按 (h - bar) 等比缩放，水平居中，贴顶。 */
export function linkedPlacement(linked: SizeLinked, board: { w: number; h: number }, master: { w: number; h: number }) {
  const scale = (board.h - linked.bar) / master.h;
  return { scale, x: (board.w - master.w * scale) / 2, w: master.w * scale, h: master.h * scale };
}
