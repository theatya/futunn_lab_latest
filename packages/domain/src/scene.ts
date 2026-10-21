/**
 * 画板场景模型 —— 四步延展流程的唯一数据源。
 *
 * 第三步按「族」编辑代表画幅，第四步按单块画板覆盖；
 * Web 预览与 Figma 写入都从 buildSceneBoard 取同一份结果，保证所见即所得。
 * 所有位置都是 0..1 的锚点坐标，尺寸按画板短边（竖版按宽）等比换算，不保存绝对字号。
 */

import type { CtaPresetId, Lang, LangCopy, LibraryLogoPreset } from "./content";
import { CTA_STYLE_PRESETS } from "./content";
import type { Solution } from "./layout";
import type { NativeState } from "./native";
import type { SizeAnchor, SizeLayout } from "./size";

export type SceneFamily = "strip" | "landscape" | "square" | "portrait";
/**
 * 第三步的编辑分组，族里的调整、文案与预设都按它存：自由排版的画板就是画幅族；
 * 站内/官网特殊规范按规范模板分组（`族@spec:模板`），闪屏母版单独一组（`族@splash`），
 * 其余有规范或首选对齐的按「画幅族 × 对齐」分组（`族@align:left`）。
 * 默认位置、字号系数仍按 @ 前的画幅族取。
 */
export type SceneBucket = string;
export type SceneRole = "visual" | "logo" | "badge" | "kicker" | "title" | "subtitle" | "custom" | "module" | "disclaimer" | "cta";
export type SceneAlign = "left" | "center" | "right";
export type SceneCustomPlacementMode = "title-backdrop" | "above-title" | "below-title" | "free";
export type SceneCustomBackdropTarget = "kicker" | "title" | "subtitle";
/** 与标题组外框对齐：none 时按自身锚点摆放。 */
export type SceneFollow = "none" | SceneAlign;
export type SceneCopyKind = "single" | "group" | "complex";
export type SceneCopyStructure = "single" | "kicker-title" | "title-sub" | "kicker-title-sub";
export type SceneFontScript = "latin" | "cjk";
export type SceneBadgeStyle = "style1" | "style2" | "style3" | "earnings";
export type SceneBadgeLength = "auto" | "short" | "long";

export interface ScenePlacement {
  x: number;
  y: number;
  scale: number;
  align: SceneAlign;
  visible: boolean;
  follow?: SceneFollow;
  /** 手动宽度，按画板单位长度（通栏/横版为高，方版/竖版为宽）存比例；对 CTA、可拉伸角标与自定义元素生效。 */
  w?: number;
  /** 层间距相对训练集默认值的倍数：标题组上为整组间距；小标题上为它与下一层的间距，副标题上为它与上一层的间距。 */
  gap?: number;
  /** CTA 字号相对默认值的倍数；规范锁定的 CTA 不生效。 */
  font?: number;
  /** CTA 预设长度，只用于无广告规范的画板；文案放不下时仍按文案加宽。 */
  length?: SceneCtaLength;
  /** 自定义元素在当前族或画板采用的放置模式。 */
  customMode?: SceneCustomPlacementMode;
  /** 标题底层模式对应的小标题、主标题或副标题。 */
  backdropTarget?: SceneCustomBackdropTarget;
  /** 单板明确解除从族继承的标题组编入关系。 */
  detached?: boolean;
  /** 编入标题组：位置跟标题组外框走，比例为相对标题组整体比例的倍数。 */
  attach?: SceneAttach;
  /** 标题组：族里选的对齐方式覆盖规范对齐（外框仍按规范锚点定位）。 */
  overSpec?: boolean;
  /** 规范锚点指向的外框边；与 align 不同时，按它定外框、按 align 排各行。 */
  edge?: SceneAlign;
  /** 标题组：从上到下的层序（含编入组的图层），缺省按 上方图层→小标题→主标题→副标题→下方图层。 */
  order?: string[];
  /**
   * 相对锚点的纵向偏移：标题组上单位为画板单位长度 × 整体比例（显示/隐藏成员时保持顶边不动、规范画板上在族里挪位置都记在这里），
   * 其它图层的偏移在代表画板有规范位置时记下，同组画板都按它挪，单位为画板单位长度。单板覆盖了 y 时不生效。
   */
  shift?: number;
  /** 相对锚点的横向偏移，规则同 shift。 */
  shiftX?: number;
}

/** 编入标题组的图层相对标题组的位置，单位为画板单位长度 × 标题组整体比例，跟标题组一起缩放。 */
export interface SceneAttach {
  /** 上方/下方的图层排进标题组的层序：在主标题上方时 dy 为与下一层的间距，下方时为与上一层的间距；并排时为与标题组的中心差。 */
  v: "above" | "below" | "beside";
  dy: number;
  /** 按自身对齐方式量的左/中/右边差。 */
  dx: number;
}

/** 可编入标题组的图层。 */
export const SCENE_ATTACH_ROLES: readonly SceneRole[] = ["logo", "badge", "disclaimer", "custom", "module"];

export type SceneCtaLength = "short" | "medium" | "long";

/** CTA 预设宽度，按按钮高度的倍数。 */
const CTA_LENGTH_FACTOR: Record<SceneCtaLength, number> = { short: 3.2, medium: 4.2, long: 5.4 };

export type ScenePlacementPatch = Partial<ScenePlacement>;
export type ScenePatchMap = Record<string, Record<string, ScenePlacementPatch>>;

export interface SceneHighlight {
  start: number;
  end: number;
  preset: string;
}

export interface SceneElement {
  id: string;
  role: SceneRole;
  name: string;
  visible: boolean;
  texts: Partial<Record<Lang, string>>;
  /** 从 Figma 节点导入的复合元素；与“自定义文字”走独立渲染和写入链路。 */
  module?: SceneCustomModule;
}

export interface SceneCustomModule {
  figmaUrl: string;
  fileKey: string;
  nodeId: string;
  nodeType: string;
  previewUrl?: string;
  width: number;
  height: number;
  /** 单个矩形允许宽高分别调整；复合节点只等比缩放。 */
  stretchable: boolean;
  /** 用户清除了来源链接，保留元素槽位等待重新识别。 */
  cleared?: boolean;
  placementMode: SceneCustomPlacementMode;
  /** 标题底层模式默认作用的文字层。 */
  backdropTarget?: SceneCustomBackdropTarget;
}

export interface SceneCustomModuleScopeSnapshot {
  visibility: Record<string, boolean>;
  removedScopes: string[];
}

/** 图片本身只存在 content.kv.previewUrl，这里只记元信息，避免本地存储里存两份大图。 */
export interface SceneUpload {
  name: string;
  width: number;
  height: number;
}

export interface SceneState {
  version: 1;
  visualMode: "figma" | "upload";
  uploadType: "png" | "jpg";
  upload?: SceneUpload;
  /** 主视觉组件宽高比，识别或上传后写入。 */
  visualAspect: number;
  /** 上传图片转组件时生成的四边过渡强度，0 = 关。Figma 组件自带暗角，不再叠加。 */
  feather: number;
  /** 主视觉焦点，组件内 0..1 坐标；延展时焦点落在元素锚点上。 */
  focal: { x: number; y: number };
  /** 主体不可裁区域，组件内 0..1 坐标。 */
  safeBox: { x: number; y: number; w: number; h: number };
  elements: SceneElement[];
  /** 下一个自定义元素编号；删除或跨语言隐藏后也不回收旧编号。 */
  nextModuleNumber?: number;
  familyEdits: ScenePatchMap;
  boardOverrides: ScenePatchMap;
  background: string;
  textColors: Record<string, string>;
  highlights: Record<string, Partial<Record<Lang, SceneHighlight[]>>>;
  /** 旧版两色自定义高亮，没有 customGradient 时据此换算。 */
  customHighlight: [string, string];
  customGradient?: SceneCustomGradient;
  /** 自定义纯色高亮（高亮预设 id 为 custom-solid）。 */
  customSolid?: string;
  logoPreset: LibraryLogoPreset;
  ctaPreset: CtaPresetId | "custom";
  ctaCustom?: SceneCtaCustom;
  /** 文字描边，按元素 id 存。 */
  strokes?: Record<string, SceneStroke>;
  /** 文案类型，未选择时第三步先引导选择。 */
  copyKind?: SceneCopyKind;
  copyStructure?: SceneCopyStructure;
  /** 元素字体覆盖，只能取 SCENE_FONTS 里的公司规范字体。 */
  fonts?: Record<string, Partial<Record<SceneFontScript, string>>>;
  /** 按语言独立的整层字体选择；日语不复用历史 CJK 通用字体。 */
  languageFonts?: Partial<Record<Lang, Record<string, string>>>;
  /** 第三步已「保存预设」的布局族，全部保存后才进入批量生成。 */
  savedFamilies?: SceneBucket[];
  /** 按基础语言分别记录已保存的版式族；旧 savedFamilies 仅作兼容回退。 */
  savedFamiliesByLanguage?: Partial<Record<Lang, SceneBucket[]>>;
  /** 选中的训练版式（去掉语言与对齐后的版式键，如「标题组｜小标题＋主标题两行」）。 */
  copyVariant?: string;
  /** 逐行字号比例，第 1 行为 1；取自训练集「主标题断行」的行比例。 */
  lineRatios?: Record<string, number[]>;
  /** 按版式族单独设置的逐行字号比例，优先于 lineRatios。 */
  familyLineRatios?: Partial<Record<SceneBucket, Record<string, number[]>>>;
  badgeStyle?: SceneBadgeStyle;
  /** 多角标实例各自的样式；badgeStyle 仅用于兼容旧项目。 */
  badgeStyles?: Record<string, SceneBadgeStyle>;
  badgeLength?: SceneBadgeLength;
  /** 字间距，按元素 id 存，单位为字号的比例（0.05 = 5%）。 */
  tracking?: Record<string, number>;
  /** 行间距（行高），按元素 id 存，单位为字号的倍数，缺省 SCENE_LINE_HEIGHT。 */
  leading?: Record<string, number>;
  /** 换行后第 2 行起单独设的行高 / 字间距，按元素 id、行号存，单位为该行字号的倍数；缺省跟整体。 */
  lineLeading?: Record<string, Record<number, number>>;
  lineTracking?: Record<string, Record<number, number>>;
  /** 用户解除了站内规范对 CTA 字号的锁定（宽高仍按规范）。 */
  ctaFontUnlocked?: boolean;
  /** 用户自定义版本（如「英文版2」「英文无 Logo 版」），基于某个语种，单独保存改过的文案、高亮与显隐。 */
  versions?: SceneVersion[];
  /** 基础语言各自的自定义元素来源与放置模式，避免刷新源元素时串改其它语言。 */
  languageModules?: Partial<Record<Lang, Record<string, SceneCustomModule>>>;
  /** 自定义元素应用到全部版式前的语言级范围快照，用于刷新后仍能精确撤销且不串语言。 */
  customModuleScopeSnapshots?: Partial<Record<Lang, Record<string, SceneCustomModuleScopeSnapshot>>>;
  /** 用户记录的文案版式方案，可套用到任意版式族。 */
  layoutSchemes?: SceneLayoutScheme[];
  /** 某个语言 / 自定义版本里隐藏的共享标题组方案 id；不删除来源方案。 */
  hiddenLayoutSchemes?: Record<string, string[]>;
  /** 基础语言的图层显隐隔离：语言 → 版式族或画板 key → 图层 id。 */
  languageVisibility?: Partial<Record<Lang, Record<string, Record<string, boolean>>>>;
  /** 基础语言里真正删除的图层：与“隐藏”分开，删除后图层栏和参数栏都不再显示。 */
  languageRemoved?: Partial<Record<Lang, Record<string, string[]>>>;
  /** 基础语言各自的版式参数；标题组方案、位置、比例等不跨语言串改。 */
  languageFamilyEdits?: Partial<Record<Lang, Partial<Record<SceneBucket, Record<string, ScenePlacementPatch>>>>>;
  /** 基础语言各自的单板精调参数。 */
  languageBoardOverrides?: Partial<Record<Lang, Record<string, Record<string, ScenePlacementPatch>>>>;
  /** 锁定的基础语言；锁定后该语言及其自定义版本不可编辑。 */
  lockedLanguages?: Lang[];
  /** 批量生成时跳过的基础语言；语言及内容仍完整保留、可继续编辑。 */
  hiddenLanguages?: Lang[];
  /** 局部字体：框选的字符区间换字体，按元素、语种存。 */
  fontRuns?: Record<string, Partial<Record<Lang, SceneFontRun[]>>>;
  /** 仿原生资源位的模板、ICON / 配图与各语种文案；不参与主视觉延展。 */
  native?: NativeState;
  /** 各版式族单独改过的文案、显隐与 Logo 样式，盖在通用内容上。 */
  familyContent?: Partial<Record<SceneBucket, SceneFamilyContent>>;
}

/** 版式族自己的内容：只存与通用内容不同的部分。 */
export interface SceneFamilyContent {
  texts?: Record<string, Partial<Record<Lang, string>>>;
  highlights?: Record<string, Partial<Record<Lang, SceneHighlight[]>>>;
  fontRuns?: Record<string, Partial<Record<Lang, SceneFontRun[]>>>;
  visibility?: Record<string, boolean>;
  logoPreset?: LibraryLogoPreset;
  copyKind?: SceneCopyKind;
  copyStructure?: SceneCopyStructure;
  copyVariant?: string;
  /** 只出现在视图里：该族内容已经叠过，再取视图时原样返回 */
  viewed?: true;
}

type LangMap<T> = Record<string, Partial<Record<Lang, T>>>;

function overlayLangMap<T>(base: LangMap<T> | undefined, top: LangMap<T> | undefined): LangMap<T> | undefined {
  if (!top) return base;
  const next = { ...base };
  for (const [id, langs] of Object.entries(top)) next[id] = { ...next[id], ...langs };
  return next;
}

/** 某个版式族看到的场景：通用内容叠上该族单独改过的文案、高亮、局部字体、显隐与 Logo 样式。 */
export function sceneFamilyView(scene: SceneState, family: SceneBucket, show?: readonly SceneRole[]): SceneState {
  const own = scene.familyContent?.[family];
  if (own?.viewed || (!own && !show?.length)) return scene;
  const elements = scene.elements.map((el) => {
    const texts = own?.texts?.[el.id];
    const visible = own?.visibility?.[el.id] ?? (show?.includes(el.role) && !el.visible ? true : undefined);
    if (!texts && visible === undefined) return el;
    return { ...el, ...(texts ? { texts: { ...el.texts, ...texts } } : {}), ...(visible !== undefined ? { visible } : {}) };
  });
  /** 已叠上的这一族内容在视图里换成标记，视图再取一次视图时不会把视图里的改动盖回去。 */
  const familyContent = { ...scene.familyContent, [family]: { viewed: true as const } };
  if (!own) return { ...scene, familyContent, elements };
  const fontRuns = overlayLangMap(scene.fontRuns, own.fontRuns);
  return {
    ...scene,
    familyContent,
    elements,
    highlights: overlayLangMap(scene.highlights, own.highlights) ?? {},
    ...(fontRuns ? { fontRuns } : {}),
    ...(own.logoPreset ? { logoPreset: own.logoPreset } : {}),
    ...(own.copyKind ? { copyKind: own.copyKind } : {}),
    ...(own.copyStructure ? { copyStructure: own.copyStructure } : {}),
    ...(own.copyVariant ? { copyVariant: own.copyVariant } : {}),
  };
}

