/*
 * 由 scripts/import-corpus.mjs 维护的运行时快照。
 * 原始来源与不可变备份位于 data/corpus/；不要在 UI 中复制这份数据。
 */

import type {
  BadgeStylePresetRecord,
  CtaStylePresetRecord,
  LayoutRecipe,
  LayoutPresetRecord,
  ResourceSlotRule,
} from "./types";
import { IMPORTED_RECIPES } from "./imported-recipes";

export const CORPUS_VERSION = "2026-10-09.3";

const modules = (
  badge = false,
  disclaimer = false,
  combinedLogo = false,
): LayoutPresetRecord["modules"] => ({ badge, disclaimer, combinedLogo, cta: true });

export const LAYOUT_PRESETS: readonly LayoutPresetRecord[] = [
  { id: "en-single-2-center", name: "单标题｜两行断行｜居中对齐｜英文", sourceNodeId: "464:999", sourceSectionId: "466:740", sourceKind: "curated", language: "en", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 2, subTitleLines: 0, alignment: "center", modules: modules() },
  { id: "en-single-2-left", name: "单标题｜两行断行｜左对齐｜英文", sourceNodeId: "464:1029", sourceSectionId: "466:740", sourceKind: "curated", language: "en", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 2, subTitleLines: 0, alignment: "left", modules: modules() },
  { id: "en-single-3-center", name: "单标题｜三行断行｜居中对齐｜英文", sourceNodeId: "464:962", sourceSectionId: "466:740", sourceKind: "curated", language: "en", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 3, subTitleLines: 0, alignment: "center", modules: modules() },
  { id: "en-single-3-left", name: "单标题｜三行断行｜左对齐｜英文", sourceNodeId: "464:1053", sourceSectionId: "466:740", sourceKind: "curated", language: "en", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 3, subTitleLines: 0, alignment: "left", modules: modules() },
  { id: "en-title-sub-left", name: "标题组｜主标题两行＋副标题｜左对齐｜英文", sourceNodeId: "464:1108", sourceSectionId: "466:740", sourceKind: "real", language: "en", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 2, subTitleLines: 1, alignment: "left", modules: modules() },
  { id: "en-title-sub-center", name: "标题组｜主标题两行＋副标题｜居中对齐｜英文", sourceNodeId: "466:854", sourceSectionId: "466:740", sourceKind: "spec-supplement", language: "en", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 2, subTitleLines: 1, alignment: "center", modules: modules() },
  { id: "en-kicker-title-left", name: "标题组｜小标题＋主标题两行｜左对齐｜英文", sourceNodeId: "466:862", sourceSectionId: "466:740", sourceKind: "real", language: "en", board: { width: 1080, height: 225 }, structure: "kicker-title", mainTitleLines: 2, subTitleLines: 0, alignment: "left", modules: modules() },
  { id: "en-kicker-title-center", name: "标题组｜小标题＋主标题两行｜居中对齐｜英文", sourceNodeId: "466:920", sourceSectionId: "466:740", sourceKind: "real", language: "en", board: { width: 1080, height: 225 }, structure: "kicker-title", mainTitleLines: 2, subTitleLines: 0, alignment: "center", modules: modules() },
  { id: "en-title-sub2-center", name: "标题组｜主标题＋副标题两行｜居中对齐｜英文", sourceNodeId: "466:978", sourceSectionId: "466:740", sourceKind: "real", language: "en", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 1, subTitleLines: 2, alignment: "center", modules: modules() },
  { id: "en-title-3-center", name: "标题组｜主标题三行｜居中对齐｜英文", sourceNodeId: "464:1083", sourceSectionId: "466:740", sourceKind: "curated", language: "en", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 3, subTitleLines: 0, alignment: "center", modules: modules() },
  { id: "en-badge", name: "复杂模块｜标题组＋角标｜居中对齐｜英文", sourceNodeId: "466:1034", sourceSectionId: "466:740", sourceKind: "real", language: "en", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 1, subTitleLines: 1, alignment: "center", modules: modules(true) },
  { id: "en-disc", name: "复杂模块｜小标题＋主标题＋免责｜居中对齐｜英文", sourceNodeId: "466:1066", sourceSectionId: "466:740", sourceKind: "real", language: "en", board: { width: 1080, height: 225 }, structure: "kicker-title", mainTitleLines: 2, subTitleLines: 0, alignment: "center", modules: modules(false, true) },
  { id: "en-badge-disc", name: "复杂模块｜单标题＋角标＋免责｜居中对齐｜英文", sourceNodeId: "466:1075", sourceSectionId: "466:740", sourceKind: "spec-supplement", language: "en", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 2, subTitleLines: 0, alignment: "center", modules: modules(true, true) },
  { id: "en-logo", name: "复杂模块｜单标题＋组合Logo｜居中对齐｜英文", sourceNodeId: "466:1086", sourceSectionId: "466:740", sourceKind: "spec-supplement", language: "en", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 2, subTitleLines: 0, alignment: "center", modules: modules(false, false, true) },
  { id: "en-title-logo-left", name: "复杂模块｜主标题两行＋副标题＋组合Logo｜左对齐｜英文", sourceNodeId: "466:794", sourceSectionId: "466:740", sourceKind: "real", language: "en", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 2, subTitleLines: 1, alignment: "left", modules: modules(false, false, true) },
  { id: "en-title-logo-disc-left", name: "复杂模块｜主标题两行＋副标题＋组合Logo＋免责｜左对齐｜英文", sourceNodeId: "470:1686", sourceSectionId: "466:740", sourceKind: "real", language: "en", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 2, subTitleLines: 1, alignment: "left", modules: modules(false, true, true) },

  { id: "zh-single-2-center", name: "单标题｜两行断行｜居中对齐｜简繁通用", sourceNodeId: "471:672", sourceSectionId: "471:671", sourceKind: "curated", language: "zh-common", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 2, subTitleLines: 0, alignment: "center", modules: modules() },
  { id: "zh-single-2-left", name: "单标题｜两行断行｜左对齐｜简繁通用", sourceNodeId: "470:1387", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 2, subTitleLines: 0, alignment: "left", modules: modules() },
  { id: "zh-single-3-left", name: "单标题｜三行断行｜左对齐｜简繁通用", sourceNodeId: "471:696", sourceSectionId: "471:671", sourceKind: "curated", language: "zh-common", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 3, subTitleLines: 0, alignment: "left", modules: modules() },
  { id: "zh-single-3-center", name: "单标题｜三行断行｜居中对齐｜简繁通用", sourceNodeId: "470:1417", sourceSectionId: "471:671", sourceKind: "curated", language: "zh-common", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 3, subTitleLines: 0, alignment: "center", modules: modules() },
  { id: "zh-kicker-title1-center", name: "标题组｜小标题＋主标题一行｜居中对齐｜简繁通用", sourceNodeId: "471:680", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "kicker-title", mainTitleLines: 1, subTitleLines: 0, alignment: "center", modules: modules() },
  { id: "zh-title-sub-center", name: "标题组｜主标题断行＋副标题｜居中对齐｜简繁通用", sourceNodeId: "471:764", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 2, subTitleLines: 1, alignment: "center", modules: modules() },
  { id: "zh-title-sub-left", name: "标题组｜主标题断行＋副标题｜左对齐｜简繁通用", sourceNodeId: "470:1447", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 2, subTitleLines: 1, alignment: "left", modules: modules() },
  { id: "zh-kicker-title2-left", name: "标题组｜小标题＋主标题两行｜左对齐｜简繁通用", sourceNodeId: "471:773", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "kicker-title", mainTitleLines: 2, subTitleLines: 0, alignment: "left", modules: modules() },
  { id: "zh-kicker-title2-center", name: "标题组｜小标题＋主标题两行｜居中对齐｜简繁通用", sourceNodeId: "471:831", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "kicker-title", mainTitleLines: 2, subTitleLines: 0, alignment: "center", modules: modules() },
  { id: "zh-title-sub1-center", name: "标题组｜主标题＋副标题｜居中对齐｜简繁通用", sourceNodeId: "471:945", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 1, subTitleLines: 1, alignment: "center", modules: modules() },
  { id: "zh-kicker-title-sub-center", name: "标题组｜小标题＋主标题＋副标题｜居中对齐｜简繁通用", sourceNodeId: "470:1479", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "kicker-title-sub", mainTitleLines: 1, subTitleLines: 1, alignment: "center", modules: modules() },
  { id: "zh-badge", name: "复杂模块｜标题组＋角标｜居中对齐｜简繁通用", sourceNodeId: "471:1055", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 1, subTitleLines: 1, alignment: "center", modules: modules(true) },
  { id: "zh-disc", name: "复杂模块｜小标题＋主标题断行＋免责｜居中对齐｜简繁通用", sourceNodeId: "471:1088", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "kicker-title", mainTitleLines: 2, subTitleLines: 0, alignment: "center", modules: modules(false, true) },
  { id: "zh-badge-disc", name: "复杂模块｜单标题＋角标＋免责｜居中对齐｜简繁通用", sourceNodeId: "471:1097", sourceSectionId: "471:671", sourceKind: "spec-supplement", language: "zh-common", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 2, subTitleLines: 0, alignment: "center", modules: modules(true, true) },
  { id: "zh-logo", name: "复杂模块｜单标题＋组合Logo｜居中对齐｜简繁通用", sourceNodeId: "471:1108", sourceSectionId: "471:671", sourceKind: "spec-supplement", language: "zh-common", board: { width: 1080, height: 225 }, structure: "single", mainTitleLines: 2, subTitleLines: 0, alignment: "center", modules: modules(false, false, true) },
  { id: "zh-title-logo-center", name: "标题组｜主标题＋副标题＋组合Logo｜居中对齐｜简繁通用", sourceNodeId: "471:703", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 1, subTitleLines: 1, alignment: "center", modules: modules(false, false, true) },
  { id: "zh-title-logo-disc-center", name: "标题组｜主标题＋副标题＋组合Logo＋免责｜居中对齐｜简繁通用", sourceNodeId: "470:1588", sourceSectionId: "471:671", sourceKind: "real", language: "zh-common", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 1, subTitleLines: 1, alignment: "center", modules: modules(false, true, true) },
  { id: "tc-validation-title-sub-left", name: "繁体校验｜标题组｜主标题＋副标题｜左对齐", sourceNodeId: "471:1117", sourceSectionId: "471:671", sourceKind: "validation", language: "tc-validation", board: { width: 1080, height: 225 }, structure: "title-sub", mainTitleLines: 1, subTitleLines: 1, alignment: "left", modules: modules(), validationOnly: true },
];

