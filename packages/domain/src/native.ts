/**
 * 仿原生素材 —— 账户 tab 1080×225 的固定模板，不走主视觉延展。
 *
 * 版式参数取自 Figma「仿原生素材」37112:46645 与原生素材平台的同一套标注；
 * Web 预览与 Figma 写入都从 buildNativeBoard 取同一份图元，保证所见即所得。
 */

import type { Lang } from "./content";
import { SCENE_FONTS, type SceneFontOption } from "./scene";

export type NativeStyleId = "style-1" | "style-2";
export type NativeSkin = "light" | "dark";
export type NativeIconId = "speaker" | "topic" | "countdown" | "gift" | "hot";
export type NativeImageId = "img1" | "img2" | "img3" | "img4" | "img5" | "img6" | "img7";
export type NativeAppId = "moomoo" | "niuniu";

/** 字符下标区间（按 Array.from 计），左闭右开。 */
export interface NativeRun {
  start: number;
  end: number;
}

/** 样式 1：ICON + 副文案在上，主文案（可高亮）+ 按钮在下。 */
export interface NativeCopy1 {
  subtitle: string;
  title: string;
  /** 主文案里要高亮的文字，出现几处高亮几处；留空不高亮。 */
  mark: string;
  cta: string;
}

/** 样式 2：单行文案 + 文字按钮，右侧配图。 */
export interface NativeCopy2 {
  title: string;
  /** 文案里要高亮的文字，规则同样式 1。 */
  mark: string;
  cta: string;
}

/** 文字图层；样式 2 文字按钮按规范固定字体，不可换。 */
export type NativeTextRole = "s1-subtitle" | "s1-title" | "s1-cta" | "s2-title" | "s2-cta";

/** 字体按书写体系存：简繁共用 zh，其余按语种。 */
export type NativeScript = "zh" | "en" | "ja" | "th";

export interface NativeState {
  style: NativeStyleId;
  icon: NativeIconId;
  image: NativeImageId;
  copy1: Partial<Record<Lang, Partial<NativeCopy1>>>;
  copy2: Partial<Record<Lang, Partial<NativeCopy2>>>;
  /** SCENE_FONTS 的 id；未选时用模板默认字体。 */
  fonts?: Partial<Record<NativeTextRole, Partial<Record<NativeScript, string>>>>;
}

export const NATIVE_W = 1080;
export const NATIVE_H = 225;
export const NATIVE_HIGHLIGHT = "#FF6900";

export const NATIVE_STYLES: ReadonlyArray<{ id: NativeStyleId; name: string }> = [
  { id: "style-1", name: "样式 1" },
  { id: "style-2", name: "样式 2" },
];

export const NATIVE_SKINS: ReadonlyArray<{ id: NativeSkin; name: string }> = [
  { id: "dark", name: "深色" },
  { id: "light", name: "浅色" },
];

export const NATIVE_ICONS: ReadonlyArray<{ id: NativeIconId; name: string; url: string }> = [
  { id: "speaker", name: "喇叭", url: "/native/icons/speaker.svg" },
  { id: "topic", name: "话题", url: "/native/icons/topic.svg" },
  { id: "countdown", name: "倒计时", url: "/native/icons/countdown.svg" },
  { id: "gift", name: "礼盒", url: "/native/icons/gift.svg" },
  { id: "hot", name: "热门", url: "/native/icons/hot.svg" },
];

export const NATIVE_IMAGES: ReadonlyArray<{ id: NativeImageId; name: string }> = (["img1", "img2", "img3", "img4", "img5", "img6", "img7"] as const)
  .map((id, index) => ({ id, name: `配图 ${index + 1}` }));

export const nativeImageUrl = (id: NativeImageId, skin: NativeSkin) => `/native/style2/${id}-${skin}.png`;

export const NATIVE_CHEVRON_URL = "/native/icons/chevron-right.svg";

