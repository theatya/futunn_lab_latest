/**
 * 内容模型 —— 一次活动要投放的所有文案与素材。
 *
 * 设计上和「版式」严格分开：内容变了不重新设计版式，版式变了不重打文案。
 * 求解器只读这里，不改这里。
 */

import type { MasterLayoutFingerprint, RecipeOverride, RecipeRole, RecipeTrace, RecipeTypography } from "./layout-recipe";
import type { SceneState } from "./scene";

export type Lang = "sc" | "tc" | "en" | "ja" | "th";

export const LANGS: ReadonlyArray<{ id: Lang; name: string }> = [
  { id: "sc", name: "简体" },
  { id: "tc", name: "繁体" },
  { id: "en", name: "英文" },
  { id: "ja", name: "日语" },
  { id: "th", name: "泰语" },
];

/** 英文按词拼回，其余按字。日语/泰语先按字标断点，以后再细。 */
export function langJoinsWithSpace(lang: Lang): boolean {
  return lang === "en";
}

export type Brand = "moomoo" | "futu";

/**
 * 免责声明的一段。字符串是普通文本，`{ nb }` 是**锁住不许拆开**的词组
 * （nb = non-breaking），比如 "Moomoo Financial Inc."、"Member FINRA/SIPC"。
 * 折行时这些片段整体移动。
 */
export type DisclaimerPart = string | { nb: string };

/** 主副标题谁在上。默认主标题在上。 */
export type TitleStack = "title-first" | "sub-first";

/** 一种可复用的主标题断行方案。断点是 token 下标。 */
export interface TitleBreakVariant {
  id: string;
  name: string;
  breaks: number[];
}

/** 第二步保存的完整文案排版方案；第三步确认交互后再接入尺寸分配。 */
export interface CopyLayoutPreset {
  id: string;
  name: string;
  /** 方案继承的母版 Frame，避免静默套到另一块母版。 */
  sourceFrameId?: string;
  /** 来自版本化语料库时，保存稳定方案 ID 以便追溯和刷新。 */
  corpusPresetId?: string;
  /** 推荐给用户看的简短原因；不参与求解。 */
  recommendationReason?: string;
  /** 机器推荐方案按分数排序，用户自建方案不写。 */
  recommendationScore?: number;
  corpusVersion?: string;
  recipeId?: string;
  fingerprintHash?: string;
  applicationState?: "recommended" | "applied" | "modified" | "blocked";
  overrides?: Partial<Record<RecipeRole, RecipeOverride>>;
  titleBreaks: number[];
  titleStack: TitleStack;
  titleGap?: number;
  /** CTA 与标题的位置不属于第二步；保留旧字段仅用于读取历史项目。 */
  actionGap?: number;
}

/** 第二步设定、后续画幅默认继承的四种 CTA 视觉样式。 */
export type CtaPresetId = "orange-gradient" | "brand-orange" | "champagne" | "black";

export interface CtaStyle {
  presetId?: CtaPresetId;
  backgroundColor: string;
  backgroundImage?: string;
  textColor: string;
}

export const CTA_STYLE_PRESETS: ReadonlyArray<{
  id: CtaPresetId;
  name: string;
  backgroundColor: string;
  backgroundImage?: string;
  defaultTextColor: string;
}> = [
  {
    id: "orange-gradient",
    name: "橙色渐变",
    backgroundColor: "#f06400",
    backgroundImage: "linear-gradient(90deg,#ff6626 0%,#f04700 100%)",
    defaultTextColor: "#ffffff",
  },
  { id: "brand-orange", name: "橙色实底", backgroundColor: "#ff6900", defaultTextColor: "#ffffff" },
  {
    id: "champagne",
    name: "香槟金",
    backgroundColor: "#ffe5c0",
    backgroundImage: "linear-gradient(90deg,#fff9ea 0%,#ffcf83 100%)",
    defaultTextColor: "#391a00",
  },
  { id: "black", name: "黑色实底", backgroundColor: "#121212", defaultTextColor: "#ffffff" },
];

export type BadgeAlignment = "left" | "center" | "right";

export interface BadgeStyle {
  presetId?: string;
  sizing?: "hug" | "fixed-short" | "fixed-long";
  alignment: BadgeAlignment;
  backgroundColor: string;
  textColor: string;
}

