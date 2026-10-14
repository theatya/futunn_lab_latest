/**
 * 站内规范库。
 *
 * 三条录入原则，违反了宁可不录：
 *  1. **必须写明来源和读取时间**，出了事能追溯到是哪版规范。
 *  2. **只录量得到的硬约束**，量不到的不猜。
 *  3. **没定死的写进 todo**，让它在界面上显形 —— 假装有规范比没有规范更危险。
 *
 * key 是资源位 id（见 sizes.ts）。CTA 字号没标注的资源位不锁 CTA，只在 notes 里写尺寸。
 */

import type { SizeSpec } from "@futu/domain";

const VERSION = "纯净版 2026-10-12";

type Cta = NonNullable<SizeSpec["cta"]>;

/** 1080×225 标准横幅：CTA 200×80 固定在右侧，距右 24、距顶 72，字号 30。 */
const STRIP: Cta = { height: 80, fontPx: 30, paddingX: 40, minWidth: 200, maxWidth: 360, anchor: "right", gapX: 24 };

const spec = (source: string, cta: Cta, extra: Partial<SizeSpec> = {}): SizeSpec => ({
  source: `广告设计规范 / ${source}`,
  version: VERSION,
  minPadX: cta.gapX,
  cta,
  todo: [],
  ...extra,
});

const strip = (source: string): SizeSpec => spec(source, STRIP, { maxTitleLines: 3 });

export const SPECS: Record<string, SizeSpec> = {
  "a-acct": strip("账户tab_交易tab banner"),
  "a-wm-new-s": strip("理财tab_理财首页顶部新客banner"),
  "a-fund-s": strip("理财tab_基金组合页banner"),
  "a-news-foot": strip("资讯tab_资讯详情底部"),
  "a-topic": strip("牛牛圈tab_热点话题详情banner"),
  "a-vip": strip("会员页_会员打新专区banner"),
  "a-mine": strip("我的tab_banner"),
  "a-ipo-stock": strip("新股页_新股个股banner"),
  "a-ipo-done": strip("新股页_新股申购完成页"),
  "a-watch": strip("自选页_个股banner"),
  "a-search": spec("全局_搜索tab", { ...STRIP, fontPx: 33 }),
  "w-pc-hero": spec("官网_PC首页轮播banner（30255:3413 / 29121:3611）", { height: 60, fontPx: 22, paddingX: 30, minWidth: 280, maxWidth: 280, anchor: "left", gapX: 580 }),
  "a-fund": spec("理财tab_基金组合页banner", { height: 80, fontPx: 32, paddingX: 30, minWidth: 220, maxWidth: 220, anchor: "left", gapX: 70 }),
  "a-ipo": spec("新股页_新股中心banner", { height: 70, fontPx: 32, paddingX: 30, minWidth: 220, maxWidth: 220, anchor: "left", gapX: 70 }),
  "a-feed": spec("牛牛圈tab_牛牛圈feed", { height: 90, fontPx: 38, paddingX: 40, minWidth: 270, maxWidth: 270, anchor: "left", gapX: 70 }),
  "a-class": spec("课堂banner", { height: 50, fontPx: 26, paddingX: 15, minWidth: 150, maxWidth: 150, anchor: "left", gapX: 40 }),
  "a-fb": spec("消息推送_活动FB分享图", { height: 88, fontPx: 38, paddingX: 30, minWidth: 280, maxWidth: 280, anchor: "left", gapX: 40 }),
  "a-desk": spec("新桌面端-底部广告位（18674:179742，示例稿按 1/3 绘制）", { height: 70, fontPx: 32, paddingX: 45, minWidth: 220, maxWidth: 360, anchor: "left", gapX: 72, soft: true }, { todo: ["CTA 最大宽度规范未注明，暂按 360"] }),
  "a-popup": spec("全局_弹窗", {
    height: 120,
    fontPx: 48,
    paddingX: 60,
    minWidth: 480,
    maxWidth: 680,
    anchor: "center",
    gapX: 24,
    lengths: { short: 480, medium: 580, long: 680 },
  }),
};

/** 按另一个资源位的 CTA 规范等比换算，字号保留一位小数。 */
const scaled = (cta: Cta, k: number, gapX: number): Cta => {
  const px = (value: number) => Math.round(value * k * 10) / 10;
  return { ...cta, height: px(cta.height), fontPx: px(cta.fontPx), paddingX: px(cta.paddingX), minWidth: px(cta.minWidth), maxWidth: px(cta.maxWidth), gapX };
};

/** 官网扁条有 CTA 版按 1080×225 等比换算。 */
for (const [id, w, gapX, source] of [
  ["w-top-h5", 375, 16, "官网顶部banner-H5"],
  ["w-iframe-h5", 342, 8, "H5轮播图"],
  ["w-mid-ipad", 864, 19, "官网首页固定中缝位-iPad"],
  ["w-ops", 1180, 26, "官网通用运营广告位-Web"],
] as const) {
  SPECS[id] = spec(`${source}（按 1080×225 有 CTA 规范等比换算）`, scaled(STRIP, w / 1080, gapX), { maxTitleLines: 3 });
}

/** 官网中缝位 H5 与牛牛圈 feed 比例一致，规范等比缩小。 */
SPECS["w-mid-h5"] = spec("官网首页固定中缝位-H5（按牛牛圈 feed 1080×540 等比缩小）", scaled(SPECS["a-feed"]!.cta!, 327 / 1080, 21));

/** 官网弹窗 / 侧边栏同为 810×1110，用户确认先复用站内全局弹窗规范。 */
for (const id of ["w-popup", "w-side"]) {
  SPECS[id] = { ...SPECS["a-popup"]!, source: "广告设计规范 / 全局_弹窗（官网弹窗、侧边栏复用）" };
}
