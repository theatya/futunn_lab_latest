import type {
  LayoutRecipe,
  MasterLayoutFingerprint,
  RecipeModules,
  RecipeSourceKind,
  RecipeTextStructure,
} from "@futu/domain";

export type CorpusLanguage = "en" | "zh-common" | "tc-validation";
export type TextStructure = RecipeTextStructure;
export type TextAlignment = "left" | "center";
export type CorpusSourceKind = RecipeSourceKind;

export type ComplexModules = RecipeModules;
export type { LayoutRecipe, MasterLayoutFingerprint };

export interface LayoutPresetRecord {
  id: string;
  name: string;
  sourceNodeId: string;
  sourceSectionId: string;
  sourceKind: CorpusSourceKind;
  language: CorpusLanguage;
  board: { width: number; height: number };
  structure: TextStructure;
  mainTitleLines: number;
  subTitleLines: number;
  alignment: TextAlignment;
  modules: ComplexModules;
  /** 规范化运行时库应始终提供；可选仅用于读取旧版本目录。 */
  recipe?: LayoutRecipe;
  validationOnly?: boolean;
}

export interface CtaGeometryRule {
  height: number;
  fontPx: number;
  paddingX: number;
  minWidth: number;
  maxWidth: number;
  anchor: "left" | "center" | "right";
  gapX: number;
}

export interface ResourceSlotRule {
  id: string;
  name: string;
  width: number;
  height: number;
  sourcePageId: string;
  sourceNodeId?: string;
  status: "verified" | "pending";
  minPadX?: number;
  maxTitleLines?: number;
  cta?: CtaGeometryRule;
  excludedFromBannerTraining?: boolean;
  outputMode?: "layout" | "visual-crop" | "flash-template" | "component";
  notes: string[];
}

export interface CtaStylePresetRecord {
  id: "brand-orange" | "orange-gradient" | "black" | "champagne";
  name: string;
  sourceNodeId: string;
  backgroundColor: string;
  backgroundImage?: string;
  textColor: string;
  stretch: "hug";
}

export interface BadgeStylePresetRecord {
  id: string;
  name: string;
  sourceNodeId: string;
  style: 1 | 2 | 3;
  sizing: "hug" | "fixed-short" | "fixed-long";
  alignment: "left" | "center";
  language: "en" | "zh-common";
  safeInset: boolean;
  validationOnly?: boolean;
}

export interface MasterLayoutFacts {
  language: "sc" | "tc" | "en" | "ja" | "th";
  board: { width: number; height: number };
  structure: TextStructure;
  mainTitleLines: number;
  subTitleLines: number;
  alignment: TextAlignment;
  modules: ComplexModules;
  fingerprint?: MasterLayoutFingerprint;
}

export interface LayoutRecommendation {
  preset: LayoutPresetRecord;
  score: number;
  reasons: string[];
}
