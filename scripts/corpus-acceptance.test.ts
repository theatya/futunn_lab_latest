import "../packages/corpus/src/matcher.test";
import { readFileSync } from "node:fs";
import { LAYOUT_PRESETS, LAYOUT_RECIPES, recommendLayoutPresets, recipeById } from "../packages/corpus/src";
import { ApproxMeasurer, solve } from "../packages/solver/src";
import type { Lang, RecipeRole, RecipeTypography } from "../packages/domain/src";
import { buildMasterLayoutFingerprint } from "../apps/web/src/lib/layout-fingerprint";
import type { FigmaRecognitionResult } from "../apps/web/src/lib/figma-recognition";

interface GoldenCase {
  id: string;
  recipeId: string;
  runtimeLanguage: Lang;
  tokens: string[];
  breaks: number[];
  sub: string;
  badge?: string;
  disclaimer?: string;
  expectedRoles: RecipeRole[];
}

interface GoldenFixture {
  corpusVersion: string;
  board: { width: number; height: number };
  gates: {
    geometryTolerancePx: number;
    minimumQualityScore: number;
    allowedBlockingIssues: number;
    requireExactLineCount: boolean;
    requireRecipeTrace: boolean;
    requireStructuredTypography: boolean;
    requireAutoLayout: boolean;
  };
  cases: GoldenCase[];
}

const fixture = JSON.parse(
  readFileSync(new URL("../data/corpus/golden/1080x225.acceptance.json", import.meta.url), "utf8"),
) as GoldenFixture;

function equal(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: expected ${String(expected)}, received ${String(actual)}`);
}

function near(actual: number, expected: number, tolerance: number, label: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label}: expected ${expected}±${tolerance}, received ${actual}`);
  }
}

equal(LAYOUT_RECIPES.length, LAYOUT_PRESETS.length, "every catalog preset has a recipe");
for (const recipe of LAYOUT_RECIPES.filter((item) => !item.validationOnly)) {
  for (const role of ["kv", "title", "cta"] as const) {
    if (!recipe.layers.some((layer) => layer.role === role)) {
      throw new Error(`${recipe.id}: missing ${role}`);
    }
  }
}

const sample = recipeById("en-title-sub-left");
if (!sample) throw new Error("missing en-title-sub-left recipe");
const sampleGroup = sample.layers.find((layer) => layer.role === "titleGroup");
const sampleCta = sample.layers.find((layer) => layer.role === "cta");
const sampleKv = sample.layers.find((layer) => layer.role === "kv");
if (!sampleGroup || !sampleCta || !sampleKv) throw new Error("sample recipe is incomplete");
near(sampleGroup.boundsPx.x, 343, 0.01, "sample title x");
near(sampleGroup.boundsPx.y, 37.0941162109375, 0.01, "sample title y");
near(sampleGroup.boundsPx.w, 470, 0.01, "sample title width");
near(sampleCta.boundsPx.x, 847, 0.01, "sample CTA x");
near(sampleCta.boundsPx.h, 80, 0.01, "sample CTA height");
near(sampleKv.boundsPx.x, -198.217, 0.01, "sample KV x");
near(sampleKv.boundsPx.w, 719.843, 0.01, "sample KV width");

const recommendations = recommendLayoutPresets({
  language: "en",
  board: { width: 1080, height: 225 },
  structure: "title-sub",
  mainTitleLines: 2,
  subTitleLines: 1,
  alignment: "left",
  modules: { cta: true, badge: false, disclaimer: false, combinedLogo: false },
});
equal(recommendations[0]?.preset.id, "en-title-sub-left", "top recommendation");
if (!recommendations[0]?.preset.recipe) throw new Error("recommendation did not carry its recipe");