/** 单个画幅对某种语言主标题的选择。默认 auto，跟随求解器推荐。 */
export type TitleBreakChoice =
  | { mode: "auto" }
  | { mode: "variant"; variantId: string };

/** 一种语言下的全套文案 */
export interface LangCopy {
  /** 副标题，永远单行 */
  sub: string;
  /** 主副标题之外的可选补充标题 */
  supplement?: string;
  /**
   * 主标题原文。断行不交给引擎自由决定 —— 断在哪儿是有语义的，
   * 所以拆成 token 由人标断点。
   */
  title: string;
  /**
   * 允许断行的位置，值是 token 下标（断在第几个 token 之前）。
   * 空数组 = 永远不断行，装不下只能缩字号。
   */
  titleBreaks: number[];
  /** 系统自动推荐方案在界面里显示的名称。 */
  titleBreakDefaultName?: string;
  /** 设计师维护的可复用断行版本；未存时自动从 titleBreaks 兼容生成默认方案。 */
  titleBreakVariants?: TitleBreakVariant[];
  /** 主副标题上下顺序。未写则主标题在上。 */
  titleStack?: TitleStack;
  /** 按钮长版，空间够就用它 */
  ctaLong: string;
  /** 按钮短版，长版装不下时自动降级 */
  ctaShort: string;
  /** 角标，永远单行，装不下会报出来让人换短的 */
  badge: string;
  /** 免责声明，自由折行 */
  disclaimer: DisclaimerPart[];
}

export function emptyLangCopy(): LangCopy {
  return {
    sub: "",
    supplement: "",
    title: "",
    titleBreaks: [],
    ctaLong: "",
    ctaShort: "",
    badge: "",
    disclaimer: [],
  };
}

/** 新增语言时可直接开始编辑的初始文案；保留空值给尚未定义的语言。 */
export function initialLangCopy(lang: Lang): LangCopy {
  if (lang !== "ja") return emptyLangCopy();
  return {
    sub: "条件達成で必ずもらおう",
    supplement: "",
    title: "5万円分のNVIDIA株またはSpaceX株",
    titleBreaks: [13],
    ctaLong: "今すぐ参加",
    ctaShort: "今すぐ参加",
    badge: "",
    disclaimer: [],
  };
}

export function titleBreakVariantsOf(copy: LangCopy): TitleBreakVariant[] {
  return copy.titleBreakVariants?.length
    ? copy.titleBreakVariants
    : [{ id: "default", name: "自定义", breaks: copy.titleBreaks }];
}

export function titleBreakDefaultNameOf(copy: LangCopy): string {
  return copy.titleBreakDefaultName?.trim() || "默认方案";
}

export function titleStackOf(copy: LangCopy): TitleStack {
  return copy.titleStack ?? "title-first";
}

/** 素材从哪来。library = 品牌标准件；figma = 贴链接认组件；upload = 传图（只能当图） */
export type AssetSource = "library" | "figma" | "upload";
export type AssetKind = "component" | "image";
export type LogoPreset =
  | "moomoo"
  | "futu"
  | "moomooLight"
  | "futuLight"
  | "moomooWhite"
  | "futuWhite"
  | "futuNasdaq"
  | "moomooNasdaq"
  | "futuNasdaqLight"
  | "moomooNasdaqLight"
  | "custom";
export type LibraryLogoPreset = Exclude<LogoPreset, "custom">;
export type LogoSourceMode = "master" | "replace";

/** 素材引用。主路径是引用，不是上传 —— 求解器只决定它摆哪儿、缩多少，从不动它内部 */
export interface AssetRef {
  /** Figma 组件 key 或本地素材 id */
  id: string;
  name: string;
  /** 预览图 URL，可空（离线/未上传时） */
  previewUrl?: string;
  /** 主体框：不允许被裁掉的区域，0..1 相对坐标 */
  safeArea?: { x: number; y: number; w: number; h: number };
  source?: AssetSource;
  kind?: AssetKind;
  figmaUrl?: string;
  /** 母版画幅向外延展时使用的背景填充色。 */
  backgroundColor?: string;
}

