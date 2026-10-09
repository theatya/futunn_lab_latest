import { LAYOUT_PRESETS, recipeById } from "./generated";
import type {
  CorpusLanguage,
  CorpusSourceKind,
  LayoutPresetRecord,
  LayoutRecommendation,
  MasterLayoutFacts,
} from "./types";

const SOURCE_SCORE: Record<CorpusSourceKind, number> = {
  real: 32,
  curated: 26,
  "spec-supplement": 16,
  validation: 0,
};

function corpusLanguageOf(language: MasterLayoutFacts["language"]): CorpusLanguage | null {
  if (language === "en") return "en";
  if (language === "sc" || language === "tc") return "zh-common";
  return null;
}

function modulesEqual(
  left: MasterLayoutFacts["modules"],
  right: LayoutPresetRecord["modules"],
): boolean {
  return left.badge === right.badge
    && left.disclaimer === right.disclaimer
    && left.combinedLogo === right.combinedLogo
    && left.cta === right.cta;
}

function geometryDistance(
  facts: MasterLayoutFacts,
  preset: LayoutPresetRecord,
): number {
  const actual = facts.fingerprint?.normalizedGeometry;
  const expected = recipeById(preset.id)?.fingerprint.normalizedGeometry;
  if (!actual || !expected) return 0;
  const roles = ["titleGroup", "title", "cta", "kv", "badge", "disc", "logo"] as const;
  let distance = 0;
  let compared = 0;
  for (const role of roles) {
    const left = actual[role];
    const right = expected[role];
    if (!left || !right) continue;
    distance += Math.abs(left.x - right.x) + Math.abs(left.y - right.y)
      + Math.abs(left.w - right.w) + Math.abs(left.h - right.h);
    compared += 1;
  }
  return compared ? distance / compared : 0;
}

/**
 * 先做不可违反的结构硬筛，再对兼容方案评分。
 * 不返回跨语言、跨标题结构或模块增减不一致的“看起来差不多”方案。
 */
export function recommendLayoutPresets(
  facts: MasterLayoutFacts,
  limit = 3,
): LayoutRecommendation[] {
  const language = corpusLanguageOf(facts.language);
  if (!language) return [];

  return LAYOUT_PRESETS
    .filter((preset) =>
      !preset.validationOnly
      && preset.language === language
      && preset.board.width === facts.board.width
      && preset.board.height === facts.board.height
      && preset.structure === facts.structure
      && modulesEqual(facts.modules, preset.modules),
    )
    .map((preset) => {
      const recipe = recipeById(preset.id);
      let score = 100 + SOURCE_SCORE[preset.sourceKind];
      const reasons = [
        `${facts.board.width}×${facts.board.height} 同尺寸`,
        `${preset.structure === "single" ? "单标题" : "标题组"}结构一致`,
      ];

      const lineDistance = Math.abs(preset.mainTitleLines - facts.mainTitleLines)
        + Math.abs(preset.subTitleLines - facts.subTitleLines);
      score -= lineDistance * 13;
      if (lineDistance === 0) {
        score += 20;
        reasons.push("标题行数一致");
      }

      if (preset.alignment === facts.alignment) {
        score += 12;
        reasons.push(`${preset.alignment === "left" ? "左对齐" : "居中"}一致`);
      } else {
        score -= 5;
        reasons.push("提供兼容的另一种对齐");
      }

      if (preset.sourceKind === "real") reasons.push("真实案例优先");
      if (preset.sourceKind === "spec-supplement") reasons.push("规范补充兜底");
      const distance = geometryDistance(facts, preset);
      if (distance > 0) {
        score -= Math.round(distance * 30);
        if (distance < 0.08) reasons.push("母版比例关系接近");
      }

      return { preset: recipe ? { ...preset, recipe } : preset, score, reasons };
    })
    .sort((left, right) =>
      right.score - left.score
      || left.preset.name.localeCompare(right.preset.name),
    )
    .slice(0, Math.max(1, limit));
}

/** 按目标行数生成稳定断点；优先保留与目标行数一致的母版断点。 */
export function breaksForLineCount(
  tokensOrCount: number | readonly string[],
  lineCount: number,
  masterBreaks: readonly number[],
): number[] {
  const tokens = typeof tokensOrCount === "number"
    ? Array.from({ length: tokensOrCount }, () => "x")
    : [...tokensOrCount];
  const tokenCount = tokens.length;
  const wanted = Math.max(1, Math.min(lineCount, tokenCount));
  if (wanted <= 1 || tokenCount <= 1) return [];
  if (masterBreaks.length === wanted - 1) return [...masterBreaks];

  const breaks: number[] = [];
  const weights = tokens.map((token) => Math.max(1, [...token].length) + 0.35);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  for (let line = 1; line < wanted; line += 1) {
    const target = total * line / wanted;
    let cumulative = 0;
    let index = 1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let candidate = 1; candidate < tokenCount; candidate += 1) {
      cumulative += weights[candidate - 1]!;
      const distance = Math.abs(target - cumulative);
      if (distance < bestDistance) {
        bestDistance = distance;
        index = candidate;
      }
    }
    if (index > 0 && index < tokenCount && !breaks.includes(index)) breaks.push(index);
  }
  return breaks;
}
