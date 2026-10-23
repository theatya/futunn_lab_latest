import { emptyLangCopy, type Lang, type Project, type ScenePlacementPatch, type TargetBoard } from "@futu/domain";

export type CampaignScenarioId = "earnings-general" | "hk-stock-banner" | "stock-options";
export type CampaignCopyType = "earnings" | "live" | "hk" | "options";

export type CampaignSlotDefinition = {
  id: string;
  name: string;
  w: number;
  h: number;
  baseSizeId?: string;
  languages?: Lang[];
  copyType: CampaignCopyType;
  tag?: "title" | "center" | "left" | "none";
  earningsTime?: boolean;
};

export type CampaignScenarioDefinition = {
  id: CampaignScenarioId;
  name: string;
  languages: Lang[];
  slots: CampaignSlotDefinition[];
  hasEarningsTag: boolean;
  hasEarningsTime: boolean;
};

export const CAMPAIGN_PACK = {
  id: "earnings-season",
  name: "财报季",
  version: "2026Q2-corpus-layout-3",
} as const;

export const CAMPAIGN_VISUAL_WIDTH = 1160;
export const CAMPAIGN_VISUAL_HEIGHT = 623;
export const CAMPAIGN_VISUAL_ASPECT = CAMPAIGN_VISUAL_WIDTH / CAMPAIGN_VISUAL_HEIGHT;
export const CAMPAIGN_TAG_ID = "campaign-earnings-tag";
export const CAMPAIGN_TIME_ID = "campaign-earnings-time";

type CampaignCorpusFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
  align?: "left" | "center" | "right";
};

type CampaignCorpusLayout = {
  visual: CampaignCorpusFrame;
  copy: CampaignCorpusFrame;
  cta?: CampaignCorpusFrame;
  tag?: CampaignCorpusFrame;
  time?: CampaignCorpusFrame;
};

const BANNER_CTA = { x: 848, y: 78, w: 200, h: 80, align: "left" } as const;
const POPUP_CTA = { x: 65, y: 929, w: 680, h: 120, align: "left" } as const;
const COMMUNITY_CTA = { x: 48.828, y: 368, w: 270, h: 90, align: "left" } as const;

/**
 * 财报季语料中各可见图层的原始画板坐标。
 * 隐藏的旧标题/时间实例没有录入；标签坐标保留贴边值，不额外加安全区。
 */