/** 第三步可按目标画幅覆盖第二步的全局元素样式。 */
export interface FrameStyleOverride {
  ctaStyle?: CtaStyle;
  logo?: AssetRef;
  logoPreset?: LogoPreset;
  badgeStyle?: BadgeStyle;
  /** 当前目标画幅对训练配方的受约束调整；不污染同一配方在其他画幅的训练值。 */
  layoutOverrides?: Partial<Record<RecipeRole, RecipeOverride>>;
}

export interface Content {
  brand: Brand;
  /** 这次要出哪几种语言 */
  langs: Lang[];
  /** 各语言的文案，切语言不丢 */
  copy: Record<Lang, LangCopy>;
  kv?: AssetRef;
  /** 四步延展流程的画板场景：元素、族编辑、单板覆盖、高亮。 */
  scene?: SceneState;
  /** 没按语种单选时的默认二维码 */
  qrCode?: AssetRef;
  /** 各语言可使用不同二维码 */
  qrCodes?: Partial<Record<Lang, AssetRef>>;
  /** 识别阶段保留的业务自定义角色 */
  customMappings?: Partial<Record<Lang, Array<{ id: string; name: string; label: string; text: string }>>>;
  /** 没按语种单选时的默认 Logo */
  logo?: AssetRef;
  logoPreset?: LogoPreset;
  /** 各语言可以各用各的标。没写的语言退回 logo */
  logos?: Partial<Record<Lang, AssetRef>>;
  logoPresets?: Partial<Record<Lang, LogoPreset>>;
  /** 第二步默认沿用母版 Logo，只有明确替换时才展开选择器 */
  logoSourceModes?: Partial<Record<Lang, LogoSourceMode>>;
  /** 各语言相对母版的文案间距调整 */
  copyLayoutAdjustments?: Partial<Record<Lang, { titleGap?: number; actionGap?: number }>>;
  /** 第二步创建的可复用排版方案，按语言独立保存。 */
  copyLayoutPresets?: Partial<Record<Lang, CopyLayoutPreset[]>>;
  /** 第二步当前查看的方案；master 为忠实跟随母版，draft 为未保存调整。 */
  copyLayoutSelections?: Partial<Record<Lang, "master" | "draft" | string>>;
  /** 第三步为每个目标画幅指定第二步保存的排版方案；未指定即跟随母版。 */
  copyLayoutAssignments?: Partial<Record<Lang, Record<string, "master" | string>>>;
  /** 第一步确认后冻结的结构指纹；第二步不得重新猜测。 */
  masterLayoutFingerprints?: Partial<Record<Lang, MasterLayoutFingerprint>>;
  /** 第一阶段冻结的真实字体与富文本范围，写回时优先于语料示例文字样式。 */
  masterTextStyles?: Partial<Record<Lang, Partial<Record<"title" | "sub" | "cta" | "disc", RecipeTypography>>>>;
  /** 项目最后确认使用的语料版本，用于刷新和旧项目迁移。 */
  corpusVersion?: string;
  /** 各语言 CTA 的全局默认颜色；位置与间距仍由第三步按画幅处理。 */
  ctaStyles?: Partial<Record<Lang, CtaStyle>>;
  /** 各语言角标的全局默认样式。 */
  badgeStyles?: Partial<Record<Lang, BadgeStyle>>;
  /** 第三步按语言、画幅保存的元素样式覆盖。 */
  frameStyleOverrides?: Partial<Record<Lang, Record<string, FrameStyleOverride>>>;
  /** 「从现成板开始」贴的那块 Frame。多语种时以 sourceFrames 为准 */
  sourceFrame?: AssetRef;
  /** 同一版式、各语种各一块板 */
  sourceFrames?: Partial<Record<Lang, AssetRef>>;
  /** 每种语言 × 每个画幅的主标题断行覆盖。没有记录即系统自动推荐。 */
  titleBreakChoices?: Partial<Record<Lang, Record<string, TitleBreakChoice>>>;
}

export function resolvedLayoutRecipe(
  content: Content,
  lang: Lang,
  targetKey: string,
): RecipeTrace | undefined {
  const presetId = content.copyLayoutAssignments?.[lang]?.[targetKey];
  if (!presetId || presetId === "master") return undefined;
  const preset = content.copyLayoutPresets?.[lang]?.find((item) => item.id === presetId);
  if (!preset?.recipeId || !preset.corpusVersion) return undefined;
  const frameOverrides = content.frameStyleOverrides?.[lang]?.[targetKey]?.layoutOverrides;
  return {
    corpusVersion: preset.corpusVersion,
    recipeId: preset.recipeId,
    fingerprintHash: preset.fingerprintHash,
    overrides: {
      ...preset.overrides,
      ...frameOverrides,
    },
  };
}