/** App 上线效果底图 1153×2557，banner 宽 1080、圆角 24 落在 (left, top)。 */
export const NATIVE_APPS: ReadonlyArray<{ id: NativeAppId; name: string; w: number; h: number; left: number; top: number }> = [
  { id: "moomoo", name: "Moomoo", w: 1153, h: 2557, left: 37, top: 567 },
  { id: "niuniu", name: "牛牛", w: 1153, h: 2557, left: 37, top: 627 },
];

export const nativeAppUrl = (app: NativeAppId, skin: NativeSkin) => `/native/preview/${app}-${skin}-blank.png`;

export function createNativeState(): NativeState {
  return { style: "style-1", icon: "speaker", image: "img3", copy1: {}, copy2: {} };
}

/** 默认文案取自 Figma 示例稿；日泰没有示例，留空待填。 */
const DEFAULT_COPY1: Partial<Record<Lang, NativeCopy1>> = {
  sc: { subtitle: "如何跟上反弹行情？", title: "科技指数连升30%+", mark: "连升30%+", cta: "立即查看" },
  tc: { subtitle: "如何跟上反彈行情？", title: "科技指數連升30%+", mark: "連升30%+", cta: "立即查看" },
  en: { subtitle: "Diversify Your Portfolio", title: "S-REITs with 6.3% Average Dividend", mark: "S-REITs", cta: "Learn More" },
};

const DEFAULT_COPY2: Partial<Record<Lang, NativeCopy2>> = {
  sc: { title: "为你生成一份专属调仓建议", mark: "", cta: "查看更多" },
  tc: { title: "為你生成一份專屬調倉建議", mark: "", cta: "查看更多" },
  en: { title: "TSLA Earnings Play: High-Vol Options Setup", mark: "", cta: "Explore" },
};

export function nativeCopy1(state: NativeState, lang: Lang): NativeCopy1 {
  const base = DEFAULT_COPY1[lang] ?? { subtitle: "", title: "", mark: "", cta: "" };
  const own = state.copy1[lang] as (Partial<NativeCopy1> & { runs?: NativeRun[] }) | undefined;
  const copy = { ...base, ...own };
  if (own?.mark === undefined && own?.runs) {
    const run = own.runs[0];
    copy.mark = run ? Array.from(copy.title).slice(run.start, run.end).join("") : "";
  }
  return { subtitle: copy.subtitle, title: copy.title, mark: copy.mark, cta: copy.cta };
}

/** 高亮文字在主文案里的每一处位置（按 Array.from 计）。 */
export function nativeMarkRuns(title: string, mark: string): NativeRun[] {
  const needle = mark.trim();
  if (!needle) return [];
  const runs: NativeRun[] = [];
  const length = Array.from(needle).length;
  let from = 0;
  for (let index = title.indexOf(needle); index >= 0; index = title.indexOf(needle, from)) {
    const start = Array.from(title.slice(0, index)).length;
    runs.push({ start, end: start + length });
    from = index + needle.length;
  }
  return runs;
}

export function nativeCopy2(state: NativeState, lang: Lang): NativeCopy2 {
  const base = DEFAULT_COPY2[lang] ?? { title: "", mark: "", cta: "" };
  return { ...base, ...state.copy2[lang] };
}

function markRuns(title: string, mark: string, issues: string[]) {
  if (mark.trim() && title.trim() && !title.includes(mark.trim())) issues.push("高亮文字不在文案里，不会高亮");
  return nativeMarkRuns(title, mark).map((run) => ({ ...run, color: NATIVE_HIGHLIGHT }));
}

/* ------------------------------------------------------------------ */
/* 图元                                                                */
/* ------------------------------------------------------------------ */

export interface NativeFont {
  family: string;
  style: string;
  /** 平台 fonts.css 里的 @font-face 别名；没有对应字体包时为空，预览退回系统字体。 */
  face?: string;
}