const EARNINGS_CORPUS_LAYOUTS: Record<string, Partial<Record<Lang, CampaignCorpusLayout>>> = {
  "mine-banner": {
    sc: {
      visual: { x: -123.177, y: -66.059, w: 561.177, h: 301.391 },
      copy: { x: 359, y: 74, w: 442.82, h: 117.999, align: "center" },
      cta: BANNER_CTA,
      tag: { x: 404, y: 0.028, w: 343.327, h: 49.336, align: "center" },
      time: { x: -28, y: 148, w: 360, h: 48, align: "center" },
    },
    tc: {
      visual: { x: -123.177, y: -68.059, w: 561.177, h: 301.391 },
      copy: { x: 355, y: 74, w: 442.82, h: 117.999, align: "center" },
      cta: BANNER_CTA,
      tag: { x: 404, y: 0.028, w: 343.327, h: 49.336, align: "center" },
      time: { x: -28, y: 148, w: 360, h: 48, align: "center" },
    },
    en: {
      visual: { x: -142.177, y: -68.059, w: 561.177, h: 301.391 },
      copy: { x: 304, y: 81.23, w: 499.01, h: 105.546, align: "center" },
      cta: BANNER_CTA,
      tag: { x: 347, y: -0.484, w: 412.439, h: 45.278, align: "center" },
      time: { x: -35.422, y: 144.92, w: 331.2, h: 44.16, align: "center" },
    },
    ja: {
      visual: { x: -136.177, y: -62.059, w: 561.177, h: 301.391 },
      copy: { x: 251, y: 52, w: 593.212, h: 137.787, align: "center" },
      cta: BANNER_CTA,
    },
  },
  "live-banner": {
    sc: {
      visual: { x: -123.177, y: -45.059, w: 561.177, h: 301.391 },
      copy: { x: 302, y: 71, w: 502.47, h: 117.999, align: "center" },
      cta: BANNER_CTA,
      tag: { x: 378, y: 0.028, w: 343.327, h: 49.336, align: "center" },
    },
    tc: {
      visual: { x: -123.177, y: -45.059, w: 561.177, h: 301.391 },
      copy: { x: 298, y: 71, w: 502.47, h: 117.999, align: "center" },
      cta: BANNER_CTA,
      tag: { x: 398, y: 0.028, w: 343.327, h: 49.336, align: "center" },
    },
    en: {
      visual: { x: -144.177, y: -45.059, w: 561.177, h: 301.391 },
      copy: { x: 292, y: 58.211, w: 518.07, h: 109.577, align: "center" },
      cta: BANNER_CTA,
    },
  },
  popup: {
    sc: {
      visual: { x: -285, y: 162, w: 1391.814, h: 747.5 },
      copy: { x: 63, y: 119, w: 683, h: 182, align: "center" },
      cta: POPUP_CTA,
      tag: { x: 170, y: 0, w: 470, h: 74, align: "center" },
      time: { x: 124, y: 832.7, w: 562.1, h: 50.6, align: "center" },
    },
    tc: {
      visual: { x: -285, y: 162, w: 1391.814, h: 747.5 },
      copy: { x: 63, y: 119, w: 683, h: 182, align: "center" },
      cta: POPUP_CTA,
      tag: { x: 169.828, y: 0, w: 470, h: 74, align: "center" },
      time: { x: 123, y: 832.7, w: 563.2, h: 50.6, align: "center" },
    },
    en: {
      visual: { x: -324.343, y: 115.293, w: 1484.872, h: 797.478 },
      copy: { x: 50.44, y: 107, w: 709.18, h: 150, align: "center" },
      cta: POPUP_CTA,
      tag: { x: 124, y: -0.472, w: 562.979, h: 61.804, align: "center" },
      time: { x: 85.008, y: 844.464, w: 640.361, h: 35.389, align: "center" },
    },
    ja: {
      visual: { x: -427, y: 99, w: 1687.814, h: 906.473 },
      copy: { x: -8, y: 84, w: 826, h: 203, align: "center" },
      cta: POPUP_CTA,
    },
  },
  "live-popup": {
    sc: {
      visual: { x: -377.186, y: 159, w: 1576.186, h: 846.52 },
      copy: { x: 39, y: 129, w: 733, h: 172.137, align: "center" },
      cta: POPUP_CTA,
      tag: { x: 170, y: 0, w: 470, h: 74, align: "center" },
    },
    tc: {
      visual: { x: -377.186, y: 159, w: 1576.186, h: 846.52 },
      copy: { x: 20, y: 128, w: 735, h: 172.606, align: "center" },
      cta: POPUP_CTA,
      tag: { x: 170, y: 0, w: 470, h: 74, align: "center" },
    },
    en: {
      visual: { x: -373.957, y: 161.499, w: 1584.098, h: 850.77 },
      copy: { x: 21, y: 115.87, w: 767.13, h: 162.26, align: "center" },
      cta: POPUP_CTA,
      tag: { x: 124, y: -0.472, w: 562.979, h: 61.804, align: "center" },
    },
  },
  community: {
    sc: {
      visual: { x: 298, y: -77, w: 1108.889, h: 595.55 },
      copy: { x: 47, y: 131, w: 630, h: 167.88, align: "left" },
      cta: COMMUNITY_CTA,
      tag: { x: -0.172, y: -0.836, w: 459, h: 70.033, align: "left" },
      time: { x: 555.76, y: 395.15, w: 485.45, h: 43.7, align: "center" },
    },
    tc: {
      visual: { x: 298, y: -77, w: 1108.889, h: 595.55 },
      copy: { x: 47, y: 131, w: 630, h: 167.88, align: "left" },
      cta: COMMUNITY_CTA,
      tag: { x: -0.172, y: -0.836, w: 459, h: 70.033, align: "left" },
      time: { x: 555.76, y: 395.15, w: 485.45, h: 43.7, align: "center" },
    },
    en: {
      visual: { x: 299, y: -84.217, w: 1138, h: 611.185 },
      copy: { x: 61, y: 102, w: 560, h: 239.518, align: "left" },
      cta: COMMUNITY_CTA,
      tag: { x: 0, y: -1, w: 600, h: 57, align: "left" },
      time: { x: 582.828, y: 408.838, w: 549, h: 43.7, align: "center" },
    },
    ja: {
      visual: { x: 347, y: -45.823, w: 1090.778, h: 585.823 },
      copy: { x: 150, y: 126.577, w: 549, h: 176.846, align: "left" },
      cta: COMMUNITY_CTA,
    },
  },
  activity: {
    sc: {
      visual: { x: 450.396, y: -78.138, w: 847.216, h: 455.013 },
      copy: { x: 1.828, y: 120, w: 698.347, h: 184, align: "left" },
      tag: { x: 2, y: 0, w: 431.452, h: 62, align: "left" },
      time: { x: 601.828, y: 241.838, w: 549, h: 43.7, align: "center" },
    },
    tc: {
      visual: { x: 450.396, y: -78.138, w: 847.216, h: 455.013 },
      copy: { x: 1.828, y: 120, w: 698.347, h: 184, align: "left" },
      tag: { x: 2, y: 0, w: 431.452, h: 62, align: "left" },
      time: { x: 601.828, y: 241.838, w: 549, h: 43.7, align: "center" },
    },
    en: {
      visual: { x: 450.396, y: -78.138, w: 847.216, h: 455.013 },
      copy: { x: 8.828, y: 96, w: 698, h: 208, align: "left" },
      tag: { x: 2, y: 0.905, w: 505, h: 55.445, align: "left" },
      time: { x: 601.828, y: 251.838, w: 549, h: 43.7, align: "center" },
    },
    ja: {
      visual: { x: 444, y: -82, w: 918.4, h: 493.244 },
      copy: { x: 147, y: 107.221, w: 545, h: 175.558, align: "left" },
    },
  },
};