const pxRect = (x: number, y: number, w: number, h: number) => ({
  boundsPx: { x, y, w, h },
  bounds: { x: x / 1080, y: y / 225, w: w / 1080, h: h / 225 },
});

type ExactRecipeGeometry = {
  group?: [number, number, number, number];
  kv?: [number, number, number, number];
  cta?: [number, number, number, number];
  badge?: [number, number, number, number];
  disc?: [number, number, number, number];
  gap?: number;
  titleFont?: number;
  titleLineHeight?: number;
  secondaryFont?: number;
  lineRatios?: number[];
};

/** 由训练 Figma 节点逐帧回读；不得再退回按结构共用一套估算坐标。 */
const EXACT_RECIPE_GEOMETRY: Readonly<Record<string, ExactRecipeGeometry>> = {
  "en-single-2-center": { group: [245, 49, 588, 136], cta: [856, 72, 200, 80], gap: 10, titleFont: 50, titleLineHeight: 58.5 },
  "en-single-2-left": { group: [252, 46, 588, 142], cta: [856, 72, 200, 80], gap: 10, titleFont: 50, titleLineHeight: 61 },
  "en-single-3-center": { group: [343, 37.09, 470, 156], gap: 12, titleFont: 50 },
  "en-single-3-left": { group: [344, 37.09, 470, 156], gap: 12, titleFont: 50 },
  "en-title-sub-left": { group: [343, 37.09, 470, 151], gap: 12, titleFont: 50, titleLineHeight: 50, secondaryFont: 32.68 },
  "en-title-sub-center": { group: [343, 37.09, 470, 151], gap: 12, titleFont: 50, titleLineHeight: 50, secondaryFont: 32.68 },
  "en-kicker-title-left": { group: [382.79, 41.43, 469.84, 140.66], kv: [-272.05, -148.42, 632.1, 521.85], gap: 19.33, titleFont: 67.49, secondaryFont: 37.65, lineRatios: [1, 0.623] },
  "en-kicker-title-center": { group: [362, 41.43, 469.84, 140.66], kv: [-272.05, -148.43, 632.1, 521.85], gap: 19.33, titleFont: 67.49, secondaryFont: 37.65, lineRatios: [1, 0.623] },
  "en-title-sub2-center": { group: [334, 42.5, 485.29, 144], gap: 14 },
  "en-title-3-center": { group: [399.11, 35, 349, 154] },
  "en-badge": { group: [271, 81.52, 540, 99.8], cta: [848, 78, 200, 80], gap: 12, titleFont: 44, secondaryFont: 32 },
  "en-disc": { group: [292, 21, 535, 149], disc: [514, 184, 92, 24], gap: 3, titleFont: 47.56, secondaryFont: 28 },
  "en-badge-disc": { group: [298, 66.72, 570, 120.96], badge: [460, 0, 246.27, 43], disc: [528, 177, 111, 27], gap: -134, titleFont: 47.35, titleLineHeight: 45.46, lineRatios: [1, 0.798] },
  "en-logo": { group: [298, 85, 570, 120.96], gap: -134, titleFont: 47.35, titleLineHeight: 45.46, lineRatios: [1, 0.798] },
  "en-title-logo-left": { group: [318, 73, 498, 125.89], cta: [856, 72.34, 200, 80], titleFont: 55.34, secondaryFont: 31.86, lineRatios: [1, 0.786] },
  "en-title-logo-disc-left": { group: [318, 73, 498, 125.89], cta: [856, 72.34, 200, 80], disc: [904, 163, 111, 27], titleFont: 55.34, secondaryFont: 31.86, lineRatios: [1, 0.786] },
  "zh-single-2-center": { group: [312.22, 52.04, 536.43, 136.05], gap: -86.98 },
  "zh-single-2-left": { group: [338, 52.04, 536.43, 136.05], gap: -86.98 },
  "zh-single-3-left": { group: [377, 34, 389, 153] },
  "zh-single-3-center": { group: [377, 34, 389, 153] },
  "zh-kicker-title1-center": { group: [316, 24, 515.37, 176.51], cta: [856, 72, 200, 80], gap: -10, titleFont: 84.37, secondaryFont: 58.57 },
  "zh-title-sub-center": { group: [381, 38, 402, 153], titleFont: 46.98 },
  "zh-title-sub-left": { group: [381, 38, 402, 153], titleFont: 46.98 },
  "zh-kicker-title2-left": { group: [373.79, 41.43, 469.84, 150.66], kv: [-272.05, -148.42, 632.1, 521.85], gap: 19.33, titleFont: 52, secondaryFont: 37.65, lineRatios: [1, 0.808] },
  "zh-kicker-title2-center": { group: [358.79, 40.43, 469.84, 148], kv: [-272.05, -148.42, 632.1, 521.85], gap: 11, titleFont: 52, secondaryFont: 37.65, lineRatios: [1, 0.808] },
  "zh-title-sub1-center": { group: [257, 42, 589.2, 141.46], cta: [830, 77.48, 220, 70] },
  "zh-kicker-title-sub-center": { group: [293, 35, 535, 158], gap: 5, secondaryFont: 28 },
  "zh-badge": { group: [320, 74, 442.82, 115.79], cta: [848, 78, 200, 80], gap: -2, titleFont: 58, secondaryFont: 38 },
  "zh-disc": { group: [292, 20, 535, 154], disc: [465, 179, 190, 27], gap: 3, secondaryFont: 28 },
  "zh-badge-disc": { group: [341, 55.32, 479.04, 121.49], badge: [457, 0, 246.18, 43], disc: [485, 179, 190, 27], gap: -77.68 },
  "zh-logo": { group: [335, 80.55, 500.87, 127.03], gap: -81.22 },
  "zh-title-logo-center": { group: [339, 81, 442.83, 116], cta: [856, 72.34, 200, 80] },
  "zh-title-logo-disc-center": { group: [339, 81, 442.83, 116], cta: [856, 72.34, 200, 80], disc: [859, 165, 190, 27] },
  "tc-validation-title-sub-left": { group: [257, 46, 589.2, 141.46], cta: [830, 77.48, 220, 70] },
};

