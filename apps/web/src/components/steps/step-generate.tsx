"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { LANGS, resolvedTitleBreaks, sizeKey } from "@futu/domain";
import { generate, planBoards, preflight } from "@futu/orchestrator";
import { createWebPorts } from "@futu/adapters-web";
import { T_BASE, useStagger } from "@/lib/motion";
import { useStudio } from "@/lib/studio-store";
import { BoardPreview } from "@/components/board/board-preview";
import { Button, WorkflowSparkle } from "@/components/ui/button";
import { Chip } from "@/components/ui/note";
import { Band, Panel, SectionTitle } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { buildSolveContent, CanvasMeasurer } from "@futu/solver";

const ports = createWebPorts();

export function StepGenerate() {
  const { project, lang, setStep } = useStudio();
  const [page, setPage] = useState<"new" | "current">("new");
  const [arrange, setArrange] = useState<"group" | "lang" | "flat">("group");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Awaited<ReturnType<typeof generate>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bridgeLabel, setBridgeLabel] = useState("");
  const measurer = useMemo(() => new CanvasMeasurer('"BR Hendrix","PingFang SC",sans-serif'), []);

  const plans = useMemo(() => planBoards(project, measurer), [measurer, project]);
  const issues = useMemo(() => preflight(plans), [plans]);
  const hasBlockingIssues = issues.some((issue) => issue.level === "lock");
  const recipeTraces = useMemo(() => Array.from(new Map(
    plans.flatMap((plan) => plan.solution.recipeTrace ? [[plan.solution.recipeTrace.recipeId, plan.solution.recipeTrace] as const] : []),
  ).values()), [plans]);
  const boards = plans.length;
  const copy = project.content.copy[lang];
  const stagger = useStagger(0.02);

  useEffect(() => {
    void ports.figma.identity().then((identity) => setBridgeLabel(identity.label));
  }, []);

  const run = async () => {
    setBusy(true);
    setDone(null);
    setError(null);
    try {
      const result = await generate(project, ports.figma, {
        page,
        pageName: project.name,
        arrange,
      }, { measurer });
      setDone(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Figma 写入失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full min-h-0 grid gap-3 lg:gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden">
      <Band className="min-h-0 flex flex-col lg:overflow-hidden">
        <SectionTitle>{boards} 块</SectionTitle>
        <motion.div
          variants={stagger.container}
          initial="hidden"
          animate="show"
          className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 content-start"
        >
          {project.targets.map((t) => {
            const plan = plans.find((p) => p.key === t.key && p.lang === lang);
            const s = plan?.solution;
            if (!s || !plan) return null;
            const w = t.w >= t.h ? 180 : 108;
            return (
              <motion.div key={t.key} variants={stagger.item} className="min-w-0">
                <div className="grid place-items-center rounded-[16px] bg-[var(--app-bg)] py-3">
                  <BoardPreview
                    solution={s}
                    content={buildSolveContent(copy, lang, resolvedTitleBreaks(project.content, lang, t.key))}
                    width={w}
                    kv={project.content.kv}
                    logo={plan.logo}
                    ctaStyle={plan.ctaStyle}
                    badgeStyle={plan.badgeStyle}
                    backgroundColor={project.content.sourceFrames?.[lang]?.backgroundColor ?? project.content.sourceFrame?.backgroundColor}
                  />
                </div>
                <div className="mt-1.5 text-[11px] font-medium tabular-nums">{sizeKey(t.w, t.h)}</div>
                <div className="text-[10px] text-[var(--app-text-4)] truncate">{t.use}</div>
              </motion.div>
            );
          })}
        </motion.div>
      </Band>

      <Band className="lg:min-h-0 flex flex-col">
        <div className="min-h-0 flex-1 space-y-5 lg:overflow-y-auto">
          <Panel>
          <SectionTitle>写入 Figma</SectionTitle>
          <div className="space-y-3">
            <div>
              <div className="text-[11px] text-[var(--app-text-3)] mb-1.5">目标页</div>
              <Segmented
                value={page}
                onChange={setPage}
                options={[
                  { id: "new", label: "新建一页" },
                  { id: "current", label: "当前页" },
                ]}
              />
            </div>
            <div>
              <div className="text-[11px] text-[var(--app-text-3)] mb-1.5">排列</div>
              <Segmented
                value={arrange}
                onChange={setArrange}
                options={[
                  { id: "group", label: "按尺寸" },
                  { id: "lang", label: "按语种" },
                  { id: "flat", label: "平铺" },
                ]}
              />
            </div>
            <div className="rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2.5 text-[10px]">
              <div className="text-[var(--app-text-3)]">在 Figma Desktop 中加载 <code className="text-[var(--color-brand)]">figma-plugin/manifest.json</code>，保持插件开启后填入配对码：</div>
              <code className="mt-1.5 block select-all text-[12px] text-[var(--app-text)]">{bridgeLabel || "正在生成…"}</code>
            </div>
          </div>
          </Panel>

          <Panel>
            <SectionTitle>训练方案追溯</SectionTitle>
            {recipeTraces.length ? (
              <div className="space-y-1 text-[10px] text-[var(--app-text-3)]">
                {recipeTraces.map((trace) => (
                  <div key={trace.recipeId}>{trace.recipeId} · 语料 {trace.corpusVersion}</div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-[var(--color-warn)]">当前没有已应用的训练配方，不能宣称为训练集输出。</p>
            )}
          </Panel>

          {issues.length > 0 ? (
            <Panel>
            <SectionTitle>生成前检查 · {issues.length} 项</SectionTitle>
            <ul className="space-y-1.5">
              {issues.slice(0, 8).map((n, i) => (
                <li key={`${n.key}-${n.lang}-${i}`} className="flex items-start gap-2 text-[12px]">
                  <AlertTriangle size={12} className="mt-0.5 text-[var(--color-warn)] shrink-0" />
                  <span className="text-[var(--app-text-2)]">
                    <Chip className="mr-1.5">
                      {n.key} · {LANGS.find((l) => l.id === n.lang)?.name}
                    </Chip>
                    {n.text}
                  </span>
                </li>
              ))}
            </ul>
            </Panel>
          ) : (
            <Panel>
              <div className="flex items-center gap-2 text-[11px] text-[var(--app-text-2)]">
                <CheckCircle2 size={14} className="shrink-0 text-[var(--color-down)]" />
                <span>生成前检查通过，可以写入 Figma</span>
              </div>
            </Panel>
          )}

          {error ? <p className="text-[11px] leading-relaxed text-[var(--color-up)]">{error}</p> : null}
          <AnimatePresence>
            {done ? (
              <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={T_BASE}
            >
              <Panel>
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-[var(--color-down)] mt-0.5" />
                  <div>
                    <div className="text-[13px] font-semibold">{done.result.ok ? "已写入 Figma" : "Figma 写入完成，但有部分画板失败"}</div>
                    <p className="text-[12px] text-[var(--app-text-3)] mt-1 leading-relaxed">
                      成功写入 {done.result.nodes.length} 块，失败 {done.result.failures.length} 块。
                    </p>
                  </div>
                </div>
              </Panel>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div className="-mx-4 -mb-4 mt-3 flex shrink-0 justify-end gap-2 border-t border-[var(--app-line)] bg-[var(--app-band)] p-4">
          <Button size="lg" disabled={busy} onClick={() => setStep(1)}>上一步</Button>
          <Button variant="workflow" size="lg" icon={busy ? undefined : <WorkflowSparkle />} disabled={busy || boards === 0 || hasBlockingIssues} onClick={run}>
            {busy ? (
              <><Loader2 size={14} className="animate-spin" />等待写入 {boards} 块…</>
            ) : hasBlockingIssues ? "存在阻塞项，暂不可写入" : "写入 Figma"}
          </Button>
        </div>
      </Band>
    </div>
  );
}