interface NativeBox {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface NativeTextStyle {
  font: NativeFont;
  size: number;
  /** 行高，px。 */
  lineHeight: number;
  /** 字间距，px。 */
  tracking: number;
  color: string;
}

export type NativeNode =
  | (NativeBox & { kind: "rect"; fill: string; radius?: number })
  | (NativeBox & { kind: "svg"; url: string })
  | (NativeBox & { kind: "image"; url: string })
  | ({ kind: "text"; name: string; x: number; y: number; w: number; text: string; wrap: boolean; runs: Array<NativeRun & { color: string }> } & NativeTextStyle)
  /** 胶囊按钮：文字在框内居中，再向下偏 dy。 */
  | (NativeBox & { kind: "pill"; fill: string; text: string; dy: number } & NativeTextStyle)
  /** 文字按钮：文字后跟箭头，整体垂直居中于 y + lineHeight / 2。 */
  | ({ kind: "link"; name: string; x: number; y: number; text: string; chevron: { url: string; size: number } } & NativeTextStyle);

export interface NativeBoard {
  w: number;
  h: number;
  style: NativeStyleId;
  skin: NativeSkin;
  lang: Lang;
  background: string;
  nodes: NativeNode[];
  issues: string[];
}

/** 按字体、字号、字间距量单行宽度；Web 用 canvas 实现，没有时不做溢出检查。 */
export type NativeMeasure = (text: string, style: Pick<NativeTextStyle, "font" | "size" | "tracking">) => number;

type Weight = "regular" | "medium" | "demibold";

/** 模板默认字体（SCENE_FONTS id）。泰语没有平台字体包，固定 Noto Sans Thai。 */
const DEFAULT_FONT_IDS: Record<"zh" | "en" | "ja", Record<Weight, string>> = {
  zh: { regular: "misans-regular", medium: "misans-medium", demibold: "misans-demibold" },
  en: { regular: "misans-regular", medium: "misans-medium", demibold: "misans-demibold" },
  ja: { regular: "mplus-regular", medium: "mplus-medium", demibold: "mplus-bold" },
};

const THAI_FONTS: Record<Weight, NativeFont> = {
  regular: { family: "Noto Sans Thai", style: "Regular" },
  medium: { family: "Noto Sans Thai", style: "Medium" },
  demibold: { family: "Noto Sans Thai", style: "SemiBold" },
};

export const NATIVE_TEXT_ROLE_LABEL: Record<NativeTextRole, string> = {
  "s1-subtitle": "副文案",
  "s1-title": "主文案",
  "s1-cta": "按钮文案",
  "s2-title": "文案",
  "s2-cta": "文字按钮",
};

export const nativeScript = (lang: Lang): NativeScript => (lang === "en" || lang === "ja" || lang === "th" ? lang : "zh");

/** 当前语种可选字体：中日文只能用含中日文字形的字体，英文全部可用，泰语不可换。 */
export function nativeFontOptions(lang: Lang): readonly SceneFontOption[] {
  const script = nativeScript(lang);
  if (script === "th") return [];
  return script === "en" ? SCENE_FONTS : SCENE_FONTS.filter((font) => font.script === "cjk");
}

function roleWeight(role: NativeTextRole, lang: Lang): Weight {
  const key = langKey(lang);
  if (role === "s1-title") return S1_LANG[key].titleWeight;
  if (role === "s1-cta") return S1_LANG[key].ctaWeight;
  if (role === "s2-title") return key === "en" ? "regular" : S2_LANG[key].titleWeight;
  return "regular";
}

export const nativeFontLocked = (role: NativeTextRole) => role === "s2-cta";

/** 图层当前字体 id；泰语返回 null。 */
export function nativeFontId(state: NativeState, role: NativeTextRole, lang: Lang): string | null {
  const script = nativeScript(lang);
  if (script === "th") return null;
  const chosen = nativeFontLocked(role) ? undefined : state.fonts?.[role]?.[script];
  if (chosen && nativeFontOptions(lang).some((font) => font.id === chosen)) return chosen;
  return DEFAULT_FONT_IDS[script][roleWeight(role, lang)];
}

export const nativeDefaultFontId = (role: NativeTextRole, lang: Lang) => nativeFontId(createNativeState(), role, lang);

function fontOf(state: NativeState, role: NativeTextRole, lang: Lang): NativeFont {
  const id = nativeFontId(state, role, lang);
  const font = id ? SCENE_FONTS.find((item) => item.id === id) : undefined;
  if (!font) return THAI_FONTS[roleWeight(role, lang)];
  return { family: font.family, style: font.style, face: font.face };
}

const SKIN1: Record<NativeSkin, { outer: string; inner: string; subtitle: string; title: string }> = {
  dark: { outer: "#1D1F21", inner: "#25282B", subtitle: "#9B9B9E", title: "#FFFFFF" },
  light: { outer: "#F2F3F5", inner: "#EBEBEB", subtitle: "#606266", title: "#0F1112" },
};

const SKIN2: Record<NativeSkin, { bg: string; title: string }> = {
  dark: { bg: "#0F1112", title: "#FFFFFF" },
  light: { bg: "#FFFFFF", title: "#0F1112" },
};

/**
 * 样式 1 公共几何（Figma Component 4/5/6）：下半区 y 87 高 138、圆角 20；ICON 38，x 40；
 * 主文案 x 44；按钮 200×80 在 (840, 115) 自动布局居中，字号 30、行高 40。
 */
const S1 = { innerY: 87, innerRadius: 20, padX: 40, icon: 38, titleX: 44, ctaX: 840, ctaY: 115, ctaW: 200, ctaH: 80, ctaFont: 30, ctaLineH: 40, ctaTracking: -0.6 };

/** 中英文取 Figma 文本框（行高为字体自动行高），ICON 与副文案垂直居中对齐；日泰没有 Figma 稿，沿用原生素材平台标注。 */
const S1_LANG = {
  zh: { iconTop: 28, iconGap: 10, subtitleTop: 23, subtitleSize: 36, subtitleLineH: 48, subtitleTracking: -0.36, titleTop: 131, titleSize: 40, titleLineH: 51, titleTracking: -0.4, titleMaxW: 772, titleWeight: "demibold", ctaWeight: "demibold", ctaDy: 0 },
  en: { iconTop: 25, iconGap: 10, subtitleTop: 19, subtitleSize: 36, subtitleLineH: 48, subtitleTracking: -0.36, titleTop: 131, titleSize: 40, titleLineH: 51, titleTracking: -0.4, titleMaxW: 772, titleWeight: "demibold", ctaWeight: "demibold", ctaDy: 0 },
  ja: { iconTop: 28, iconGap: 10, subtitleTop: 28, subtitleSize: 36, subtitleLineH: 38, subtitleTracking: -0.36, titleTop: 137, titleSize: 40, titleLineH: 40, titleTracking: -0.4, titleMaxW: 772, titleWeight: "medium", ctaWeight: "medium", ctaDy: 0 },
  th: { iconTop: 28, iconGap: 10, subtitleTop: 28, subtitleSize: 37, subtitleLineH: 38, subtitleTracking: -0.37, titleTop: 137, titleSize: 42, titleLineH: 42, titleTracking: -0.42, titleMaxW: 772, titleWeight: "medium", ctaWeight: "regular", ctaDy: 0 },
} as const satisfies Record<string, { titleWeight: Weight; ctaWeight: Weight } & Record<string, unknown>>;

/** 样式 2：左 30；配图 300×225 贴右；文字按钮灰 #828282 + 24 箭头。英文可两行，其余单行限字数。 */
const S2 = { padX: 30, imageW: 300, ctaColor: "#828282", chevron: 24 };

const S2_LANG = {
  zh: { titleTop: 60, titleSize: 44, maxChars: 17, ctaTop: 142, ctaSize: 34, titleWeight: "regular" },
  ja: { titleTop: 60, titleSize: 43, maxChars: 28, ctaTop: 142, ctaSize: 34, titleWeight: "medium" },
  th: { titleTop: 60, titleSize: 43, maxChars: 40, ctaTop: 142, ctaSize: 35, titleWeight: "medium" },
} as const satisfies Record<string, { titleWeight: Weight } & Record<string, unknown>>;

const S2_EN = { titleTopOne: 40, titleTopTwo: 9, titleSize: 47, lineHeight: 1.2, maxLines: 2, boxW: 780, ctaTop: 152, ctaSize: 38 };

const langKey = (lang: Lang) => (lang === "en" || lang === "ja" || lang === "th" ? lang : "zh");

export function nativeTitleLimit(lang: Lang) {
  const key = langKey(lang);
  return key === "en" ? null : S2_LANG[key].maxChars;
}

export function buildNativeBoard(state: NativeState, skin: NativeSkin, lang: Lang, measure?: NativeMeasure): NativeBoard {
  return state.style === "style-1" ? buildStyle1(state, skin, lang, measure) : buildStyle2(state, skin, lang, measure);
}

function buildStyle1(state: NativeState, skin: NativeSkin, lang: Lang, measure?: NativeMeasure): NativeBoard {
  const copy = nativeCopy1(state, lang);
  const colors = SKIN1[skin];
  const spec = S1_LANG[langKey(lang)];
  const icon = NATIVE_ICONS.find((item) => item.id === state.icon) ?? NATIVE_ICONS[0]!;
  const issues: string[] = [];
  const subtitleX = S1.padX + S1.icon + spec.iconGap;
  const subtitleMaxW = S1.ctaX - 24 - subtitleX;
  const subtitle: NativeTextStyle = { font: fontOf(state, "s1-subtitle", lang), size: spec.subtitleSize, lineHeight: spec.subtitleLineH, tracking: spec.subtitleTracking, color: colors.subtitle };
  const title: NativeTextStyle = { font: fontOf(state, "s1-title", lang), size: spec.titleSize, lineHeight: spec.titleLineH, tracking: spec.titleTracking, color: colors.title };
  const cta: NativeTextStyle = { font: fontOf(state, "s1-cta", lang), size: S1.ctaFont, lineHeight: S1.ctaLineH, tracking: S1.ctaTracking, color: "#FFFFFF" };

  if (!copy.subtitle.trim()) issues.push("副文案未填写");
  if (!copy.title.trim()) issues.push("主文案未填写");
  if (!copy.cta.trim()) issues.push("按钮文案未填写");
  const runs = markRuns(copy.title, copy.mark, issues);
  if (measure) {
    if (measure(copy.subtitle, subtitle) > subtitleMaxW) issues.push(`副文案超出 ${subtitleMaxW}px，会被按钮挡住`);
    if (measure(copy.title, title) > spec.titleMaxW) issues.push(`主文案超出 ${spec.titleMaxW}px，会被按钮挡住`);
    if (measure(copy.cta, cta) > S1.ctaW - 24) issues.push("按钮文案超出按钮宽度");
  }

  return {
    w: NATIVE_W,
    h: NATIVE_H,
    style: "style-1",
    skin,
    lang,
    background: colors.outer,
    issues,
    nodes: [
      { kind: "rect", name: "下半区底色", x: 0, y: S1.innerY, w: NATIVE_W, h: NATIVE_H - S1.innerY, fill: colors.inner, radius: S1.innerRadius },
      { kind: "svg", name: `ICON / ${icon.name}`, x: S1.padX, y: spec.iconTop, w: S1.icon, h: S1.icon, url: icon.url },
      { kind: "text", name: "副文案", x: subtitleX, y: spec.subtitleTop, w: subtitleMaxW, text: copy.subtitle, wrap: false, runs: [], ...subtitle },
      { kind: "text", name: "主文案", x: S1.titleX, y: spec.titleTop, w: spec.titleMaxW, text: copy.title, wrap: false, runs, ...title },
      { kind: "pill", name: "CTA", x: S1.ctaX, y: S1.ctaY, w: S1.ctaW, h: S1.ctaH, fill: NATIVE_HIGHLIGHT, text: copy.cta, dy: spec.ctaDy, ...cta },
    ],
  };
}

function buildStyle2(state: NativeState, skin: NativeSkin, lang: Lang, measure?: NativeMeasure): NativeBoard {
  const copy = nativeCopy2(state, lang);
  const colors = SKIN2[skin];
  const key = langKey(lang);
  const issues: string[] = [];
  if (!copy.title.trim()) issues.push("文案未填写");
  if (!copy.cta.trim()) issues.push("文字按钮未填写");
  const runs = markRuns(copy.title, copy.mark, issues);
  const image = { kind: "image" as const, name: "右侧配图", x: NATIVE_W - S2.imageW, y: 0, w: S2.imageW, h: NATIVE_H, url: nativeImageUrl(state.image, skin) };

  let titleNode: NativeNode;
  let ctaTop: number;
  let ctaSize: number;
  if (key === "en") {
    const style: NativeTextStyle = { font: fontOf(state, "s2-title", lang), size: S2_EN.titleSize, lineHeight: S2_EN.titleSize * S2_EN.lineHeight, tracking: 0, color: colors.title };
    const w = S2_EN.boxW - S2.padX;
    const lines = measure ? wrapLines(copy.title, style, w, measure) : copy.title.includes("\n") ? 2 : 1;
    if (lines > S2_EN.maxLines) issues.push(`文案超过 ${S2_EN.maxLines} 行`);
    titleNode = { kind: "text", name: "文案", x: S2.padX, y: lines > 1 ? S2_EN.titleTopTwo : S2_EN.titleTopOne, w, text: copy.title, wrap: true, runs, ...style };
    ctaTop = S2_EN.ctaTop;
    ctaSize = S2_EN.ctaSize;
  } else {
    const spec = S2_LANG[key];
    const style: NativeTextStyle = { font: fontOf(state, "s2-title", lang), size: spec.titleSize, lineHeight: spec.titleSize, tracking: 0, color: colors.title };
    const w = NATIVE_W - S2.padX - S2.imageW - 24;
    if (Array.from(copy.title).length > spec.maxChars) issues.push(`文案超过 ${spec.maxChars} 字`);
    else if (measure && measure(copy.title, style) > w) issues.push(`文案超出 ${w}px，会压到配图`);
    titleNode = { kind: "text", name: "文案", x: S2.padX, y: spec.titleTop, w, text: copy.title, wrap: false, runs, ...style };
    ctaTop = spec.ctaTop;
    ctaSize = spec.ctaSize;
  }

  return {
    w: NATIVE_W,
    h: NATIVE_H,
    style: "style-2",
    skin,
    lang,
    background: colors.bg,
    issues,
    nodes: [
      titleNode,
      { kind: "link", name: "文字按钮", x: S2.padX, y: ctaTop, text: copy.cta, chevron: { url: NATIVE_CHEVRON_URL, size: S2.chevron }, font: fontOf(state, "s2-cta", lang), size: ctaSize, lineHeight: ctaSize, tracking: 0, color: S2.ctaColor },
      image,
    ],
  };
}

/** 英文按词折行，返回行数；手动换行按段落分别计算。 */
function wrapLines(text: string, style: NativeTextStyle, width: number, measure: NativeMeasure) {
  return text.replace(/\r\n/g, "\n").trimEnd().split("\n").reduce((sum, paragraph) => {
    const words = paragraph.split(/(\s+)/).filter(Boolean);
    let lines = 1;
    let line = "";
    for (const word of words) {
      const next = line + word;
      if (line && !/^\s+$/.test(word) && measure(next.trimEnd(), style) > width) {
        lines += 1;
        line = word;
      } else {
        line = next;
      }
    }
    return sum + lines;
  }, 0);
}