/** 编辑器与批量生成共用：按语言、版式族、单板精调解析最终场景。 */
export function sceneLanguageBoardView(scene: SceneState, lang: Lang, board: SceneBoardRef, show?: readonly SceneRole[]): SceneState {
  const family = sceneBucketOf(board);
  /** 旧共享显隐只归简体；其它语言从角色默认显隐开始。 */
  let raw = scene;
  if (lang !== "sc") {
    const familyContent = { ...scene.familyContent };
    const own = familyContent[family];
    if (own?.visibility) {
      const { visibility: _visibility, ...rest } = own;
      if (Object.keys(rest).length) familyContent[family] = rest;
      else delete familyContent[family];
    }
    raw = {
      ...scene,
      familyContent,
      elements: scene.elements.map((el) => {
        const fallback = el.role === "custom" || el.role === "module" || el.role === "badge" || el.role === "disclaimer"
          ? false
          : sceneDefaultElement(el.role, 0).visible;
        return { ...el, visible: fallback };
      }),
    };
  }
  const familyEdit = raw.languageFamilyEdits?.[lang]?.[family];
  const boardEdit = raw.languageBoardOverrides?.[lang]?.[board.key];
  const languageModules = raw.languageModules?.[lang];
  const laid = sceneFamilyView({
    ...raw,
    elements: languageModules
      ? raw.elements.map((el) => languageModules[el.id] ? { ...el, module: languageModules[el.id] } : el)
      : raw.elements,
    familyEdits: familyEdit ? { ...raw.familyEdits, [family]: familyEdit } : raw.familyEdits,
    boardOverrides: boardEdit ? { ...raw.boardOverrides, [board.key]: boardEdit } : raw.boardOverrides,
  }, family, show);
  const applyVisibility = (current: SceneState, scope: string) => {
    const visibility = current.languageVisibility?.[lang]?.[scope];
    const removed = new Set(current.languageRemoved?.[lang]?.[scope] ?? []);
    if (!visibility && !removed.size) return current;
    return {
      ...current,
      elements: current.elements.filter((el) => !removed.has(el.id)).map((el) => {
        const value = visibility?.[el.id];
        return value === undefined ? el : { ...el, visible: value };
      }),
    };
  };
  return applyVisibility(applyVisibility(applyVisibility(laid, "*"), family), `board:${board.key}`);
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function langDiff<T>(next: LangMap<T> | undefined, base: LangMap<T> | undefined, empty: T): LangMap<T> | undefined {
  const out: LangMap<T> = {};
  for (const id of new Set([...Object.keys(next ?? {}), ...Object.keys(base ?? {})])) {
    for (const lang of new Set([...Object.keys(next?.[id] ?? {}), ...Object.keys(base?.[id] ?? {})]) as Set<Lang>) {
      const value = next?.[id]?.[lang] ?? empty;
      if (!sameJson(value, base?.[id]?.[lang] ?? empty)) out[id] = { ...out[id], [lang]: value };
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * 把在某个版式族视图里改出的结果写回：文案、高亮、局部字体、显隐、Logo 样式与版式选择只记到该族，
 * 新增的图层只在该族显示，删除只从该族移除；其余（位置、颜色、方案等）照常写入。
 */
export function sceneCommitFamily(raw: SceneState, family: SceneBucket, next: SceneState, show?: readonly SceneRole[]): SceneState {
  const nextById = new Map(next.elements.map((el) => [el.id, el]));
  const rawIds = new Set(raw.elements.map((el) => el.id));
  const texts: LangMap<string> = {};
  const visibility: Record<string, boolean> = {};
  const removed = new Set<string>();
  const elements: SceneElement[] = [];
  for (const base of raw.elements) {
    const el = nextById.get(base.id);
    if (!el) {
      removed.add(base.id);
      visibility[base.id] = false;
      elements.push(base);
      continue;
    }
    const moduleChanged = !sameJson(el.module, base.module);
    elements.push(el.name === base.name && !moduleChanged ? base : { ...base, name: el.name, ...(el.module ? { module: el.module } : {}) });
    const diff: Partial<Record<Lang, string>> = {};
    for (const lang of new Set([...Object.keys(el.texts), ...Object.keys(base.texts)]) as Set<Lang>) {
      const value = el.texts[lang];
      if (value !== undefined && value !== base.texts[lang]) diff[lang] = value;
    }
    if (Object.keys(diff).length) texts[base.id] = diff;
    if (el.visible !== (base.visible || Boolean(show?.includes(base.role)))) visibility[base.id] = el.visible;
  }
  /** 图层顺序跟视图走（越靠后越在上层）；视图里删掉的层留在原位置。 */
  const rank = new Map(next.elements.map((el, index) => [el.id, index]));
  const layered = elements.filter((el) => !removed.has(el.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
  raw.elements.forEach((base, index) => {
    if (removed.has(base.id)) layered.splice(Math.min(index, layered.length), 0, elements[index]!);
  });
  elements.splice(0, elements.length, ...layered);
  for (const el of next.elements) {
    if (rawIds.has(el.id)) continue;
    const nextRank = rank.get(el.id) ?? Number.MAX_SAFE_INTEGER;
    const insertAt = elements.findIndex((item) => (rank.get(item.id) ?? Number.MAX_SAFE_INTEGER) > nextRank);
    elements.splice(insertAt < 0 ? elements.length : insertAt, 0, { ...el, visible: false });
    if (el.visible) visibility[el.id] = true;
  }
  const own: SceneFamilyContent = {};
  if (Object.keys(texts).length) own.texts = texts;
  if (Object.keys(visibility).length) own.visibility = visibility;
  const highlights = langDiff<SceneHighlight[]>(next.highlights, raw.highlights, []);
  if (highlights) own.highlights = highlights;
  const fontRuns = langDiff<SceneFontRun[]>(next.fontRuns, raw.fontRuns, []);
  if (fontRuns) own.fontRuns = fontRuns;
  if (next.logoPreset !== raw.logoPreset) own.logoPreset = next.logoPreset;
  if (next.copyKind && next.copyKind !== raw.copyKind) own.copyKind = next.copyKind;
  if (next.copyStructure && next.copyStructure !== raw.copyStructure) own.copyStructure = next.copyStructure;
  if (next.copyVariant && next.copyVariant !== raw.copyVariant) own.copyVariant = next.copyVariant;
  const familyContent = { ...raw.familyContent };
  if (Object.keys(own).length) familyContent[family] = own;
  else delete familyContent[family];
  /** 自定义文字和自定义元素在所有版式族都删掉了才真正删除。 */
  const buckets = [...new Set([...SCENE_FAMILIES, ...Object.keys(familyContent)])];
  const shownSomewhere = (el: SceneElement) => buckets.some((item) => familyContent[item]?.visibility?.[el.id] ?? el.visible);
  const kept = elements.filter((el) => !(removed.has(el.id) && (el.role === "custom" || el.role === "module") && !shownSomewhere(el)));
  const result: SceneState = {
    ...next,
    elements: kept,
    highlights: raw.highlights,
    logoPreset: raw.logoPreset,
    familyContent,
  };
  if (raw.fontRuns) result.fontRuns = raw.fontRuns;
  else delete result.fontRuns;
  for (const key of ["copyKind", "copyStructure", "copyVariant"] as const) {
    if (raw[key] === undefined) delete result[key];
    else (result as unknown as Record<string, unknown>)[key] = raw[key];
  }
  if (kept.length !== elements.length) {
    for (const item of Object.keys(familyContent)) {
      const entry = familyContent[item];
      if (!entry?.visibility) continue;
      const map = Object.fromEntries(Object.entries(entry.visibility).filter(([id]) => kept.some((el) => el.id === id)));
      familyContent[item] = { ...entry, visibility: map };
    }
  }
  return result;
}

/** 该图层的文案（含高亮、局部字体）在这个版式族是否单独改过。 */
export function sceneFamilyCopyEdited(scene: SceneState, family: SceneBucket, id: string) {
  const own = scene.familyContent?.[family];
  return Boolean(own?.texts?.[id] || own?.highlights?.[id] || own?.fontRuns?.[id]);
}

function withoutCopy(own: SceneFamilyContent | undefined, id: string): SceneFamilyContent | undefined {
  if (!own) return own;
  const next: SceneFamilyContent = { ...own };
  for (const key of ["texts", "highlights", "fontRuns"] as const) {
    const map = next[key];
    if (!map?.[id]) continue;
    const rest = { ...map };
    delete rest[id];
    if (Object.keys(rest).length) (next as Record<string, unknown>)[key] = rest;
    else delete next[key];
  }
  return Object.keys(next).length ? next : undefined;
}

function setFamilyContent(scene: SceneState, recipe: (family: SceneBucket, own: SceneFamilyContent | undefined) => SceneFamilyContent | undefined): SceneState {
  const familyContent: Partial<Record<SceneBucket, SceneFamilyContent>> = {};
  for (const family of Object.keys(scene.familyContent ?? {})) {
    const own = recipe(family, scene.familyContent?.[family]);
    if (own) familyContent[family] = own;
  }
  return { ...scene, familyContent };
}

/** 该族改过的文案恢复成通用文案。 */
export function sceneResetFamilyCopy(scene: SceneState, family: SceneBucket, id: string): SceneState {
  return setFamilyContent(scene, (item, own) => item === family ? withoutCopy(own, id) : own);
}

/** 把该族这一层的文案（全部语种，含高亮、局部字体）设为通用文案，其它版式族的单独修改一并清掉。 */
export function sceneSyncCopyToAll(scene: SceneState, family: SceneBucket, id: string): SceneState {
  const view = sceneFamilyView(scene, family);
  const el = view.elements.find((item) => item.id === id);
  if (!el) return scene;
  const synced: SceneState = {
    ...scene,
    elements: scene.elements.map((item) => item.id === id ? { ...item, texts: el.texts } : item),
    highlights: { ...scene.highlights, [id]: view.highlights[id] ?? {} },
    ...(view.fontRuns?.[id] ? { fontRuns: { ...scene.fontRuns, [id]: view.fontRuns[id]! } } : {}),
  };
  return setFamilyContent(synced, (_, own) => withoutCopy(own, id));
}

/**
 * 把当前语言视图里的全部内容设成所有版式族的共同内容。
 * 只同步内容与模块显隐；familyEdits / boardOverrides 等排版数据完全不动。
 */
export function sceneSyncLanguageContentToAll(scene: SceneState, source: SceneState, lang: Lang): SceneState {
  const sourceById = new Map(source.elements.map((el) => [el.id, el]));
  const rawIds = new Set(scene.elements.map((el) => el.id));
  const elements = scene.elements.map((el) => {
    const from = sourceById.get(el.id);
    const text = from?.texts[lang];
    return text === undefined ? el : { ...el, texts: { ...el.texts, [lang]: text } };
  });
  for (const el of source.elements) {
    if (rawIds.has(el.id)) continue;
    elements.push({ ...el, visible: false, texts: { [lang]: el.texts[lang] ?? "" } });
  }
  const highlights = { ...scene.highlights };
  const fontRuns = { ...scene.fontRuns };
  for (const el of source.elements) {
    highlights[el.id] = { ...highlights[el.id], [lang]: source.highlights[el.id]?.[lang] ?? [] };
    const runs = source.fontRuns?.[el.id]?.[lang];
    if (runs) fontRuns[el.id] = { ...fontRuns[el.id], [lang]: runs };
    else if (fontRuns[el.id]?.[lang]) {
      const rest = { ...fontRuns[el.id] };
      delete rest[lang];
      if (Object.keys(rest).length) fontRuns[el.id] = rest;
      else delete fontRuns[el.id];
    }
  }
  const familyContent: SceneState["familyContent"] = {};
  for (const [key, own] of Object.entries(scene.familyContent ?? {})) {
    const next: SceneFamilyContent = { ...own };
    for (const field of ["texts", "highlights", "fontRuns"] as const) {
      const map = next[field];
      if (!map) continue;
      const cleaned = Object.fromEntries(Object.entries(map).flatMap(([id, langs]) => {
        const rest = { ...langs };
        delete rest[lang];
        return Object.keys(rest).length ? [[id, rest]] : [];
      }));
      if (Object.keys(cleaned).length) (next as Record<string, unknown>)[field] = cleaned;
      else delete next[field];
    }
    delete next.logoPreset;
    delete next.copyKind;
    delete next.copyStructure;
    delete next.copyVariant;
    if (Object.keys(next).length) familyContent[key] = next;
  }
  const ownVisibility = Object.fromEntries(source.elements.map((el) => [el.id, el.visible]));
  const languageScopes = Object.fromEntries(Object.entries(scene.languageVisibility?.[lang] ?? {}).filter(([key]) => key.startsWith("board:")));
  languageScopes["*"] = ownVisibility;
  return {
    ...scene,
    elements,
    highlights,
    ...(Object.keys(fontRuns).length ? { fontRuns } : {}),
    familyContent,
    logoPreset: source.logoPreset,
    copyKind: source.copyKind,
    copyStructure: source.copyStructure,
    copyVariant: source.copyVariant,
    languageVisibility: {
      ...scene.languageVisibility,
      [lang]: languageScopes,
    },
  };
}

/**
 * 标题组排版方案：把标题组的对齐、整体比例、层间距，各成员的比例与间距，以及逐行字号比例
 * 按实际生效值存下来（不论是否手动改过）。位置只用于缩略图，套用时不改目标版式族的位置。
 */
export interface SceneLayoutScheme {
  id: string;
  name: string;
  /** 创建方案时的语言，仅用于记录来源；同一项目内所有语言都可套用。 */
  lang?: Lang;
  /** 来源视图：基础语言用语言 id，自定义版本用版本 id。 */
  sourceKey?: string;
  sourceLabel?: string;
  /** 记录时所在的版式族与代表画幅，用于缩略图。 */
  family: SceneFamily;
  board: SceneBoardRef;
  group: Pick<ScenePlacement, "x" | "y" | "align" | "scale"> & { gap?: number; order?: string[] };
  members: Record<string, { scale: number; gap?: number }>;
  lineRatios: Record<string, number[]>;
  /** 编入标题组（或多选）一并记录的图层，如 Logo；套用时编入目标版式族的标题组。 */
  extras?: Record<string, SceneSchemeExtra>;
}

export interface SceneSchemeExtra {
  name: string;
  role?: SceneRole;
  /** 目标里已没有这个图层时，用它重建。 */
  texts?: Partial<Record<Lang, string>>;
  module?: SceneCustomModule;
  logoPreset?: LibraryLogoPreset;
  attach?: SceneAttach;
  align: SceneAlign;
  /** 有 attach 时为相对标题组整体比例的倍数；旧格式为图层自身比例。 */
  scale: number;
  w?: number;
  /** 旧格式：相对位置以标题组外框高度为单位。 */
  follow?: SceneFollow;
  v?: "above" | "below" | "beside";
  dy?: number;
  dx?: number;
}

export interface SceneFontRun {
  start: number;
  end: number;
  font: string;
}

const edgeX = (box: SceneBox, align: SceneAlign) => align === "left" ? box.x : align === "center" ? box.x + box.w / 2 : box.x + box.w;

/** 某个版式族里编入标题组的图层。 */
export function sceneAttachedIds(scene: SceneState, family: SceneBucket) {
  return scene.elements.filter((el) => SCENE_ATTACH_ROLES.includes(el.role) && scene.familyEdits[family]?.[el.id]?.attach).map((el) => el.id);
}

function attachBetween(group: SceneBox, box: SceneBox, align: SceneAlign, unit: number): SceneAttach {
  const v = box.y + box.h <= group.y ? "above" : box.y >= group.y + group.h ? "below" : "beside";
  const dy = v === "above" ? group.y - (box.y + box.h) : v === "below" ? box.y - (group.y + group.h) : (box.y + box.h / 2) - (group.y + group.h / 2);
  return { v, dy: round(dy / unit, 4), dx: round((edgeX(box, align) - edgeX(group, align)) / unit, 4) };
}

/** 按当前画面（或拖到的新位置）算出图层编入标题组的参数。 */
export function sceneAttachOf(
  scene: SceneState,
  board: SceneBoardRef,
  lang: Lang,
  id: string,
  at?: Partial<Pick<ScenePlacement, "x" | "y" | "align">>,
): { attach: SceneAttach; align: SceneAlign; scale: number } | null {
  const layout = layoutScene(scene, board, lang);
  const group = layout.group?.box;
  const laid = layout.laid.find((item) => item.el.id === id);
  if (!group || group.h <= 0 || !laid || !SCENE_ATTACH_ROLES.includes(laid.el.role)) return null;
  const placement = at ? { ...laid.placement, ...at } : laid.placement;
  const box = at ? sceneBox(scene, board, laid.el, placement, laid.metrics) : laid.box;
  const groupScale = resolveSceneGroup(scene, board).scale;
  return { attach: attachBetween(group, box, placement.align, unitOf(board) * groupScale), align: placement.align, scale: round(laid.placement.scale / groupScale, 2) };
}

/** 层序里的主标题位置（没有主标题时取第一层文字），在它上方的编入图层记为上方。 */
function groupPivot(roles: SceneRole[]) {
  const title = roles.indexOf("title");
  return title >= 0 ? title : roles.findIndex((role) => isSceneGroupRole(role));
}

/** 编组：把图层按当前位置编入该版式族的标题组，插进层序，与相邻层的间距保持画面上的样子。 */
export function sceneAttachToGroup(scene: SceneState, family: SceneBucket, board: SceneBoardRef, lang: Lang, ids: string[]): SceneState {
  const layout = layoutScene(scene, board, lang);
  if (!layout.group) return scene;
  const unit = unitOf(board) * resolveSceneGroup(scene, board).scale;
  const target = { ...scene.familyEdits[family] };
  const list = layout.group.stackIds.flatMap((id) => layout.laid.filter((item) => item.el.id === id));
  const fresh: string[] = [];
  for (const id of ids) {
    const found = sceneAttachOf(scene, board, lang, id);
    const laid = layout.laid.find((item) => item.el.id === id);
    if (!found || !laid) continue;
    const { x: _x, y: _y, follow: _follow, ...rest } = target[id] ?? {};
    target[id] = laid.el.role === "module"
      ? roundSceneModulePatch({ ...rest, ...found })
      : roundScenePatch({ ...rest, ...found });
    if (found.attach.v === "beside") continue;
    const center = laid.box.y + laid.box.h / 2;
    const at = list.findIndex((item) => item.box.y + item.box.h / 2 > center);
    list.splice(at < 0 ? list.length : at, 0, laid);
    fresh.push(id);
  }
  if (!fresh.length) return { ...scene, familyEdits: { ...scene.familyEdits, [family]: target } };
  const pivot = groupPivot(list.map((item) => item.el.role));
  const align = layout.group.align;
  for (const id of fresh) {
    const index = list.findIndex((item) => item.el.id === id);
    const item = list[index]!;
    const above = index < pivot;
    const neighbor = list[above ? index + 1 : index - 1];
    const space = neighbor ? (above ? neighbor.box.y - (item.box.y + item.box.h) : item.box.y - (neighbor.box.y + neighbor.box.h)) : 0;
    const dx = (edgeX(item.box, align) - edgeX(layout.group.box, align)) / unit;
    const patch = { ...target[id], align, attach: { ...target[id]!.attach!, v: above ? "above" as const : "below" as const, dy: Math.max(0, space) / unit, dx: round(dx, 4) } };
    target[id] = item.el.role === "module" ? roundSceneModulePatch(patch) : roundScenePatch(patch);
  }
  const shown = list.map((item) => item.el.id);
  const order = sceneGroupOrder({ ...scene, familyEdits: { ...scene.familyEdits, [family]: target } }, family).filter((id) => !fresh.includes(id));
  shown.forEach((id, index) => {
    if (!fresh.includes(id)) return;
    const before = shown.slice(0, index).reverse().find((item) => order.includes(item));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  });
  target[SCENE_GROUP_ID] = { ...target[SCENE_GROUP_ID], order };
  return { ...scene, familyEdits: { ...scene.familyEdits, [family]: target } };
}

/** 调整标题组层序：把一层移到另一层的前面或后面；编入组的图层按新位置记为主标题上方或下方，间距沿用。 */
export function sceneMoveInGroup(scene: SceneState, family: SceneBucket, id: string, targetId: string, place: "before" | "after"): SceneState {
  const order = sceneGroupOrder(scene, family);
  if (id === targetId || !order.includes(id) || !order.includes(targetId)) return scene;
  order.splice(order.indexOf(id), 1);
  order.splice(order.indexOf(targetId) + (place === "after" ? 1 : 0), 0, id);
  const pivot = groupPivot(order.map((item) => scene.elements.find((el) => el.id === item)?.role ?? "custom"));
  const target: Record<string, ScenePlacementPatch> = { ...scene.familyEdits[family], [SCENE_GROUP_ID]: { ...scene.familyEdits[family]?.[SCENE_GROUP_ID], order } };
  order.forEach((item, at) => {
    const attach = target[item]?.attach;
    if (attach && attach.v !== "beside") target[item] = { ...target[item], attach: { ...attach, v: at < pivot ? "above" : "below" } };
  });
  return { ...scene, familyEdits: { ...scene.familyEdits, [family]: target } };
}

/** 编入组图层的间距、偏移所用的单位（px）：画板单位长度 × 标题组整体比例。 */
export function sceneGroupUnit(scene: SceneState, board: SceneBoardRef) {
  return unitOf(board) * resolveSceneGroup(scene, board).scale;
}

/**
 * 把画面上的最终位置、比例换算成族里要存的调整值：比例去掉规范自带的倍数；
 * 规范给了位置的画板上，位置记成相对规范锚点的偏移（shiftX / shift）。编入标题组的图层不走这里。
 */
export function sceneFamilyPatch(scene: SceneState, board: SceneBoardRef, id: string, patch: ScenePlacementPatch): ScenePlacementPatch {
  const own = scene.familyEdits[sceneBucketOf(board)]?.[id];
  const isGroup = id === SCENE_GROUP_ID;
  const el = isGroup ? undefined : scene.elements.find((item) => item.id === id);
  if (!isGroup && !el) return patch;
  const resolved = isGroup ? resolveSceneGroup(scene, board) : resolveScenePlacement(scene, board, el!);
  const specScale = isGroup ? specGroupScale(board) : (specPosition(scene, board, el!.role)?.scale ?? 1);
  const positioned = !board.layout?.soft && (isGroup ? Boolean(board.layout?.group) : Boolean(specPosition(scene, board, el!.role)));
  const next: ScenePlacementPatch = { ...patch };
  if (patch.scale !== undefined) next.scale = patch.scale / specScale;
  const u = unitOf(board) * (isGroup ? (patch.scale ?? resolved.scale) : 1);
  /** 规范画板上换对齐不挪锚点（对齐只决定从锚点往哪边排）。 */
  if (positioned && patch.align !== undefined) delete next.x;
  else if (patch.x !== undefined) {
    if (positioned) {
      delete next.x;
      next.shiftX = (own?.shiftX ?? 0) + ((patch.x - resolved.x) * board.w) / u;
    } else if (isGroup && own?.shiftX) next.shiftX = 0;
  }
  if (patch.y !== undefined) {
    if (positioned) {
      delete next.y;
      next.shift = (own?.shift ?? 0) + ((patch.y - resolved.y) * board.h) / u;
    } else if (isGroup && own?.shift) next.shift = 0;
  }
  return next;
}

/**
 * 取消编组：图层留在当前位置，回到自己的锚点（规范给了位置的回到规范位置）。
 * 留在两层文字之间的，把那两层的间距留成现在的样子，文字不挪。
 */
export function sceneDetachFromGroup(scene: SceneState, family: SceneBucket, board: SceneBoardRef, lang: Lang, ids: string[]): SceneState {
  const layout = layoutScene(scene, board, lang);
  const target = { ...scene.familyEdits[family] };
  const stays = new Set<string>();
  for (const id of ids) {
    const entry = target[id];
    if (!entry?.attach) continue;
    const { attach: _attach, ...rest } = entry;
    const laid = layout.laid.find((item) => item.el.id === id);
    const specScale = laid ? specPosition(scene, board, laid.el.role)?.scale ?? 1 : 1;
    const patch = laid
      ? { ...rest, x: laid.placement.x, y: laid.placement.y, align: laid.placement.align, scale: laid.placement.scale / specScale, follow: "none" as const }
      : rest;
    target[id] = laid?.el.role === "module" ? roundSceneModulePatch(patch) : roundScenePatch(patch);
    const placed = laid ? resolveScenePlacement({ ...scene, familyEdits: { ...scene.familyEdits, [family]: target } }, board, laid.el) : null;
    if (laid && placed && Math.abs(placed.y - laid.placement.y) < 1e-3) stays.add(id);
  }
  const stack = (layout.group?.stackIds ?? []).flatMap((id) => layout.laid.filter((item) => item.el.id === id));
  const kept = stack.filter((item) => !ids.includes(item.el.id) && isSceneGroupRole(item.el.role));
  const baseGap = sceneGroupBaseGap(board) * resolveSceneGroup(scene, board).scale;
  kept.slice(1).forEach((lower, index) => {
    const upper = kept[index]!;
    const between = stack.slice(stack.indexOf(upper) + 1, stack.indexOf(lower));
    if (!between.length || !baseGap || between.some((item) => !stays.has(item.el.id))) return;
    const gap = (lower.box.y - (upper.box.y + upper.box.h)) / baseGap;
    if (lower.el.role === "subtitle") target[lower.el.id] = roundScenePatch({ ...target[lower.el.id], gap });
    else if (upper.el.role === "kicker") target[upper.el.id] = roundScenePatch({ ...target[upper.el.id], gap });
  });
  return { ...scene, familyEdits: { ...scene.familyEdits, [family]: target } };
}

/**
 * 记录方案：标题组的对齐（画板上实际生效的）、整体比例、层间距、成员比例与逐行字号，
 * 以及编入标题组的图层（另可传入多选的图层，按当前位置一并记录）。
 */
export function captureSceneLayoutScheme(scene: SceneState, family: SceneBucket, board: SceneBoardRef, lang: Lang, id: string, name: string, extraIds: string[] = []): SceneLayoutScheme {
  const resolved = resolveSceneGroup(scene, board);
  const groupEdit = scene.familyEdits[family]?.[SCENE_GROUP_ID];
  const group = {
    x: resolved.x,
    y: resolved.y,
    align: resolved.align,
    scale: groupEdit?.scale ?? 1,
    ...(groupEdit?.gap !== undefined ? { gap: groupEdit.gap } : {}),
    order: sceneGroupOrder(scene, family),
  };
  const extras: Record<string, SceneSchemeExtra> = {};
  for (const elId of new Set([...sceneAttachedIds(scene, family), ...extraIds])) {
    const el = scene.elements.find((item) => item.id === elId);
    if (!el || !SCENE_ATTACH_ROLES.includes(el.role)) continue;
    const placement = resolveScenePlacement(scene, board, el);
    if (!placement.visible) continue;
    const entry = scene.familyEdits[family]?.[elId];
    const found = entry?.attach ? { attach: entry.attach, align: placement.align, scale: entry.scale ?? 1 } : sceneAttachOf(scene, board, lang, elId);
    if (!found) continue;
    extras[elId] = {
      name: el.name,
      role: el.role,
      ...(el.role === "logo"
        ? { logoPreset: scene.logoPreset }
        : el.role === "module"
          ? { module: el.module }
          : { texts: { [lang]: el.texts[lang] ?? "" } }),
      ...found,
      ...(entry?.w !== undefined ? { w: entry.w } : {}),
    };
  }
  const members: SceneLayoutScheme["members"] = {};
  const lineRatios: SceneLayoutScheme["lineRatios"] = {};
  for (const el of scene.elements.filter((item) => isSceneGroupRole(item.role))) {
    const own = scene.familyEdits[family]?.[el.id];
    members[el.id] = { scale: own?.scale ?? 1, ...(own?.gap !== undefined ? { gap: own.gap } : {}) };
    const ratios = scene.familyLineRatios?.[family]?.[el.id] ?? scene.lineRatios?.[el.id];
    if (ratios) lineRatios[el.id] = [...ratios];
  }
  return {
    id,
    name,
    lang,
    family: sceneBucketFamily(family),
    board: { key: board.key, w: board.w, h: board.h, ...(board.ctaSpec ? { ctaSpec: board.ctaSpec } : {}) },
    group,
    members,
    lineRatios,
    ...(Object.keys(extras).length ? { extras } : {}),
  };
}

/**
 * 把方案的排版（对齐、比例、间距、逐行字号）套到某个版式族的标题组；成员缺省的项回到自动值。
 * 方案的对齐优先于规范对齐。位置不跟方案走：传 position 时用它（换对齐后保持原区域的锚点），否则保留原来的位置。
 */
export function applySceneLayoutScheme(scene: SceneState, scheme: SceneLayoutScheme, family: SceneBucket, position?: { x: number; y: number }): SceneState {
  const target = { ...scene.familyEdits[family] };
  const groupEntry: ScenePlacementPatch = { ...target[SCENE_GROUP_ID], ...position, align: scheme.group.align, scale: scheme.group.scale, overSpec: true };
  if (scheme.group.gap !== undefined) groupEntry.gap = scheme.group.gap;
  else delete groupEntry.gap;
  if (scheme.group.order) groupEntry.order = [...scheme.group.order];
  else delete groupEntry.order;
  target[SCENE_GROUP_ID] = roundScenePatch(groupEntry);
  const ratios = { ...scene.familyLineRatios?.[family] };
  for (const el of scene.elements.filter((item) => isSceneGroupRole(item.role))) {
    const member = scheme.members[el.id];
    const entry: ScenePlacementPatch = { ...target[el.id] };
    delete entry.scale;
    delete entry.gap;
    if (member && member.scale !== 1) entry.scale = member.scale;
    if (member?.gap !== undefined) entry.gap = member.gap;
    if (Object.keys(entry).length) target[el.id] = roundScenePatch(entry);
    else delete target[el.id];
    if (scheme.lineRatios[el.id]) ratios[el.id] = [...scheme.lineRatios[el.id]!];
    else delete ratios[el.id];
  }
  return {
    ...scene,
    familyEdits: { ...scene.familyEdits, [family]: target },
    familyLineRatios: { ...scene.familyLineRatios, [family]: ratios },
  };
}

/**
 * 完整套用方案：标题组排版，加上方案里的图层——没有就重建，显示出来、编入标题组，Logo 换成方案里的样式。
 * 传入的 scene 应是该版式族的视图，显隐与 Logo 样式经 sceneCommitFamily 只记到该族。
 */
export function applySceneScheme(scene: SceneState, scheme: SceneLayoutScheme, family: SceneBucket, board: SceneBoardRef, lang: Lang, position?: { x: number; y: number }): SceneState {
  const next = applySceneLayoutScheme(scene, scheme, family, position);
  const extras = Object.entries(scheme.extras ?? {});
  let elements = [...next.elements];
  const target = { ...next.familyEdits[family] };
  let logoPreset = next.logoPreset;
  let legacy: { unit: number; groupScale: number } | null = null;
  for (const [id, extra] of extras) {
    let index = elements.findIndex((el) => el.id === id);
    if (index < 0) {
      if (!extra.role) continue;
      const fresh = sceneDefaultElement(extra.role, elements.filter((el) => el.role === "custom").length + 1);
      elements.push({
        ...fresh,
        id,
        name: extra.name,
        ...(extra.texts ? { texts: { ...extra.texts } } : {}),
        ...(extra.module ? { module: extra.module } : {}),
      });
      index = elements.length - 1;
    }
    const el = elements[index]!;
    if (!SCENE_ATTACH_ROLES.includes(el.role)) continue;
    elements[index] = { ...el, visible: true };
    let attach = extra.attach;
    let scale = extra.scale;
    if (!attach) {
      if (!legacy) {
        const laid = layoutScene({ ...next, elements }, board, lang);
        const groupScale = resolveSceneGroup(next, board).scale;
        legacy = { unit: (laid.group?.box.h ?? 0) / (unitOf(board) * groupScale), groupScale };
      }
      if (!extra.v || extra.dy === undefined || extra.dx === undefined || !legacy.unit) continue;
      attach = { v: extra.v, dy: round(extra.dy * legacy.unit, 4), dx: round(extra.dx * legacy.unit, 4) };
      scale = extra.scale / legacy.groupScale;
    }
    const { x: _x, y: _y, follow: _follow, w: _w, ...rest } = target[id] ?? {};
    const patch = { ...rest, attach, align: extra.align, scale, ...(extra.w !== undefined ? { w: extra.w } : {}) };
    target[id] = el.role === "module" ? roundSceneModulePatch(patch) : roundScenePatch(patch);
    if (el.role === "logo" && extra.logoPreset) logoPreset = extra.logoPreset;
  }
  return { ...next, elements, logoPreset, familyEdits: { ...next.familyEdits, [family]: target } };
}

/** 版式族当前是否就是这套方案：标题组排版一致，方案里的图层都显示并按方案编入标题组。 */
export function sceneLayoutSchemeMatches(scene: SceneState, scheme: SceneLayoutScheme, family: SceneBucket, board: SceneBoardRef) {
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-3;
  const edits = scene.familyEdits[family] ?? {};
  const groupEdit = edits[SCENE_GROUP_ID];
  const sameGroup = resolveSceneGroup(scene, board).align === scheme.group.align
    && close(groupEdit?.scale ?? 1, scheme.group.scale)
    && (groupEdit?.gap ?? 1) === (scheme.group.gap ?? 1);
  if (!sameGroup) return false;
  if (scheme.group.order) {
    const now = sceneGroupOrder(scene, family);
    const common = scheme.group.order.filter((id) => now.includes(id));
    if (!sameJson(common, now.filter((id) => common.includes(id)))) return false;
  }
  for (const el of scene.elements.filter((item) => isSceneGroupRole(item.role))) {
    const member = scheme.members[el.id];
    const own = edits[el.id];
    if (!close(own?.scale ?? 1, member?.scale ?? 1) || own?.gap !== member?.gap) return false;
    const ratios = scene.familyLineRatios?.[family]?.[el.id] ?? scene.lineRatios?.[el.id];
    if (!sameJson(ratios, scheme.lineRatios[el.id] ?? scene.lineRatios?.[el.id])) return false;
  }
  return Object.entries(scheme.extras ?? {}).every(([id, extra]) => {
    const el = scene.elements.find((item) => item.id === id);
    const entry = edits[id];
    if (!el?.visible || !entry?.attach) return false;
    if (el.role === "logo" && extra.logoPreset && extra.logoPreset !== scene.logoPreset) return false;
    if (!extra.attach) return entry.align === extra.align;
    return entry.attach.v === extra.attach.v && close(entry.attach.dx, extra.attach.dx) && close(entry.attach.dy, extra.attach.dy)
      && close(entry.scale ?? 1, extra.scale) && entry.align === extra.align;
  });
}

/** 旧格式（只记手动改动）的方案无法还原版式，读取时丢弃。 */
export function sceneLayoutSchemes(scene: SceneState) {
  return (scene.layoutSchemes ?? []).filter((item) => Boolean(item.group && item.board));
}

export interface SceneVersion {
  id: string;
  name: string;
  lang: Lang;
  /** 从基础语言或其它版本复制出的独立副本，不受来源语言锁定影响。 */
  independent?: boolean;
  /** 独立版本自己的锁定与批量生成显隐状态。 */
  locked?: boolean;
  hidden?: boolean;
  texts?: Record<string, string>;
  highlights?: Record<string, SceneHighlight[]>;
  fontRuns?: Record<string, SceneFontRun[]>;
  visibility?: Record<string, boolean>;
  modules?: Record<string, SceneCustomModule>;
  familyEdits?: ScenePatchMap;
  boardOverrides?: ScenePatchMap;
  removed?: string[];
  badgeStyles?: Record<string, SceneBadgeStyle>;
}

/** 把自定义版本叠到场景上：版本里改过的文案、高亮、显隐覆盖基础语种，其余沿用。 */
export function sceneVersionView(scene: SceneState, version?: SceneVersion | null): SceneState {
  if (!version) return scene;
  const highlights = { ...scene.highlights };
  const fontRuns = { ...scene.fontRuns };
  const removed = new Set(version.removed ?? []);
  const elements = scene.elements.filter((el) => !removed.has(el.id)).map((el) => {
    const text = version.texts?.[el.id];
    const visible = version.visibility?.[el.id];
    const module = version.modules?.[el.id];
    if (text !== undefined || version.highlights?.[el.id]) {
      highlights[el.id] = { ...highlights[el.id], [version.lang]: version.highlights?.[el.id] ?? [] };
    }
    if (text !== undefined || version.fontRuns?.[el.id]) {
      fontRuns[el.id] = { ...fontRuns[el.id], [version.lang]: version.fontRuns?.[el.id] ?? [] };
    }
    if (text === undefined && visible === undefined && !module) return el;
    return {
      ...el,
      ...(text !== undefined ? { texts: { ...el.texts, [version.lang]: text } } : {}),
      ...(visible !== undefined ? { visible } : {}),
      ...(module ? { module } : {}),
    };
  });
  return {
    ...scene,
    elements,
    highlights,
    fontRuns,
    badgeStyles: version.badgeStyles ? { ...scene.badgeStyles, ...version.badgeStyles } : scene.badgeStyles,
    familyEdits: version.familyEdits ? { ...scene.familyEdits, ...version.familyEdits } : scene.familyEdits,
    boardOverrides: version.boardOverrides ? { ...scene.boardOverrides, ...version.boardOverrides } : scene.boardOverrides,
  };
}

/** 站内规范 CTA：有规范时高度、字号、内边距与宽度上下限全部锁定。 */
export interface SceneCtaSpec {
  height: number;
  fontPx: number;
  paddingX: number;
  minWidth: number;
  maxWidth: number;
  /** 宽度可在上下限内选短/中/长，真实 px */
  lengths?: Record<SceneCtaLength, number>;
  /** 不锁死：解除锁定后高度、字号、宽度按比例自由调整 */
  soft?: boolean;
}

/** 规范标注区，真实 px。只在编辑器里叠加显示，不写入 Figma。 */
export interface SceneZone {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: "reserved" | "safe";
  label?: string;
}

export interface SceneBoardRef {
  key: string;
  w: number;
  h: number;
  ctaSpec?: SceneCtaSpec;
  zones?: SceneZone[];
  /** 该资源位版式不出现的元素，如「无 CTA」 */
  hide?: SceneRole[];
  /** 规范要求必须出现的元素（如 Logo）：默认显示，族里或单板仍可关掉 */
  show?: SceneRole[];
  /** 规范示例稿给出的位置，优先于版式族。 */
  layout?: SizeLayout;
  /** 左右两侧过渡到画板底色的宽度（px），两侧会延展成纯色底的资源位用。 */
  edgeFade?: number;
  /** 不按画幅归族的画板所在的编辑分组（规范模板、闪屏母版）。 */
  bucket?: SceneBucket;
  /** 资源位指定的版式族；没给时按宽高比推算。 */
  family?: SceneFamily;
}

export const SCENE_COMPONENT_ASPECT = 1884 / 1096;

export const SCENE_FAMILY_LABEL: Record<SceneFamily, string> = {
  strip: "通栏族",
  landscape: "横版族",
  square: "方版族",
  portrait: "竖版族",
};

export const SCENE_FAMILY_SOURCE: Record<SceneFamily, string> = {
  strip: "默认值取自 1080×225 训练集（zh-title-sub-left）",
  landscape: "横版暂无训练样本，按左文右图比例推算",
  square: "方版暂无训练样本，按居中方版比例推算",
  portrait: "竖版暂无训练样本，按居中竖版比例推算",
};

export const SCENE_ROLE_LABEL: Record<SceneRole, string> = {
  visual: "主视觉组件",
  logo: "Logo",
  badge: "角标",
  kicker: "小标题",
  title: "主标题",
  subtitle: "副标题",
  custom: "自定义文字",
  module: "元素",
  disclaimer: "免责声明",
  cta: "CTA",
};

export const SCENE_TEXT_ROLES: readonly SceneRole[] = ["kicker", "title", "subtitle", "custom", "disclaimer"];
export const SCENE_REMOVABLE_ROLES: readonly SceneRole[] = ["badge", "disclaimer", "custom", "module", "cta"];

/** 自定义元素使用稳定编号；旧数据按当前图层顺序补成元素1、元素2…… */
export function sceneModuleName(scene: Pick<SceneState, "elements">, el: Pick<SceneElement, "id" | "role" | "name">) {
  if (el.role !== "module") return el.name;
  if (/^元素\d+$/.test(el.name)) return el.name;
  const modules = scene.elements.filter((item) => item.role === "module");
  const used = new Set(modules.flatMap((item) => {
    const match = /^元素(\d+)$/.exec(item.name);
    return match ? [Number(match[1])] : [];
  }));
  let number = 1;
  for (const item of modules) {
    const match = /^元素(\d+)$/.exec(item.name);
    if (match) continue;
    while (used.has(number)) number += 1;
    if (item.id === el.id) return `元素${number}`;
    used.add(number);
    number += 1;
  }
  return "元素1";
}

/** 按当前语言版本里实际存在的元素分配编号；空版本始终从元素1开始。 */
export function sceneNextModuleNumber(scene: Pick<SceneState, "elements">) {
  const used = new Set(scene.elements
    .filter((item) => item.role === "module")
    .map((item) => Number(sceneModuleName(scene, item).replace(/^元素/, "")))
    .filter((number) => Number.isFinite(number) && number > 0));
  let next = 1;
  while (used.has(next)) next += 1;
  return next;
}

/** 将旧项目中的模块名称稳定为“元素N”，避免不同语种或版式过滤后编号漂移。 */
export function normalizeSceneModuleNames(scene: SceneState): SceneState {
  const used = new Set<number>();
  const assigned = new Map<string, number>();

  for (const el of scene.elements) {
    if (el.role !== "module") continue;
    const match = /^元素(\d+)$/.exec(el.name.trim());
    const number = match ? Number(match[1]) : 0;
    if (number > 0) {
      used.add(number);
      assigned.set(el.id, number);
    }
  }

  let candidate = 1;
  for (const el of scene.elements) {
    if (el.role !== "module" || assigned.has(el.id)) continue;
    while (used.has(candidate)) candidate += 1;
    assigned.set(el.id, candidate);
    used.add(candidate);
  }

  let changed = false;
  const elements = scene.elements.map((el) => {
    const number = assigned.get(el.id);
    if (!number) return el;
    const name = `元素${number}`;
    if (el.name === name) return el;
    changed = true;
    return { ...el, name };
  });
  return changed ? { ...scene, elements } : scene;
}

/** 标题组：小标题、主标题、副标题共用一个锚点和对齐方式，纵向堆叠。 */
export const SCENE_GROUP_ID = "titleGroup";
export const SCENE_GROUP_ROLES: readonly SceneRole[] = ["kicker", "title", "subtitle"];

export function isSceneGroupRole(role: SceneRole) {
  return SCENE_GROUP_ROLES.includes(role);
}

/** 文案类型与示例，对应训练集的 单标题 / 标题组 / 复杂模块 三类。 */
export const SCENE_COPY_KINDS: ReadonlyArray<{ id: SceneCopyKind; name: string; example: string; detail: string }> = [
  { id: "single", name: "单标题", example: "入金$100得 ／ 高达$200交易现金券", detail: "只有主标题，断成两到三行" },
  { id: "group", name: "标题组", example: "新客限时特惠 ／ 特邀客户限时宝箱", detail: "小标题、主标题、副标题组合" },
  { id: "complex", name: "复杂模块", example: "角标 ＋ 标题组 ＋ 免责声明", detail: "标题组外再带角标、组合 Logo、免责声明" },
];

/** 训练版式的套用参数，由 @futu/corpus 的 LAYOUT_PRESETS 换算，领域层不直接依赖语料包。 */
export interface SceneCopyVariantSpec {
  kind: SceneCopyKind;
  structure: SceneCopyStructure;
  mainTitleLines: number;
  modules: { badge: boolean; disclaimer: boolean; combinedLogo: boolean };
  alignment: "left" | "center";
  /** 训练稿主标题逐行字号比例。 */
  lineRatios?: number[];
  /** 免责在 CTA 正下方（true）还是标题组正下方。 */
  disclaimerUnderCta: boolean;
  /** 训练稿标题组锚点（通栏，0..1）：居中取中线、左对齐取左缘，y 取外框中心。 */
  groupAnchor?: { x: number; y: number };
}

export interface SceneBadgeStyleSpec {
  id: SceneBadgeStyle;
  name: string;
  sourceNodeId: string;
  /** 1080×225 训练画板上的高度。 */
  h: number;
  /** 固定规格的短版/长版宽度；可拉伸样式为空。 */
  widths?: { short: number; long: number };
  /** 可拉伸样式文字两侧留白。 */
  padX: number;
  fontPx: { short: Record<SceneFontScript, number>; long: Record<SceneFontScript, number> };
  lineHeight: number;
  textColor: string;
  /** 文字上叠的橙色渐变（左→右），[起始色, 不透明度]。 */
  textOverlay?: { color: string; alpha: number };
  /** 文字斜切角度（度），Figma 稿用 -5°。 */
  skew?: number;
  letterSpacing?: Record<SceneFontScript, number>;
}

/** 角标样式库，取自训练版「角标｜样式库｜预设3种」（451:7556）与「财报季专用角标」（470:1973）。 */
export const SCENE_BADGE_STYLES: readonly SceneBadgeStyleSpec[] = [
  {
    id: "style1",
    name: "样式1 · 可拉伸",
    sourceNodeId: "451:7569",
    h: 43,
    padX: 12,
    fontPx: { short: { latin: 28, cjk: 27 }, long: { latin: 28, cjk: 27 } },
    lineHeight: 1.5,
    textColor: "#1C0707",
    skew: -5,
    letterSpacing: { latin: 0, cjk: 0.54 },
  },
  {
    id: "style2",
    name: "样式2 · 票券形",
    sourceNodeId: "451:8253",
    h: 50.0078,
    widths: { short: 267.563, long: 404.437 },
    padX: 40,
    fontPx: { short: { latin: 28, cjk: 28 }, long: { latin: 26, cjk: 26 } },
    lineHeight: 1.2,
    textColor: "#462F2F",
    textOverlay: { color: "#FF954B", alpha: 0.4 },
  },
  {
    id: "style3",
    name: "样式3 · 梯形",
    sourceNodeId: "459:11240",
    h: 53,
    widths: { short: 247, long: 355 },
    padX: 36,
    fontPx: { short: { latin: 28, cjk: 28 }, long: { latin: 28, cjk: 28 } },
    lineHeight: 1.3,
    textColor: "#553636",
    textOverlay: { color: "#FF954B", alpha: 0.2 },
  },
  {
    id: "earnings",
    name: "财报季专用",
    sourceNodeId: "451:8171",
    h: 49.336,
    padX: 0,
    fontPx: { short: { latin: 25.073, cjk: 27.457 }, long: { latin: 25.073, cjk: 27.457 } },
    lineHeight: 1.1,
    textColor: "#000000",
  },
];

export function sceneBadgeStyle(scene: Pick<SceneState, "badgeStyle" | "badgeStyles">, elementId?: string) {
  const selected = (elementId ? scene.badgeStyles?.[elementId] : undefined) ?? scene.badgeStyle;
  return SCENE_BADGE_STYLES.find((item) => item.id === selected) ?? SCENE_BADGE_STYLES[0]!;
}

/** 财报季角标的固定版式（文字 + moomoo 标），中英文各一套，坐标为 1080×225 训练像素。 */
const EARNINGS_BADGE = {
  cjk: { w: 343.327, h: 49.336, bg: { x: 14.4, y: 0, w: 315.84, h: 48 }, text: { x: 39.36, cy: 25.76 }, mark: { x: 151.487, y: 8.515, w: 154.461, h: 29.086 } },
  latin: { w: 412.439, h: 45.278, bg: { x: -2.7, y: 0, w: 418.5, h: 45 }, text: { x: 17.364, cy: 23.83 }, mark: { x: 262.686, y: 10.702, w: 128.224, h: 24.145 } },
} as const;

const EARNINGS_TEXT: Partial<Record<Lang, string>> = { sc: "看财报用", tc: "看財報用", en: "Decode Earnings with" };

export const SCENE_COPY_STRUCTURES: ReadonlyArray<{ id: SceneCopyStructure; label: string }> = [
  { id: "single", label: "仅主标题" },
  { id: "kicker-title", label: "小标题＋主标题" },
  { id: "title-sub", label: "主标题＋副标题" },
  { id: "kicker-title-sub", label: "三层" },
];

export interface SceneFontOption {
  id: string;
  /** 下拉分组名（字体名）。 */
  group: string;
  label: string;
  /** cjk 字体同时含拉丁字形；latin 字体只能用于英文。 */
  script: SceneFontScript;
  family: string;
  style: string;
  weight: number;
  italic?: boolean;
  /** fonts.css 里与该字重一一对应的 @font-face 别名。 */
  face: string;
}

const WEIGHTS: Record<string, number> = { Thin: 100, ExtraLight: 200, Light: 300, Normal: 400, Regular: 400, Medium: 500, SemiBold: 600, Semibold: 600, Demibold: 600, Bold: 700, ExtraBold: 800, Heavy: 900, Black: 900 };
const fontFace = (face: string) => `face-${face}`;

const BR_STYLES = ["Thin", "ExtraLight", "Light", "Regular", "Medium", "SemiBold", "Bold", "Black"];
const BR_FONTS: SceneFontOption[] = BR_STYLES.flatMap((style) => [false, true].map((italic) => {
  const name = italic ? `${style} Italic` : style;
  const slug = `${style.toLowerCase()}${italic ? "italic" : ""}`;
  return { id: italic ? `br-${slug}` : `br-${style.toLowerCase()}`, group: "BR Hendrix", label: name, script: "latin" as const, family: "BR Hendrix", style: name, weight: WEIGHTS[style]!, italic: italic || undefined, face: fontFace(`brhendrix-${slug}`) };
}));

const familyFonts = (group: string, prefix: string, family: string, face: string, styles: string[]): SceneFontOption[] =>
  styles.map((style) => ({ id: `${prefix}-${style.toLowerCase()}`, group, label: style, script: "cjk", family, style, weight: WEIGHTS[style] ?? 400, face: fontFace(`${face}-${style.toLowerCase()}`) }));

/** 公司规范字体（字体包：A-延展工具/Fonts），平台只允许使用这些字体。 */
export const SCENE_FONTS: ReadonlyArray<SceneFontOption> = [
  ...BR_FONTS,
  { id: "fz-l", group: "方正兰亭", label: "细黑", script: "cjk", family: "FZLanTingHei-L-GBK", style: "Regular", weight: 400, face: fontFace("fzltxhk") },
  { id: "fz-r", group: "方正兰亭", label: "黑", script: "cjk", family: "FZLanTingHei-R-GBK", style: "Regular", weight: 400, face: fontFace("fzlthk--gbk1-0") },
  { id: "fz-db", group: "方正兰亭", label: "中黑", script: "cjk", family: "FZLanTingHei-DB-GBK", style: "Regular", weight: 400, face: fontFace("fzltzhk--gbk1-0") },
  { id: "fz-sdb", group: "方正兰亭", label: "中粗黑", script: "cjk", family: "FZLanTingHeiS-DB1-GBK", style: "Regular", weight: 400, face: fontFace("fzltzchk--gbk1-0") },
  { id: "fz-eb", group: "方正兰亭", label: "大黑", script: "cjk", family: "FZLanTingHei-EB-GBK", style: "Regular", weight: 400, face: fontFace("fzltdhk--gbk1-0") },
  ...familyFonts("MiSans", "misans", "MiSans", "misans", ["Thin", "ExtraLight", "Light", "Normal", "Regular", "Medium", "Semibold", "Demibold", "Bold", "Heavy"]),
  ...familyFonts("思源宋体 Source Han Serif", "shs", "Source Han Serif", "sourcehanserif", ["ExtraLight", "Light", "Regular", "Medium", "SemiBold", "Bold", "Heavy"]),
  ...familyFonts("M PLUS 1p", "mplus", "M PLUS 1p", "mplus1p", ["Thin", "Light", "Regular", "Medium", "Bold", "ExtraBold", "Black"]),
  { id: "hy-45j", group: "汉仪雅酷黑", label: "45J 简", script: "cjk", family: "HYYaKuHei", style: "45J", weight: 300, face: fontFace("hyyakuhei-45j") },
  { id: "hy-85j", group: "汉仪雅酷黑", label: "85J 简", script: "cjk", family: "HYYaKuHei", style: "85J", weight: 700, face: fontFace("hyyakuhei-85j") },
  { id: "hy-45f", group: "汉仪雅酷黑", label: "45F 繁", script: "cjk", family: "HYYaKuHei", style: "45F", weight: 300, face: fontFace("hyyakuhei-45f") },
  { id: "hy-85f", group: "汉仪雅酷黑", label: "85F 繁", script: "cjk", family: "HYYaKuHei", style: "85F", weight: 700, face: fontFace("hyyakuhei-85f") },];

/** 英文可用全部字体；中日文只能用含中日文字形的字体。 */
export function sceneFontSupports(font: Pick<SceneFontOption, "script">, script: SceneFontScript) {
  return script === "latin" || font.script === "cjk";
}

export const SCENE_LINE_HEIGHT = 1.2;

/** 底部被原生控件遮挡的比例。数值待纯净版规范逐页确认。 */
export const SCENE_OCCLUSION: Record<string, number> = {
  "1080×432": 0.18,
};

export const SCENE_TEXT_COLORS: readonly string[] = ["#FFFFFF", "#121212", "#231407", "#FF6900", "#F7DE9E", "#E2BF73"];

export type SceneGradientType = "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "GRADIENT_DIAMOND";
export type SceneTransform = [[number, number, number], [number, number, number]];
export interface SceneGradientStop {
  pos: number;
  color: string;
  alpha: number;
}
/** 与 Figma Paint 一一对应；数组顺序同 Figma fills（后面的叠在上面）。 */
export type ScenePaint =
  | { type: "SOLID"; color: string; opacity?: number }
  | { type: SceneGradientType; transform: SceneTransform; stops: SceneGradientStop[]; opacity?: number };

export interface SceneHighlightPreset {
  id: string;
  name: string;
  nodeId: string;
  paints: ScenePaint[];
}

const stop = (pos: number, color: string, alpha = 1): SceneGradientStop => ({ pos, color, alpha });

/** 高亮样式库，逐层取自训练版 Figma「高亮色｜样式库｜预设」483:1974。 */
export const SCENE_HIGHLIGHT_PRESETS: readonly SceneHighlightPreset[] = [
  { id: "brand-orange", name: "品牌橙", nodeId: "483:1975", paints: [{ type: "SOLID", color: "#FF6900" }] },
  { id: "light-gold", name: "浅金", nodeId: "483:1976", paints: [{ type: "SOLID", color: "#FFF4D2" }] },
  { id: "pure-black", name: "极致黑", nodeId: "483:1977", paints: [{ type: "SOLID", color: "#000000" }] },
  { id: "regular-black", name: "常规黑", nodeId: "483:1978", paints: [{ type: "SOLID", color: "#121212" }] },
  { id: "dark-brown", name: "深棕", nodeId: "483:1979", paints: [{ type: "SOLID", color: "#391A00" }] },
  {
    id: "mist-gold", name: "云雾金渐变", nodeId: "483:1980", paints: [
      { type: "SOLID", color: "#E7C281" },
      { type: "GRADIENT_LINEAR", transform: [[0.9258, -0.1002, 0.0772], [2.1491, 0.9402, -1.1535]], stops: [stop(0, "#FFD08A"), stop(1, "#FFE5C0")] },
      { type: "GRADIENT_LINEAR", opacity: 0.4, transform: [[0.9502, -0.0257, 0.0498], [0.8847, 0.9072, -0.3847]], stops: [stop(0.55, "#FFFFFF", 0), stop(1, "#FFFBE8")] },
    ],
  },
  {
    id: "champagne", name: "浅金渐变", nodeId: "483:1981", paints: [
      { type: "GRADIENT_LINEAR", transform: [[-0.5527, 0, 0.7251], [0, 0.0852, 0.4039]], stops: [stop(0, "#FFF9EA"), stop(1, "#FFCF83")] },
    ],
  },
  {
    id: "warm-orange", name: "暖橙渐变", nodeId: "483:1982", paints: [
      { type: "SOLID", color: "#FF6900" },
      { type: "GRADIENT_LINEAR", transform: [[0, 1, 0], [-1, 0, 1]], stops: [stop(0, "#FF7F26"), stop(1, "#FF4000")] },
    ],
  },
  {
    id: "orange-gold-flow", name: "橙金流光", nodeId: "483:1984", paints: [
      { type: "GRADIENT_LINEAR", transform: [[0.7767, 0.4186, -0.1651], [-12.9716, 0.7767, 6.8822]], stops: [stop(0, "#FF6900"), stop(0.5, "#FFE2BF"), stop(0.898, "#FF6900")] },
    ],
  },
  {
    id: "champagne-metal", name: "香槟金属", nodeId: "483:1987", paints: [
      { type: "SOLID", color: "#FFFFFF" },
      { type: "GRADIENT_LINEAR", transform: [[0.7645, 0.0746, 0.035], [-1.4268, 0.7645, 1.2401]], stops: [stop(0.453, "#FCEFDC"), stop(0.634, "#C3A38E"), stop(0.762, "#FCEFDC")] },
    ],
  },
  {
    id: "silver-metal", name: "银白金属", nodeId: "483:1991", paints: [
      { type: "SOLID", color: "#FFFFFF" },
      { type: "GRADIENT_LINEAR", transform: [[0.7649, 0.0555, 0.2226], [-0.4899, 0.7177, 0.4391]], stops: [stop(0, "#FFFFFF", 0.8), stop(0.397, "#FFFFFF"), stop(0.719, "#FFFFFF"), stop(0.847, "#B1B1B1", 0.41), stop(0.892, "#FFFFFF", 0.8)] },
    ],
  },
];

/** 自定义渐变：类型 + 角度（0° 为从左到右，顺时针）+ 断点。 */
export interface SceneCustomGradient {
  type: SceneGradientType;
  angle: number;
  stops: SceneGradientStop[];
}

export const SCENE_GRADIENT_TYPES: ReadonlyArray<{ id: SceneGradientType; name: string }> = [
  { id: "GRADIENT_LINEAR", name: "线性渐变" },
  { id: "GRADIENT_RADIAL", name: "径向渐变" },
  { id: "GRADIENT_ANGULAR", name: "角度渐变" },
  { id: "GRADIENT_DIAMOND", name: "菱形" },
];

/** 用户可编辑的单层填充：纯色或自定义渐变（描边、自定义 CTA 底色共用）。 */
export type SceneFillSpec = { type: "SOLID"; color: string } | SceneCustomGradient;

export type SceneStrokeAlign = "CENTER" | "INSIDE" | "OUTSIDE";

export const SCENE_STROKE_ALIGNS: ReadonlyArray<{ id: SceneStrokeAlign; name: string }> = [
  { id: "CENTER", name: "居中" },
  { id: "INSIDE", name: "内部" },
  { id: "OUTSIDE", name: "外部" },
];

/** 文字描边，对应 Figma strokes / strokeWeight / strokeAlign；粗细按字号存比例，跨尺寸等比。 */
export interface SceneStroke {
  visible: boolean;
  fill: SceneFillSpec;
  opacity: number;
  weight: number;
  align: SceneStrokeAlign;
}

export function sceneDefaultStroke(fontPx: number): SceneStroke {
  return { visible: true, fill: { type: "SOLID", color: "#FFFFFF" }, opacity: 1, weight: fontPx > 0 ? 2 / fontPx : 0.05, align: "OUTSIDE" };
}

export function sceneFillPaints(fill: SceneFillSpec, opacity = 1): ScenePaint[] {
  if (fill.type === "SOLID") return [{ type: "SOLID", color: fill.color, ...(opacity < 1 ? { opacity } : {}) }];
  return [{ type: fill.type, transform: sceneGradientTransform(fill.angle), stops: fill.stops, ...(opacity < 1 ? { opacity } : {}) }];
}

/** 自定义 CTA 样式：底色可纯色或渐变。 */
export interface SceneCtaCustom {
  fill: SceneFillSpec;
  textColor: string;
}

export const SCENE_CTA_CUSTOM_DEFAULT: SceneCtaCustom = {
  fill: { type: "GRADIENT_LINEAR", angle: 0, stops: [{ pos: 0, color: "#FF6626", alpha: 1 }, { pos: 1, color: "#F04700", alpha: 1 }] },
  textColor: "#FFFFFF",
};

export const SCENE_BACKGROUND_PRESETS: ReadonlyArray<{ id: string; name: string; hex: string }> = [
  { id: "black", name: "纯黑", hex: "#121212" },
  { id: "brown", name: "深棕", hex: "#231407" },
  { id: "navy", name: "深蓝", hex: "#0B1A3A" },
  { id: "red", name: "深红", hex: "#2A0E0B" },
];

const SIZE_FACTOR: Record<SceneFamily, Record<SceneRole, number>> = {
  strip: { visual: 419 / 225, logo: 34 / 225, badge: 1 / 225, kicker: 37.65 / 225, title: 47 / 225, subtitle: 24 / 225, custom: 24 / 225, module: 32 / 225, disclaimer: 18 / 225, cta: 80 / 225 },
  landscape: { visual: 1, logo: 0.07, badge: 0, kicker: 0.08, title: 0.14, subtitle: 0.07, custom: 0.06, module: 0.08, disclaimer: 0.04, cta: 0.14 },
  square: { visual: 0.62, logo: 0.055, badge: 0, kicker: 0.05, title: 0.085, subtitle: 0.045, custom: 0.04, module: 0.06, disclaimer: 0.025, cta: 0.1 },
  portrait: { visual: 0.8, logo: 0.06, badge: 0, kicker: 0.055, title: 0.1, subtitle: 0.05, custom: 0.045, module: 0.06, disclaimer: 0.025, cta: 0.12 },
};

/** 角标按训练像素换算：其它族跟主标题相对通栏的缩放走，保证角标与标题的比例不变。 */
function badgeUnitFactor(family: SceneFamily) {
  return SIZE_FACTOR[family].title / SIZE_FACTOR.strip.title / 225;
}

/** 标题组默认锚点（组中心）与层间距；通栏取自 1080×225 训练集标题组 gap 12px。 */
const GROUP_POS: Record<SceneFamily, [number, number, SceneAlign]> = {
  strip: [0.353, 0.5, "left"],
  landscape: [0.07, 0.38, "left"],
  square: [0.5, 0.2, "center"],
  portrait: [0.5, 0.2, "center"],
};

const GROUP_GAP: Record<SceneFamily, number> = {
  strip: 12 / 225,
  landscape: 0.03,
  square: 0.02,
  portrait: 0.02,
};

const DEFAULT_POS: Record<SceneFamily, Record<SceneRole, [number, number, SceneAlign]>> = {
  strip: {
    visual: [0.15, 0.687, "center"],
    logo: [0.353, 0.17, "left"],
    /** 角标贴画板顶边，y 指外框顶边。 */
    badge: [0.5, 0, "center"],
    kicker: [0.353, 0.22, "left"],
    title: [0.353, 0.42, "left"],
    subtitle: [0.353, 0.66, "left"],
    custom: [0.353, 0.84, "left"],
    module: [0.353, 0.78, "left"],
    /** 免责放在 CTA 正下方。 */
    disclaimer: [1056 / 1080, 178.5 / 225, "right"],
    /** 规范 1677:15954：CTA 200×80 距右 24、距顶 72。 */
    cta: [1056 / 1080, 112 / 225, "right"],
  },
  landscape: {
    visual: [0.74, 0.52, "center"],
    logo: [0.07, 0.12, "left"],
    badge: [0.07, 0, "left"],
    kicker: [0.07, 0.26, "left"],
    title: [0.07, 0.4, "left"],
    subtitle: [0.07, 0.53, "left"],
    custom: [0.07, 0.62, "left"],
    module: [0.07, 0.66, "left"],
    disclaimer: [0.07, 0.92, "left"],
    cta: [0.07, 0.74, "left"],
  },
  square: {
    visual: [0.5, 0.6, "center"],
    logo: [0.5, 0.07, "center"],
    badge: [0.5, 0, "center"],
    kicker: [0.5, 0.14, "center"],
    title: [0.5, 0.22, "center"],
    subtitle: [0.5, 0.3, "center"],
    custom: [0.5, 0.35, "center"],
    module: [0.5, 0.38, "center"],
    disclaimer: [0.5, 0.95, "center"],
    cta: [0.5, 0.88, "center"],
  },
  portrait: {
    visual: [0.5, 0.57, "center"],
    logo: [0.5, 0.07, "center"],
    badge: [0.5, 0, "center"],
    kicker: [0.5, 0.14, "center"],
    title: [0.5, 0.21, "center"],
    subtitle: [0.5, 0.28, "center"],
    custom: [0.5, 0.33, "center"],
    module: [0.5, 0.37, "center"],
    disclaimer: [0.5, 0.95, "center"],
    cta: [0.5, 0.87, "center"],
  },
};

/** 预设 Logo 的宽高比，取自训练版 Logo（7:7842）与组合 Logo（7:7841）组件导出的 SVG。 */
export function sceneLogoAspect(preset: LibraryLogoPreset) {
  if (preset.includes("Nasdaq")) return preset.startsWith("moomoo") ? 478 / 50 : 446 / 50;
  return preset.startsWith("moomoo") ? 262.943 / 49.55 : 229.752 / 49.6584;
}

/** 文字默认可占的列宽（占画板宽度），超出时自动缩小字号，最多缩到一半；用户比例在此基础上再乘。 */
const TEXT_COLUMN: Record<SceneFamily, number> = {
  strip: 0.43,
  landscape: 0.5,
  square: 0.86,
  portrait: 0.86,
};

/**
 * 通栏文字列止于 CTA 左缘前一个间距，CTA 随画板高度变宽。
 * 标题组按实际排出的 CTA 宽度算（长文案的 CTA 会更宽）；规范把主视觉放在文案右侧时，也不越过主体左缘。
 */
function stripTextColumn(scene: SceneState, board: SceneBoardRef, lang: Lang, placement?: ScenePlacement) {
  const gap = (24 / 1080) * board.w;
  let limit = DEFAULT_POS.strip.cta[0] * board.w - 2.5 * SIZE_FACTOR.strip.cta * board.h - gap;
  const spec = board.layout?.group;
  const fallback = DEFAULT_POS.strip.title[0] * board.w;
  if (placement) {
    const cta = scene.elements.find((item) => item.role === "cta");
    const rest = cta ? sceneAtRest(scene, board, cta.id) : scene;
    const ctaPlacement = cta ? resolveScenePlacement(rest, board, cta) : null;
    const before = placement.align === "right" ? fallback : spec?.x ?? fallback;
    if (cta && ctaPlacement?.visible && ctaPlacement.align === "right" && sceneText(cta, lang).trim()) {
      const left = ctaPlacement.x * board.w - sceneMetrics(rest, board, cta, ctaPlacement, lang).w;
      if (left > before) limit = Math.min(limit, left - gap);
    }
  }
  /** 列宽按规范 / 默认位置量，不随拖动变：拖标题组或 CTA 只改位置，不改字号。 */
  const anchor = !placement || placement.align === "right" ? fallback : spec ? spec.x : placement.align === "center" ? (0.25 * board.w + limit) / 2 : fallback;
  const room = limit - anchor;
  /** 居中时左侧也不越过训练集最靠左的标题组左缘（271/1080），避免压到主视觉。 */
  const leftRoom = anchor - 0.25 * board.w;
  return Math.max(0.25 * board.w, placement?.align === "center" ? Math.min(room, leftRoom) * 2 : room);
}

/** 文字列宽：族默认列宽，再收进规范内容区。主视觉在最底层，不影响文字。 */
function textColumn(scene: SceneState, board: SceneBoardRef, lang: Lang, el: SceneElement, own: ScenePlacement) {
  const family = sceneBoardFamily(board);
  const group = isSceneGroupRole(el.role);
  /** 外框按规范锚点的那条边定位时，可用宽度也从那条边量。 */
  const placement = own.edge ? { ...own, align: own.edge } : own;
  let column = family === "strip" ? stripTextColumn(scene, board, lang, group ? placement : undefined) : TEXT_COLUMN[family] * board.w;
  if (!group) return column;
  if (board.zones?.length) {
    const area = sceneContentArea(board);
    const spec = board.layout?.group;
    const anchor = spec ? spec.x : placement.align === "left" ? DEFAULT_POS[family].title[0] * board.w : placement.align === "right" ? area.x + area.w : area.x + area.w / 2;
    const room = placement.align === "left" ? area.x + area.w - anchor : placement.align === "right" ? anchor - area.x : 2 * Math.min(anchor - area.x, area.x + area.w - anchor);
    column = Math.min(column, room);
  }
  return column;
}

/** 去掉某图层在族里和单板上的位置调整，用来量「没拖动时」的可用宽度。 */
function sceneAtRest(scene: SceneState, board: SceneBoardRef, id: string): SceneState {
  const bucket = sceneBucketOf(board);
  const strip = (patch: ScenePlacementPatch | undefined) => {
    if (!patch) return patch;
    const { x: _x, y: _y, shift: _shift, shiftX: _shiftX, ...rest } = patch;
    return rest;
  };
  return {
    ...scene,
    familyEdits: { ...scene.familyEdits, [bucket]: { ...scene.familyEdits[bucket], [id]: strip(scene.familyEdits[bucket]?.[id]) ?? {} } },
    boardOverrides: { ...scene.boardOverrides, [board.key]: { ...scene.boardOverrides[board.key], [id]: strip(scene.boardOverrides[board.key]?.[id]) ?? {} } },
  };
}

export function sceneFamilyOf(w: number, h: number): SceneFamily {
  const ratio = w / h;
  if (ratio >= 2.6) return "strip";
  if (ratio > 1.18) return "landscape";
  if (ratio >= 0.82) return "square";
  return "portrait";
}

/** 画板的版式族：资源位指定的优先，否则按宽高比。 */
export function sceneBoardFamily(board: Pick<SceneBoardRef, "w" | "h" | "family">): SceneFamily {
  return board.family ?? sceneFamilyOf(board.w, board.h);
}

export function sceneBucketOf(board: Pick<SceneBoardRef, "w" | "h" | "bucket" | "family">): SceneBucket {
  return board.bucket ?? sceneBoardFamily(board);
}

/** 分组对应的画幅族，默认位置与字号系数按它取。 */
export function sceneBucketFamily(bucket: SceneBucket): SceneFamily {
  return bucket.split("@")[0] as SceneFamily;
}

/** 规范模板分组：第三步只改内容与样式，版式按规范。 */
export function sceneBucketLocked(bucket: SceneBucket) {
  return bucket.includes("@spec:");
}

/** 画板自身是否按规范锁版式：特殊规范模板，或对齐分组里有规范锚点 / CTA 规范的（首选对齐的不锁）。 */
export function sceneBoardLocked(board: Pick<SceneBoardRef, "w" | "h" | "bucket" | "family" | "layout" | "ctaSpec">) {
  const bucket = sceneBucketOf(board);
  if (sceneBucketLocked(bucket)) return true;
  if (bucket.includes("@own:")) return false;
  return bucket.includes("@align:") && Boolean(board.ctaSpec || (board.layout && !board.layout.soft));
}

/** 画幅族默认的标题组对齐。 */
export function sceneFamilyAlign(family: SceneFamily): SceneAlign {
  return GROUP_POS[family][2];
}

function unitOf(board: SceneBoardRef) {
  const family = sceneBoardFamily(board);
  return family === "portrait" || family === "square" ? board.w : board.h;
}

export function sceneFontScript(lang: Lang): SceneFontScript {
  return lang === "sc" || lang === "tc" || lang === "ja" ? "cjk" : "latin";
}

export function sceneDefaultFontId(script: SceneFontScript, role: SceneRole, lang?: Lang) {
  /** 日语默认使用 M PLUS 1p：主标题 Bold、CTA / 小标题 / 副标题 Medium。 */
  if (lang === "ja") {
    if (role === "title") return "mplus-bold";
    if (role === "cta") return "mplus-medium";
    return "mplus-medium";
  }
  const strong = role === "title" || role === "cta";
  if (script === "latin") return strong ? "br-medium" : "br-regular";
  return strong ? "fz-db" : "fz-r";
}

export function sceneFontId(scene: SceneState, el: Pick<SceneElement, "id" | "role">, lang: Lang) {
  const script = sceneFontScript(lang);
  /** 历史 fonts 按 CJK 共用，不能让简繁体的方正兰亭覆盖新增日语的 M PLUS 默认值。 */
  const chosen = scene.languageFonts?.[lang]?.[el.id]
    ?? (lang === "ja" ? undefined : scene.fonts?.[el.id]?.[script]);
  return chosen && SCENE_FONTS.some((font) => font.id === chosen && sceneFontSupports(font, script)) ? chosen : sceneDefaultFontId(script, el.role, lang);
}

export function sceneFont(scene: SceneState, el: Pick<SceneElement, "id" | "role">, lang: Lang) {
  const id = sceneFontId(scene, el, lang);
  const font = SCENE_FONTS.find((item) => item.id === id)!;
  return { fontFamily: font.family, fontStyle: font.style, fontWeight: font.weight, fontFace: font.face, italic: font.italic };
}

export interface SceneFontRunOut {
  start: number;
  end: number;
  fontFamily: string;
  fontStyle: string;
  fontWeight: number;
  fontFace: string;
  italic?: boolean;
}

/** 局部字体可选的字体：选中的字里没有中日韩文字时，英文字体也可用（如中文里的数字、金额）。 */
export function sceneFontSupportsText(font: Pick<SceneFontOption, "script">, script: SceneFontScript, text: string) {
  return sceneFontSupports(font, script) || !/[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(text);
}

/** 局部字体段：丢掉越界或不支持这段文字的字体。 */
export function sceneFontRuns(scene: SceneState, el: SceneElement, lang: Lang): SceneFontRunOut[] {
  const script = sceneFontScript(lang);
  const chars = Array.from(sceneText(el, lang));
  const length = chars.length;
  return (scene.fontRuns?.[el.id]?.[lang] ?? []).flatMap((run) => {
    const font = SCENE_FONTS.find((item) => item.id === run.font && sceneFontSupportsText(item, script, chars.slice(run.start, run.end).join("")));
    if (!font || run.start >= length || run.end <= run.start) return [];
    return [{ start: run.start, end: Math.min(run.end, length), fontFamily: font.family, fontStyle: font.style, fontWeight: font.weight, fontFace: font.face, ...(font.italic ? { italic: true } : {}) }];
  });
}

function trackedWidth(line: string, fontPx: number, tracking: number) {
  return lineWidth(line, fontPx) + Math.max(0, Array.from(line).length - 1) * fontPx * tracking;
}

function lineWidth(line: string, fontPx: number) {
  let units = 0;
  for (const character of Array.from(line)) {
    if (/[\u3000-\u9fff\uff00-\uffef\uac00-\ud7af]/.test(character)) units += 1;
    else if (character === " ") units += 0.33;
    else if (/[%@&mwMW]/.test(character)) units += 0.9;
    else if (/[A-Z]/.test(character)) units += 0.68;
    else if (/[0-9$+\-=]/.test(character)) units += 0.62;
    else if (/[.,:;!'|il]/.test(character)) units += 0.3;
    else units += 0.56;
  }
  return units * fontPx;
}

/** 文字宽度的确定性近似（多行取最宽一行），用于体检；预览与写入按真实字体自动撑开。 */
export function sceneTextWidth(text: string, fontPx: number) {
  return Math.max(0, ...text.split("\n").map((line) => lineWidth(line, fontPx)));
}

export function sceneLineCount(text: string) {
  return Math.max(1, text.split("\n").length);
}

export function sceneText(el: SceneElement, lang: Lang) {
  return el.texts[lang] ?? el.texts.en ?? Object.values(el.texts)[0] ?? "";
}

/** 财报季角标文字固定为规范文案，其余样式用元素自身文案。 */
export function sceneBadgeText(scene: SceneState, el: SceneElement, lang: Lang) {
  if (sceneBadgeStyle(scene, el.id).id === "earnings") return EARNINGS_TEXT[lang] ?? EARNINGS_TEXT.en!;
  return sceneText(el, lang);
}

/** 逐行字号比例，缺省为 1。 */
export function sceneLineRatios(scene: SceneState, el: Pick<SceneElement, "id">, count: number, family?: SceneBucket) {
  const ratios = (family ? scene.familyLineRatios?.[family]?.[el.id] : undefined) ?? scene.lineRatios?.[el.id];
  return Array.from({ length: count }, (_, index) => ratios?.[index] ?? 1);
}

/** 整体行高倍数。 */
export function sceneLeading(scene: SceneState, el: Pick<SceneElement, "id">) {
  return scene.leading?.[el.id] ?? SCENE_LINE_HEIGHT;
}

/** 逐行样式：字号比例（相对第 1 行）、行高与字间距（相对该行字号）；第 1 行和没单独设的行跟整体。 */
export function sceneLineStyles(scene: SceneState, el: Pick<SceneElement, "id">, count: number, family?: SceneBucket) {
  const leading = sceneLeading(scene, el);
  const tracking = scene.tracking?.[el.id] ?? 0;
  return sceneLineRatios(scene, el, count, family).map((ratio, index) => ({
    ratio,
    leading: (index ? scene.lineLeading?.[el.id]?.[index] : undefined) ?? leading,
    tracking: (index ? scene.lineTracking?.[el.id]?.[index] : undefined) ?? tracking,
  }));
}

/** 第 2 行起有单独的字号、行高或字间距。 */
function sceneLinesStyled(scene: SceneState, el: Pick<SceneElement, "id">, ratios: number[]) {
  const own = (map?: Record<number, number>) => Object.keys(map ?? {}).some((key) => Number(key) > 0 && Number(key) < ratios.length);
  return ratios.some((ratio) => ratio !== 1) || own(scene.lineLeading?.[el.id]) || own(scene.lineTracking?.[el.id]);
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function roundScenePatch(patch: ScenePlacementPatch): ScenePlacementPatch {
  const next = { ...patch };
  if (next.x !== undefined) next.x = round(next.x, 4);
  if (next.y !== undefined) next.y = round(next.y, 4);
  if (next.scale !== undefined) next.scale = round(Math.max(0.3, Math.min(3, next.scale)), 2);
  if (next.w !== undefined) next.w = round(Math.max(0.1, next.w), 4);
  if (next.gap !== undefined) next.gap = round(Math.max(0, Math.min(12, next.gap)), 3);
  if (next.font !== undefined) next.font = round(Math.max(0.4, Math.min(2.5, next.font)), 3);
  if (next.attach) next.attach = { v: next.attach.v, dy: round(next.attach.dy, 4), dx: round(next.attach.dx, 4) };
  if (next.shift !== undefined) next.shift = round(next.shift, 4);
  if (next.shiftX !== undefined) next.shiftX = round(next.shiftX, 4);
  return next;
}

/** 自定义元素以 Figma 原始节点为 1×，内部换算值可能远大于普通图层的 3× 上限。 */
export function roundSceneModulePatch(patch: ScenePlacementPatch): ScenePlacementPatch {
  const next = roundScenePatch(patch);
  if (patch.scale !== undefined) next.scale = round(Math.max(0.001, Math.min(1000, patch.scale)), 4);
  return next;
}

/** 把像素宽度换成 ScenePlacement.w 的存储值。 */
export function sceneWidthToUnit(board: SceneBoardRef, px: number) {
  return px / unitOf(board);
}

/** 训练集标题组层间距（像素，整体比例为 1 时）。 */
export function sceneGroupBaseGap(board: SceneBoardRef) {
  return GROUP_GAP[sceneBoardFamily(board)] * unitOf(board);
}

const anchorOf = (board: SceneBoardRef, anchor: SizeAnchor) => ({ x: anchor.x / board.w, y: anchor.y / board.h, align: anchor.align });

/** 规范给了位置时，族内调整只保留比例、间距等，位置与对齐以规范为准。 */
function withoutPosition(patch: ScenePlacementPatch | undefined): ScenePlacementPatch | undefined {
  if (!patch) return patch;
  const { x: _x, y: _y, align: _align, ...rest } = patch;
  return rest;
}

/** 标题组整体的锚点、整体比例与对齐，按族默认值 → 规范版式 → 族调整 → 单板覆盖叠加。 */
export function resolveSceneGroup(scene: SceneState, board: SceneBoardRef): ScenePlacement {
  const family = sceneBoardFamily(board);
  const [x, y, align] = GROUP_POS[family];
  const shown = (role: SceneRole) => family === "strip" && scene.elements.some((el) => el.role === role && el.visible);
  const spec = board.layout?.group;
  const familyEdit = scene.familyEdits[sceneBucketOf(board)]?.[SCENE_GROUP_ID];
  const override = scene.boardOverrides[board.key]?.[SCENE_GROUP_ID];
  const specScale = specGroupScale(board);
  /** 首选版式的锚点只当默认值，族里的位置、对齐照常覆盖。 */
  const locked = spec && !board.layout?.soft;
  const ownAlign = locked && familyEdit?.overSpec && familyEdit.align && familyEdit.align !== spec.align ? familyEdit.align : undefined;
  const resolved: ScenePlacement = {
    x,
    y: shown("logo") ? 0.6 : shown("badge") ? 0.58 : y,
    align,
    visible: true,
    ...(spec ? anchorOf(board, spec) : {}),
    ...(locked ? withoutPosition(familyEdit) : familyEdit),
    ...(spec && ownAlign ? { align: ownAlign, edge: spec.align } : {}),
    ...override,
    scale: override?.scale ?? specScale * (familyEdit?.scale ?? 1),
  };
  const u = unitOf(board) * resolved.scale;
  if (override?.x === undefined && resolved.shiftX) resolved.x += (resolved.shiftX * u) / board.w;
  if (override?.y === undefined && resolved.shift) resolved.y += (resolved.shift * u) / board.h;
  return resolved;
}

/** 规范版式里该元素的锚点；Logo 跟随规范标题组的左右位置。 */
/** 规范主标题字号相对版式族默认字号的倍数；角标、Logo 跟标题组一起按它缩放。 */
function specGroupScale(board: SceneBoardRef) {
  const titlePx = board.layout?.titlePx;
  return titlePx ? titlePx / (SIZE_FACTOR[sceneBoardFamily(board)].title * unitOf(board)) : 1;
}

function specPosition(scene: SceneState, board: SceneBoardRef, role: SceneRole): Partial<ScenePlacement> | null {
  const layout = board.layout;
  if (!layout) return null;
  if (role === "visual" && layout.visualFill) {
    const baseH = SIZE_FACTOR[sceneBoardFamily(board)].visual * unitOf(board);
    const scale = Math.max(board.h / baseH, board.w / (baseH * scene.visualAspect));
    const w = baseH * scale * scene.visualAspect;
    const h = baseH * scale;
    return { x: (board.w / 2 + (scene.focal.x - 0.5) * w) / board.w, y: (board.h / 2 + (scene.focal.y - 0.5) * h) / board.h, scale };
  }
  if (role === "cta" && layout.cta && !("afterSubtitle" in layout.cta)) return anchorOf(board, layout.cta);
  if (role === "visual" && layout.visual) return { x: layout.visual.x / board.w, y: layout.visual.y / board.h, scale: layout.visual.scale ?? 1 };
  if (role === "logo" && layout.logo) return { ...anchorOf(board, layout.logo), scale: specGroupScale(board) };
  if (role === "logo" && layout.group) return { x: layout.group.x / board.w, align: layout.group.align, scale: specGroupScale(board) };
  if (role === "badge" && layout.titlePx) return { scale: specGroupScale(board) };
  return null;
}

/** 图层未做手动调整时的规范比例；比例预设据此相对缩放，不写死素材像素。 */
export function sceneDefaultScale(scene: SceneState, board: SceneBoardRef, role: SceneRole) {
  return specPosition(scene, board, role)?.scale ?? 1;
}

/** 元素自身的调整值；标题组成员只用其中的 scale 与 visible。 */
export function resolveSceneOwn(scene: SceneState, board: SceneBoardRef, el: SceneElement): ScenePlacement {
  const family = sceneBoardFamily(board);
  const [x, y, align] = DEFAULT_POS[family][el.role];
  return withBoardHide(board, el, {
    x,
    y,
    scale: 1,
    align,
    visible: el.visible,
    ...scene.familyEdits[sceneBucketOf(board)]?.[el.id],
    ...scene.boardOverrides[board.key]?.[el.id],
  });
}

function withBoardHide(board: SceneBoardRef, el: SceneElement, placement: ScenePlacement): ScenePlacement {
  return board.hide?.includes(el.role) ? { ...placement, visible: false } : placement;
}

/** 标题组成员的 y 需要结合兄弟层高度才能确定，最终位置以 layoutScene 为准。 */
export function resolveScenePlacement(scene: SceneState, board: SceneBoardRef, el: SceneElement): ScenePlacement {
  if (isSceneGroupRole(el.role)) {
    const group = resolveSceneGroup(scene, board);
    const own = resolveSceneOwn(scene, board, el);
    return { x: group.x, y: group.y, scale: group.scale * own.scale, align: group.align, visible: own.visible && group.visible, ...(group.edge ? { edge: group.edge } : {}) };
  }
  const family = sceneBoardFamily(board);
  const [x, y, align] = DEFAULT_POS[family][el.role];
  const customIndex = el.role === "custom"
    ? scene.elements.filter((item) => item.role === "custom").findIndex((item) => item.id === el.id)
    : 0;
  const bucket = sceneBucketOf(board);
  const familyEdit = scene.familyEdits[bucket]?.[el.id];
  const moduleAttach = el.role === "module" && el.module?.placementMode !== "free" && !familyEdit?.attach
    ? {
      attach: {
        v: el.module?.placementMode === "above-title" ? "above" as const : el.module?.placementMode === "below-title" ? "below" as const : "beside" as const,
        dy: el.module?.placementMode === "title-backdrop" ? 0 : GROUP_GAP[family],
        dx: 0,
      },
      align: resolveSceneGroup(scene, board).align,
    }
    : {};
  const ownEdit = { ...moduleAttach, ...familyEdit };
  const override = scene.boardOverrides[board.key]?.[el.id];
  const effectiveOwnEdit = override?.detached ? { ...ownEdit, attach: undefined } : ownEdit;
  /** 编入标题组的图层跟组走，不受规范位置约束；单板手动拖过位置的除外。 */
  if (effectiveOwnEdit.attach && SCENE_ATTACH_ROLES.includes(el.role) && override?.x === undefined && override?.y === undefined) {
    const group = resolveSceneGroup(scene, board);
    return withBoardHide(board, el, {
      x,
      y,
      align,
      visible: el.visible,
      ...effectiveOwnEdit,
      ...override,
      follow: "none",
      scale: override?.scale ?? group.scale * (effectiveOwnEdit.scale ?? 1),
    });
  }
  const spec = specPosition(scene, board, el.role);
  const soft = Boolean(board.layout?.soft);
  const placement: ScenePlacement = {
    x,
    y: y + Math.max(0, customIndex) * 0.06,
    align,
    visible: el.visible,
    follow: el.role === "badge" ? "center" : "none",
    ...spec,
    ...(spec && !soft ? withoutPosition(effectiveOwnEdit) : effectiveOwnEdit),
    ...override,
    scale: override?.scale ?? (spec?.scale ?? 1) * (effectiveOwnEdit.scale ?? 1),
  };
  const u = unitOf(board);
  /** 族里的位置在规范画板上记成相对锚点的偏移，同组没有锚点的画板也按同样的偏移跟着挪。 */
  if (override?.x === undefined && effectiveOwnEdit.shiftX) placement.x += (effectiveOwnEdit.shiftX * u) / board.w;
  if (override?.y === undefined && effectiveOwnEdit.shift) placement.y += (effectiveOwnEdit.shift * u) / board.h;
  /** 跟随标题组的元素按规范的组对齐方式跟随（族里选的对齐覆盖规范时按它），单板手动选过的除外。 */
  const groupEdit = scene.familyEdits[bucket]?.[SCENE_GROUP_ID];
  const specAlign = board.layout?.group ? ((soft || groupEdit?.overSpec) && groupEdit?.align ? groupEdit.align : board.layout.group.align) : undefined;
  if (specAlign && placement.follow && placement.follow !== "none" && !override?.follow) placement.follow = specAlign;
  return withBoardHide(board, el, placement);
}

export interface SceneMetrics {
  w: number;
  h: number;
  fontPx: number;
  /** 文字超出默认列宽时的自动缩放系数，1 = 未缩放。 */
  fit?: number;
  /** 逐行字号，只在有行比例时给出。 */
  lineFontPx?: number[];
  /** 站内规范锁定了尺寸（CTA）。 */
  locked?: boolean;
  /** 固定规格角标选中的版本。 */
  badgeLength?: "short" | "long";
  /** 文字放不进固定宽度。 */
  overflow?: boolean;
}

/** 样式1 短文案的外框宽度（451:7569 / 459:11238），长文案按文字撑开。 */
const STRETCH_BADGE_MIN_W = 246;

function badgeLengthOf(scene: SceneState, style: SceneBadgeStyleSpec, text: string, script: SceneFontScript): "short" | "long" {
  if (scene.badgeLength === "short" || scene.badgeLength === "long") return scene.badgeLength;
  if (!style.widths) return "short";
  return lineWidth(text, style.fontPx.short[script]) + style.padX * 2 > style.widths.short ? "long" : "short";
}

function naturalTextWidth(scene: SceneState, board: SceneBoardRef, el: SceneElement, height: number, lang: Lang) {
  const lines = sceneText(el, lang).split("\n");
  const styles = sceneLineStyles(scene, el, lines.length, sceneBucketOf(board));
  return { natural: Math.max(0, ...lines.map((line, index) => trackedWidth(line, height * styles[index]!.ratio, styles[index]!.tracking))), styles };
}

/** 超出列宽时自动缩小字号，最多缩到一半。 */
function ownTextFit(scene: SceneState, board: SceneBoardRef, lang: Lang, el: SceneElement, placement: ScenePlacement, natural: number) {
  const column = textColumn(scene, board, lang, el, placement);
  return natural > column ? Math.max(0.5, column / natural) : 1;
}

/** 标题组里最需要缩小的那一层决定整组的倍数。 */
function groupTextFit(scene: SceneState, board: SceneBoardRef, lang: Lang) {
  const family = sceneBoardFamily(board);
  let fit = 1;
  for (const member of scene.elements) {
    if (!isSceneGroupRole(member.role) || !sceneText(member, lang).trim()) continue;
    const placement = resolveScenePlacement(scene, board, member);
    if (!placement.visible) continue;
    const height = SIZE_FACTOR[family][member.role] * unitOf(board) * placement.scale;
    fit = Math.min(fit, ownTextFit(scene, board, lang, member, placement, naturalTextWidth(scene, board, member, height, lang).natural));
  }
  return fit;
}

export function sceneMetrics(scene: SceneState, board: SceneBoardRef, el: SceneElement, placement: ScenePlacement, lang: Lang): SceneMetrics {
  const family = sceneBoardFamily(board);
  const unit = unitOf(board);
  const height = SIZE_FACTOR[family][el.role] * unit * placement.scale;
  const text = sceneText(el, lang);
  const tracking = scene.tracking?.[el.id] ?? 0;
  if (el.role === "visual") return { w: height * scene.visualAspect, h: height, fontPx: 0 };
  if (el.role === "module") {
    const aspect = el.module && el.module.height > 0 ? el.module.width / el.module.height : 3;
    const width = el.module?.stretchable && placement.w ? placement.w * unit : height * aspect;
    return { w: width, h: height, fontPx: 0 };
  }
  if (el.role === "cta") {
    const spec = board.ctaSpec;
    if (spec?.soft && scene.ctaFontUnlocked) {
      const s = placement.scale;
      const fontPx = spec.fontPx * s * (placement.font ?? 1);
      const need = trackedWidth(text, fontPx, tracking) + spec.paddingX * 2 * s;
      return { w: placement.w ? Math.max(need, placement.w * unit) : Math.max(spec.minWidth * s, need), h: spec.height * s, fontPx };
    }
    if (spec) {
      const fontPx = scene.ctaFontUnlocked ? spec.fontPx * (placement.font ?? 1) : spec.fontPx;
      const need = trackedWidth(text, fontPx, tracking) + spec.paddingX * 2;
      const chosen = spec.lengths
        ? placement.length ? spec.lengths[placement.length] : placement.w ? placement.w * unit : 0
        : 0;
      const w = Math.min(spec.maxWidth, Math.max(spec.minWidth, need, chosen));
      return { w, h: spec.height, fontPx, locked: true, overflow: need > spec.maxWidth };
    }
    /** 日语 CTA 参考规格为 200×80、M PLUS 1p Medium 28px；其它语言沿用既有比例。 */
    const fontPx = height * (lang === "ja" ? 0.35 : 0.325) * (placement.font ?? 1);
    const textW = Math.max(0, ...text.split("\n").map((line) => trackedWidth(line, fontPx, tracking)));
    const hug = Math.max(height * 2.5, textW + height * 0.78);
    if (placement.length) return { w: Math.max(textW + height * 0.78, height * CTA_LENGTH_FACTOR[placement.length]), h: height, fontPx };
    return { w: placement.w ? Math.max(textW + height * 0.4, placement.w * unit) : hug, h: height, fontPx };
  }
  if (el.role === "logo") return { w: height * sceneLogoAspect(scene.logoPreset), h: height, fontPx: 0 };
  if (el.role === "badge") {
    const style = sceneBadgeStyle(scene, el.id);
    const script = sceneFontScript(lang);
    const k = badgeUnitFactor(family) * unit * placement.scale;
    if (style.id === "earnings") {
      const geometry = EARNINGS_BADGE[script];
      return { w: geometry.w * k, h: geometry.h * k, fontPx: style.fontPx.short[script] * k };
    }
    const label = sceneBadgeText(scene, el, lang);
    const length = badgeLengthOf(scene, style, label, script);
    const fontPx = style.fontPx[length][script] * k;
    const textW = lineWidth(label, fontPx);
    if (style.widths) {
      const w = style.widths[length] * k;
      return { w, h: style.h * k, fontPx, badgeLength: length, overflow: textW > w - style.padX * 1.2 * k };
    }
    const hug = Math.max(STRETCH_BADGE_MIN_W * k, textW + style.padX * 2 * k);
    return { w: placement.w ? Math.max(textW + 8 * k, placement.w * unit) : hug, h: style.h * k, fontPx };
  }
  const { natural, styles } = naturalTextWidth(scene, board, el, height, lang);
  /** 标题组各层共用一个缩小倍数，层与层的字号比例和对齐关系保持方案里的样子。 */
  const fit = isSceneGroupRole(el.role) ? groupTextFit(scene, board, lang) : ownTextFit(scene, board, lang, el, placement, natural);
  const fontPx = height * fit;
  const lineFontPx = styles.map((style) => fontPx * style.ratio);
  const h = styles.reduce((sum, style, index) => sum + lineFontPx[index]! * style.leading, 0);
  return { w: natural * fit, h, fontPx, fit, ...(sceneLinesStyled(scene, el, styles.map((style) => style.ratio)) ? { lineFontPx } : {}) };
}

export interface SceneBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function sceneBox(scene: SceneState, board: SceneBoardRef, el: SceneElement, placement: ScenePlacement, metrics: SceneMetrics): SceneBox {
  const ax = placement.x * board.w;
  const ay = placement.y * board.h;
  if (el.role === "visual") {
    return { x: ax - scene.focal.x * metrics.w, y: ay - scene.focal.y * metrics.h, w: metrics.w, h: metrics.h };
  }
  const x = placement.align === "left" ? ax : placement.align === "center" ? ax - metrics.w / 2 : ax - metrics.w;
  if (el.role === "badge") return { x, y: ay, w: metrics.w, h: metrics.h };
  return { x, y: ay - metrics.h / 2, w: metrics.w, h: metrics.h };
}

/** 跟随标题组对齐时的锚点 x（像素）。 */
function followX(box: SceneBox, follow: SceneAlign) {
  return follow === "left" ? box.x : follow === "center" ? box.x + box.w / 2 : box.x + box.w;
}

export interface SceneLaid {
  el: SceneElement;
  placement: ScenePlacement;
  metrics: SceneMetrics;
  box: SceneBox;
}

export interface SceneGroupLayout {
  /** 小标题、主标题、副标题的外框。 */
  box: SceneBox;
  /** 连同编入组的图层在内的整组外框。 */
  frame: SceneBox;
  align: SceneAlign;
  gap: number;
  /** 标题组 Auto Layout 相邻成员之间的实际间距，长度为 stackIds.length - 1。 */
  gaps: number[];
  anchor: { x: number; y: number };
  ids: string[];
  /** 从上到下排进标题组的全部图层，含编入组的图层。 */
  stackIds: string[];
}

function hasSceneContent(scene: SceneState, el: SceneElement, lang: Lang) {
  return el.role === "visual" || el.role === "logo" || (el.role === "module" && Boolean(el.module) && !el.module?.cleared) || Boolean(sceneText(el, lang).trim()) || (el.role === "badge" && sceneBadgeStyle(scene, el.id).id === "earnings");
}

/** 标题组从上到下的层序，含隐藏的层；新编入或新出现的层按缺省位置插进已存的层序。 */
export function sceneGroupOrder(scene: SceneState, family: SceneBucket, boardKey?: string): string[] {
  const edits = scene.familyEdits[family] ?? {};
  const boardEdits = boardKey ? (scene.boardOverrides[boardKey] ?? {}) : {};
  const riders = (v: SceneAttach["v"]) => scene.elements.filter((el) => {
    if (!SCENE_ATTACH_ROLES.includes(el.role)) return false;
    const attached = boardEdits[el.id]?.detached ? undefined : (boardEdits[el.id]?.attach?.v ?? edits[el.id]?.attach?.v);
    if (attached) return attached === v;
    if (el.role !== "module") return false;
    const customMode = boardEdits[el.id]?.customMode ?? edits[el.id]?.customMode ?? el.module?.placementMode;
    return (customMode === "above-title" && v === "above")
      || (customMode === "below-title" && v === "below");
  }).map((el) => el.id);
  const core = SCENE_GROUP_ROLES.flatMap((role) => scene.elements.filter((el) => el.role === role).map((el) => el.id));
  const defaults = [...riders("above"), ...core, ...riders("below")];
  const order = (edits[SCENE_GROUP_ID]?.order ?? []).filter((id) => defaults.includes(id));
  if (!order.length) return defaults;
  defaults.forEach((id, index) => {
    if (order.includes(id)) return;
    const before = defaults.slice(0, index).reverse().find((item) => order.includes(item));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, id);
  });
  return order;
}

/** 按层序把标题组排好（未做安全区与避让）：文字部分的中心落在组锚点上，编入组的图层排在各自的位置。 */
function stackSceneGroup(scene: SceneState, board: SceneBoardRef, lang: Lang) {
  const group = resolveSceneGroup(scene, board);
  const u = unitOf(board) * group.scale;
  const core: SceneLaid[] = [];
  for (const role of SCENE_GROUP_ROLES) {
    for (const el of scene.elements.filter((item) => item.role === role)) {
      const placement = resolveScenePlacement(scene, board, el);
      if (!placement.visible || !sceneText(el, lang).trim()) continue;
      const metrics = sceneMetrics(scene, board, el, placement, lang);
      core.push({ el, placement, metrics, box: { x: 0, y: 0, w: 0, h: 0 } });
    }
  }
  if (!core.length) return null;
  /** 族里的对齐覆盖了规范：外框按规范锚点的那条边定位，各行按族里的对齐排。 */
  let anchorX = group.x;
  if (group.edge && group.edge !== group.align) {
    const w = Math.max(...core.map((item) => item.metrics.w));
    const left = group.x * board.w - (group.edge === "left" ? 0 : group.edge === "center" ? w / 2 : w);
    anchorX = (left + (group.align === "left" ? 0 : group.align === "center" ? w / 2 : w)) / board.w;
    for (const item of core) item.placement = { ...item.placement, x: anchorX };
  }
  const riders: SceneLaid[] = [];
  for (const el of scene.elements) {
    if (!SCENE_ATTACH_ROLES.includes(el.role)) continue;
    const placement = resolveScenePlacement(scene, board, el);
    if (!placement.visible || !placement.attach || placement.attach.v === "beside" || !hasSceneContent(scene, el, lang)) continue;
    riders.push({ el, placement, metrics: sceneMetrics(scene, board, el, placement, lang), box: { x: 0, y: 0, w: 0, h: 0 } });
  }
  const order = sceneGroupOrder(scene, sceneBucketOf(board), board.key);
  const rank = (item: SceneLaid) => {
    const index = order.indexOf(item.el.id);
    return index < 0 ? order.length : index;
  };
  const stack = [...core, ...riders].sort((a, b) => rank(a) - rank(b));
  const baseGap = sceneGroupBaseGap(board) * group.scale;
  const gap = baseGap * (group.gap ?? 1);
  const titleAt = stack.findIndex((item) => item.el.role === "title");
  const pivot = titleAt >= 0 ? titleAt : stack.findIndex((item) => isSceneGroupRole(item.el.role));
  const between = stack.slice(1).map((lower, index) => {
    const upper = stack[index]!;
    if (lower.placement.attach && index + 1 > pivot) return lower.placement.attach.dy * u;
    if (upper.placement.attach && index < pivot) return upper.placement.attach.dy * u;
    const own = upper.el.role === "kicker"
      ? resolveSceneOwn(scene, board, upper.el).gap
      : lower.el.role === "subtitle" ? resolveSceneOwn(scene, board, lower.el).gap : undefined;
    return own === undefined ? gap : baseGap * own;
  });
  const tops: number[] = [];
  let cursor = 0;
  stack.forEach((item, index) => {
    tops.push(cursor);
    cursor += item.metrics.h + (between[index] ?? 0);
  });
  const first = stack.findIndex((item) => isSceneGroupRole(item.el.role));
  const last = stack.length - 1 - [...stack].reverse().findIndex((item) => isSceneGroupRole(item.el.role));
  const spanTop = tops[first]!;
  const spanBottom = tops[last]! + stack[last]!.metrics.h;
  const offset = group.y * board.h - (spanTop + spanBottom) / 2;
  const coreX = core.map((item) => sceneBox(scene, board, item.el, item.placement, item.metrics));
  const left = Math.min(...coreX.map((box) => box.x));
  const coreBox: SceneBox = { x: left, y: spanTop + offset, w: Math.max(...coreX.map((box) => box.x + box.w)) - left, h: spanBottom - spanTop };
  stack.forEach((item, index) => {
    const top = tops[index]! + offset;
    if (isSceneGroupRole(item.el.role)) {
      item.placement = { ...item.placement, y: (top + item.metrics.h / 2) / board.h };
      item.box = sceneBox(scene, board, item.el, item.placement, item.metrics);
      return;
    }
    /** 编入组的上下层跟标题组同一对齐方式。 */
    const align = group.align;
    const x = edgeX(coreBox, align) + item.placement.attach!.dx * u - (align === "left" ? 0 : align === "center" ? item.metrics.w / 2 : item.metrics.w);
    item.box = { x, y: top, w: item.metrics.w, h: item.metrics.h };
    item.placement = { ...item.placement, align, x: edgeX(item.box, align) / board.w, y: (item.el.role === "badge" ? top : top + item.metrics.h / 2) / board.h };
  });
  return { group, u, gap, anchorX, stack, core: stack.filter((item) => isSceneGroupRole(item.el.role)), riders, coreBox };
}

/**
 * 显示/隐藏标题组里的一层后，整组顶边在排版上移动的距离，按 ScenePlacement.shift 的单位。
 * 抵消它就是顶边不动、下面的层顺次让开或补上，和顶部对齐的 Auto Layout 一样。
 */
export function sceneGroupDrift(before: SceneState, after: SceneState, board: SceneBoardRef, lang: Lang): number {
  const family = sceneBucketOf(board);
  const a = stackSceneGroup(sceneFamilyView(before, family, board.show), board, lang);
  const b = stackSceneGroup(sceneFamilyView(after, family, board.show), board, lang);
  if (!a?.stack[0] || !b?.stack[0] || !a.u) return 0;
  return (b.stack[0].box.y - a.stack[0].box.y) / a.u;
}

/** 所有可见元素的最终位置。标题组按层序纵向堆叠，文字部分的中心落在组锚点上。 */
export function layoutScene(input: SceneState, board: SceneBoardRef, lang: Lang): { laid: SceneLaid[]; group: SceneGroupLayout | null } {
  const scene = sceneFamilyView(input, sceneBucketOf(board), board.show);
  const stacked = stackSceneGroup(scene, board, lang);
  const groupBox = stacked?.coreBox ?? null;
  const core = stacked?.core ?? [];
  const byId = new Map((stacked?.stack ?? []).map((item) => [item.el.id, item]));
  const laid: SceneLaid[] = [];
  const attached: SceneLaid[] = [...(stacked?.riders ?? [])];
  for (const el of scene.elements) {
    const item = byId.get(el.id);
    if (item) {
      laid.push(item);
      continue;
    }
    if (isSceneGroupRole(el.role)) continue;
    let placement = resolveScenePlacement(scene, board, el);
    if (!placement.visible || !hasSceneContent(scene, el, lang)) continue;
    if (groupBox && stacked && placement.attach) {
      const metrics = sceneMetrics(scene, board, el, placement, lang);
      const a = placement.attach;
      const customMode = placement.customMode ?? el.module?.placementMode;
      const backdrop = el.role === "module" && customMode === "title-backdrop";
      const backdropTarget = backdrop
        ? core.find((item) => item.el.role === (placement.backdropTarget ?? el.module?.backdropTarget ?? "title"))
          ?? core.find((item) => item.el.role === "title")
          ?? core[0]
        : undefined;
      /** 标题底层的偏移以选中的文字层为基准；其它编组元素仍以标题组整体为基准。 */
      const anchorBox = backdropTarget?.box ?? groupBox;
      const y = anchorBox.y + anchorBox.h / 2 + a.dy * stacked.u - metrics.h / 2;
      const x = edgeX(anchorBox, placement.align) + a.dx * stacked.u - (placement.align === "left" ? 0 : placement.align === "center" ? metrics.w / 2 : metrics.w);
      const box = { x, y, w: metrics.w, h: metrics.h };
      placement = { ...placement, x: edgeX(box, placement.align) / board.w, y: (el.role === "badge" ? box.y : box.y + box.h / 2) / board.h };
      const beside = { el, placement, metrics, box };
      laid.push(beside);
      attached.push(beside);
      continue;
    }
    if (groupBox && el.role !== "visual" && placement.follow && placement.follow !== "none") {
      placement = { ...placement, x: followX(groupBox, placement.follow) / board.w, align: placement.follow };
    }
    const metrics = sceneMetrics(scene, board, el, placement, lang);
    const ctaRule = board.layout?.cta;
    const own = scene.boardOverrides[board.key]?.[el.id];
    const subtitle = core.find((entry) => entry.el.role === "subtitle");
    if (el.role === "cta" && ctaRule && "afterSubtitle" in ctaRule && subtitle && own?.x === undefined && own?.y === undefined) {
      placement = { ...placement, x: (subtitle.box.x + subtitle.box.w + ctaRule.afterSubtitle) / board.w, y: (subtitle.box.y + subtitle.box.h / 2) / board.h, align: "left" };
    }
    laid.push({ el, placement, metrics, box: sceneBox(scene, board, el, placement, metrics) });
  }
  /** 跟着副标题走的 CTA（课堂）和标题组一起挪。 */
  const unitIds = new Set([...core, ...attached].map((item) => item.el.id));
  const rider = board.layout?.cta && "afterSubtitle" in board.layout.cta ? laid.find((item) => item.el.role === "cta") : undefined;
  if (rider) unitIds.add(rider.el.id);
  fitSceneZones(board, laid, unitIds);
  if (avoidTopElements(board, laid, core, attached, rider, stacked?.gap ?? 0)) fitSceneZones(board, laid, unitIds);
  keepBadgeInside(board, laid);
  if (!stacked || !groupBox) return { laid, group: null };
  const fitted = stackBox(core);
  return {
    laid,
    group: {
      box: fitted,
      frame: stackBox([...core, ...attached]),
      align: stacked.group.align,
      gap: stacked.gap,
      gaps: stacked.stack.slice(1).map((item, index) => item.box.y - (stacked.stack[index]!.box.y + stacked.stack[index]!.box.h)),
      anchor: { x: stacked.anchorX * board.w + fitted.x - groupBox.x, y: fitted.y + fitted.h / 2 },
      ids: core.map((item) => item.el.id),
      stackIds: stacked.stack.map((item) => item.el.id),
    },
  };
}

/** 内容必须落在的范围：所有安全区的交集（「标题区」只约束标题，不参与）；没有安全区时为整块画板。 */
function sceneContentArea(board: SceneBoardRef): SceneBox {
  let area: SceneBox = { x: 0, y: 0, w: board.w, h: board.h };
  for (const zone of board.zones ?? []) {
    if (zone.kind !== "safe" || zone.label?.includes("标题区")) continue;
    const x = Math.max(area.x, zone.x);
    const y = Math.max(area.y, zone.y);
    area = { x, y, w: Math.max(0, Math.min(area.x + area.w, zone.x + zone.w) - x), h: Math.max(0, Math.min(area.y + area.h, zone.y + zone.h) - y) };
  }
  return area;
}

const touches = (a: SceneBox, b: SceneBox) => a.x + 1 < b.x + b.w && b.x + 1 < a.x + a.w && a.y + 1 < b.y + b.h && b.y + 1 < a.y + a.h;

/** 把一组元素整体挪到最近的合规位置：先收进内容范围，再以最小位移避开保留区。挪不开就留给体检报出来。 */
function fitSceneUnit(board: SceneBoardRef, area: SceneBox, units: SceneLaid[]) {
  const box: SceneBox = {
    x: Math.min(...units.map((item) => item.box.x)),
    y: Math.min(...units.map((item) => item.box.y)),
    w: Math.max(...units.map((item) => item.box.x + item.box.w)) - Math.min(...units.map((item) => item.box.x)),
    h: Math.max(...units.map((item) => item.box.y + item.box.h)) - Math.min(...units.map((item) => item.box.y)),
  };
  const clamp = (value: number, min: number, size: number, room: number) => (size > room ? min : Math.min(Math.max(value, min), min + room - size));
  let dx = clamp(box.x, area.x, box.w, area.w) - box.x;
  let dy = clamp(box.y, area.y, box.h, area.h) - box.y;
  const reserved = (board.zones ?? []).filter((zone) => zone.kind === "reserved");
  const inside = (b: SceneBox) => b.x >= area.x - 1 && b.y >= area.y - 1 && b.x + b.w <= area.x + area.w + 1 && b.y + b.h <= area.y + area.h + 1;
  for (let pass = 0; pass < 3; pass += 1) {
    const moved = { ...box, x: box.x + dx, y: box.y + dy };
    const hit = reserved.find((zone) => touches(moved, zone));
    if (!hit) break;
    const options = [
      { x: hit.x - (moved.x + moved.w), y: 0 },
      { x: hit.x + hit.w - moved.x, y: 0 },
      { x: 0, y: hit.y - (moved.y + moved.h) },
      { x: 0, y: hit.y + hit.h - moved.y },
    ]
      .map((step) => ({ step, next: { ...moved, x: moved.x + step.x, y: moved.y + step.y } }))
      .filter(({ next }) => inside(next) && !reserved.some((zone) => touches(next, zone)))
      .sort((a, b) => Math.abs(a.step.x) + Math.abs(a.step.y) - (Math.abs(b.step.x) + Math.abs(b.step.y)));
    if (!options[0]) break;
    dx += options[0].step.x;
    dy += options[0].step.y;
  }
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return 0;
  shiftSceneLaid(board, units, dx, dy);
  return dx;
}

function shiftSceneLaid(board: SceneBoardRef, units: SceneLaid[], dx: number, dy: number) {
  for (const item of units) {
    item.box = { ...item.box, x: item.box.x + dx, y: item.box.y + dy };
    item.placement = { ...item.placement, x: item.placement.x + dx / board.w, y: item.placement.y + dy / board.h };
  }
}

/** 角标贴顶边，只做水平收边：贴左边（x≈0）的版本保留，其余收进左右安全边距。 */
function keepBadgeInside(board: SceneBoardRef, laid: SceneLaid[]) {
  const pad = (24 / 1080) * board.w;
  for (const badge of laid.filter((item) => item.el.role === "badge" && !item.placement.attach)) {
    const { x, w } = badge.box;
    if (Math.abs(x) <= 1 || w > board.w - pad * 2) continue;
    const dx = x < pad ? pad - x : x + w > board.w - pad ? board.w - pad - (x + w) : 0;
    if (dx) shiftSceneLaid(board, [badge], dx, 0);
  }
}

function stackBox(stack: SceneLaid[]): SceneBox {
  const x = Math.min(...stack.map((item) => item.box.x));
  const y = Math.min(...stack.map((item) => item.box.y));
  return { x, y, w: Math.max(...stack.map((item) => item.box.x + item.box.w)) - x, h: Math.max(...stack.map((item) => item.box.y + item.box.h)) - y };
}

/**
 * 顶部元素压到标题组时让位：贴顶的角标不动，标题组下移到角标下方一个组间距；
 * Logo 放到组上方一个组间距，顶部放不下再把标题组往下让。
 */
function avoidTopElements(board: SceneBoardRef, laid: SceneLaid[], stack: SceneLaid[], attached: SceneLaid[], rider: SceneLaid | undefined, gap: number) {
  if (!stack.length) return false;
  let moved = false;
  /** 标题组连同编入组里的图层是一个整体，组里的角标、Logo 不再单独让位。 */
  const block = [...stack, ...attached];
  const unit = rider ? [...block, rider] : block;
  const free = (role: SceneRole) => laid.find((item) => item.el.role === role && !item.placement.attach);
  const badge = free("badge");
  /** 通栏族按训练集排，不在这里改。 */
  const adjustable = Boolean(board.layout?.group) || sceneBoardFamily(board) !== "strip";
  if (badge && adjustable && overlaps(badge.box, stackBox(block))) {
    shiftSceneLaid(board, unit, 0, badge.box.y + badge.box.h + gap - stackBox(block).y);
    moved = true;
  }
  const logo = free("logo");
  /** 只在压到组里某一层时让位；取消编组后留在两层文字之间的 Logo 不动。 */
  if (logo && block.some((item) => overlaps(logo.box, item.box))) {
    const groupTop = stackBox(block).y;
    const topBands = (board.zones ?? []).filter((zone) => zone.kind === "reserved" && zone.y <= 0 && zone.w >= board.w * 0.5);
    const top = Math.max(0.04 * board.h, sceneContentArea(board).y, ...topBands.map((zone) => zone.y + zone.h));
    const want = groupTop - gap - logo.box.h;
    shiftSceneLaid(board, [logo], 0, Math.max(top, want) - logo.box.y);
    if (want < top) shiftSceneLaid(board, unit, 0, top + logo.box.h + gap - groupTop);
    moved = true;
  }
  /** 规范把 CTA 放在标题组下方时，组变高（多了小标题）就整体上移，底边离 CTA 一个组间距；排版自由的画板不推，CTA 与标题组各挪各的。 */
  const cta = laid.find((item) => item.el.role === "cta");
  const group = stackBox(block);
  if (board.layout?.group && !board.layout.soft && cta && !rider && cta.box.y > group.y && overlaps(cta.box, group)) {
    const floor = badge ? badge.box.y + badge.box.h + gap : -Infinity;
    shiftSceneLaid(board, block, 0, Math.max(cta.box.y - gap - (group.y + group.h), Math.min(0, floor - group.y)));
    const after = stackBox(block);
    if (overlaps(cta.box, after)) shiftSceneLaid(board, [cta], 0, after.y + after.h + gap - cta.box.y);
    moved = true;
  }
  return moved;
}

/** 规范标注区是硬约束：标题组整体、Logo、CTA 等逐个挪进合规位置。主视觉可以出血，角标按规范贴边，不参与。 */
function fitSceneZones(board: SceneBoardRef, laid: SceneLaid[], groupIds: Set<string>) {
  if (!board.zones?.length) return;
  const area = sceneContentArea(board);
  const group = laid.filter((item) => groupIds.has(item.el.id));
  const groupDx = group.length ? fitSceneUnit(board, area, group) : 0;
  for (const item of laid) {
    if (groupIds.has(item.el.id) || item.el.role === "visual") continue;
    if (groupDx && item.placement.follow && item.placement.follow !== "none") shiftSceneLaid(board, [item], groupDx, 0);
    if (item.el.role !== "badge") fitSceneUnit(board, area, [item]);
  }
}

function overlaps(a: SceneBox, b: SceneBox) {
  return a.x + 2 < b.x + b.w && b.x + 2 < a.x + a.w && a.y + 2 < b.y + b.h && b.y + 2 < a.y + a.h;
}

/** 生成前体检：安全区、遮挡区、字号下限、元素重叠。 */
export interface SceneIssue {
  ids: string[];
  text: string;
}

export function checkSceneBoard(input: SceneState, board: SceneBoardRef, lang: Lang): SceneIssue[] {
  const scene = sceneFamilyView(input, sceneBucketOf(board), board.show);
  const issues: SceneIssue[] = [];
  const padX = (24 / 1080) * board.w;
  const padY = 0.04 * board.h;
  const occlusion = SCENE_OCCLUSION[board.key];
  const placed: Array<{ el: SceneElement; box: SceneBox }> = [];
  let subject: SceneBox | null = null;
  const result = layoutScene(scene, board, lang);
  const specAlign = board.layout?.soft ? undefined : board.layout?.group?.align;
  if (specAlign && result.group && result.group.align !== specAlign) {
    const name = { left: "左对齐", center: "居中", right: "右对齐" }[specAlign];
    issues.push({ ids: result.group.ids, text: `标题组对齐与规范不符，规范为${name}` });
  }
  for (const { el, metrics, box } of result.laid) {
    if (el.role === "visual") {
      subject = {
        x: box.x + scene.safeBox.x * box.w,
        y: box.y + scene.safeBox.y * box.h,
        w: scene.safeBox.w * box.w,
        h: scene.safeBox.h * box.h,
      };
      const visibleW = Math.max(0, Math.min(board.w, subject.x + subject.w) - Math.max(0, subject.x));
      const visibleH = Math.max(0, Math.min(board.h, subject.y + subject.h) - Math.max(0, subject.y));
      const visible = (visibleW * visibleH) / Math.max(1, subject.w * subject.h);
      if (visible < 0.7) {
        issues.push({ ids: [el.id], text: `主视觉主体只露出 ${Math.round(visible * 100)}%，缩小比例或移动位置` });
      }
      continue;
    }
    placed.push({ el, box });
    /** 角标按规范贴画板顶边；左对齐版本贴左边并自带安全预留。 */
    const badge = el.role === "badge";
    const outLeft = badge ? box.x < -1 || (box.x > 1 && box.x < padX) : box.x < padX;
    const outTop = badge ? box.y < -1 : box.y < padY;
    if (outLeft || outTop || box.x + box.w > board.w - padX || box.y + box.h > board.h - padY) {
      issues.push({ ids: [el.id], text: `${el.name}超出安全区，拖回虚线框内或缩小比例` });
    }
    if (metrics.overflow) {
      issues.push({ ids: [el.id], text: el.role === "cta" ? `CTA 文案超过规范最大宽度，请缩短文案` : `${el.name}文案放不进固定规格，换长版或缩短文案` });
    }
    if (occlusion && box.y + box.h > board.h * (1 - occlusion)) issues.push({ ids: [el.id], text: `${el.name}进入底部遮挡区` });
    if (!badge && board.zones?.length) {
      const area = sceneContentArea(board);
      const inside = box.x >= area.x - 1 && box.y >= area.y - 1 && box.x + box.w <= area.x + area.w + 1 && box.y + box.h <= area.y + area.h + 1;
      const safe = board.zones.find((zone) => zone.kind === "safe" && !zone.label?.includes("标题区"));
      if (!inside && (area.w < board.w || area.h < board.h)) issues.push({ ids: [el.id], text: `${el.name}超出规范「${safe?.label ?? "内容区"}」` });
      for (const zone of board.zones) {
        if (zone.kind === "reserved" && touches(box, zone)) issues.push({ ids: [el.id], text: `${el.name}进入规范保留区「${zone.label ?? "避让区"}」` });
      }
    }
    if (el.role !== "logo" && metrics.fontPx > 0 && metrics.fontPx < 18) {
      issues.push({ ids: [el.id], text: `${el.name}字号 ${Math.round(metrics.fontPx)}px，低于 18px 下限` });
    }
  }
  for (let i = 0; i < placed.length; i += 1) {
    const a = placed[i]!;
    if (subject && overlaps(a.box, subject)) issues.push({ ids: [a.el.id, "visual"], text: `${a.el.name}遮挡主视觉主体` });
    for (let j = i + 1; j < placed.length; j += 1) {
      const b = placed[j]!;
      if (overlaps(a.box, b.box)) issues.push({ ids: [a.el.id, b.el.id], text: `${a.el.name}与${b.el.name}重叠` });
    }
  }
  return issues;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
}

export function isSceneHex(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** 绕画框中心旋转的渐变矩阵（Figma gradientTransform，归一化坐标）。 */
export function sceneGradientTransform(angle: number): SceneTransform {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [[cos, sin, 0.5 - 0.5 * cos - 0.5 * sin], [-sin, cos, 0.5 + 0.5 * sin - 0.5 * cos]];
}

export function sceneCustomGradient(scene: SceneState): SceneCustomGradient {
  return scene.customGradient ?? {
    type: "GRADIENT_LINEAR",
    angle: 0,
    stops: [stop(0, scene.customHighlight[0]), stop(1, scene.customHighlight[1])],
  };
}

/** 早期版本的参考色板，只为已有高亮继续可读，不再出现在样式库里。 */
const LEGACY_HIGHLIGHTS: Record<string, string[]> = {
  gold: ["#F7DE9E", "#E2BF73"],
  peach: ["#F8CBB0"],
  cream: ["#FBF1DC"],
  "white-cream": ["#FFFFFF", "#F3E3C3"],
};

export function highlightPaints(scene: SceneState, preset: string): ScenePaint[] {
  if (preset === "custom") {
    const custom = sceneCustomGradient(scene);
    return [{ type: custom.type, transform: sceneGradientTransform(custom.angle), stops: custom.stops }];
  }
  if (preset === "custom-solid") return [{ type: "SOLID", color: scene.customSolid ?? "#FFFFFF" }];
  const found = SCENE_HIGHLIGHT_PRESETS.find((item) => item.id === preset);
  if (found) return found.paints;
  const legacy = LEGACY_HIGHLIGHTS[preset] ?? ["#FFFFFF"];
  return legacy.length > 1
    ? [{ type: "GRADIENT_LINEAR", transform: [[1, 0, 0], [0, 1, 0]], stops: legacy.map((color, index) => stop(index / (legacy.length - 1), color)) }]
    : [{ type: "SOLID", color: legacy[0]! }];
}

function invertTransform([[a, b, tx], [c, d, ty]]: SceneTransform) {
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) return null;
  return (gx: number, gy: number) => {
    const x = gx - tx;
    const y = gy - ty;
    return { x: (d * x - b * y) / det, y: (-c * x + a * y) / det };
  };
}

function stopAt(stops: readonly SceneGradientStop[], t: number): { rgb: number[]; alpha: number } {
  const sorted = [...stops].sort((left, right) => left.pos - right.pos);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (t <= first.pos) return { rgb: hexToRgb(first.color), alpha: first.alpha };
  if (t >= last.pos) return { rgb: hexToRgb(last.color), alpha: last.alpha };
  const index = sorted.findIndex((item) => item.pos >= t);
  const right = sorted[index]!;
  const left = sorted[index - 1]!;
  const k = (t - left.pos) / Math.max(1e-6, right.pos - left.pos);
  const ca = hexToRgb(left.color);
  const cb = hexToRgb(right.color);
  return { rgb: ca.map((value, channel) => value + (cb[channel]! - value) * k), alpha: left.alpha + (right.alpha - left.alpha) * k };
}

/** 在画框归一化坐标 (u, v) 处合成各层颜色，透明部分透出 base。 */
export function sampleScenePaints(paints: readonly ScenePaint[], u: number, v: number, base: string): string {
  let rgb = hexToRgb(base);
  for (const paint of paints) {
    let color: { rgb: number[]; alpha: number };
    if (paint.type === "SOLID") color = { rgb: hexToRgb(paint.color), alpha: 1 };
    else {
      const [[a, b, tx], [c, d, ty]] = paint.transform;
      const gx = a * u + b * v + tx;
      const gy = c * u + d * v + ty;
      const dx = gx - 0.5;
      const dy = gy - 0.5;
      const t = paint.type === "GRADIENT_LINEAR"
        ? gx
        : paint.type === "GRADIENT_RADIAL"
          ? Math.hypot(dx, dy) * 2
          : paint.type === "GRADIENT_DIAMOND"
            ? (Math.abs(dx) + Math.abs(dy)) * 2
            : ((Math.atan2(dy, dx) / (2 * Math.PI)) + 1) % 1;
      color = stopAt(paint.stops, t);
    }
    const alpha = color.alpha * (paint.opacity ?? 1);
    rgb = rgb.map((value, channel) => value + (color.rgb[channel]! - value) * alpha);
  }
  return `#${rgb.map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0")).join("")}`;
}

function cssColor(color: string, alpha: number) {
  const [r, g, b] = hexToRgb(color);
  return alpha >= 1 ? color : `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
}

/**
 * 把 Figma 填充层换成 CSS 背景层（第一层在最上面），aspect 为画框宽高比。
 * 渐变轴按真实宽高比换算；菱形渐变 CSS 无对应写法，预览用径向近似。
 */
export function scenePaintsCss(paints: readonly ScenePaint[], aspect = 1): string[] {
  const layers = paints.map((paint) => {
    const opacity = paint.opacity ?? 1;
    if (paint.type === "SOLID") {
      const color = cssColor(paint.color, opacity);
      return `linear-gradient(${color}, ${color})`;
    }
    const inverse = invertTransform(paint.transform);
    const stops = [...paint.stops].sort((a, b) => a.pos - b.pos);
    if (!inverse) {
      const color = cssColor(stops[0]!.color, stops[0]!.alpha * opacity);
      return `linear-gradient(${color}, ${color})`;
    }
    const toPx = (point: { x: number; y: number }) => ({ x: point.x * aspect, y: point.y });
    const center = toPx(inverse(0.5, 0.5));
    const end = toPx(inverse(1, 0.5));
    if (paint.type === "GRADIENT_LINEAR") {
      const start = toPx(inverse(0, 0.5));
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const theta = Math.atan2(dx, -dy);
      const dir = { x: Math.sin(theta), y: -Math.cos(theta) };
      const length = Math.abs(aspect * Math.sin(theta)) + Math.abs(Math.cos(theta));
      const along = (point: { x: number; y: number }) => ((point.x - aspect / 2) * dir.x + (point.y - 0.5) * dir.y) / length + 0.5;
      const t0 = along(start);
      const t1 = along(end);
      const list = stops.map((item) => `${cssColor(item.color, item.alpha * opacity)} ${((t0 + item.pos * (t1 - t0)) * 100).toFixed(2)}%`);
      return `linear-gradient(${((theta * 180) / Math.PI).toFixed(2)}deg, ${list.join(", ")})`;
    }
    const at = `${((center.x / aspect) * 100).toFixed(2)}% ${(center.y * 100).toFixed(2)}%`;
    if (paint.type === "GRADIENT_ANGULAR") {
      const from = (Math.atan2(end.x - center.x, -(end.y - center.y)) * 180) / Math.PI;
      const list = stops.map((item) => `${cssColor(item.color, item.alpha * opacity)} ${(item.pos * 360).toFixed(2)}deg`);
      return `conic-gradient(from ${from.toFixed(2)}deg at ${at}, ${list.join(", ")})`;
    }
    const edge = toPx(inverse(0.5, 1));
    const rx = Math.hypot(end.x - center.x, end.y - center.y) / aspect;
    const ry = Math.hypot(edge.x - center.x, edge.y - center.y);
    const list = stops.map((item) => `${cssColor(item.color, item.alpha * opacity)} ${(item.pos * 100).toFixed(2)}%`);
    return `radial-gradient(${(rx * 100).toFixed(2)}% ${(ry * 100).toFixed(2)}% at ${at}, ${list.join(", ")})`;
  });
  return layers.reverse();
}

export interface SceneHighlightRun {
  start: number;
  end: number;
  paints: ScenePaint[];
}

export function sceneHighlightRuns(scene: SceneState, el: SceneElement, lang: Lang): SceneHighlightRun[] {
  const length = Array.from(sceneText(el, lang)).length;
  return (scene.highlights[el.id]?.[lang] ?? [])
    .filter((range) => range.start < length && range.end > range.start)
    .map((range) => ({ start: range.start, end: Math.min(range.end, length), paints: highlightPaints(scene, range.preset) }));
}

/** 逐字代表色：高亮字取该字在高亮段中心处的合成色，供体检与不支持渐变的场合使用。 */
export function sceneCharColors(scene: SceneState, el: SceneElement, lang: Lang): string[] {
  const characters = Array.from(sceneText(el, lang));
  const base = scene.textColors[el.id] ?? "#FFFFFF";
  const runs = sceneHighlightRuns(scene, el, lang);
  return characters.map((_, index) => {
    const run = runs.find((item) => index >= item.start && index < item.end);
    if (!run) return base;
    return sampleScenePaints(run.paints, (index - run.start + 0.5) / (run.end - run.start), 0.5, base);
  });
}

export interface SceneLayerOut {
  id: string;
  role: SceneRole;
  name: string;
  /** 真实像素。 */
  box: SceneBox;
  anchor: { x: number; y: number };
  align: SceneAlign;
  module?: SceneCustomModule;
  text?: string;
  fontPx?: number;
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: number;
  /** 预览用 @font-face 别名，精确对应所选字重。 */
  fontFace?: string;
  italic?: boolean;
  /** 行高倍数。 */
  lineHeight?: number;
  charColors?: string[];
  /** 高亮段（按字符计）及其 Figma 填充层。 */
  highlightRuns?: SceneHighlightRun[];
  /** 局部字体段（按字符计）。 */
  fontRuns?: SceneFontRunOut[];
  /** 逐行字号（真实像素），只在主标题断行有行比例时给出。 */
  lineFontPx?: number[];
  /** 逐行行高、字间距（真实像素），和 lineFontPx 一起给出。 */
  lineHeightPx?: number[];
  lineLetterSpacing?: number[];
  letterSpacing?: number;
  /** 文字描边，粗细为真实像素。 */
  stroke?: { paints: ScenePaint[]; weight: number; align: SceneStrokeAlign };
  cta?: {
    backgroundColor: string;
    backgroundImage?: string;
    /** 自定义样式的底色填充层；有值时优先于 backgroundColor / backgroundImage。 */
    paints?: ScenePaint[];
    textColor: string;
    paddingX: number;
    minWidth: number;
    maxWidth?: number;
    /** 手动定宽；为空时宽度随文案自适应。 */
    fixedWidth?: number;
    /** 站内规范锁定。 */
    locked?: boolean;
  };
  badge?: SceneBadgeOut;
}

/** 角标的拼装结果，坐标都相对角标外框左上角（真实像素）。 */
export interface SceneBadgeOut {
  style: SceneBadgeStyle;
  length?: "short" | "long";
  /** 固定规格底图（public 下的 SVG 路径），写入前由 Web 端读成文本放进 bgSvg。 */
  bgUrl?: string;
  bgSvg?: string;
  bgBox: SceneBox;
  markUrl?: string;
  markSvg?: string;
  markBox?: SceneBox;
  /** 文字锚点：align=center 时为中心 x，left 为左缘，right 为右缘。 */
  textX: number;
  textCy: number;
  textAlign: SceneAlign;
  textColor: string;
  textOverlay?: { color: string; alpha: number };
  skew?: number;
}

function cssLine(angle: number, w: number, h: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  const fmt = (value: number) => value.toFixed(2);
  return `x1="${fmt(w / 2 - dx * half)}" y1="${fmt(h / 2 - dy * half)}" x2="${fmt(w / 2 + dx * half)}" y2="${fmt(h / 2 + dy * half)}"`;
}

/** 样式1 可拉伸角标的底图：底边两角 30px 圆角，三层填充与训练稿一致。 */
export function sceneBadgeStyle1Svg(w: number, h: number, k: number) {
  const r = Math.min(30 * k, h, w / 2);
  const fmt = (value: number) => value.toFixed(2);
  const path = `M0 0H${fmt(w)}V${fmt(h - r)}A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(w - r)} ${fmt(h)}H${fmt(r)}A${fmt(r)} ${fmt(r)} 0 0 1 0 ${fmt(h - r)}Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w)}" height="${fmt(h)}" viewBox="0 0 ${fmt(w)} ${fmt(h)}" fill="none">`
    + `<defs><linearGradient id="b1a" gradientUnits="userSpaceOnUse" ${cssLine(58.2, w, h)}><stop offset="0.0225" stop-color="#FFD08A"/><stop offset="0.9971" stop-color="#FFE5C0"/></linearGradient>`
    + `<linearGradient id="b1b" gradientUnits="userSpaceOnUse" ${cssLine(81.2, w, h)}><stop offset="0.5389" stop-color="#FFFFFF" stop-opacity="0"/><stop offset="1" stop-color="#FFFBE8" stop-opacity="0.4"/></linearGradient></defs>`
    + `<path d="${path}" fill="#E7C281"/><path d="${path}" fill="url(#b1a)"/><path d="${path}" fill="url(#b1b)"/></svg>`;
}

function badgeOut(scene: SceneState, elementId: string, metrics: SceneMetrics, placement: ScenePlacement, box: SceneBox, board: SceneBoardRef, lang: Lang): SceneBadgeOut {
  const style = sceneBadgeStyle(scene, elementId);
  const script = sceneFontScript(lang);
  const k = metrics.h / (style.id === "earnings" ? EARNINGS_BADGE[script].h : style.h);
  const full = { x: 0, y: 0, w: box.w, h: box.h };
  if (style.id === "earnings") {
    const g = EARNINGS_BADGE[script];
    const side = script === "cjk" ? "zh" : "en";
    return {
      style: style.id,
      bgUrl: `/brand/badges/earnings-${side}-bg.svg`,
      bgBox: { x: g.bg.x * k, y: g.bg.y * k, w: g.bg.w * k, h: g.bg.h * k },
      markUrl: `/brand/badges/earnings-${side}-moomoo.svg`,
      markBox: { x: g.mark.x * k, y: g.mark.y * k, w: g.mark.w * k, h: g.mark.h * k },
      textX: g.text.x * k,
      textCy: g.text.cy * k,
      textAlign: "left",
      textColor: style.textColor,
    };
  }
  /** 贴左边的角标换「左对齐｜安全预留」版本：左侧不切角，文字右移避开安全区。 */
  const flushLeft = box.x <= 1 && placement.align === "left";
  const length = metrics.badgeLength ?? "short";
  const common = { style: style.id, textCy: box.h / 2, textColor: style.textColor, ...(style.textOverlay ? { textOverlay: style.textOverlay } : {}), ...(style.skew ? { skew: style.skew } : {}) };
  if (style.id === "style1") {
    return { ...common, bgSvg: sceneBadgeStyle1Svg(box.w, box.h, k), bgBox: full, textX: box.w / 2 + (flushLeft ? 4 * k : 0), textAlign: "center" };
  }
  if (style.id === "style2") {
    return {
      ...common,
      length,
      bgUrl: `/brand/badges/style2-${length}-${flushLeft ? "left" : "center"}.svg`,
      bgBox: full,
      ...(flushLeft ? { textX: box.w - 47.7 * k, textAlign: "right" as const } : { textX: box.w / 2, textAlign: "center" as const }),
    };
  }
  return { ...common, length, bgUrl: `/brand/badges/style3-${length}.svg`, bgBox: full, textX: box.w / 2 + (flushLeft ? 8 * k : 0), textAlign: "center" };
}

export interface SceneBoard {
  board: { w: number; h: number };
  background: string;
  layers: SceneLayerOut[];
  issues: SceneIssue[];
  /** 自动决策的人话说明，界面原样展示。 */
  notes: string[];
  /** 标题组外框，写入 Figma 时成员放进同一个纵向 Auto Layout。 */
  group: SceneGroupLayout | null;
  /** 左右两侧过渡到底色的宽度（px），压在主视觉上、文字下。 */
  edgeFade?: number;
  /** 该画板所在版式族用的 Logo 样式。 */
  logoPreset: LibraryLogoPreset;
}

export function buildSceneBoard(input: SceneState, board: SceneBoardRef, lang: Lang): SceneBoard {
  const scene = sceneFamilyView(input, sceneBucketOf(board), board.show);
  const custom = scene.ctaPreset === "custom" ? scene.ctaCustom ?? SCENE_CTA_CUSTOM_DEFAULT : null;
  const cta = CTA_STYLE_PRESETS.find((item) => item.id === scene.ctaPreset) ?? CTA_STYLE_PRESETS[0]!;
  const layout = layoutScene(scene, board, lang);
  /** 绘制顺序就是图层顺序（elements 越靠后越在上层），主视觉默认在最底层。 */
  const backdrops = layout.laid.filter(({ el, placement }) => (
    el.role === "module"
    && (placement.customMode ?? el.module?.placementMode) === "title-backdrop"
  ));
  const ordered = layout.laid.filter((item) => !backdrops.includes(item));
  for (const item of backdrops) {
    /** 目标只决定几何位置；层序始终放在整个标题组下面，避免覆盖任一层文字。 */
    const groupIndex = ordered.findIndex((candidate) => isSceneGroupRole(candidate.el.role));
    const insertAt = groupIndex >= 0 ? groupIndex : ordered.length;
    ordered.splice(insertAt, 0, item);
  }
  const layers: SceneLayerOut[] = [];
  const notes: string[] = [];
  const script = sceneFontScript(lang);
  for (const { el, placement, metrics, box } of ordered) {
    const text = el.role === "badge" ? sceneBadgeText(scene, el, lang) : sceneText(el, lang);
    if (metrics.fit !== undefined && metrics.fit < 1) {
      notes.push(`${el.name}超出默认文字列宽，字号自动缩到 ${Math.round(metrics.fit * 100)}%（${Math.round(metrics.fontPx)}px）`);
    }
    if (metrics.locked && el.role === "cta") {
      notes.push(scene.ctaFontUnlocked && Math.round(metrics.fontPx) !== board.ctaSpec!.fontPx ? `CTA 字号已解除规范锁定（${Math.round(metrics.fontPx)}px，规范 ${board.ctaSpec!.fontPx}px）` : "CTA 尺寸按站内规范锁定（高度、字号、内边距与宽度上下限）");
    }
    const badgeStyle = el.role === "badge" ? sceneBadgeStyle(scene, el.id) : null;
    const font = badgeStyle
      ? { ...sceneFont(scene, { id: el.id, role: "title" }, lang), lineHeight: badgeStyle.lineHeight }
      : { ...sceneFont(scene, el, lang), lineHeight: el.role === "cta" ? SCENE_LINE_HEIGHT : sceneLeading(scene, el) };
    const lineStyles = metrics.lineFontPx ? sceneLineStyles(scene, el, metrics.lineFontPx.length, sceneBucketOf(board)) : [];
    const tracking = scene.tracking?.[el.id];
    const letterSpacing = badgeStyle?.letterSpacing?.[script]
      ? badgeStyle.letterSpacing[script] * (metrics.fontPx / badgeStyle.fontPx.short[script])
      : tracking ? tracking * metrics.fontPx : undefined;
    const ctaSpec = el.role === "cta" && metrics.locked ? board.ctaSpec : undefined;
    const ctaScale = el.role === "cta" && board.ctaSpec && !metrics.locked ? metrics.h / board.ctaSpec.height : 0;
    const stroke = SCENE_TEXT_ROLES.includes(el.role) ? scene.strokes?.[el.id] : undefined;
    const fontRuns = SCENE_TEXT_ROLES.includes(el.role) ? sceneFontRuns(scene, el, lang) : [];
    const strokePx = stroke ? stroke.weight * metrics.fontPx : 0;
    layers.push({
      id: el.id,
      role: el.role,
      name: sceneModuleName(scene, el),
      box,
      anchor: { x: placement.x * board.w, y: el.role === "badge" ? box.y + box.h / 2 : placement.y * board.h },
      align: placement.align,
      ...(el.role === "module" && el.module ? {
        module: {
          ...el.module,
          placementMode: placement.customMode ?? el.module.placementMode,
          backdropTarget: placement.backdropTarget ?? el.module.backdropTarget,
        },
      } : {}),
      ...(el.role !== "visual" && el.role !== "logo" && el.role !== "module" ? { text, fontPx: metrics.fontPx, ...font } : {}),
      ...(metrics.lineFontPx ? {
        lineFontPx: metrics.lineFontPx,
        lineHeightPx: metrics.lineFontPx.map((px, index) => px * lineStyles[index]!.leading),
        lineLetterSpacing: metrics.lineFontPx.map((px, index) => px * lineStyles[index]!.tracking),
      } : {}),
      ...(letterSpacing ? { letterSpacing } : {}),
      ...(SCENE_TEXT_ROLES.includes(el.role) ? { charColors: sceneCharColors(scene, el, lang), highlightRuns: sceneHighlightRuns(scene, el, lang) } : {}),
      ...(fontRuns.length ? { fontRuns } : {}),
      ...(badgeStyle ? { badge: badgeOut(scene, el.id, metrics, placement, box, board, lang) } : {}),
      ...(stroke?.visible && strokePx > 0 ? { stroke: { paints: sceneFillPaints(stroke.fill, stroke.opacity), weight: strokePx, align: stroke.align } } : {}),
      ...(el.role === "cta" ? {
        cta: {
          backgroundColor: custom ? (custom.fill.type === "SOLID" ? custom.fill.color : custom.fill.stops[0]?.color ?? "#FF6900") : cta.backgroundColor,
          ...(!custom && cta.backgroundImage ? { backgroundImage: cta.backgroundImage } : {}),
          ...(custom ? { paints: sceneFillPaints(custom.fill) } : {}),
          textColor: scene.textColors[el.id] ?? (custom ? custom.textColor : cta.defaultTextColor),
          paddingX: ctaSpec ? ctaSpec.paddingX : ctaScale ? board.ctaSpec!.paddingX * ctaScale : metrics.h * 0.39,
          minWidth: ctaSpec ? ctaSpec.minWidth : ctaScale ? board.ctaSpec!.minWidth * ctaScale : metrics.h * 2.5,
          ...(ctaSpec ? { maxWidth: ctaSpec.maxWidth, locked: true } : {}),
          ...((!ctaSpec || ctaSpec.lengths) && (placement.length || placement.w) ? { fixedWidth: metrics.w } : {}),
        },
      } : {}),
    });
  }
  if (board.edgeFade) notes.push(`两侧在页面上延展为纯色底：左右各 ${board.edgeFade}px 过渡到底色 ${scene.background.toUpperCase()}，交付时附上这个色值`);
  return {
    board: { w: board.w, h: board.h },
    background: scene.background,
    layers,
    issues: checkSceneBoard(scene, board, lang),
    notes,
    group: layout.group,
    ...(board.edgeFade ? { edgeFade: board.edgeFade } : {}),
    logoPreset: scene.logoPreset,
  };
}

/** 场景写入不经过求解器，Solution 只保留画板尺寸供写入端建 Frame。 */
export function sceneSolution(board: SceneBoardRef): Solution {
  return {
    layout: board.w / board.h >= 1 ? "左文右图" : "居中 · 竖版",
    board: { w: board.w, h: board.h },
    kv: null,
    logo: null,
    badge: null,
    badgeSide: "left",
    sub: null,
    subPx: 0,
    title: null,
    titleLines: [],
    titlePx: 0,
    align: "left",
    cta: null,
    ctaLabel: "",
    ctaPx: 0,
    disc: null,
    discPx: 0,
    discLineCount: 0,
    extra: null,
    notes: [],
  };
}

export function createDefaultScene(copy: Partial<Record<Lang, LangCopy>>): SceneState {
  const pick = (field: (item: LangCopy) => string | undefined, fallback: Partial<Record<Lang, string>>) => {
    const texts: Partial<Record<Lang, string>> = { ...fallback };
    for (const [lang, item] of Object.entries(copy) as Array<[Lang, LangCopy | undefined]>) {
      const value = item ? field(item)?.replace(/\s*[→›>]\s*$/, "").trim() : "";
      if (value) texts[lang] = value;
    }
    return texts;
  };
  return {
    version: 1,
    visualMode: "figma",
    uploadType: "png",
    visualAspect: SCENE_COMPONENT_ASPECT,
    feather: 2,
    focal: { x: 0.5, y: 0.5 },
    safeBox: { x: 0.31, y: 0.2, w: 0.38, h: 0.6 },
    elements: [
      { id: "visual", role: "visual", name: "主视觉组件", visible: true, texts: {} },
      { id: "logo", role: "logo", name: "Logo", visible: false, texts: {} },
      { id: "kicker", role: "kicker", name: "小标题", visible: false, texts: { en: "Market Focus", sc: "市场焦点", tc: "市場焦點", ja: "条件達成で必ずもらおう" } },
      { id: "title", role: "title", name: "主标题", visible: true, texts: pick((item) => item.title, { en: "Smart Money's Next Stop", sc: "聪明钱的下一站", tc: "聰明錢的下一站", ja: "5万円分のNVIDIA株またはSpaceX株" }) },
      { id: "subtitle", role: "subtitle", name: "副标题", visible: true, texts: pick((item) => item.sub, { en: "Where big money moves", sc: "AI 狂欢下的大资金动向", tc: "AI 狂歡下的大資金動向", ja: "条件達成で必ずもらおう" }) },
      { id: "cta", role: "cta", name: "CTA", visible: true, texts: pick((item) => item.ctaShort || item.ctaLong, { en: "Learn More", sc: "立即查看", tc: "立即查看", ja: "今すぐ参加" }) },
    ],
    familyEdits: {},
    boardOverrides: {},
    background: "#121212",
    textColors: {},
    highlights: {},
    customHighlight: ["#FFD98A", "#FFB347"],
    logoPreset: "futu",
    ctaPreset: "brand-orange",
  };
}

export function sceneDefaultElement(role: SceneRole, index: number): SceneElement {
  if (role === "custom") return { id: `custom-${index}-${role}`, role, name: `自定义文字 ${index}`, visible: true, texts: { en: "Custom text", sc: "自定义文案", tc: "自定義文案" } };
  if (role === "module") return { id: `module-${index}`, role, name: `元素${index}`, visible: true, texts: {} };
  if (role === "disclaimer") {
    return { id: "disclaimer", role, name: "免责声明", visible: true, texts: { en: "Investing involves risks.", sc: "投资有风险，入市需谨慎", tc: "投資涉及風險，入市需謹慎" } };
  }
  if (role === "badge") return { id: "badge", role, name: "角标", visible: true, texts: { en: "Limited-time", sc: "限时福利", tc: "限時福利" } };
  const defaults = createDefaultScene({}).elements.find((item) => item.role === role)!;
  return { ...defaults, visible: true };
}

export function sceneStructureRoles(structure: SceneCopyStructure): SceneRole[] {
  if (structure === "single") return ["title"];
  if (structure === "kicker-title") return ["kicker", "title"];
  if (structure === "title-sub") return ["title", "subtitle"];
  return ["kicker", "title", "subtitle"];
}

const SCENE_FAMILIES: readonly SceneFamily[] = ["strip", "landscape", "square", "portrait"];

/**
 * 套用训练版式：决定标题组有哪几层、是否用组合 Logo，并按训练稿写入通栏的对齐、主标题逐行字号比例。
 * 角标与免责是否出现只由文案决定；训练稿带免责时按其位置摆放，否则放在默认位置（CTA 下方）。
 */
export function applySceneCopyVariant(scene: SceneState, key: string, spec: SceneCopyVariantSpec, only?: SceneBucket): SceneState {
  const wanted = new Set<SceneRole>(sceneStructureRoles(spec.structure));
  if (spec.modules.combinedLogo) wanted.add("logo");
  const elements = [...scene.elements];
  for (const role of wanted) {
    if (!elements.some((el) => el.role === role)) elements.push(sceneDefaultElement(role, 0));
  }
  const families = only ? [only] : SCENE_FAMILIES;
  const title = elements.find((el) => el.role === "title");
  const ratios = title && spec.mainTitleLines >= 2 && spec.lineRatios ? spec.lineRatios : undefined;
  const lineRatios = { ...scene.lineRatios };
  if (title && !only) {
    if (ratios) lineRatios[title.id] = ratios;
    else delete lineRatios[title.id];
  }
  const familyLineRatios = Object.fromEntries(Object.entries(scene.familyLineRatios ?? {}).map(([family, map]) => {
    const next = { ...map };
    if (title && (!only || family === only)) delete next[title.id];
    return [family, next];
  })) as NonNullable<SceneState["familyLineRatios"]>;
  /** 只套到一个版式族时，逐行字号写到该族，不动其它族。 */
  if (title && only && (ratios || scene.lineRatios?.[title.id])) familyLineRatios[only] = { ...familyLineRatios[only], [title.id]: ratios ?? [] };
  const familyEdits = { ...scene.familyEdits };
  const patch = (family: SceneBucket, id: string, value: ScenePlacementPatch) => {
    familyEdits[family] = { ...familyEdits[family], [id]: { ...familyEdits[family]?.[id], ...value } };
  };
  for (const family of families) {
    if (sceneBucketFamily(family) !== "strip") continue;
    patch(family, SCENE_GROUP_ID, {
      align: spec.alignment,
      x: spec.groupAnchor?.x ?? (spec.alignment === "center" ? 0.54 : GROUP_POS.strip[0]),
      ...(spec.groupAnchor ? { y: spec.groupAnchor.y } : {}),
    });
  }
  const logo = elements.find((el) => el.role === "logo");
  if (logo && spec.modules.combinedLogo) {
    for (const family of families) {
      const shape = sceneBucketFamily(family);
      if (!familyEdits[family]?.[logo.id]?.attach) patch(family, logo.id, { follow: shape === "strip" ? spec.alignment : GROUP_POS[shape][2] });
    }
  }
  for (const disclaimer of elements.filter((el) => el.role === "disclaimer" && el.visible)) {
    for (const family of families) {
      const shape = sceneBucketFamily(family);
      if (familyEdits[family]?.[disclaimer.id]?.attach) continue;
      if (!spec.modules.disclaimer || spec.disclaimerUnderCta) {
        const [x, y, align] = DEFAULT_POS[shape].disclaimer;
        patch(family, disclaimer.id, { follow: "none", x, y, align });
      } else {
        patch(family, disclaimer.id, { follow: shape === "strip" ? spec.alignment : GROUP_POS[shape][2], ...(shape === "strip" ? { y: 192 / 225 } : {}) });
      }
    }
  }
  for (const badge of elements.filter((el) => el.role === "badge" && el.visible)) {
    for (const family of families) {
      if (!familyEdits[family]?.[badge.id]?.attach) patch(family, badge.id, { follow: "center", y: 0 });
    }
  }
  const logoPreset = spec.modules.combinedLogo && !scene.logoPreset.includes("Nasdaq")
    ? (`${scene.logoPreset.startsWith("moomoo") ? "moomoo" : "futu"}Nasdaq${scene.logoPreset.endsWith("Light") ? "Light" : ""}` as LibraryLogoPreset)
    : scene.logoPreset;
  return {
    ...scene,
    copyKind: spec.kind,
    copyStructure: spec.structure,
    copyVariant: key,
    lineRatios,
    familyLineRatios,
    familyEdits,
    logoPreset,
    elements: elements.map((el) => {
      /** 已编入标题组的 Logo 是用户自己组的，换版式时保留。 */
      if (el.role === "logo" && only && familyEdits[only]?.[el.id]?.attach) return el;
      if (isSceneGroupRole(el.role) || el.role === "logo") return { ...el, visible: wanted.has(el.role) };
      return el;
    }),
  };
}

/** 文案区的填写顺序；CTA 不参与版式匹配。 */
export const SCENE_COPY_SLOTS: readonly SceneRole[] = ["badge", "kicker", "title", "subtitle", "disclaimer"];

/** 当前语言下用户实际填了哪些文案。财报季角标文字固定，开启即算已填。 */
export function sceneFilledCopy(scene: SceneState, lang: Lang): Set<SceneRole> {
  const filled = new Set<SceneRole>();
  for (const role of SCENE_COPY_SLOTS) {
    const el = scene.elements.find((item) => item.role === role);
    if (!el?.visible) continue;
    if (sceneText(el, lang).trim() || (role === "badge" && sceneBadgeStyle(scene, el.id).id === "earnings")) filled.add(role);
  }
  return filled;
}

/** 当前文案的标题组结构；没填主标题时为空。 */
export function sceneFilledStructure(scene: SceneState, lang: Lang): SceneCopyStructure | null {
  const filled = sceneFilledCopy(scene, lang);
  if (!filled.has("title")) return null;
  const kicker = filled.has("kicker");
  const sub = filled.has("subtitle");
  return kicker && sub ? "kicker-title-sub" : kicker ? "kicker-title" : sub ? "title-sub" : "single";
}

export interface SceneCopyFit {
  /** 标题组层次与版式一致，可以套用。 */
  ok: boolean;
  /** 版式需要、但文案没填的标题组层。 */
  missing: SceneRole[];
  /** 文案填了、但版式没有的标题组层。 */
  extra: SceneRole[];
  titleLines: number;
  linesMatch: boolean;
  /** 角标、免责的有无与训练稿一致。 */
  modulesMatch: boolean;
}

/** 只按标题组层次判定能否套用；主标题行数、角标、免责是附加项，不影响能否套用。 */
export function sceneCopyFit(scene: SceneState, lang: Lang, spec: Pick<SceneCopyVariantSpec, "structure" | "mainTitleLines" | "modules">): SceneCopyFit {
  const need = new Set<SceneRole>(sceneStructureRoles(spec.structure));
  const filled = sceneFilledCopy(scene, lang);
  const missing = SCENE_GROUP_ROLES.filter((role) => need.has(role) && !filled.has(role));
  const extra = SCENE_GROUP_ROLES.filter((role) => filled.has(role) && !need.has(role));
  const title = scene.elements.find((el) => el.role === "title");
  const titleLines = title && filled.has("title") ? sceneText(title, lang).split("\n").filter((line) => line.trim()).length : 0;
  const modulesMatch = spec.modules.badge === filled.has("badge") && spec.modules.disclaimer === filled.has("disclaimer");
  return { ok: !missing.length && !extra.length, missing, extra, titleLines, linesMatch: titleLines === spec.mainTitleLines, modulesMatch };
}