function typography(
  language: LayoutRecipe["language"],
  role: "title" | "sub" | "kicker" | "cta" | "disc" | "badge",
  align: "left" | "center",
) {
  const english = language === "en";
  const fontSize = role === "title" ? (english ? 50 : 44)
    : role === "cta" ? (english ? 30 : 26)
      : role === "disc" ? (english ? 20 : 18)
        : role === "badge" ? 28
        : (english ? 27 : 24);
  const lineHeight = role === "title" ? fontSize
    : role === "cta" ? (english ? 41 : 34)
      : role === "badge" ? 42
        : Math.round(fontSize * 1.2);
  return {
    fontFamily: english ? "BR Hendrix" : "PingFang SC",
    fontStyle: role === "title" || role === "cta" ? "Medium" : "Regular",
    fontWeight: role === "title" || role === "cta" ? 600 : 400,
    fontSizePx: fontSize,
    fontSizeToBoardHeight: fontSize / 225,
    lineHeightPx: lineHeight,
    lineHeightToFontSize: lineHeight / fontSize,
    alignHorizontal: align,
    alignVertical: "center" as const,
    autoResize: "height" as const,
    color: "#ffffff",
    runs: [],
  };
}

function buildRecipe(preset: LayoutPresetRecord): LayoutRecipe {
  const centered = preset.alignment === "center";
  const exact = EXACT_RECIPE_GEOMETRY[preset.id];
  const exactBadgeDisc = preset.id === "en-badge-disc";
  const exactEnglishTitleSub = preset.id === "en-title-sub-left";
  const group = exact?.group
    ? { x: exact.group[0], y: exact.group[1], w: exact.group[2], h: exact.group[3] }
    : centered
    ? { x: 381, y: 38, w: 402, h: 153 }
    : { x: 343, y: 37, w: 470, h: 151 };
  const hasSub = preset.structure === "title-sub" || preset.structure === "kicker-title-sub";
  const hasKicker = preset.structure === "kicker-title" || preset.structure === "kicker-title-sub";
  const secondaryH = hasSub || hasKicker
    ? exact?.secondaryFont
      ? exact.secondaryFont * 1.2
      : preset.language === "en" ? 39 : 41
    : 0;
  const gap = exact?.gap ?? (secondaryH ? 12 : 0);
  const titleH = hasSub || hasKicker
    ? Math.max(1, group.h - secondaryH - gap)
    : group.h;
  const titleY = hasKicker ? group.y + secondaryH + gap : group.y;
  const secondaryY = hasKicker ? group.y : titleY + titleH + gap;
  const layers: LayoutRecipe["layers"] = [
    {
      id: `${preset.id}:kv`,
      sourceNodeId: `${preset.sourceNodeId}:kv`,
      role: "kv",
      name: "主视觉组件",
      order: 0,
      ...pxRect(...(exact?.kv ?? [-198.217, -55.111, 719.843, 418.762])),
      anchor: "board",
      clipContent: false,
    },
    {
      id: `${preset.id}:title-group`,
      sourceNodeId: `${preset.sourceNodeId}:title-group`,
      role: "titleGroup",
      name: "标题组",
      order: 1,
      ...pxRect(group.x, group.y, group.w, group.h),
      anchor: "content",
      autoLayout: {
        mode: "VERTICAL",
        gapPx: gap,
        gapToBoardHeight: gap / 225,
        paddingPx: { top: 0, right: 0, bottom: 0, left: 0 },
        primaryAlign: "CENTER",
        counterAlign: centered ? "CENTER" : "MIN",
        sizingHorizontal: gap < 0 ? "HUG" : "FIXED",
        sizingVertical: gap < 0 ? "FIXED" : "HUG",
      },
    },
    {
      id: `${preset.id}:title`,
      sourceNodeId: `${preset.sourceNodeId}:title`,
      role: "title",
      name: "主标题",
      parentRole: "titleGroup",
      order: hasKicker ? 1 : 0,
      ...pxRect(group.x, titleY, group.w, titleH),
      anchor: "titleGroup",
      typography: {
        ...typography(preset.language, "title", preset.alignment),
        ...(exactBadgeDisc ? {
          fontSizePx: exact?.titleFont ?? 47.35472869873047,
          fontSizeToBoardHeight: (exact?.titleFont ?? 47.35472869873047) / 225,
          lineHeightPx: exact?.titleLineHeight ?? 45.46053955078125,
          lineHeightToFontSize: (exact?.titleLineHeight ?? 45.46053955078125) / (exact?.titleFont ?? 47.35472869873047),
          letterSpacing: -0.01,
          lineFontSizeRatios: exact?.lineRatios ?? [1, 0.798],
        } : {}),
        ...(!exactBadgeDisc && exact?.titleFont ? {
          fontSizePx: exact.titleFont,
          fontSizeToBoardHeight: exact.titleFont / 225,
          lineHeightPx: exact.titleLineHeight ?? exact.titleFont,
          lineHeightToFontSize: (exact.titleLineHeight ?? exact.titleFont) / exact.titleFont,
          lineFontSizeRatios: exact.lineRatios,
        } : {}),
      },
    },
  ];
  if (hasSub || hasKicker) {
    layers.push({
      id: `${preset.id}:secondary`,
      sourceNodeId: `${preset.sourceNodeId}:secondary`,
      role: hasKicker ? "kicker" : "sub",
      name: hasKicker ? "小标题" : "副标题",
      parentRole: "titleGroup",
      order: hasKicker ? 0 : 1,
      ...pxRect(group.x, secondaryY, group.w, secondaryH),
      anchor: "titleGroup",
      typography: {
        ...typography(preset.language, hasKicker ? "kicker" : "sub", preset.alignment),
        ...(exact?.secondaryFont ? {
          fontSizePx: exact.secondaryFont,
          fontSizeToBoardHeight: exact.secondaryFont / 225,
          lineHeightPx: exactEnglishTitleSub ? 39.21917266845703 : exact.secondaryFont * 1.2,
          lineHeightToFontSize: exactEnglishTitleSub ? 1.2 : 1.2,
          letterSpacing: -0.02,
        } : {}),
      },
    });
  }
  if (preset.modules.cta) {
    layers.push({
      id: `${preset.id}:cta`,
      sourceNodeId: `${preset.sourceNodeId}:cta`,
      role: "cta",
      name: "CTA",
      order: 3,
      ...pxRect(...(exact?.cta ?? [847, 73, 200, 80])),
      anchor: "safe-right",
      cornerRadius: 40,
      backgroundColor: "#ff6900",
      typography: typography(preset.language, "cta", "center"),
      autoLayout: {
        mode: "HORIZONTAL",
        gapPx: 10,
        gapToBoardHeight: 10 / 225,
        paddingPx: { top: preset.language === "en" ? 19.5 : 23, right: 31, bottom: preset.language === "en" ? 19.5 : 23, left: 31 },
        primaryAlign: "CENTER",
        counterAlign: "CENTER",
        sizingHorizontal: "HUG",
        sizingVertical: "FIXED",
      },
    });
  }
  if (preset.modules.badge) {
    layers.push({
      id: `${preset.id}:badge`,
      sourceNodeId: `${preset.sourceNodeId}:badge`,
      role: "badge",
      name: "角标",
      order: 4,
      ...pxRect(...(exact?.badge ?? [centered ? 460 : 343, 0, centered ? 246 : 220, 43])),
      anchor: centered ? "titleGroup" : "safe-left",
      cornerRadius: 12,
      typography: typography(preset.language, "badge", "center"),
    });
  }
  if (preset.modules.disclaimer) {
    layers.push({
      id: `${preset.id}:disc`,
      sourceNodeId: `${preset.sourceNodeId}:disc`,
      role: "disc",
      name: "免责文案",
      order: 5,
      ...pxRect(...(exact?.disc ?? [group.x, 202, group.w, 18])),
      anchor: "content",
      typography: typography(preset.language, "disc", preset.alignment),
    });
  }
  if (preset.modules.combinedLogo) {
    layers.push({
      id: `${preset.id}:logo`,
      sourceNodeId: `${preset.sourceNodeId}:logo`,
      role: "logo",
      name: "组合Logo",
      order: 0,
      ...pxRect(centered ? 421 : 343, 28, centered ? 323 : 300, 34),
      anchor: centered ? "titleGroup" : "safe-left",
    });
  }

  return {
    schemaVersion: 1,
    corpusVersion: CORPUS_VERSION,
    id: preset.id,
    name: preset.name,
    source: {
      fileKey: "33G7qGtDpdJXwg3UP0k47O",
      sectionNodeId: preset.sourceSectionId,
      frameNodeId: preset.sourceNodeId,
      sourceKind: preset.sourceKind,
      capturedAt: "2026-10-09T00:00:00.000Z",
    },
    board: { width: 1080, height: 225, clipContent: true },
    language: preset.language,
    structure: preset.structure,
    modules: preset.modules,
    mainTitleLines: preset.mainTitleLines,
    subTitleLines: preset.subTitleLines,
    alignment: preset.alignment,
    layers,
    relations: [
      { kind: centered ? "align-center" : "align-left", from: "title", to: "titleGroup", axis: "x", tolerance: 0.01, hard: true },
      { kind: "avoid-overlap", from: "titleGroup", to: "cta", axis: "x", value: 24 / 1080, tolerance: 0, hard: true },
      { kind: "inside", from: "titleGroup", to: "board", tolerance: 0, hard: true },
    ],
    fitting: {
      approvedLineCounts: [preset.mainTitleLines],
      fontScaleSteps: [1, 0.95, 0.9, 0.85],
      minFontScale: 0.85,
      maxFontScale: 1,
      overflow: "block",
      preserveStructure: true,
    },
    fingerprint: {
      schemaVersion: 1,
      board: { width: 1080, height: 225, aspect: 1080 / 225 },
      structure: preset.structure,
      modules: preset.modules,
      mainTitleLines: preset.mainTitleLines,
      subTitleLines: preset.subTitleLines,
      alignment: preset.alignment,
      roleTopology: layers.map((layer) => `${layer.parentRole ?? "board"}>${layer.role}`),
      normalizedGeometry: Object.fromEntries(layers.map((layer) => [layer.role, layer.bounds])),
      relativeTypeScale: Object.fromEntries(
        layers.filter((layer) => layer.typography).map((layer) => [layer.role, layer.typography!.fontSizeToBoardHeight]),
      ),
      autoLayoutSignature: layers.filter((layer) => layer.autoLayout).map((layer) => `${layer.role}:${layer.autoLayout!.mode}`),
      componentIds: layers.flatMap((layer) => layer.componentId ? [layer.componentId] : []),
    },
    validationOnly: preset.validationOnly,
  };
}