const solution = solve({
  board: { w: 1080, h: 225 },
  content: {
    lang: "en",
    titleTokens: ["Transfer", "to", "Earn", "More"],
    titleBreaks: [2],
    titleBreakFixed: true,
    sub: "Welcome offer",
    titleStack: "title-first",
    ctaLong: "Claim now",
    ctaShort: "Claim",
    badge: "",
    disclaimer: "",
  },
  recipe: sample,
  recipeTrace: { corpusVersion: sample.corpusVersion, recipeId: sample.id },
  spec: {
    source: "golden",
    version: sample.corpusVersion,
    minPadX: 24,
    maxTitleLines: 3,
    cta: { height: 80, fontPx: 30, paddingX: 40, minWidth: 200, maxWidth: 360, anchor: "right", gapX: 24 },
    todo: [],
  },
  show: { kv: true, logo: false, badge: false, sub: true, title: true, cta: true, disc: false, extra: false },
  measurer: new ApproxMeasurer(),
});
equal(solution.recipeTrace?.recipeId, sample.id, "resolved recipe trace");
equal(solution.titleLines.length, 2, "recipe line count");
near((solution.kv?.w ?? 0) * 1080, 719.843, 0.1, "solver KV width");
near((solution.title?.x ?? 0) * 1080, 343, 0.1, "solver title x");
const trainedCta = sample.layers.find((layer) => layer.role === "cta");
near(
  ((solution.cta?.x ?? 0) + (solution.cta?.w ?? 0)) * 1080,
  (trainedCta?.boundsPx.x ?? 0) + (trainedCta?.boundsPx.w ?? 0),
  0.1,
  "solver CTA trained right anchor",
);
if ((solution.quality?.geometryDeviation ?? 0) <= 0) {
  throw new Error("responsive CTA stretch must be reflected in geometry deviation");
}
equal(solution.quality?.status, "pass", "golden quality");

const complexEnglish = recipeById("en-badge-disc");
if (!complexEnglish) throw new Error("missing en-badge-disc recipe");
const complexGroup = complexEnglish.layers.find((layer) => layer.role === "titleGroup");
const complexTitle = complexEnglish.layers.find((layer) => layer.role === "title");
const complexBadge = complexEnglish.layers.find((layer) => layer.role === "badge");
const complexDisc = complexEnglish.layers.find((layer) => layer.role === "disc");
const complexCta = complexEnglish.layers.find((layer) => layer.role === "cta");
if (!complexGroup || !complexTitle || !complexBadge || !complexDisc || !complexCta) {
  throw new Error("en-badge-disc exact recipe is incomplete");
}
near(complexGroup.boundsPx.x, 298, 0.01, "complex title group x");
near(complexGroup.boundsPx.y, 66.7197265625, 0.01, "complex title group y");
near(complexGroup.boundsPx.w, 570, 0.01, "complex title group width");
near(complexTitle.typography?.fontSizePx ?? 0, 47.35472869873047, 0.01, "complex title font");
near(complexBadge.boundsPx.w, 246, 1, "complex badge width");
near(complexDisc.boundsPx.y, 177, 0.01, "complex disclaimer y");
near(complexCta.cornerRadius ?? 0, 40, 0.01, "complex CTA radius");
const complexReplay = solve({
  board: { w: 1080, h: 225 },
  content: {
    lang: "en",
    titleTokens: ["Deposit", "$100", "to", "earn", "up", "to", "$200", "in", "Trading", "Coupons"],
    titleBreaks: [4],
    titleBreakFixed: true,
    sub: "",
    titleStack: "title-first",
    ctaLong: "Claim now",
    ctaShort: "Claim",
    badge: "Limited-time",
    disclaimer: "*T&Cs apply.",
  },
  recipe: complexEnglish,
  recipeTrace: { corpusVersion: complexEnglish.corpusVersion, recipeId: complexEnglish.id },
  spec: {
    source: "golden-complex",
    version: complexEnglish.corpusVersion,
    minPadX: 24,
    maxTitleLines: 3,
    cta: { height: 80, fontPx: 30, paddingX: 31, minWidth: 200, maxWidth: 360, anchor: "right", gapX: 33 },
    todo: [],
  },
  show: { kv: true, logo: false, badge: true, sub: false, title: true, cta: true, disc: true, extra: false },
  measurer: new ApproxMeasurer(),
});
if (complexReplay.quality?.status !== "pass") {
  throw new Error(`complex source replay blocked: ${complexReplay.quality?.issues.map((issue) => issue.code).join(", ")}`);
}