function frameAnchor(frame: CampaignCorpusFrame, boardW: number, boardH: number) {
  const align = frame.align ?? "center";
  const x = align === "left" ? frame.x : align === "right" ? frame.x + frame.w : frame.x + frame.w / 2;
  return { x: x / boardW, y: (frame.y + frame.h / 2) / boardH, align };
}

function visualBaseHeight(slot: CampaignSlotDefinition) {
  if (slot.w / slot.h >= 3) return (419 / 225) * slot.h;
  if (slot.h / slot.w >= 1.2) return 0.8 * Math.min(slot.w, slot.h);
  return slot.h;
}

function groupBaseHeight(slot: CampaignSlotDefinition) {
  if (slot.w / slot.h >= 3) return (47 + 24) * 1.2 + 12;
  if (slot.h / slot.w >= 1.2) {
    const unit = Math.min(slot.w, slot.h);
    return (0.1 + 0.05) * unit * 1.2 + 0.02 * unit;
  }
  return (0.14 + 0.07) * slot.h * 1.2 + 0.03 * slot.h;
}

function badgeBaseHeight(slot: CampaignSlotDefinition, lang: Lang) {
  const geometry = lang === "en" ? 45.278 : 49.336;
  if (slot.w / slot.h >= 3) return geometry;
  const unit = slot.h / slot.w >= 1.2 ? Math.min(slot.w, slot.h) : slot.h;
  const titleFactor = slot.h / slot.w >= 1.2 ? 0.1 : 0.14;
  return geometry * (titleFactor / 47) * unit;
}

function customBaseHeight(slot: CampaignSlotDefinition) {
  const unit = slot.w / slot.h >= 3 ? slot.h : slot.h / slot.w >= 1.2 ? Math.min(slot.w, slot.h) : slot.h;
  const factor = slot.w / slot.h >= 3 ? 24 / 225 : slot.h / slot.w >= 1.2 ? 0.045 : 0.06;
  return factor * unit * 1.2;
}

export function campaignCorpusLayout(scenarioId: CampaignScenarioId, slotId: string, lang: Lang) {
  if (scenarioId !== "earnings-general") return undefined;
  return EARNINGS_CORPUS_LAYOUTS[slotId]?.[lang];
}