type ImportedLayer = {
  sourceNodeId: string;
  role: string;
  name: string;
  type?: string;
  order?: number;
  bounds: LayoutRecipe["layers"][number]["bounds"];
  boundsPx: LayoutRecipe["layers"][number]["boundsPx"];
  componentId?: string;
  autoLayout?: Partial<NonNullable<LayoutRecipe["layers"][number]["autoLayout"]>>;
  typography?: Partial<NonNullable<LayoutRecipe["layers"][number]["typography"]>>;
};

type ImportedRecipe = {
  source?: { frameNodeId?: string; capturedAt?: string };
  id?: string;
  board?: { clipContent?: boolean };
  layers?: ImportedLayer[];
};

function unionImportedBounds(layers: ImportedLayer[]) {
  const left = Math.min(...layers.map((layer) => layer.boundsPx.x));
  const top = Math.min(...layers.map((layer) => layer.boundsPx.y));
  const right = Math.max(...layers.map((layer) => layer.boundsPx.x + layer.boundsPx.w));
  const bottom = Math.max(...layers.map((layer) => layer.boundsPx.y + layer.boundsPx.h));
  return pxRect(left, top, right - left, bottom - top);
}

function applyImportedRecipe(base: LayoutRecipe): LayoutRecipe {
  const imported = (IMPORTED_RECIPES as readonly ImportedRecipe[]).find((candidate) =>
    candidate.source?.frameNodeId === base.source.frameNodeId || candidate.id === base.source.frameNodeId,
  );
  if (!imported?.layers?.length) return base;
  const layers = base.layers.map((layer) => {
    const candidates = imported.layers!.filter((candidate) => candidate.role === layer.role);
    if (!candidates.length) return layer;
    const textCandidates = candidates.filter((candidate) => candidate.type === "TEXT");
    const geometryCandidate = candidates.find((candidate) => candidate.type !== "TEXT") ?? candidates[0]!;
    const geometry = layer.role === "title" && textCandidates.length > 1
      ? unionImportedBounds(textCandidates)
      : { bounds: geometryCandidate.bounds, boundsPx: geometryCandidate.boundsPx };
    const typographyCandidate = textCandidates[0]?.typography ?? geometryCandidate.typography;
    return {
      ...layer,
      ...geometry,
      sourceNodeId: geometryCandidate.sourceNodeId,
      name: geometryCandidate.name || layer.name,
      order: geometryCandidate.order ?? layer.order,
      componentId: geometryCandidate.componentId ?? layer.componentId,
      autoLayout: geometryCandidate.autoLayout && layer.autoLayout
        ? { ...layer.autoLayout, ...geometryCandidate.autoLayout }
        : layer.autoLayout,
      typography: typographyCandidate && layer.typography
        ? { ...layer.typography, ...typographyCandidate }
        : layer.typography,
    };
  });
  return {
    ...base,
    source: {
      ...base.source,
      capturedAt: imported.source?.capturedAt ?? base.source.capturedAt,
    },
    board: {
      ...base.board,
      clipContent: imported.board?.clipContent ?? base.board.clipContent,
    },
    layers,
    fingerprint: {
      ...base.fingerprint,
      normalizedGeometry: Object.fromEntries(layers.map((layer) => [layer.role, layer.bounds])),
      relativeTypeScale: Object.fromEntries(
        layers.filter((layer) => layer.typography).map((layer) => [layer.role, layer.typography!.fontSizeToBoardHeight]),
      ),
      autoLayoutSignature: layers.filter((layer) => layer.autoLayout).map((layer) => `${layer.role}:${layer.autoLayout!.mode}`),
      componentIds: layers.flatMap((layer) => layer.componentId ? [layer.componentId] : []),
    },
  };
}

