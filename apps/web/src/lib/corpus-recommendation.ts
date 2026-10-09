import {
  breaksForLineCount,
  recommendLayoutPresets,
  type MasterLayoutFacts,
  type TextStructure,
} from "@futu/corpus";
import type { CopyLayoutPreset, Lang } from "@futu/domain";

export interface RecommendationInput {
  lang: Lang;
  board: { width: number; height: number };
  structure: TextStructure;
  mainTitleLines: number;
  subTitleLines: number;
  alignment: "left" | "center";
  modules: MasterLayoutFacts["modules"];
  fingerprint?: MasterLayoutFacts["fingerprint"];
  titleTokens: string[];
  masterBreaks: number[];
  sourceFrameId: string;
}

export function buildRecommendedCopyPresets(input: RecommendationInput): CopyLayoutPreset[] {
  const recommendations = recommendLayoutPresets({
    language: input.lang,
    board: input.board,
    structure: input.structure,
    mainTitleLines: input.mainTitleLines,
    subTitleLines: input.subTitleLines,
    alignment: input.alignment,
    modules: input.modules,
    fingerprint: input.fingerprint,
  });

  return recommendations.map(({ preset, score, reasons }, index) => ({
    id: `corpus:${preset.id}`,
    corpusPresetId: preset.id,
    corpusVersion: preset.recipe?.corpusVersion,
    recipeId: preset.recipe?.id,
    fingerprintHash: input.fingerprint?.hash,
    applicationState: "recommended",
    name: `${index === 0 ? "推荐｜" : "备选｜"}${preset.name.replace(/｜(英文|简繁通用)$/, "")}`,
    sourceFrameId: input.sourceFrameId,
    recommendationReason: reasons.join(" · "),
    recommendationScore: score,
    titleBreaks: breaksForLineCount(
      input.titleTokens,
      preset.mainTitleLines,
      input.masterBreaks,
    ),
    titleStack: preset.structure === "kicker-title" || preset.structure === "kicker-title-sub"
      ? "sub-first"
      : "title-first",
  }));
}
