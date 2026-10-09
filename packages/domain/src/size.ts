/**
 * 尺寸与站内规范的类型定义。
 * 具体数据在 `@futu/specs`（会持续录入），这里只定形状。
 */

export type SizeChannel = "inapp" | "external" | "custom" | "paid" | "kol" | "partner" | "owned";

export interface SizeItem {
  id: string;
  w: number;
  h: number;
  /** 用在哪儿，给人看的 */
  use: string;
}

export interface SizeGroup {
  id: SizeChannel;
  name: string;
  note: string;
  items: SizeItem[];
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
