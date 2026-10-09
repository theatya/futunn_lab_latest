/**
 * 生成任务编排。
 *
 * 职责：把一个 Project 展开成「尺寸 × 语种」的画板清单，逐块求解，
 * 交给 FigmaWriterPort 写出去，并如实汇总成功与失败。
 *
 * 这一层不认识 React，也不认识 Figma 的协议细节 —— 它只认领域模型和端口。
 */

import {
  badgeStyleOf,
  boardConfigOf,
  ctaStyleOf,
  disclaimerText,
  emptyLangCopy,
  frameLogoOf,
  resolvedLayoutRecipe,
  resolvedTitleBreaks,
  type Lang,
  type Project,
  type Solution,
  type TargetBoard,
} from "@futu/domain";
import { recipeById } from "@futu/corpus";
import type {
  BoardPlan,
  FigmaWriteOptions,
  FigmaWriteResult,
  FigmaWriterPort,
  LoggerPort,
} from "@futu/ports";
import { buildSolveContent, solve, type TextMeasurer } from "@futu/solver";
import { specOf } from "@futu/specs";

/** 解一块板。UI 的实时预览和最终生成走的是**同一个函数** —— 所见即所得靠这个保证。 */
export function solveBoard(
  project: Project,
  target: TargetBoard,
  lang: Lang,
  measurer?: TextMeasurer,
): Solution {
  const cfg = boardConfigOf(project, target.key);
  const copy = project.content.copy[lang] ?? emptyLangCopy();
  const titleBreaks = resolvedTitleBreaks(project.content, lang, target.key);
  const recipeTrace = resolvedLayoutRecipe(project.content, lang, target.key);
  const recipe = recipeTrace ? recipeById(recipeTrace.recipeId) : undefined;
  const lookup = specOf(target.w, target.h);

  return solve({
    board: { w: target.w, h: target.h },
    content: buildSolveContent(copy, lang, titleBreaks),
    show: cfg.show,
    margin: cfg.margin,
    extra: cfg.extra,
    spec: lookup?.spec ?? null,
    recipe,
    recipeTrace,
    typographyOverrides: project.content.masterTextStyles?.[lang],
    ...(measurer ? { measurer } : {}),
  });
}

/** 展开成完整的画板清单：每个尺寸 × 每种语言一块 */
export function planBoards(project: Project, measurer?: TextMeasurer): BoardPlan[] {
  const plans: BoardPlan[] = [];
  for (const target of project.targets) {
    for (const lang of project.content.langs) {
      plans.push({
        key: target.key,
        lang,
        name: `${project.name} / ${target.key} / ${lang}`,
        solution: solveBoard(project, target, lang, measurer),
        visualComponent: project.content.kv,
        backgroundColor: project.content.sourceFrames?.[lang]?.backgroundColor ?? project.content.sourceFrame?.backgroundColor,
        subLabel: project.content.copy[lang]?.sub,
        badgeLabel: project.content.copy[lang]?.badge,
        disclaimerLabel: disclaimerText(project.content.copy[lang]?.disclaimer ?? []),
        logo: frameLogoOf(project.content, lang, target.key),
        ctaStyle: ctaStyleOf(project.content, lang, target.key),
        badgeStyle: badgeStyleOf(project.content, lang, target.key),
      });
    }
  }
  return plans;
}

/** 生成前的体检：把会出问题的板先报出来，别等写完才发现 */
export interface PreflightIssue {
  key: string;
  lang: string;
  level: "warn" | "lock";
  text: string;
}

export function preflight(plans: BoardPlan[]): PreflightIssue[] {
  const issues: PreflightIssue[] = [];
  for (const p of plans) {
    if (!p.visualComponent?.figmaUrl) {
      issues.push({ key: p.key, lang: p.lang, level: "warn", text: "主视觉组件关系缺失，请返回第一步重新确认映射" });
    }
    if (!p.backgroundColor) {
      issues.push({ key: p.key, lang: p.lang, level: "warn", text: "母版背景色缺失，主视觉暗角边缘可能出现接缝" });
    }
    for (const n of p.solution.notes) {
      if (n.level === "warn" || n.level === "lock") {
        issues.push({ key: p.key, lang: p.lang, level: n.level, text: n.text });
      }
    }
    for (const issue of p.solution.quality?.issues ?? []) {
      issues.push({
        key: p.key,
        lang: p.lang,
        level: issue.level === "block" ? "lock" : "warn",
        text: issue.text,
      });
    }
  }
  return issues;
}

export interface GenerateOutcome {
  plans: BoardPlan[];
  issues: PreflightIssue[];
  result: FigmaWriteResult;
}

export async function generate(
  project: Project,
  writer: FigmaWriterPort,
  options: FigmaWriteOptions,
  deps: { logger?: LoggerPort; measurer?: TextMeasurer } = {},
): Promise<GenerateOutcome> {
  const plans = planBoards(project, deps.measurer);
  const issues = preflight(plans);

  deps.logger?.log("info", `开始生成 ${plans.length} 块画板`, {
    project: project.id,
    issues: issues.length,
  });

  const result = await writer.write(plans, {
    ...options,
    visualComponent: project.content.kv,
  });

  deps.logger?.log(result.ok ? "info" : "warn", "生成结束", {
    ok: result.nodes.length,
    failed: result.failures.length,
  });

  return { plans, issues, result };
}