equal(fixture.corpusVersion, sample.corpusVersion, "golden fixture corpus version");
equal(fixture.board.width, 1080, "golden board width");
equal(fixture.board.height, 225, "golden board height");

const frozenTitleStyle: RecipeTypography = {
  fontFamily: "BR Hendrix",
  fontStyle: "Medium",
  fontWeight: 600,
  fontSizePx: 46,
  fontSizeToBoardHeight: 46 / 225,
  lineHeightPx: 52,
  lineHeightToFontSize: 52 / 46,
  alignHorizontal: "left",
  alignVertical: "center",
  autoResize: "height",
  color: "#ffffff",
  runs: [
    { start: 0, end: 8, fontFamily: "BR Hendrix", fontStyle: "Bold", fontWeight: 700, color: "#ff6900" },
  ],
};

for (const golden of fixture.cases) {
  const recipe = recipeById(golden.recipeId);
  if (!recipe) throw new Error(`${golden.id}: missing recipe ${golden.recipeId}`);
  equal(recipe.validationOnly === true, false, `${golden.id}: deliverable recipe`);

  const roles = new Set(recipe.layers.map((layer) => layer.role));
  for (const role of golden.expectedRoles) {
    if (!roles.has(role)) throw new Error(`${golden.id}: missing expected role ${role}`);
  }
  if (fixture.gates.requireAutoLayout && !recipe.layers.some((layer) => layer.role === "titleGroup" && layer.autoLayout)) {
    throw new Error(`${golden.id}: title group is not structured Auto Layout`);
  }

  const result = solve({
    board: { w: fixture.board.width, h: fixture.board.height },
    content: {
      lang: golden.runtimeLanguage,
      titleTokens: golden.tokens,
      titleBreaks: golden.breaks,
      titleBreakFixed: true,
      sub: golden.sub,
      titleStack: recipe.structure.startsWith("kicker") ? "sub-first" : "title-first",
      ctaLong: golden.runtimeLanguage === "en" ? "Claim now" : "立即领取",
      ctaShort: golden.runtimeLanguage === "en" ? "Claim" : "领取",
      badge: golden.badge ?? "",
      disclaimer: golden.disclaimer ?? "",
    },
    recipe,
    recipeTrace: { corpusVersion: recipe.corpusVersion, recipeId: recipe.id },
    typographyOverrides: { title: frozenTitleStyle },
    spec: {
      source: "golden",
      version: recipe.corpusVersion,
      minPadX: 24,
      maxTitleLines: 3,
      cta: { height: 80, fontPx: 30, paddingX: 40, minWidth: 200, maxWidth: 360, anchor: "right", gapX: 24 },
      todo: [],
    },
    show: {
      kv: true,
      logo: recipe.modules.combinedLogo,
      badge: recipe.modules.badge,
      sub: recipe.structure !== "single",
      title: true,
      cta: true,
      disc: recipe.modules.disclaimer,
      extra: false,
    },
    measurer: new ApproxMeasurer(),
  });

  const blockingIssues = result.quality?.issues.filter((issue) => issue.level === "block") ?? [];
  if (blockingIssues.length > fixture.gates.allowedBlockingIssues) {
    throw new Error(`${golden.id}: blocked by ${blockingIssues.map((issue) => issue.code).join(", ")}`);
  }
  if ((result.quality?.score ?? 0) < fixture.gates.minimumQualityScore) {
    throw new Error(`${golden.id}: quality score ${result.quality?.score ?? 0} is below gate`);
  }
  if (fixture.gates.requireExactLineCount) {
    equal(result.titleLines.length, recipe.mainTitleLines, `${golden.id}: exact line count`);
  }
  if (fixture.gates.requireRecipeTrace) {
    equal(result.recipeTrace?.recipeId, recipe.id, `${golden.id}: recipe trace`);
  }
  if (fixture.gates.requireStructuredTypography) {
    const resolvedTitle = result.resolvedLayers?.find((layer) => layer.role === "title");
    equal(resolvedTitle?.typography?.fontFamily, frozenTitleStyle.fontFamily, `${golden.id}: frozen font family`);
    equal(resolvedTitle?.typography?.runs.length, 1, `${golden.id}: rich text runs`);
  }
}

