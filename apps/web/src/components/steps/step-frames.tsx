"use client";

import { Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CTA_STYLE_PRESETS,
  ELEMENT_LABEL,
  LANGS,
  TOGGLE_ORDER,
  badgeStyleOf,
  ctaStyleOf,
  disclaimerText,
  frameLogoOf,
  presetLogo,
  resolvedLayoutRecipe,
  resolvedTitleBreaks,
  sizeKey,
  sourceFrameOf,
  tokenizeTitle,
  type FrameStyleOverride,
  type LibraryLogoPreset,
  type RecipeOverride,
  type RecipeRole,
} from "@futu/domain";
import { BADGE_STYLE_PRESETS as CORPUS_BADGE_PRESETS, breaksForLineCount, recipeById } from "@futu/corpus";
import { buildSolveContent, CanvasMeasurer, solve } from "@futu/solver";
import { RATIO_PRESETS, SIZE_GROUPS, specOf } from "@futu/specs";
import { useFitBoard } from "@/lib/use-fit-board";
import { useStudio } from "@/lib/studio-store";
import { BoardPreview } from "@/components/board/board-preview";
import { Button, WorkflowSparkle } from "@/components/ui/button";
import { LOGO_PRESET_OPTIONS, LogoPresetPreview } from "@/components/logo-preset-preview";
import { Chip, NoteList } from "@/components/ui/note";
import { Band, Panel, SectionTitle } from "@/components/ui/panel";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function StepFrames({
  embedded = false,
  familyKeys,
  familyLabel,
}: {
  embedded?: boolean;
  familyKeys?: string[];
  familyLabel?: string;
}) {
  const [selectedElement, setSelectedElement] = useState<"kv" | "title" | "cta" | "logo" | "badge" | "disc" | "background">("kv");
  const {
    project,
    lang,
    setLang,
    setStep,
    updateCopy,
    updateContent,
    focusKey,
    setFocusKey,
    setTargets,
    patchFocus,
    applySharedToAll,
    applyDraftToTargets,
    focusCfg,
    focusOverridden,
  } = useStudio();

  const selected = new Set(project.targets.map((t) => t.key));
  const focus = project.targets.find((t) => t.key === focusKey) ?? project.targets[0];
  const copy = project.content.copy[lang];
  const lookup = focus ? specOf(focus.w, focus.h) : null;
  const titleBreaks = focus ? resolvedTitleBreaks(project.content, lang, focus.key) : null;
  const activeSourceFrame = sourceFrameOf(project.content, lang);
  const layoutPresets = (project.content.copyLayoutPresets?.[lang] ?? []).filter((preset) =>
    !preset.sourceFrameId
    || !activeSourceFrame
    || preset.sourceFrameId === activeSourceFrame.id
    || preset.sourceFrameId.endsWith(`:${activeSourceFrame.id}`),
  );
  const storedLayoutAssignment = focus
    ? project.content.copyLayoutAssignments?.[lang]?.[focus.key]
    : undefined;
  const layoutAssignment = storedLayoutAssignment
    && layoutPresets.some((preset) => preset.id === storedLayoutAssignment)
    ? storedLayoutAssignment
    : "master";
  const selectedLayoutPreset = layoutPresets.find((preset) => preset.id === layoutAssignment);
  const recipeTrace = focus ? resolvedLayoutRecipe(project.content, lang, focus.key) : undefined;
  const activeRecipe = recipeTrace ? recipeById(recipeTrace.recipeId) : undefined;
  const recipeFont = activeRecipe?.layers.find((layer) => layer.role === "title")?.typography?.fontFamily
    ?? (lang === "en" ? "BR Hendrix" : "PingFang SC");
  const measurer = useMemo(() => new CanvasMeasurer(`"${recipeFont}"`), [recipeFont]);
  const [fontRevision, setFontRevision] = useState(0);
  useEffect(() => {
    if (typeof document === "undefined") return;
    void document.fonts.ready.then(() => {
      measurer.reset();
      setFontRevision((value) => value + 1);
    });
  }, [measurer]);
  const frameOverride = focus ? project.content.frameStyleOverrides?.[lang]?.[focus.key] : undefined;
  const activeCtaStyle = focus ? ctaStyleOf(project.content, lang, focus.key) : undefined;
  const activeBadgeStyle = focus ? badgeStyleOf(project.content, lang, focus.key) : undefined;
  const activeLogo = focus ? frameLogoOf(project.content, lang, focus.key) : undefined;

  const patchFrameStyle = (patch: Partial<FrameStyleOverride>) => {
    if (!focus) return;
    const byLang = { ...(project.content.frameStyleOverrides?.[lang] ?? {}) };
    const next = { ...(byLang[focus.key] ?? {}), ...patch };
    Object.keys(next).forEach((key) => {
      if (next[key as keyof FrameStyleOverride] === undefined) delete next[key as keyof FrameStyleOverride];
    });
    if (Object.keys(next).length) byLang[focus.key] = next;
    else delete byLang[focus.key];
    updateContent({
      frameStyleOverrides: {
        ...project.content.frameStyleOverrides,
        [lang]: byLang,
      },
    });
  };

  const patchRecipeOverride = (role: RecipeRole, patch: Partial<RecipeOverride>) => {
    if (!selectedLayoutPreset?.recipeId || !focus) return;
    patchFrameStyle({
      layoutOverrides: {
        ...frameOverride?.layoutOverrides,
        [role]: {
          ...recipeTrace?.overrides?.[role],
          ...patch,
        },
      },
    });
  };
  const roleOverride = (role: RecipeRole) => recipeTrace?.overrides?.[role];

  const applyFocusSettingsToFamily = () => {
    if (!focus || !familyKeys?.length) return;
    const frameStyles = { ...(project.content.frameStyleOverrides?.[lang] ?? {}) };
    const assignments = { ...(project.content.copyLayoutAssignments?.[lang] ?? {}) };
    const breakChoices = { ...(project.content.titleBreakChoices?.[lang] ?? {}) };
    familyKeys.forEach((key) => {
      if (frameOverride) frameStyles[key] = structuredClone(frameOverride);
      else delete frameStyles[key];
      if (layoutAssignment !== "master") assignments[key] = layoutAssignment;
      else delete assignments[key];
      const focusBreakChoice = project.content.titleBreakChoices?.[lang]?.[focus.key];
      if (focusBreakChoice) breakChoices[key] = structuredClone(focusBreakChoice);
      else delete breakChoices[key];
    });
    updateContent({
      frameStyleOverrides: { ...project.content.frameStyleOverrides, [lang]: frameStyles },
      copyLayoutAssignments: { ...project.content.copyLayoutAssignments, [lang]: assignments },
      titleBreakChoices: { ...project.content.titleBreakChoices, [lang]: breakChoices },
    });
  };

  const solution = useMemo(() => {
    if (!focus) return null;
    return solve({
      board: { w: focus.w, h: focus.h },
      content: buildSolveContent(copy, lang, titleBreaks ?? undefined),
      show: focusCfg.show,
      margin: focusCfg.margin,
      extra: focusCfg.extra,
      spec: lookup?.spec ?? null,
      recipe: activeRecipe,
      recipeTrace,
      typographyOverrides: project.content.masterTextStyles?.[lang],
      measurer,
    });
  }, [activeRecipe, copy, focus, focusCfg, fontRevision, lang, lookup, measurer, project.content.masterTextStyles, recipeTrace, titleBreaks]);

  const fit = useFitBoard(focus?.w ?? 1, focus?.h ?? 1);

  const sizeList = (
    <Band className="lg:min-h-0 lg:overflow-y-auto">
      <SectionTitle>尺寸</SectionTitle>
      <div className="space-y-4">
        {SIZE_GROUPS.map((g) => {
          const visibleItems = familyKeys?.length
            ? g.items.filter((item) => familyKeys.includes(sizeKey(item.w, item.h)))
            : g.items;
          if (!visibleItems.length) return null;
          return (
          <div key={g.id}>
            <div className="text-[12px] font-semibold mb-2">{g.name}</div>
            <div className="grid grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2 gap-1">
              {visibleItems.map((item) => {
                const key = sizeKey(item.w, item.h);
                const on = selected.has(key);
                const spec = specOf(item.w, item.h);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (!on) {
                        setTargets([...selected, key]);
                        setFocusKey(key);
                        return;
                      }
                      if (focusKey === key && selected.size > 1) {
                        const next = [...selected].filter((k) => k !== key);
                        setTargets(next);
                        return;
                      }
                      setFocusKey(key);
                    }}
                    className={cn(
                      "rounded-[var(--radius-md)] px-2.5 py-2 text-left",
                      on || focusKey === key ? "choice-on" : "choice-idle",
                    )}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[12px] font-semibold tabular-nums">
                        {item.w} × {item.h}
                      </span>
                      {spec?.spec ? <Lock size={11} className="text-[var(--color-brand)]" /> : null}
                    </div>
                    <div className="text-[10px] text-[var(--app-text-3)] mt-0.5 truncate">{item.use}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )})}
      </div>
      <div className="mt-3 text-[11px] text-[var(--app-text-4)]">{familyLabel ? `${familyLabel} · ${familyKeys?.length ?? 0} 块` : `${selected.size} 块`}</div>
    </Band>
  );

  if (!focus || !solution) {
    return <div className="h-full min-h-0">{sizeList}</div>;
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 lg:grid lg:grid-cols-[240px_minmax(0,1fr)_300px] xl:grid-cols-[260px_minmax(0,1fr)_320px] lg:gap-4">
      {sizeList}

      <Panel className="flex-1 min-h-[280px] lg:min-h-0 flex flex-col">
        <SectionTitle>{focus.use}</SectionTitle>
        <div
          ref={fit.ref}
          className="flex-1 min-h-0 grid place-items-center rounded-[20px] bg-[var(--app-bg)]"
        >
          <BoardPreview
            solution={solution}
            content={buildSolveContent(copy, lang, titleBreaks ?? undefined)}
            width={fit.width}
            extraKind={focusCfg.extra.kind}
            kv={project.content.kv}
            logo={activeLogo}
            ctaStyle={activeCtaStyle}
            badgeStyle={activeBadgeStyle}
            backgroundColor={activeSourceFrame?.backgroundColor}
          />
        </div>
      </Panel>

      <Band className="space-y-5 lg:min-h-0 lg:overflow-y-auto">
        <div>
          <SectionTitle>编辑图层</SectionTitle>
          <div className="mb-2 flex flex-wrap gap-1">
            {LANGS.filter((item) => project.content.langs.includes(item.id)).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLang(item.id)}
                className={cn("h-7 rounded-[4px] px-2 text-[9px]", lang === item.id ? "choice-on" : "choice-idle")}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {([
              ["kv", "主视觉"],
              ["title", "标题"],
              ["cta", "CTA"],
              ["logo", "Logo"],
              ["badge", "角标"],
              ["disc", "免责"],
              ["background", "背景"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedElement(id)}
                className={cn("h-7 rounded-[4px] text-[9px]", selectedElement === id ? "choice-on" : "choice-idle")}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[9px] text-[var(--app-text-4)]">内容、显隐和比例均在当前画幅完成。</p>
            {selectedElement !== "background" ? (
              <Switch
                checked={selectedElement === "title" ? focusCfg.show.title : focusCfg.show[selectedElement]}
                label="显示"
                onChange={(visible) => {
                  if (selectedElement === "title") {
                    patchFocus({ show: { ...focusCfg.show, title: visible, sub: visible } });
                  } else {
                    patchFocus({ show: { ...focusCfg.show, [selectedElement]: visible } as typeof focusCfg.show });
                  }
                }}
              />
            ) : null}
          </div>
        </div>

        {lookup?.spec ? (
          <Panel>
            <SectionTitle>站内规范</SectionTitle>
            <div className="space-y-1.5 text-[12px] text-[var(--app-text-2)]">
              {lookup.spec.minPadX != null ? (
                <div className="flex justify-between">
                  <span>左右边距</span>
                  <Chip tone="lock">不小于 {lookup.spec.minPadX}px</Chip>
                </div>
              ) : null}
              {lookup.spec.cta ? (
                <div className="flex justify-between">
                  <span>按钮</span>
                  <Chip tone="lock">
                    宽 {lookup.spec.cta.minWidth}–{lookup.spec.cta.maxWidth} × 高 {lookup.spec.cta.height}
                    {" · "}{lookup.spec.cta.fontPx}px · {lookup.spec.cta.anchor === "center" ? "居中" : lookup.spec.cta.anchor === "right" ? "右锚定" : "左锚定"}
                  </Chip>
                </div>
              ) : null}
              {lookup.spec.maxTitleLines != null ? (
                <div className="flex justify-between">
                  <span>主标题</span>
                  <Chip tone="lock">最多 {lookup.spec.maxTitleLines} 行</Chip>
                </div>
              ) : null}
            </div>
            {lookup.spec.todo.length > 0 ? (
              <p className="mt-3 text-[11px] text-[var(--color-warn)] leading-relaxed">
                录入时有 {lookup.spec.todo.length} 处没定死：{lookup.spec.todo[0]}
              </p>
            ) : null}
          </Panel>
        ) : lookup?.isInApp ? (
          <Panel>
            <p className="text-[12px] text-[var(--color-warn)]">
              这个站内位还没录规范，求解器按站外规则排，请人工核对按钮和安全区。
            </p>
          </Panel>
        ) : null}

        {selectedElement === "title" ? <Panel>
          <SectionTitle>标题内容与排版</SectionTitle>
          <div className="mb-3 space-y-2">
            <label className="block">
              <span className="mb-1 block text-[9px] text-[var(--app-text-4)]">主标题</span>
              <textarea
                aria-label="当前语言主标题"
                value={copy.title}
                rows={2}
                onChange={(event) => updateCopy(lang, { title: event.target.value })}
                className="w-full resize-none rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2 py-1.5 text-[11px] outline-none focus:border-[var(--color-brand)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[9px] text-[var(--app-text-4)]">副标题／小标题</span>
              <input
                aria-label="当前语言副标题或小标题"
                value={copy.sub}
                onChange={(event) => updateCopy(lang, { sub: event.target.value })}
                className="h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2 text-[11px] outline-none focus:border-[var(--color-brand)]"
              />
            </label>
            <div>
              <span className="mb-1 block text-[9px] text-[var(--app-text-4)]">主标题行数</span>
              <div className="grid grid-cols-3 gap-1">
                {[1, 2, 3].map((lineCount) => (
                  <button
                    key={lineCount}
                    type="button"
                    onClick={() => updateCopy(lang, {
                      titleBreaks: breaksForLineCount(tokenizeTitle(copy.title, lang), lineCount, copy.titleBreaks),
                    })}
                    className={cn("h-7 rounded-[4px] text-[9px]", copy.titleBreaks.length === lineCount - 1 ? "choice-on" : "choice-idle")}
                  >
                    {lineCount} 行
                  </button>
                ))}
              </div>
            </div>
          </div>
          <select
            aria-label="当前画幅的排版方案"
            value={layoutAssignment}
            onChange={(event) => {
              const byLang = { ...(project.content.copyLayoutAssignments?.[lang] ?? {}) };
              if (event.target.value === "master") delete byLang[focus.key];
              else byLang[focus.key] = event.target.value;
              updateContent({
                copyLayoutAssignments: {
                  ...project.content.copyLayoutAssignments,
                  [lang]: byLang,
                },
              });
            }}
            className="w-full h-8 rounded-[var(--radius-md)] border border-[var(--app-line)] bg-[var(--app-surface-2)] px-2 text-[12px] text-[var(--app-text)]"
          >
            <option value="master">跟随母版</option>
            {layoutPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--app-text-4)]">
            {selectedLayoutPreset?.recommendationReason
              ? `自动匹配：${selectedLayoutPreset.recommendationReason}`
              : "选择全局内容中保存的标题组方案；位置与 CTA 间距在下方按当前画幅调整。"}
          </p>
          {solution?.recipeTrace ? (
            <div className="mt-2 rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2 text-[9px] leading-relaxed text-[var(--app-text-3)]">
              <div>训练值：{solution.recipeTrace.recipeId} · {solution.recipeTrace.corpusVersion}</div>
              <div className="mt-0.5">当前质量：{solution.quality?.score ?? 0} / 100 · {solution.quality?.status === "pass" ? "可交付" : solution.quality?.status === "blocked" ? "阻塞" : "需检查"}</div>
            </div>
          ) : (
            <div className="mt-2 rounded-[5px] border border-[var(--color-warn)]/40 bg-[var(--color-warn)]/5 p-2 text-[9px] text-[var(--color-warn)]">
              {focus?.w === 1080 && focus?.h === 225 ? "尚未应用训练方案，当前仍跟随母版。" : "该尺寸尚未训练，不会标记为训练结果。"}
            </div>
          )}
          {selectedLayoutPreset?.recipeId ? (
            <div className="mt-3 space-y-2 border-t border-[var(--app-line)] pt-3">
              <Slider label="标题字号" value={(roleOverride("title")?.fontScale ?? 1) * 100} min={85} max={120} step={1} suffix="%" onChange={(value) => patchRecipeOverride("title", { fontScale: value / 100 })} />
              <Slider label="标题左右" value={(roleOverride("title")?.dx ?? 0) * 100} min={-8} max={8} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("title", { dx: value / 100 })} />
              <Slider label="标题上下" value={(roleOverride("title")?.dy ?? 0) * 100} min={-8} max={8} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("title", { dy: value / 100 })} />
              {activeRecipe?.layers.some((item) => item.role === "sub" || item.role === "kicker") ? (
                <Slider label="副标题比例" value={(roleOverride(activeRecipe.structure.startsWith("kicker") ? "kicker" : "sub")?.scale ?? 1) * 100} min={70} max={140} step={1} suffix="%" onChange={(value) => patchRecipeOverride(activeRecipe.structure.startsWith("kicker") ? "kicker" : "sub", { scale: value / 100 })} />
              ) : null}
              <button type="button" className="text-[9px] text-[var(--app-text-4)] hover:text-[var(--app-text)]" onClick={() => patchRecipeOverride("title", { fontScale: 1, dx: 0, dy: 0 })}>恢复训练值</button>
            </div>
          ) : null}
        </Panel> : null}

        {selectedElement === "cta" || selectedElement === "logo" || selectedElement === "badge" ? <Panel>
          <SectionTitle>{selectedElement === "cta" ? "CTA 样式" : selectedElement === "logo" ? "Logo 设置" : "角标样式"}</SectionTitle>
          <div className="space-y-3">
            {selectedElement === "cta" ? <label className="block">
              <span className="mb-1 block text-[10px] text-[var(--app-text-3)]">CTA</span>
              <input
                aria-label="当前语言 CTA 文案"
                value={copy.ctaLong}
                onChange={(event) => updateCopy(lang, { ctaLong: event.target.value, ctaShort: event.target.value })}
                className="mb-2 h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2 text-[11px] outline-none focus:border-[var(--color-brand)]"
              />
              <select
                aria-label="当前画幅 CTA 样式"
                value={frameOverride?.ctaStyle?.presetId ?? "inherit"}
                onChange={(event) => {
                  if (event.target.value === "inherit") {
                    patchFrameStyle({ ctaStyle: undefined });
                    return;
                  }
                  const preset = CTA_STYLE_PRESETS.find((item) => item.id === event.target.value);
                  if (preset) patchFrameStyle({
                    ctaStyle: {
                      presetId: preset.id,
                      backgroundColor: preset.backgroundColor,
                      backgroundImage: preset.backgroundImage,
                      textColor: preset.defaultTextColor,
                    },
                  });
                }}
                className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--app-line)] bg-[var(--app-surface-2)] px-2 text-[11px]"
              >
                <option value="inherit">跟随全局默认</option>
                {CTA_STYLE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
              {selectedLayoutPreset?.recipeId ? (
                <div className="mt-3">
                  <Slider label="CTA 缩放" value={(roleOverride("cta")?.scale ?? 1) * 100} min={60} max={150} step={1} suffix="%" onChange={(value) => patchRecipeOverride("cta", { scale: value / 100 })} />
                  <Slider label="CTA 左右" value={(roleOverride("cta")?.dx ?? 0) * 100} min={-12} max={12} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("cta", { dx: value / 100 })} />
                  <Slider label="CTA 上下" value={(roleOverride("cta")?.dy ?? 0) * 100} min={-12} max={12} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("cta", { dy: value / 100 })} />
                </div>
              ) : null}
            </label> : null}

            {selectedElement === "logo" ? <label className="block">
              <span className="mb-1 block text-[10px] text-[var(--app-text-3)]">Logo</span>
              <select
                aria-label="当前画幅 Logo"
                value={frameOverride?.logoPreset ?? "inherit"}
                onChange={(event) => {
                  if (event.target.value === "inherit") {
                    patchFrameStyle({ logo: undefined, logoPreset: undefined });
                    return;
                  }
                  const preset = event.target.value as LibraryLogoPreset;
                  patchFrameStyle({ logoPreset: preset, logo: presetLogo(preset) });
                }}
                className="h-8 w-full rounded-[var(--radius-md)] border border-[var(--app-line)] bg-[var(--app-surface-2)] px-2 text-[11px]"
              >
                <option value="inherit">跟随全局默认</option>
                {LOGO_PRESET_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <LogoPresetPreview asset={activeLogo} className="mt-2 h-8 justify-start rounded-[4px] bg-[#444] px-2" />
              {selectedLayoutPreset?.recipeId ? (
                <div className="mt-3 space-y-2">
                  <Slider label="Logo 缩放" value={(roleOverride("logo")?.scale ?? 1) * 100} min={50} max={160} step={1} suffix="%" onChange={(value) => patchRecipeOverride("logo", { scale: value / 100 })} />
                  <Slider label="Logo 左右" value={(roleOverride("logo")?.dx ?? 0) * 100} min={-12} max={12} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("logo", { dx: value / 100 })} />
                  <Slider label="Logo 上下" value={(roleOverride("logo")?.dy ?? 0) * 100} min={-12} max={12} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("logo", { dy: value / 100 })} />
                </div>
              ) : null}
            </label> : null}

            {selectedElement === "badge" ? <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] text-[var(--app-text-3)]">角标</span>
                {frameOverride?.badgeStyle ? (
                  <button type="button" onClick={() => patchFrameStyle({ badgeStyle: undefined })} className="text-[9px] text-[var(--app-text-4)] hover:text-[var(--app-text)]">恢复默认</button>
                ) : null}
              </div>
              <input
                aria-label="当前语言角标文案"
                value={copy.badge}
                onChange={(event) => updateCopy(lang, { badge: event.target.value })}
                className="mb-2 h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2 text-[11px] outline-none focus:border-[var(--color-brand)]"
              />
              <select
                aria-label="当前画幅角标训练样式"
                value={activeBadgeStyle?.presetId ?? ""}
                onChange={(event) => {
                  const preset = CORPUS_BADGE_PRESETS.find((item) => item.id === event.target.value);
                  if (preset) patchFrameStyle({
                    badgeStyle: {
                      ...activeBadgeStyle!,
                      presetId: preset.id,
                      sizing: preset.sizing,
                      alignment: preset.alignment,
                    },
                  });
                }}
                className="mb-2 h-8 w-full rounded-[var(--radius-md)] border border-[var(--app-line)] bg-[var(--app-surface-2)] px-2 text-[10px]"
              >
                <option value="">跟随母版角标</option>
                {CORPUS_BADGE_PRESETS
                  .filter((preset) => !preset.validationOnly && preset.language === (lang === "en" ? "en" : "zh-common"))
                  .map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
              <div className="grid grid-cols-3 gap-1">
                {(["left", "center", "right"] as const).map((alignment) => (
                  <button
                    key={alignment}
                    type="button"
                    aria-pressed={activeBadgeStyle?.alignment === alignment}
                    onClick={() => patchFrameStyle({ badgeStyle: { ...activeBadgeStyle!, alignment } })}
                    className={cn("h-7 rounded-[4px] text-[9px]", activeBadgeStyle?.alignment === alignment ? "choice-on" : "choice-idle")}
                  >
                    {alignment === "left" ? "左对齐" : alignment === "center" ? "居中" : "右对齐"}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 text-[9px] text-[var(--app-text-4)]">
                  <input type="color" aria-label="当前画幅角标背景色" value={activeBadgeStyle?.backgroundColor} onChange={(event) => patchFrameStyle({ badgeStyle: { ...activeBadgeStyle!, backgroundColor: event.target.value } })} className="h-6 w-8 bg-transparent p-0" />
                  背景
                </label>
                <label className="flex items-center gap-2 text-[9px] text-[var(--app-text-4)]">
                  <input type="color" aria-label="当前画幅角标文字色" value={activeBadgeStyle?.textColor} onChange={(event) => patchFrameStyle({ badgeStyle: { ...activeBadgeStyle!, textColor: event.target.value } })} className="h-6 w-8 bg-transparent p-0" />
                  文字
                </label>
              </div>
              {selectedLayoutPreset?.recipeId ? (
                <div className="mt-3 space-y-2">
                  <Slider label="角标缩放" value={(roleOverride("badge")?.scale ?? 1) * 100} min={60} max={160} step={1} suffix="%" onChange={(value) => patchRecipeOverride("badge", { scale: value / 100 })} />
                  <Slider label="角标左右" value={(roleOverride("badge")?.dx ?? 0) * 100} min={-12} max={12} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("badge", { dx: value / 100 })} />
                  <Slider label="角标上下" value={(roleOverride("badge")?.dy ?? 0) * 100} min={-12} max={12} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("badge", { dy: value / 100 })} />
                </div>
              ) : null}
            </div> : null}
          </div>
        </Panel> : null}

        {selectedElement === "kv" || selectedElement === "background" ? <Panel>
          <SectionTitle>{selectedElement === "kv" ? "主视觉与画幅" : "背景画板"}</SectionTitle>
          {selectedElement === "background" ? (
            <div className="mb-3 flex items-center justify-between rounded-[4px] bg-[var(--app-surface-2)] px-2 py-2">
              <span className="text-[10px] text-[var(--app-text-3)]">继承第一步背景色</span>
              <span className="flex items-center gap-2 text-[10px] uppercase">
                <span className="size-4 rounded-[3px] border border-[var(--app-line)]" style={{ backgroundColor: activeSourceFrame?.backgroundColor ?? "#0f1112" }} />
                {activeSourceFrame?.backgroundColor ?? "#0f1112"}
              </span>
            </div>
          ) : (
            <p className="mb-3 text-[9px] leading-relaxed text-[var(--app-text-4)]">主视觉组件锁定原始比例并完整显示；空余区域由背景画板填充，不拉伸、不裁切。</p>
          )}
          <div className="flex flex-wrap gap-1 mb-3">
            {RATIO_PRESETS.map((r) => {
              const on = r.w === focus.w && r.h === focus.h;
              return (
                <button
                  key={r.ratio}
                  type="button"
                  onClick={() => {
                    const key = sizeKey(r.w, r.h);
                    if (!selected.has(key)) setTargets([...selected, key]);
                    setFocusKey(key);
                  }}
                  className={cn(
                    "h-7 px-2 rounded-[var(--radius-sm)] text-[11px] tabular-nums",
                    on ? "choice-on" : "choice-idle",
                  )}
                >
                  {r.ratio}
                </button>
              );
            })}
          </div>
          {selectedElement === "kv" && selectedLayoutPreset?.recipeId ? (
            <div className="mb-4 space-y-2 rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2">
              <Slider label="主视觉左右" value={(roleOverride("kv")?.dx ?? 0) * 100} min={-20} max={20} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("kv", { dx: value / 100 })} />
              <Slider label="主视觉上下" value={(roleOverride("kv")?.dy ?? 0) * 100} min={-20} max={20} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("kv", { dy: value / 100 })} />
              <Slider label="主视觉缩放" value={(roleOverride("kv")?.scale ?? 1) * 100} min={50} max={180} step={1} suffix="%" onChange={(value) => patchRecipeOverride("kv", { scale: value / 100 })} />
            </div>
          ) : null}
          <Slider
            label="左右"
            value={focusCfg.margin.x}
            min={0}
            max={24}
            step={0.5}
            suffix="%"
            onChange={(x) => patchFocus({ margin: { ...focusCfg.margin, x } })}
          />
          <div className="h-2" />
          <Slider
            label="上下"
            value={focusCfg.margin.y}
            min={0}
            max={24}
            step={0.5}
            suffix="%"
            onChange={(y) => patchFocus({ margin: { ...focusCfg.margin, y } })}
          />
          <div className="h-2" />
          <Slider
            label="竖向"
            value={focusCfg.margin.bias}
            min={-100}
            max={100}
            step={5}
            onChange={(bias) => patchFocus({ margin: { ...focusCfg.margin, bias } })}
          />
        </Panel> : null}

        {selectedElement === "disc" ? <Panel>
          <SectionTitle>免责文案与元素</SectionTitle>
          <textarea
            aria-label="当前语言免责文案"
            value={disclaimerText(copy.disclaimer)}
            rows={3}
            onChange={(event) => updateCopy(lang, { disclaimer: event.target.value ? [event.target.value] : [] })}
            className="mb-3 w-full resize-none rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2 py-1.5 text-[10px] outline-none focus:border-[var(--color-brand)]"
          />
          {selectedLayoutPreset?.recipeId ? (
            <div className="mb-3 space-y-2">
              <Slider label="免责缩放" value={(roleOverride("disc")?.scale ?? 1) * 100} min={60} max={160} step={1} suffix="%" onChange={(value) => patchRecipeOverride("disc", { scale: value / 100 })} />
              <Slider label="免责左右" value={(roleOverride("disc")?.dx ?? 0) * 100} min={-12} max={12} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("disc", { dx: value / 100 })} />
              <Slider label="免责上下" value={(roleOverride("disc")?.dy ?? 0) * 100} min={-12} max={12} step={0.5} suffix="%" onChange={(value) => patchRecipeOverride("disc", { dy: value / 100 })} />
            </div>
          ) : null}
          <SectionTitle>全部元素显隐</SectionTitle>
          <div className="space-y-0.5">
            {TOGGLE_ORDER.map((k) => (
              <Switch
                key={k}
                checked={k === "title" ? focusCfg.show.title : focusCfg.show[k]}
                label={k === "title" ? "标题组" : ELEMENT_LABEL[k]}
                onChange={(v) => {
                  if (k === "title") {
                    patchFocus({ show: { ...focusCfg.show, title: v, sub: v } });
                  } else {
                    patchFocus({ show: { ...focusCfg.show, [k]: v } as typeof focusCfg.show });
                  }
                }}
              />
            ))}
          </div>
        </Panel> : null}

        <Panel>
          <SectionTitle>排版依据</SectionTitle>
          <NoteList notes={solution.notes} />
          <p className="mt-3 text-[11px] text-[var(--app-text-4)]">
            调整会即时保存到 {focusKey}，预览与最终写入使用同一份配置。
            {focusOverridden ? " 当前画幅已单独调整。" : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {familyKeys?.length ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  applyDraftToTargets(familyKeys);
                  applyFocusSettingsToFamily();
                }}
              >
                同步到{familyLabel ?? "当前布局族"}（{familyKeys.length} 块）
              </Button>
            ) : null}
            <Button variant="primary" size="sm" onClick={applySharedToAll}>
              设为全部画幅共用设置
            </Button>
          </div>
        </Panel>

        {!embedded ? (
          <div className="sticky bottom-0 -mx-4 -mb-4 mt-2 flex justify-end gap-2 border-t border-[var(--app-line)] bg-[var(--app-band)] p-4">
            <Button size="lg" onClick={() => setStep(1)}>上一步</Button>
            <Button variant="workflow" size="lg" icon={<WorkflowSparkle />} onClick={() => setStep(2)}>预览并写入</Button>
          </div>
        ) : null}
      </Band>
    </div>
  );
}
