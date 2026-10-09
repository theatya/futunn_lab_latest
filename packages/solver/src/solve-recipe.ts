import {
  joinTokens,
  type LayoutRecipe,
  type QualityReport,
  type RecipeRole,
  type RecipeTrace,
  type RecipeTypography,
  type Rect,
  type ShowConfig,
  type SizeSpec,
  type Solution,
} from "@futu/domain";
import type { TextMeasurer } from "./measure";
import type { SolveContent } from "./text";

export interface SolveRecipeInput {
  board: { w: number; h: number };
  content: SolveContent;
  show: ShowConfig;
  spec?: SizeSpec | null;
  recipe: LayoutRecipe;
  trace: RecipeTrace;
  measurer: TextMeasurer;
  typographyOverrides?: Partial<Record<RecipeRole, RecipeTypography>>;
}

function visible(show: ShowConfig, role: RecipeRole): boolean {
  if (role === "titleGroup" || role === "kicker") return show.title || show.sub;
  if (role === "disc") return show.disc;
  if (role === "kv" || role === "title" || role === "sub" || role === "cta" || role === "badge" || role === "logo") {
    return show[role];
  }
  return true;
}

function applyRect(rect: Rect, role: RecipeRole, trace: RecipeTrace): Rect {
  const override = trace.overrides?.[role];
  if (!override) return { ...rect };
  const scale = override.scale ?? 1;
  return {
    x: rect.x + (override.dx ?? 0) - rect.w * (scale - 1) / 2,
    y: rect.y + (override.dy ?? 0) - rect.h * (scale - 1) / 2,
    w: rect.w * scale,
    h: rect.h * scale,
  };
}