export function titleBreakChoiceOf(content: Content, lang: Lang, targetKey: string): TitleBreakChoice {
  return content.titleBreakChoices?.[lang]?.[targetKey] ?? { mode: "auto" };
}

export function resolvedTitleBreaks(
  content: Content,
  lang: Lang,
  targetKey: string,
): { breaks: number[]; fixed: boolean; label: string; titleStack?: TitleStack; titleGap?: number } {
  const copy = content.copy[lang] ?? emptyLangCopy();
  const layoutId = content.copyLayoutAssignments?.[lang]?.[targetKey];
  if (layoutId && layoutId !== "master") {
    const preset = content.copyLayoutPresets?.[lang]?.find((item) => item.id === layoutId);
    const sourceFrame = sourceFrameOf(content, lang);
    const matchesSource = !preset?.sourceFrameId
      || !sourceFrame
      || preset.sourceFrameId === sourceFrame.id
      || preset.sourceFrameId.endsWith(`:${sourceFrame.id}`);
    if (preset && matchesSource) {
      return {
        breaks: preset.titleBreaks,
        fixed: true,
        label: preset.name,
        titleStack: preset.titleStack,
        titleGap: preset.titleGap,
      };
    }
  }
  const choice = titleBreakChoiceOf(content, lang, targetKey);
  if (choice.mode === "variant") {
    const variant = titleBreakVariantsOf(copy).find((item) => item.id === choice.variantId);
    if (variant) return { breaks: variant.breaks, fixed: true, label: variant.name };
  }
  return {
    breaks: copy.titleBreaks,
    fixed: false,
    label: titleBreakDefaultNameOf(copy),
    titleStack: copy.titleStack,
    titleGap: content.copyLayoutAdjustments?.[lang]?.titleGap,
  };
}

export function sourceFrameOf(content: Content, lang: Lang): AssetRef | undefined {
  return content.sourceFrames?.[lang] ?? (content.langs[0] === lang ? content.sourceFrame : undefined);
}

export function nextUnusedLang(used: readonly Lang[]): Lang | undefined {
  return LANGS.find((l) => !used.includes(l.id))?.id;
}

const LIBRARY_LOGOS: Record<LibraryLogoPreset, AssetRef> = {
  futu: { id: "logo-futu-dark", name: "富途牛牛 · 深色背景", previewUrl: "/brand/presets/futu-dark.svg", source: "library", kind: "component" },
  moomoo: { id: "logo-moomoo-dark", name: "moomoo · 深色背景", previewUrl: "/brand/presets/moomoo-dark.svg", source: "library", kind: "component" },
  futuLight: { id: "logo-futu-light", name: "富途牛牛 · 浅色背景", previewUrl: "/brand/presets/futu-light.svg", source: "library", kind: "component" },
  moomooLight: { id: "logo-moomoo-light", name: "moomoo · 浅色背景", previewUrl: "/brand/presets/moomoo-light.svg", source: "library", kind: "component" },
  futuWhite: { id: "logo-futu-white", name: "富途牛牛 · 纯白", previewUrl: "/brand/presets/futu-white.svg", source: "library", kind: "component" },
  moomooWhite: { id: "logo-moomoo-white", name: "moomoo · 纯白", previewUrl: "/brand/presets/moomoo-white.svg", source: "library", kind: "component" },
  futuNasdaq: { id: "logo-futu-nasdaq-dark", name: "富途牛牛 × Nasdaq · 深色背景", source: "library", kind: "component" },
  moomooNasdaq: { id: "logo-moomoo-nasdaq-dark", name: "moomoo × Nasdaq · 深色背景", source: "library", kind: "component" },
  futuNasdaqLight: { id: "logo-futu-nasdaq-light", name: "富途牛牛 × Nasdaq · 浅色背景", source: "library", kind: "component" },
  moomooNasdaqLight: { id: "logo-moomoo-nasdaq-light", name: "moomoo × Nasdaq · 浅色背景", source: "library", kind: "component" },
};