export const LAYOUT_RECIPES: readonly LayoutRecipe[] = LAYOUT_PRESETS.map(buildRecipe).map(applyImportedRecipe);
export const recipeById = (id: string): LayoutRecipe | undefined => LAYOUT_RECIPES.find((recipe) => recipe.id === id);

export const RESOURCE_SLOT_RULES: readonly ResourceSlotRule[] = [
  {
    id: "s1",
    name: "我的 tab banner",
    width: 1080,
    height: 225,
    sourcePageId: "92:573",
    status: "verified",
    minPadX: 24,
    maxTitleLines: 3,
    cta: {
      height: 80,
      fontPx: 30,
      paddingX: 40,
      minWidth: 200,
      maxWidth: 360,
      anchor: "right",
      gapX: 24,
    },
    outputMode: "layout",
    notes: ["CTA 宽度随文案 Hug；高度、字号、Padding 与右锚点来自纯净版规范。"],
  },
  { id: "global-popup", name: "全局弹窗", width: 810, height: 1110, sourcePageId: "0:1", status: "pending", outputMode: "layout", notes: ["纯净版已快照，几何字段待导入器复核。"] },
  { id: "flash-master", name: "闪屏主尺寸", width: 2000, height: 2400, sourcePageId: "0:1", status: "pending", excludedFromBannerTraining: true, outputMode: "flash-template", notes: ["闪屏不进入 Banner 训练。"] },
];