const traditionalRecommendations = recommendLayoutPresets({
  language: "tc",
  board: { width: 1080, height: 225 },
  structure: "title-sub",
  mainTitleLines: 1,
  subTitleLines: 1,
  alignment: "left",
  modules: { cta: true, badge: false, disclaimer: false, combinedLogo: false },
}, 20);
if (!traditionalRecommendations.length) throw new Error("traditional Chinese should reuse zh-common recipes");
if (traditionalRecommendations.some((item) => item.preset.validationOnly)) {
  throw new Error("validation-only Traditional Chinese recipe leaked into recommendations");
}

const overflowing = solve({
  board: { w: 1080, h: 225 },
  content: {
    lang: "en",
    titleTokens: ["This extraordinarily long sentence cannot fit", "inside the approved training title region"],
    titleBreaks: [1],
    titleBreakFixed: true,
    sub: "Welcome offer",
    titleStack: "title-first",
    ctaLong: "Claim now",
    ctaShort: "Claim",
    badge: "",
    disclaimer: "",
  },
  recipe: sample,
  recipeTrace: { corpusVersion: sample.corpusVersion, recipeId: sample.id },
  spec: {
    source: "golden-overflow",
    version: sample.corpusVersion,
    minPadX: 24,
    maxTitleLines: 3,
    cta: { height: 80, fontPx: 30, paddingX: 40, minWidth: 200, maxWidth: 360, anchor: "right", gapX: 24 },
    todo: [],
  },
  show: { kv: true, logo: false, badge: false, sub: true, title: true, cta: true, disc: false, extra: false },
  measurer: new ApproxMeasurer(),
});
equal(overflowing.quality?.status, "blocked", "overflow must block output");
if (!overflowing.quality?.issues.some((issue) => issue.code === "TITLE_OVERFLOW")) {
  throw new Error("overflow did not produce TITLE_OVERFLOW");
}

const multilineTitleFingerprint = buildMasterLayoutFingerprint({
  frame: { id: "frame", name: "1080×225", width: 1080, height: 225, layerCount: 4 },
  fileKey: "fixture",
  fileName: "fixture",
  tree: [],
  layers: [
    {
      id: "legacy-kv",
      name: "Legacy KV mapping",
      text: "",
      textNodes: [],
      nodeType: "INSTANCE",
      role: "title",
      suggestedRole: "kv",
      reason: "legacy fixture",
      confidence: 1,
      path: [],
    },
    {
      id: "title-group",
      name: "EN-居中对齐两行",
      text: "Deposit $100 to earn up to $200",
      textNodes: [
        { id: "line-1", name: "Main Heading", order: 0, text: "Deposit $100 to earn", fontSize: 40, textAlignHorizontal: "CENTER" },
        { id: "line-2", name: "Main Heading", order: 1, text: "up to $200", fontSize: 38, textAlignHorizontal: "CENTER" },
      ],
      nodeType: "INSTANCE",
      role: "titleGroup",
      suggestedRole: "titleGroup",
      reason: "fixture",
      confidence: 1,
      path: [],
    },
    {
      id: "cta",
      name: "CTA",
      text: "Claim",
      textNodes: [],
      nodeType: "FRAME",
      role: "cta",
      suggestedRole: "cta",
      reason: "fixture",
      confidence: 1,
      path: [],
    },
  ],
} as unknown as FigmaRecognitionResult, "en");
equal(multilineTitleFingerprint.structure, "single", "two main-heading layers remain one title");
equal(multilineTitleFingerprint.mainTitleLines, 2, "multi-layer main title line count");
equal(multilineTitleFingerprint.subTitleLines, 0, "multi-layer main title has no inferred subtitle");

console.log("1080×225 recipe acceptance tests passed.");