function intersects(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return false;
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function materiallyIntersects(a: Rect | null, b: Rect | null, boardWidth: number): boolean {
  if (!intersects(a, b) || !a || !b) return false;
  // 浏览器缺少训练字体时 Canvas 会略微高估字宽；36px 内由 Figma 写回后的真实字体回读复核。
  return Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 36 / boardWidth;
}

function fixedLines(content: SolveContent): string[] {
  const breaks = [...new Set(content.titleBreaks)]
    .filter((value) => value > 0 && value < content.titleTokens.length)
    .sort((a, b) => a - b);
  const ends = [...breaks, content.titleTokens.length];
  return ends.map((end, index) =>
    joinTokens(content.titleTokens.slice(index === 0 ? 0 : ends[index - 1], end), content.lang),
  );
}

export function solveRecipe(input: SolveRecipeInput): Solution {
  const { board, content, recipe, trace, measurer, show } = input;
  const notes: Solution["notes"] = [
    { level: "lock", text: `训练配方：${recipe.name}（${recipe.id}）` },
  ];
  const layer = (role: RecipeRole) => recipe.layers.find((item) => item.role === role);
  const typography = (role: RecipeRole) => {
    const trained = layer(role)?.typography;
    const master = input.typographyOverrides?.[role]
      ?? (role === "kicker" ? input.typographyOverrides?.sub : undefined);
    const merged = !trained ? master
      : !master ? trained
        : {
            ...trained,
            fontFamily: master.fontFamily,
            fontStyle: master.fontStyle,
            fontWeight: master.fontWeight,
            color: master.color ?? trained.color,
            runs: master.runs.map((run) => ({
              ...run,
              // 目标训练配方负责逐行字号比例；母版 run 只保留字重、字体和高亮语义。
              fontSizeRatio: trained.lineFontSizeRatios?.length ? undefined : run.fontSizeRatio,
            })),
          };
    if (!merged) return undefined;
    const elementScale = role === "title" ? 1 : (trace.overrides?.[role]?.scale ?? 1);
    // 母版只提供视觉语义；字号、行高和文本框比例必须服从目标尺寸的训练配方。
    return {
      ...merged,
      fontSizePx: merged.fontSizePx * elementScale,
      lineHeightPx: merged.lineHeightPx * elementScale,
    };
  };
  const rect = (role: RecipeRole): Rect | null => {
    const value = layer(role);
    return value && visible(show, role) ? applyRect(value.bounds, role, trace) : null;
  };

  const titleLayer = layer("title");
  const titleRect = rect("title");
  const titleLines = fixedLines(content);
  const titleBasePx = typography("title")?.fontSizePx ?? 46;
  const requestedScale = trace.overrides?.title?.fontScale;
  const scales = requestedScale ? [requestedScale] : recipe.fitting.fontScaleSteps;
  let titleScale = scales[scales.length - 1] ?? 1;
  let titleFits = false;
  const titleWidth = (titleRect?.w ?? 0) * board.w;
  for (const scale of scales) {
    if (titleLines.every((line, index) =>
      measurer.measure(
        line,
        titleBasePx * scale * (typography("title")?.lineFontSizeRatios?.[index] ?? 1),
        "bold",
      ) <= titleWidth + 0.5)) {
      titleScale = scale;
      titleFits = true;
      break;
    }
  }
  const titlePx = titleBasePx * titleScale;
  if (!titleFits) {
    notes.push({ level: "warn", text: "主标题超过训练配方容量，已阻止静默缩字，请缩短文案或更换兼容方案" });
  } else if (titleScale < 1) {
    notes.push({ level: "info", text: `主标题按训练字号阶梯缩放至 ${Math.round(titleScale * 100)}%` });
  }

  let cta = rect("cta");
  const ctaLayer = layer("cta");
  const ctaScale = trace.overrides?.cta?.scale ?? 1;
  const ctaPx = (ctaLayer?.typography?.fontSizePx ?? input.spec?.cta?.fontPx ?? 30) * ctaScale;
  let ctaLabel = content.ctaLong;
  if (cta && input.spec?.cta) {
    const rule = input.spec.cta;
    const measuredLong = measurer.measure(content.ctaLong, ctaPx, "bold") + rule.paddingX * 2 * ctaScale;
    const measuredShort = measurer.measure(content.ctaShort, ctaPx, "bold") + rule.paddingX * 2 * ctaScale;
    ctaLabel = measuredLong <= rule.maxWidth * ctaScale ? content.ctaLong : content.ctaShort;
    const measured = ctaLabel === content.ctaLong ? measuredLong : measuredShort;
    const currentWidth = cta.w * board.w;
    const width = Math.max(
      currentWidth,
      rule.minWidth * ctaScale,
      Math.min(rule.maxWidth * ctaScale, measured),
    );
    const right = (cta.x + cta.w) * board.w;
    const center = (cta.x + cta.w / 2) * board.w;
    const x = rule.anchor === "right" ? right - width
      : rule.anchor === "center" ? center - width / 2
        : cta.x * board.w;
    cta = { ...cta, x: x / board.w, w: width / board.w };
  }

  const kv = rect("kv");
  const sub = rect(recipe.structure.startsWith("kicker") ? "kicker" : "sub");
  let badge = rect("badge");
  if (badge && content.badge) {
    const badgePx = typography("badge")?.fontSizePx ?? 28;
    const needed = measurer.measure(content.badge, badgePx, "normal") + 24;
    const current = badge.w * board.w;
    if (needed > current) {
      const width = Math.min(380, needed);
      badge = {
        ...badge,
        x: recipe.alignment === "center" ? (1 - width / board.w) / 2 : badge.x,
        w: width / board.w,
      };
      notes.push({ level: "info", text: "角标文案超过固定容量，已回退为样式 1 的 Hug 拉伸逻辑" });
    }
  }
  const disc = rect("disc");
  const fallbackLogoBounds: Rect = { x: 24 / board.w, y: 20 / board.h, w: 160 / board.w, h: 36 / board.h };
  const logo = rect("logo") ?? (show.logo ? applyRect(fallbackLogoBounds, "logo", trace) : null);
  const measuredTitleWidth = titleLines.reduce(
    (maximum, line, index) => Math.max(
      maximum,
      measurer.measure(line, titlePx * (typography("title")?.lineFontSizeRatios?.[index] ?? 1), "bold"),
    ),
    0,
  ) / board.w;
  const renderedTitleRect = titleRect ? {
    x: recipe.alignment === "center"
      ? titleRect.x + Math.max(0, titleRect.w - measuredTitleWidth) / 2
      : titleRect.x,
    y: titleRect.y,
    w: Math.min(titleRect.w, measuredTitleWidth),
    h: Math.min(
      titleRect.h,
      titleLines.length * (typography("title")?.lineHeightPx ?? titlePx) / board.h,
    ),
  } : null;
  const qualityIssues: QualityReport["issues"] = [];
  if (!titleFits) qualityIssues.push({ level: "block", code: "TITLE_OVERFLOW", text: "主标题超出训练配方允许容量" });
  if (materiallyIntersects(renderedTitleRect, cta, board.w)) qualityIssues.push({ level: "block", code: "TITLE_CTA_OVERLAP", text: "标题与 CTA 重叠" });
  if (intersects(disc, cta)) qualityIssues.push({ level: "block", code: "DISC_CTA_OVERLAP", text: "免责与 CTA 重叠" });
  if (titleLines.length !== recipe.mainTitleLines) {
    qualityIssues.push({ level: "block", code: "LINE_COUNT_MISMATCH", text: `配方要求 ${recipe.mainTitleLines} 行，当前为 ${titleLines.length} 行` });
  }
  const geometryDeviation = Math.max(
    0,
    ...([
      ["kv", kv],
      ["title", titleRect],
      [recipe.structure.startsWith("kicker") ? "kicker" : "sub", sub],
      ["cta", cta],
      ["badge", badge],
      ["disc", disc],
      ["logo", logo],
    ] as Array<[RecipeRole, Rect | null]>).flatMap(([role, current]) => {
      const trained = layer(role)?.bounds;
      if (!trained || !current) return [];
      return [
        Math.abs(current.x - trained.x) * board.w,
        Math.abs(current.y - trained.y) * board.h,
        Math.abs(current.w - trained.w) * board.w,
        Math.abs(current.h - trained.h) * board.h,
      ];
    }),
  );
  const status = qualityIssues.some((issue) => issue.level === "block") ? "blocked"
    : qualityIssues.length ? "warn" : "pass";
  const quality: QualityReport = {
    score: Math.max(0, 100 - qualityIssues.length * 30),
    status,
    geometryDeviation,
    issues: qualityIssues,
  };
  qualityIssues.forEach((issue) => notes.push({ level: "warn", text: issue.text }));

  const resolvedLayers = recipe.layers
    .filter((item) => visible(show, item.role))
    .map((item) => {
      const resolvedTypography = typography(item.role);
      return {
        ...item,
        bounds: item.role === "cta" && cta ? cta
          : item.role === "badge" && badge ? badge
            : applyRect(item.bounds, item.role, trace),
        typography: resolvedTypography
          ? { ...resolvedTypography, fontSizePx: item.role === "title" ? titlePx : resolvedTypography.fontSizePx }
          : undefined,
      };
    });
  if (logo && !resolvedLayers.some((item) => item.role === "logo")) {
    resolvedLayers.push({
      id: `${recipe.id}:added-logo`,
      sourceNodeId: `${recipe.source.frameNodeId}:added-logo`,
      role: "logo",
      name: "Logo",
      order: 2,
      bounds: logo,
      boundsPx: {
        x: logo.x * board.w,
        y: logo.y * board.h,
        w: logo.w * board.w,
        h: logo.h * board.h,
      },
      anchor: "safe-left",
      typography: undefined,
    });
  }

  return {
    layout: "单行条幅",
    board,
    kv,
    logo,
    badge,
    badgeSide: recipe.alignment === "left" ? "left" : "right",
    sub,
    subPx: typography(recipe.structure.startsWith("kicker") ? "kicker" : "sub")?.fontSizePx ?? 24,
    title: titleRect,
    titleLines,
    titlePx,
    align: recipe.alignment,
    cta,
    ctaLabel,
    ctaPx: typography("cta")?.fontSizePx ?? ctaPx,
    disc,
    discPx: typography("disc")?.fontSizePx ?? 14,
    discLineCount: disc ? 1 : 0,
    extra: null,
    notes,
    recipeTrace: trace,
    resolvedLayers,
    quality,
  };
}