/** 闪屏底部白条里的 Logo（训练版 Logo 页「闪屏底部logo」），按品牌二选一，基准 150×58。 */
export const SPLASH_LOGOS = {
  futu: { id: "splash-logo-futu", name: "闪屏底部logo · 牛牛", url: "/brand/splash/futu.svg", w: 150, h: 59 },
  moomoo: { id: "splash-logo-moomoo", name: "闪屏底部logo · moomoo", url: "/brand/splash/moomoo.svg", w: 151, h: 59 },
} as const;

export function splashLogoOf(preset: LibraryLogoPreset) {
  return preset.startsWith("moomoo") ? SPLASH_LOGOS.moomoo : SPLASH_LOGOS.futu;
}

export function presetLogo(preset: LibraryLogoPreset): AssetRef {
  return { ...LIBRARY_LOGOS[preset] };
}

export function logoOf(content: Content, lang: Lang): AssetRef | undefined {
  return content.logos?.[lang] ?? content.logo;
}

function inferLogoPreset(logo: AssetRef | undefined, fallback?: LogoPreset): LogoPreset {
  if (logo?.source === "figma" || logo?.source === "upload") return "custom";
  const matched = (Object.entries(LIBRARY_LOGOS) as Array<[LibraryLogoPreset, AssetRef]>)
    .find(([, preset]) => preset.id === logo?.id);
  if (matched) return matched[0];
  if (logo?.id === "logo-futu-nasdaq") return "futuNasdaq";
  if (logo?.id === "logo-moomoo-nasdaq") return "moomooNasdaq";
  if (logo?.id === "logo-futu") return "futu";
  if (logo?.id === "logo-moomoo") return "moomoo";
  return fallback ?? "moomoo";
}

export function logoPresetOf(content: Content, lang?: Lang): LogoPreset {
  if (lang && content.logoPresets?.[lang]) return content.logoPresets[lang]!;
  return inferLogoPreset(lang ? logoOf(content, lang) : content.logo, content.logoPreset);
}

/** 只改这一种语言的 Logo，别的语言原样留下 */
export function withLangLogo(
  content: Content,
  lang: Lang,
  next: { preset: LogoPreset; logo?: AssetRef },
): Pick<Content, "logos" | "logoPresets" | "logo" | "logoPreset"> {
  const logo = next.preset === "custom" ? next.logo : presetLogo(next.preset);
  return {
    logos: { ...content.logos, [lang]: logo },
    logoPresets: { ...content.logoPresets, [lang]: next.preset },
    logo: content.logo ?? logo,
    logoPreset: content.logoPreset ?? next.preset,
  };
}

export function ctaStyleOf(content: Content, lang: Lang, targetKey?: string): CtaStyle | undefined {
  return (targetKey ? content.frameStyleOverrides?.[lang]?.[targetKey]?.ctaStyle : undefined)
    ?? content.ctaStyles?.[lang];
}

export function badgeStyleOf(content: Content, lang: Lang, targetKey?: string): BadgeStyle {
  return (targetKey ? content.frameStyleOverrides?.[lang]?.[targetKey]?.badgeStyle : undefined)
    ?? content.badgeStyles?.[lang]
    ?? { alignment: "left", backgroundColor: "#6a5a50", textColor: "#ffffff" };
}

export function frameLogoOf(content: Content, lang: Lang, targetKey?: string): AssetRef | undefined {
  return (targetKey ? content.frameStyleOverrides?.[lang]?.[targetKey]?.logo : undefined)
    ?? logoOf(content, lang);
}

/** 把主标题拆成 token。英文按空格，其余按字。 */
export function tokenizeTitle(title: string, lang: Lang): string[] {
  if (langJoinsWithSpace(lang)) return title.split(/\s+/).filter(Boolean);
  return Array.from(title);
}

/** token 拼回一行。英文补空格，其余不补。 */
export function joinTokens(tokens: string[], lang: Lang): string {
  return tokens.join(langJoinsWithSpace(lang) ? " " : "");
}

/** 免责声明拼成纯文本（用于测量总宽） */
export function disclaimerText(parts: DisclaimerPart[]): string {
  return parts.map((p) => (typeof p === "string" ? p : p.nb)).join("");
}