export const CTA_STYLE_PRESETS: readonly CtaStylePresetRecord[] = [
  { id: "brand-orange", name: "橙色实底｜白字", sourceNodeId: "446:7445", backgroundColor: "#ff6900", textColor: "#ffffff", stretch: "hug" },
  { id: "orange-gradient", name: "橙色渐变｜白字", sourceNodeId: "446:7443", backgroundColor: "#f06400", backgroundImage: "linear-gradient(90deg,#ff6626 0%,#f04700 100%)", textColor: "#ffffff", stretch: "hug" },
  { id: "black", name: "黑色实底｜白字", sourceNodeId: "446:7447", backgroundColor: "#121212", textColor: "#ffffff", stretch: "hug" },
  { id: "champagne", name: "浅金渐变｜深字", sourceNodeId: "446:7449", backgroundColor: "#ffe5c0", backgroundImage: "linear-gradient(90deg,#fff9ea 0%,#ffcf83 100%)", textColor: "#391a00", stretch: "hug" },
];

const badge = (
  id: string,
  sourceNodeId: string,
  style: 1 | 2 | 3,
  sizing: BadgeStylePresetRecord["sizing"],
  alignment: "left" | "center",
  language: "en" | "zh-common",
): BadgeStylePresetRecord => ({
  id,
  name: `样式${style}｜${sizing === "hug" ? "可拉伸" : sizing === "fixed-short" ? "固定短版" : "固定长版"}｜${alignment === "left" ? "左对齐" : "居中"}`,
  sourceNodeId,
  style,
  sizing,
  alignment,
  language,
  safeInset: alignment === "left",
});

