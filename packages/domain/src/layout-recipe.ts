import type { Lang } from "./content";
import type { Rect } from "./layout";

export type RecipeTextStructure = "single" | "title-sub" | "kicker-title" | "kicker-title-sub";
export type RecipeRole = "board" | "kv" | "titleGroup" | "kicker" | "title" | "sub" | "cta" | "badge" | "disc" | "logo";
export type RecipeSourceKind = "real" | "curated" | "spec-supplement" | "validation";

export interface RecipeModules {
  cta: boolean;
  badge: boolean;
  disclaimer: boolean;
  combinedLogo: boolean;
}

export interface RecipeTextRun {
  start: number;
  end: number;
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: number;
  fontSizeRatio?: number;
  color?: string;
  fillCss?: string;
  italic?: boolean;
}

export interface RecipeTypography {
  fontFamily: string;
  fontStyle: string;
  fontWeight: number;
  fontSizePx: number;
  fontSizeToBoardHeight: number;
  lineHeightPx: number;
  lineHeightToFontSize: number;
  letterSpacing?: number;
  alignHorizontal: "left" | "center";
  alignVertical: "top" | "center" | "bottom";
  autoResize: "none" | "width" | "height" | "width-and-height";
  color?: string;
  runs: RecipeTextRun[];
  /** 多行艺术排版中每一行相对基础字号的比例。 */
  lineFontSizeRatios?: number[];
}

export interface RecipeAutoLayout {
  mode: "NONE" | "HORIZONTAL" | "VERTICAL";
  gapPx: number;
  gapToBoardHeight: number;
  paddingPx: { top: number; right: number; bottom: number; left: number };
  primaryAlign: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAlign: "MIN" | "CENTER" | "MAX" | "BASELINE";
  sizingHorizontal: "FIXED" | "HUG" | "FILL";
  sizingVertical: "FIXED" | "HUG" | "FILL";
}

export interface RecipeLayer {
  id: string;
  sourceNodeId: string;
  role: RecipeRole;
  name: string;
  parentRole?: RecipeRole;
  order: number;
  boundsPx: { x: number; y: number; w: number; h: number };
  /** 允许小于 0 或大于 1；训练 KV 经常需要越界。 */
  bounds: Rect;
  anchor: "board" | "content" | "titleGroup" | "safe-left" | "safe-right";
  componentId?: string;
  clipContent?: boolean;
  cornerRadius?: number;
  backgroundColor?: string;
  backgroundImage?: string;
  typography?: RecipeTypography;
  autoLayout?: RecipeAutoLayout;
}

export interface LayoutRelation {
  kind: "align-left" | "align-center" | "gap" | "avoid-overlap" | "inside" | "anchor";
  from: RecipeRole;
  to: RecipeRole | "board";
  axis?: "x" | "y";
  value?: number;
  tolerance?: number;
  hard: boolean;
}

export interface TextFitPolicy {
  approvedLineCounts: number[];
  fontScaleSteps: number[];
  minFontScale: number;
  maxFontScale: number;
  overflow: "block" | "short-copy";
  preserveStructure: true;
}

export interface MasterLayoutFingerprint {
  schemaVersion: 1;
  hash: string;
  board: { width: number; height: number; aspect: number };
  language: Lang;
  structure: RecipeTextStructure;
  modules: RecipeModules;
  mainTitleLines: number;
  subTitleLines: number;
  alignment: "left" | "center";
  roleTopology: string[];
  normalizedGeometry: Partial<Record<RecipeRole, Rect>>;
  relativeTypeScale: Partial<Record<"title" | "sub" | "cta" | "disc", number>>;
  autoLayoutSignature: string[];
  componentIds: string[];
  textDensity: {
    titleTokens: number;
    titleCharacters: number;
    subCharacters: number;
    richTextRuns: number;
  };
}

export interface LayoutRecipe {
  schemaVersion: 1;
  corpusVersion: string;
  id: string;
  name: string;
  source: {
    fileKey: string;
    sectionNodeId: string;
    frameNodeId: string;
    sourceKind: RecipeSourceKind;
    capturedAt: string;
  };
  board: { width: number; height: number; clipContent: boolean };
  language: "en" | "zh-common" | "tc-validation";
  structure: RecipeTextStructure;
  modules: RecipeModules;
  mainTitleLines: number;
  subTitleLines: number;
  alignment: "left" | "center";
  layers: RecipeLayer[];
  relations: LayoutRelation[];
  fitting: TextFitPolicy;
  fingerprint: Omit<MasterLayoutFingerprint, "hash" | "language" | "textDensity">;
  validationOnly?: boolean;
}

export interface RecipeOverride {
  dx?: number;
  dy?: number;
  scale?: number;
  fontScale?: number;
  titleGapDelta?: number;
  ctaScale?: number;
}

export interface RecipeTrace {
  corpusVersion: string;
  recipeId: string;
  fingerprintHash?: string;
  overrides?: Partial<Record<RecipeRole, RecipeOverride>>;
}

export interface QualityReport {
  score: number;
  status: "pass" | "warn" | "blocked";
  geometryDeviation: number;
  issues: Array<{ level: "warn" | "block"; code: string; text: string }>;
}
