/**
 * 站内规范库。
 *
 * 三条录入原则，违反了宁可不录：
 *  1. **必须写明来源和读取时间**，出了事能追溯到是哪版规范。
 *  2. **只录量得到的硬约束**，量不到的不猜。
 *  3. **没定死的写进 todo**，让它在界面上显形 —— 假装有规范比没有规范更危险。
 *
 * 目前只录了一个位，是从《广告设计规范》真读出来的。
 * 其余站内尺寸还没录，界面上会提示人工核对，不会假装有规范。
 */

import type { SizeSpec } from "@futu/domain";

export const SPECS: Record<string, SizeSpec> = {
  s1: {
    source: "广告设计规范 / 我的tab_banner",
    version: "语料库 2026-10-09.1",
    minPadX: 24,
    cta: {
      height: 80,
      fontPx: 30,
      paddingX: 40,
      minWidth: 200,
      maxWidth: 360,
      anchor: "right",
      gapX: 24,
    },
    maxTitleLines: 3,
    todo: [
      "其余资源位的 CTA 几何等待导入器从纯净版逐页复核。",
    ],
  },
};