export const BADGE_STYLE_PRESETS: readonly BadgeStylePresetRecord[] = [
  badge("badge-1-en-center", "451:7569", 1, "hug", "center", "en"),
  badge("badge-1-zh-center", "459:11238", 1, "hug", "center", "zh-common"),
  badge("badge-1-en-left", "470:1925", 1, "hug", "left", "en"),
  badge("badge-1-zh-left", "470:1931", 1, "hug", "left", "zh-common"),
  badge("badge-2-en-center-short", "459:11224", 2, "fixed-short", "center", "en"),
  badge("badge-2-en-center-long", "451:8253", 2, "fixed-long", "center", "en"),
  badge("badge-2-zh-center-short", "459:11223", 2, "fixed-short", "center", "zh-common"),
  badge("badge-2-zh-center-long", "459:11232", 2, "fixed-long", "center", "zh-common"),
  badge("badge-2-en-left-short", "470:1868", 2, "fixed-short", "left", "en"),
  badge("badge-2-en-left-long", "470:1777", 2, "fixed-long", "left", "en"),
  badge("badge-2-zh-left-short", "470:1895", 2, "fixed-short", "left", "zh-common"),
  badge("badge-2-zh-left-long", "470:1889", 2, "fixed-long", "left", "zh-common"),
  badge("badge-3-en-center-short", "451:8496", 3, "fixed-short", "center", "en"),
  badge("badge-3-en-center-long", "459:11240", 3, "fixed-long", "center", "en"),
  badge("badge-3-zh-center-short", "459:11244", 3, "fixed-short", "center", "zh-common"),
  badge("badge-3-zh-center-long", "459:11248", 3, "fixed-long", "center", "zh-common"),
  badge("badge-3-en-left-short", "470:1905", 3, "fixed-short", "left", "en"),
  badge("badge-3-en-left-long", "470:1901", 3, "fixed-long", "left", "en"),
  badge("badge-3-zh-left-short", "470:1909", 3, "fixed-short", "left", "zh-common"),
  badge("badge-3-zh-left-long", "470:1913", 3, "fixed-long", "left", "zh-common"),
];