/** 将语料像素坐标换成场景引擎使用的锚点与比例。 */
export function campaignCorpusPlacements(
  scenario: CampaignScenarioDefinition,
  slot: CampaignSlotDefinition,
  lang: Lang,
): Record<string, ScenePlacementPatch> {
  const layout = campaignCorpusLayout(scenario.id, slot.id, lang);
  if (!layout) {
    const tag = scenario.hasEarningsTag && slot.tag && slot.tag !== "none"
      ? slot.tag === "left"
        ? { visible: true, x: 0.055, y: 0, align: "left" as const, follow: "none" as const, detached: true }
        : { visible: true, x: 0.5, y: slot.tag === "title" ? 0 : 0.075, align: "center" as const, follow: "none" as const, detached: true }
      : { visible: false, follow: "none" as const, detached: true };
    const time = slot.earningsTime
      ? slot.id === "poster-time"
        ? { visible: true, x: 0.5, y: 0.43, align: "center" as const, follow: "none" as const, detached: true }
        : slot.h > slot.w
          ? { visible: true, x: 0.5, y: 0.82, align: "center" as const, follow: "none" as const, detached: true }
          : { visible: true, x: 0.78, y: 0.86, align: "right" as const, follow: "none" as const, detached: true }
      : { visible: false, follow: "none" as const, detached: true };
    return { [CAMPAIGN_TAG_ID]: tag, [CAMPAIGN_TIME_ID]: time };
  }
  const visual = layout.visual;
  const copy = layout.copy;
  const tag = layout.tag;
  const time = layout.time;
  return {
    visual: {
      x: (visual.x + visual.w / 2) / slot.w,
      y: (visual.y + visual.h / 2) / slot.h,
      scale: visual.h / visualBaseHeight(slot),
      align: "center",
      visible: true,
    },
    titleGroup: {
      ...frameAnchor(copy, slot.w, slot.h),
      scale: copy.h / groupBaseHeight(slot),
      gap: 1,
      visible: true,
    },
    kicker: { visible: false, scale: 1 },
    title: { visible: true, scale: 1 },
    subtitle: { visible: true, scale: 1 },
    logo: { visible: false },
    cta: layout.cta
      ? { ...frameAnchor(layout.cta, slot.w, slot.h), scale: 1, visible: true }
      : { visible: false },
    [CAMPAIGN_TAG_ID]: tag
      ? {
        x: (tag.align === "left" ? tag.x : tag.align === "right" ? tag.x + tag.w : tag.x + tag.w / 2) / slot.w,
        y: tag.y / slot.h,
        align: tag.align ?? "center",
        scale: tag.h / badgeBaseHeight(slot, lang),
        follow: "none",
        detached: true,
        visible: true,
      }
      : { visible: false, detached: true, follow: "none" },
    [CAMPAIGN_TIME_ID]: time
      ? {
        ...frameAnchor(time, slot.w, slot.h),
        scale: time.h / customBaseHeight(slot),
        follow: "none",
        detached: true,
        visible: true,
      }
      : { visible: false, detached: true, follow: "none" },
  };
}

const CAMPAIGN_TIME_PREFIX: Partial<Record<Lang, string>> = {
  sc: "◷ 美东时间：",
  tc: "◷ 美東時間：",
  en: "◷ Eastern Time: ",
  ja: "◷ 米国東部時間：",
};

export function campaignTimeText(lang: Lang, value: string) {
  return `${CAMPAIGN_TIME_PREFIX[lang] ?? ""}${value}`;
}

export function campaignTimeValue(lang: Lang, text: string) {
  const prefix = CAMPAIGN_TIME_PREFIX[lang] ?? "";
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

export const CAMPAIGN_SCENARIOS: CampaignScenarioDefinition[] = [
  {
    id: "earnings-general",
    name: "财报通用素材与业绩直播",
    languages: ["sc", "tc", "en", "ja"],
    hasEarningsTag: true,
    hasEarningsTime: true,
    slots: [
      { id: "mine-banner", name: "我的 Banner", w: 1080, h: 225, baseSizeId: "a-mine", copyType: "earnings", tag: "title", earningsTime: true },
      { id: "live-banner", name: "业绩直播 Banner", w: 1080, h: 225, baseSizeId: "a-mine", languages: ["sc", "tc", "en"], copyType: "live", tag: "title" },
      { id: "popup", name: "弹窗", w: 810, h: 1110, baseSizeId: "a-popup", copyType: "earnings", tag: "center", earningsTime: true },
      { id: "live-popup", name: "业绩直播弹窗", w: 810, h: 1110, baseSizeId: "a-popup", languages: ["sc", "tc", "en"], copyType: "live", tag: "center" },
      { id: "community", name: "社区广场 Banner", w: 1080, h: 540, baseSizeId: "a-feed", copyType: "earnings", tag: "left", earningsTime: true },
      { id: "activity", name: "活动中心", w: 1080, h: 432, baseSizeId: "a-center", copyType: "earnings", tag: "left", earningsTime: true },
    ],
  },
  {
    id: "hk-stock-banner",
    name: "HK个股banner",
    languages: ["sc", "tc"],
    hasEarningsTag: true,
    hasEarningsTime: false,
    slots: [
      { id: "mine-banner", name: "我的 Banner", w: 1080, h: 225, baseSizeId: "a-mine", copyType: "hk", tag: "title" },
      { id: "popup", name: "弹窗", w: 810, h: 1110, baseSizeId: "a-popup", copyType: "hk", tag: "center" },
      { id: "level-one-tab", name: "一级 Tab 标签", w: 225, h: 69, copyType: "hk", tag: "none" },
    ],
  },
  {
    id: "stock-options",
    name: "个股业绩期权营销",
    languages: ["sc", "tc"],
    hasEarningsTag: false,
    hasEarningsTime: false,
    slots: [
      { id: "activity", name: "活动中心", w: 1080, h: 432, baseSizeId: "a-center", copyType: "options", tag: "none" },
      { id: "mine-banner", name: "我的 Banner", w: 1080, h: 225, baseSizeId: "a-mine", copyType: "options", tag: "none" },
      { id: "popup", name: "弹窗", w: 810, h: 1110, baseSizeId: "a-popup", copyType: "options", tag: "none" },
      { id: "poster", name: "头图 · 无时间", w: 750, h: 1034, copyType: "options", tag: "none" },
      { id: "poster-time", name: "头图 · 有时间", w: 750, h: 1034, copyType: "options", tag: "none", earningsTime: true },
      { id: "level-one-tab", name: "一级 Tab 标签", w: 225, h: 69, copyType: "options", tag: "none" },
    ],
  },
];

export const CAMPAIGN_LANG_LABELS: Record<Lang, string> = {
  sc: "简体",
  tc: "繁体",
  en: "英文",
  ja: "日语",
  th: "泰语",
};

export function campaignScenarioOf(id?: string) {
  return CAMPAIGN_SCENARIOS.find((item) => item.id === id);
}

export function campaignLangHint(languages: Lang[]) {
  const short: Record<Lang, string> = { sc: "简", tc: "繁", en: "英", ja: "日", th: "泰" };
  return languages.map((lang) => short[lang]).join("");
}

export function campaignTarget(scenario: CampaignScenarioDefinition, slot: CampaignSlotDefinition): TargetBoard {
  return {
    key: `campaign:${CAMPAIGN_PACK.id}:${scenario.id}:${slot.id}`,
    w: slot.w,
    h: slot.h,
    sizeId: slot.baseSizeId ?? `custom-campaign-${scenario.id}-${slot.id}`,
    use: slot.name,
  };
}

export function campaignSlotOfTargetKey(scenario: CampaignScenarioDefinition, targetKey: string) {
  return scenario.slots.find((slot) => campaignTarget(scenario, slot).key === targetKey);
}

export type CampaignCopyValue = { title: string; sub: string; cta: string; time: string };

export function campaignCopyVariants(): Record<CampaignCopyType, Record<Lang, CampaignCopyValue>> {
  const empty = { title: "", sub: "", cta: "", time: "" };
  return {
    earnings: {
      sc: { title: "聚焦公司财报", sub: "首次财报有哪些重点？", cta: "点击查看", time: "08/04 盘后" },
      tc: { title: "聚焦公司財報", sub: "首份財報有哪些重點？", cta: "點擊查看", time: "08/04 盤後" },
      en: { title: "Focus on Company Earnings", sub: "What Highlights in First Earnings?", cta: "View More", time: "August 4, After Market Close" },
      ja: { title: "企業決算に注目", sub: "今回の決算の注目点は？", cta: "詳細を見る", time: "8月4日 取引終了後" },
      th: empty,
    },
    live: {
      sc: { title: "公司业绩直播会", sub: "高管带你解读最新财报", cta: "预约直播", time: "" },
      tc: { title: "公司業績直播會", sub: "高管帶你解讀最新財報", cta: "預約直播", time: "" },
      en: { title: "Company Earnings Live", sub: "Management discusses the latest results", cta: "Reserve Now", time: "" },
      ja: empty,
      th: empty,
    },
    hk: {
      sc: { title: "公司业绩直播会", sub: "首次财报有哪些重点？", cta: "点击查看", time: "" },
      tc: { title: "公司業績直播會", sub: "首份財報有哪些重點？", cta: "點擊查看", time: "" },
      en: empty,
      ja: empty,
      th: empty,
    },
    options: {
      sc: { title: "特斯拉财报来袭", sub: "捕捉股价波动机会", cta: "点击查看", time: "08/04 盘后" },
      tc: { title: "特斯拉業績來襲", sub: "捕捉股價波動機會", cta: "點擊查看", time: "08/04 盤後" },
      en: empty,
      ja: empty,
      th: empty,
    },
  };
}

export function campaignCopies(project: Project, scenario: CampaignScenarioDefinition) {
  const variants = campaignCopyVariants();
  const primary = scenario.slots[0]?.copyType ?? "earnings";
  const text = variants[primary];
  const copy = { ...project.content.copy };
  scenario.languages.forEach((lang) => {
    const current = copy[lang] ?? emptyLangCopy();
    const initial = text[lang];
    copy[lang] = {
      ...current,
      title: initial.title,
      sub: initial.sub,
      ctaLong: initial.cta,
      ctaShort: initial.cta,
      badge: "",
    };
  });
  return { copy, text, variants };
}
