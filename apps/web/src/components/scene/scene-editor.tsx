"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Eye, EyeOff, Lock, LockOpen, Minus, Plus, Redo2, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { LAYOUT_PRESETS, recipeById, type LayoutPresetRecord } from "@futu/corpus";
import {
  CTA_STYLE_PRESETS,
  SCENE_BACKGROUND_PRESETS,
  SCENE_BADGE_STYLES,
  SCENE_FAMILY_LABEL,
  SCENE_FONTS,
  SCENE_GROUP_ID,
  SCENE_GROUP_ROLES,
  SCENE_HIGHLIGHT_PRESETS,
  SCENE_REMOVABLE_ROLES,
  SCENE_ROLE_LABEL,
  SCENE_CTA_CUSTOM_DEFAULT,
  SCENE_GRADIENT_TYPES,
  SCENE_STROKE_ALIGNS,
  applySceneCopyVariant,
  sceneDefaultStroke,
  sceneFillPaints,
  buildSceneBoard,
  highlightPaints,
  sceneCustomGradient,
  scenePaintsCss,
  isSceneGroupRole,
  isSceneHex,
  layoutScene,
  resolveSceneGroup,
  resolveSceneOwn,
  resolveScenePlacement,
  roundScenePatch,
  sceneBadgeStyle,
  sceneBadgeStyle1Svg,
  sceneCopyFit,
  sceneDefaultElement,
  sceneFilledCopy,
  sceneFilledStructure,
  sceneFamilyOf,
  sceneGroupBaseGap,
  sceneFontId,
  sceneFontScript,
  sceneFontSupports,
  sceneFontSupportsText,
  captureSceneLayoutScheme,
  captureSceneSchemeExtras,
  placeSceneSchemeExtras,
  applySceneLayoutScheme,
  sceneLayoutSchemeMatches,
  sceneLayoutSchemes,
  type SceneLayoutScheme,
  sceneLineRatios,
  sceneMetrics,
  sceneText,
  sceneVersionView,
  sceneWidthToUnit,
  type Lang,
  type SceneAlign,
  type SceneBadgeLength,
  type SceneBadgeStyle,
  type SceneBoardRef,
  type SceneCopyKind,
  type SceneCtaLength,
  type SceneCopyVariantSpec,
  type SceneElement,
  type SceneFollow,
  type SceneFontRun,
  type SceneHighlight,
  type ScenePaint,
  type ScenePlacementPatch,
  type SceneRole,
  type SceneState,
  type SceneStroke,
  type SceneStrokeAlign,
  type SceneVersion,
} from "@futu/domain";
import { BackgroundColorControl } from "@/components/color-control";
import { LOGO_PRESET_OPTIONS, LogoPresetPreview } from "@/components/logo-preset-preview";
import { ScrubField } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { useFitBoard } from "@/lib/use-fit-board";
import { useScene, useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";
import { Dropdown, FontPicker, fontPreviewStyle } from "./font-picker";
import { FillEditor, GradientEditor } from "./gradient-editor";
import { SceneArtboard } from "./scene-artboard";
import { VisualCrop } from "./visual-crop";

type CopyVariant = { key: string; label: string; kind: SceneCopyKind; presets: LayoutPresetRecord[] };

const KIND_BY_NAME: Record<string, SceneCopyKind> = { 单标题: "single", 标题组: "group", 复杂模块: "complex" };

/** 按训练集 LAYOUT_PRESETS 列出版式，名称去掉对齐与语言后合并左/中对齐两个样本。 */
function copyVariants(language: "en" | "zh-common"): CopyVariant[] {
  const map = new Map<string, CopyVariant>();
  for (const preset of LAYOUT_PRESETS) {
    if (preset.validationOnly || preset.language !== language) continue;
    const [kindName = "", label = ""] = preset.name.split("｜");
    const kind = KIND_BY_NAME[kindName];
    if (!kind || !label) continue;
    const key = `${kindName}｜${label}`;
    const item = map.get(key) ?? { key, label, kind, presets: [] };
    item.presets.push(preset);
    map.set(key, item);
  }
  return [...map.values()];
}

function variantSpec(kind: SceneCopyKind, preset: LayoutPresetRecord): SceneCopyVariantSpec {
  const recipe = recipeById(preset.id);
  const title = recipe?.layers.find((layer) => layer.role === "title");
  const disc = recipe?.layers.find((layer) => layer.role === "disc");
  const box = recipe?.layers.find((layer) => layer.role === "titleGroup")?.bounds;
  return {
    ...(box ? { groupAnchor: { x: preset.alignment === "center" ? box.x + box.w / 2 : box.x, y: box.y + box.h / 2 } } : {}),
    kind,
    structure: preset.structure,
    mainTitleLines: preset.mainTitleLines,
    modules: { badge: preset.modules.badge, disclaimer: preset.modules.disclaimer, combinedLogo: preset.modules.combinedLogo },
    alignment: preset.alignment,
    ...(title?.typography?.lineFontSizeRatios ? { lineRatios: title.typography.lineFontSizeRatios } : {}),
    disclaimerUnderCta: disc ? disc.boundsPx.x > 700 : false,
  };
}

const BADGE_THUMBS: Record<SceneBadgeStyle, string> = {
  style1: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sceneBadgeStyle1Svg(246, 43, 1))}`,
  style2: "/brand/badges/style2-short-center.svg",
  style3: "/brand/badges/style3-short.svg",
  earnings: "/brand/badges/earnings-zh-bg.svg",
};

const FOLLOW_OPTIONS = [
  { id: "none" as const, label: "不跟随" },
  { id: "left" as const, label: "左" },
  { id: "center" as const, label: "中" },
  { id: "right" as const, label: "右" },
];

const INPUT = "h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2.5 text-[10px] outline-none hover:border-[var(--app-line-strong)] focus:border-[var(--app-line-strong)]";
const GHOST = "h-7 rounded-[4px] px-2.5 text-[10px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-35";
const CHIP = "h-7 rounded-[4px] border px-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-40";
const ALIGN_OPTIONS = [{ id: "left" as const, label: "左" }, { id: "center" as const, label: "中" }, { id: "right" as const, label: "右" }];
const MODULE_ROLES = new Set<SceneRole>(["logo", "badge", "disclaimer"]);

const COLUMN_LIMITS = { layers: [120, 280], props: [280, 640] } as const;
const COLUMN_STORE = "futu:scene-editor-columns";
const VIEW_STORE = "futu:scene-editor-view";
const COPY_ORDER: SceneRole[] = ["title", "subtitle", "kicker", "badge", "disclaimer"];
/** 角标、免责默认不出现，通过「添加」按钮打开。 */
const OPTIONAL_ROLES = new Set<SceneRole>(["badge", "disclaimer"]);
const COLOR_ROLES = new Set<SceneRole>(["title", "subtitle", "kicker", "custom", "disclaimer", "cta"]);
const ICON = "grid size-5 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:text-[var(--app-text)]";

function highlightDetail(paints: readonly ScenePaint[]) {
  const first = paints[0];
  if (paints.length === 1 && first?.type === "SOLID") return `纯色 ${first.color}`;
  const top = paints.find((paint) => paint.type !== "SOLID");
  const colors = top && "stops" in top ? [...new Set(top.stops.map((item) => item.color))].join(" → ") : "";
  return `渐变 ${colors}${paints.length > 1 ? ` · 叠 ${paints.length} 层` : ""}`;
}

function codePointIndex(text: string, utf16: number) {
  return Array.from(text.slice(0, utf16)).length;
}

/** 改字后让高亮/局部字体跟着字走：改动前的区间不动，改动后的平移，跨改动的伸缩。 */
function shiftRanges<T extends { start: number; end: number }>(list: readonly T[], before: string, after: string): T[] {
  const a = Array.from(before);
  const b = Array.from(after);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;
  const oldEnd = a.length - tail;
  const map = (index: number, isEnd: boolean) => {
    if (isEnd ? index <= head : index < head) return index;
    if (index >= oldEnd) return index + b.length - a.length;
    return isEnd ? b.length - tail : head;
  };
  return list
    .map((item) => ({ ...item, start: map(item.start, false), end: Math.min(map(item.end, true), b.length) }))
    .filter((item) => item.end > item.start);
}

function withoutRange<T extends { start: number; end: number }>(list: readonly T[], start: number, end: number): T[] {
  return list.flatMap((item) => {
    if (item.end <= start || item.start >= end) return [item];
    return [
      ...(item.start < start ? [{ ...item, end: start }] : []),
      ...(item.end > end ? [{ ...item, start: end }] : []),
    ];
  });
}

function fillLabel(fill: SceneStroke["fill"]) {
  if (fill.type === "SOLID") return fill.color.replace("#", "").toUpperCase();
  return SCENE_GRADIENT_TYPES.find((item) => item.id === fill.type)?.name ?? "渐变";
}

/** 参数区统一的二级模块：白色标题旁带折叠按钮，展开后文案输入与全部参数在一起。 */
/** 勾选框，视觉参照 Figma：灰底方框 + 白色对勾，不用品牌色。 */
function CheckToggle({ label, title, checked, onChange }: { label: string; title?: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label title={title} className="group flex cursor-pointer select-none items-center gap-1.5 text-[var(--app-text-3)] hover:text-[var(--app-text-2)]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span
        className={cn(
          "grid size-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors peer-focus-visible:ring-1 peer-focus-visible:ring-white/40",
          checked ? "border-white/25 bg-white/15 text-white" : "border-white/20 bg-white/[0.04] group-hover:border-white/35",
        )}
      >
        {checked ? <Check size={10} strokeWidth={2.5} /> : null}
      </span>
      {label}
    </label>
  );
}

export function Section({ id, title, muted, open, onToggle, aside, children }: {
  id?: string;
  title: string;
  muted?: boolean;
  open?: boolean;
  onToggle?: () => void;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const collapsible = Boolean(onToggle);
  const expanded = !collapsible || Boolean(open);
  return (
    <section data-param-id={id} className="border-b border-[var(--app-line-soft)] py-3 last:border-b-0">
      <div className={cn("flex min-h-5 items-center justify-between gap-2", expanded && children && "mb-2")}>
        {collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={`${expanded ? "收起" : "展开"}${title}`}
            onClick={onToggle}
            className="flex min-w-0 items-center gap-1 text-left"
          >
            <span className={cn("truncate text-[11px] font-semibold", muted && "text-[var(--app-text-3)]")}>{title}</span>
            <ChevronDown size={12} className={cn("shrink-0 text-[var(--app-text-4)] transition-transform", !expanded && "-rotate-90")} />
          </button>
        ) : (
          <span className="text-[11px] font-semibold">{title}</span>
        )}
        {aside ? <div className="flex shrink-0 items-center gap-1.5">{aside}</div> : null}
      </div>
      {expanded ? children : null}
    </section>
  );
}

function withPatch(map: SceneState["familyEdits"], scope: string, id: string, patch: ScenePlacementPatch) {
  return { ...map, [scope]: { ...map[scope], [id]: { ...map[scope]?.[id], ...roundScenePatch(patch) } } };
}

function withoutEntry(map: SceneState["familyEdits"], scope: string, id?: string) {
  const next = { ...map };
  if (!id) {
    delete next[scope];
    return next;
  }
  const entries = { ...next[scope] };
  delete entries[id];
  next[scope] = entries;
  return next;
}

export function SceneEditor({
  mode,
  board,
  lang,
  familyBoards,
}: {
  mode: "family" | "board";
  board: SceneBoardRef & { use?: string };
  lang: Lang;
  familyBoards: SceneBoardRef[];
}) {
  const { project, versionId } = useStudio();
  const { scene: rawScene, updateScene, undoScene, redoScene, canUndoScene, canRedoScene } = useScene();
  const version = rawScene.versions?.find((item) => item.id === versionId && item.lang === lang) ?? null;
  const scene = useMemo(() => sceneVersionView(rawScene, version), [rawScene, version]);
  const [cols, setCols] = useState({ layers: 148, props: 320 });
  const [guides, setGuides] = useState(true);
  const [outlines, setOutlines] = useState(true);
  const colDrag = useRef<{ key: keyof typeof cols; x: number; start: number } | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(COLUMN_STORE) ?? "null") as Partial<typeof cols> | null;
      if (saved) setCols((current) => ({ ...current, ...saved }));
      const view = JSON.parse(window.localStorage.getItem(VIEW_STORE) ?? "null") as { guides?: boolean; outlines?: boolean } | null;
      if (typeof view?.guides === "boolean") setGuides(view.guides);
      if (typeof view?.outlines === "boolean") setOutlines(view.outlines);
    } catch {
      /* 读不到就用默认值 */
    }
  }, []);
  const saveView = (patch: { guides?: boolean; outlines?: boolean }) => {
    try {
      const view = JSON.parse(window.localStorage.getItem(VIEW_STORE) ?? "{}") as object;
      window.localStorage.setItem(VIEW_STORE, JSON.stringify({ ...view, ...patch }));
    } catch {
      /* 存不了就只在本次会话生效 */
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoScene();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redoScene();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoScene, redoScene]);
  const [selectedId, setSelectedId] = useState<string | null>(SCENE_GROUP_ID);
  /** Shift / Ctrl / ⌘ 点选加入的其它图层。 */
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const multiSet = useMemo(() => new Set(multiIds), [multiIds]);
  const selectLayer = (id: string | null, additive = false) => {
    if (additive && id && selectedId && id !== selectedId) {
      setMultiIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
      return;
    }
    if (additive && id === selectedId) return;
    setSelectedId(id);
    setMultiIds([]);
  };
  useEffect(() => {
    if (selectedId) setMultiIds((current) => current.includes(selectedId) ? current.filter((item) => item !== selectedId) : current);
  }, [selectedId]);
  const [range, setRange] = useState<{ id: string; start: number; end: number } | null>(null);
  const [openParams, setOpenParams] = useState<Record<string, boolean>>({});
  const [customOpen, setCustomOpen] = useState(false);
  const [ctaCustomOpen, setCtaCustomOpen] = useState(false);
  const [strokeEditing, setStrokeEditing] = useState<string | null>(null);
  const propsRef = useRef<HTMLElement>(null);
  /** 选中元素时展开它的参数面板，并把右侧滚到对应位置。 */
  useEffect(() => {
    if (!selectedId) return;
    setOpenParams((current) => current[selectedId] ? current : { ...current, [selectedId]: true });
    const frame = requestAnimationFrame(() => {
      propsRef.current?.querySelector(`[data-param-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);
  const togglePanel = (id: string) => setOpenParams((current) => ({ ...current, [id]: !current[id] }));
  const isOpen = (id: string) => Boolean(openParams[id]);
  const [colorTargetId, setColorTargetId] = useState<string | null>(null);
  const [colorOpen, setColorOpen] = useState(false);
  useEffect(() => {
    const role = scene.elements.find((el) => el.id === selectedId)?.role;
    if (selectedId && role && COLOR_ROLES.has(role)) setColorTargetId(selectedId);
  }, [selectedId, scene.elements]);
  useEffect(() => {
    if (!range || range.end <= range.start) return;
    setColorTargetId(range.id);
    setColorOpen(true);
    const frame = requestAnimationFrame(() => {
      propsRef.current?.querySelector('[data-param-id="color-module"]')?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [range]);
  const family = sceneFamilyOf(board.w, board.h);
  const fit = useFitBoard(board.w, board.h, 48);
  const output = useMemo(() => buildSceneBoard(scene, board, lang), [board, lang, scene]);
  const laid = useMemo(() => layoutScene(scene, board, lang).laid, [board, lang, scene]);
  const issueIds = useMemo(() => new Set(output.issues.flatMap((issue) => issue.ids)), [output.issues]);
  const boardPatch = scene.boardOverrides[board.key] ?? {};
  const kvUrl = project.content.kv?.previewUrl;
  const script = sceneFontScript(lang);

  const groupSelected = selectedId === SCENE_GROUP_ID;
  const members = SCENE_GROUP_ROLES.flatMap((role) => scene.elements.filter((el) => el.role === role && el.visible && sceneText(el, lang).trim()));
  const group = resolveSceneGroup(scene, board);

  const patchPlacement = (id: string, patch: ScenePlacementPatch) => updateScene((current) => {
    if (mode === "board") return { ...current, boardOverrides: withPatch(current.boardOverrides, board.key, id, patch) };
    return { ...current, familyEdits: withPatch(current.familyEdits, family, id, patch) };
  });

  const patchElement = (id: string, recipe: (el: SceneElement) => SceneElement) => updateScene((current) => ({
    ...current,
    elements: current.elements.map((el) => el.id === id ? recipe(el) : el),
  }));

  const editVersion = (current: SceneState, recipe: (item: SceneVersion) => SceneVersion) => ({
    ...current,
    versions: (current.versions ?? []).map((item) => item.id === version?.id ? recipe(item) : item),
  });

  const setVisible = (el: SceneElement, visible: boolean) => {
    if (mode === "board") patchPlacement(el.id, { visible });
    else if (version) updateScene((current) => editVersion(current, (item) => ({ ...item, visibility: { ...item.visibility, [el.id]: visible } })));
    else patchElement(el.id, (item) => ({ ...item, visible }));
  };

  /** 高亮写到当前版本：语种本身写 scene.highlights，自定义版本写版本自己的高亮。 */
  const writeHighlights = (id: string, recipe: (list: SceneHighlight[]) => SceneHighlight[]) => updateScene((current) => {
    if (version) {
      const item = current.versions?.find((entry) => entry.id === version.id);
      if (!item) return current;
      const list = recipe(sceneVersionView(current, item).highlights[id]?.[lang] ?? []);
      return editVersion(current, (entry) => ({ ...entry, highlights: { ...entry.highlights, [id]: list } }));
    }
    return { ...current, highlights: { ...current.highlights, [id]: { ...current.highlights[id], [lang]: recipe(current.highlights[id]?.[lang] ?? []) } } };
  });

  const removeElement = (id: string) => {
    updateScene((current) => ({ ...current, elements: current.elements.filter((el) => el.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  };

  const addElement = (role: SceneRole) => {
    const existing = scene.elements.find((el) => el.role === role && role !== "custom");
    if (existing) {
      patchElement(existing.id, (item) => ({ ...item, visible: true }));
      setSelectedId(existing.id);
      return;
    }
    const index = scene.elements.filter((el) => el.role === "custom").length + 1;
    const el = sceneDefaultElement(role, index);
    const id = role === "custom" ? `custom-${Date.now().toString(36)}` : el.id;
    updateScene((current) => ({ ...current, elements: [...current.elements, { ...el, id }] }));
    setSelectedId(id);
  };

  const trainingLanguage = lang === "en" ? "en" : "zh-common";
  const variants = useMemo(() => copyVariants(trainingLanguage), [trainingLanguage]);
  const activeVariant = variants.find((item) => item.key === scene.copyVariant);
  const filledCopy = useMemo(() => sceneFilledCopy(scene, lang), [scene, lang]);
  const fits = useMemo(() => variants.map((variant) => {
    const preset = variant.presets.find((item) => item.alignment === group.align) ?? variant.presets[0]!;
    return { variant, preset, fit: sceneCopyFit(scene, lang, preset) };
  }), [variants, scene, lang, group.align]);
  const filledStructure = useMemo(() => sceneFilledStructure(scene, lang), [scene, lang]);
  const recommended = useMemo(() => {
    const wantsCombo = scene.logoPreset.includes("Nasdaq");
    const score = (item: (typeof fits)[number]) =>
      (item.fit.linesMatch ? 8 : 0)
      + (item.preset.modules.badge === filledCopy.has("badge") ? 2 : 0)
      + (item.preset.modules.disclaimer === filledCopy.has("disclaimer") ? 2 : 0)
      + (item.preset.modules.combinedLogo === wantsCombo ? 1 : 0)
      + (item.variant.key === scene.copyVariant ? 0.5 : 0);
    return fits.filter((item) => item.fit.ok).sort((a, b) => score(b) - score(a))[0] ?? null;
  }, [fits, filledCopy, scene.logoPreset, scene.copyVariant]);
  const activeItem = fits.find((item) => item.variant.key === scene.copyVariant);
  const activeFit = activeItem?.fit;

  const chooseVariant = (variant: CopyVariant, alignment?: "left" | "center") => {
    const preset = variant.presets.find((item) => item.alignment === (alignment ?? group.align)) ?? variant.presets[0]!;
    updateScene((current) => {
      const next = applySceneCopyVariant(current, variant.key, variantSpec(variant.kind, preset));
      if (preset.modules.badge) return next;
      const result = layoutScene(next, board, lang);
      const badgeBox = result.laid.find((item) => item.el.role === "badge")?.box;
      if (!badgeBox || !result.group) return next;
      const shift = badgeBox.y + badgeBox.h + result.group.gap - result.group.box.y;
      if (shift <= 0) return next;
      const y = resolveSceneGroup(next, board).y + shift / board.h;
      return { ...next, familyEdits: withPatch(next.familyEdits, family, SCENE_GROUP_ID, { y }) };
    });
    setSelectedId(SCENE_GROUP_ID);
  };

  const recommendedKey = recommended?.variant.key;
  useEffect(() => {
    if (mode !== "family" || version || !filledStructure || filledStructure === scene.copyStructure || !recommended) return;
    chooseVariant(recommended.variant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, version, filledStructure, scene.copyStructure, recommendedKey]);

  /** 往隐藏或还没有的文案层里输入：恢复显示，新建的层其它语种留空，避免回退显示别的语言。 */
  const fillSlot = (role: SceneRole, text: string) => updateScene((current) => {
    const existing = current.elements.find((el) => el.role === role);
    if (version) {
      const fresh = sceneDefaultElement(role, 0);
      const base = existing ?? { ...fresh, texts: Object.fromEntries(Object.keys(fresh.texts).map((key) => [key, ""])) };
      const next = existing ? current : { ...current, elements: [...current.elements, { ...base, visible: false }] };
      return editVersion(next, (item) => ({
        ...item,
        texts: { ...item.texts, [base.id]: text },
        visibility: { ...item.visibility, [base.id]: true },
      }));
    }
    if (existing) {
      return {
        ...current,
        elements: current.elements.map((el) => el.id === existing.id ? { ...el, visible: true, texts: { ...el.texts, [lang]: text } } : el),
      };
    }
    const base = sceneDefaultElement(role, 0);
    const texts = { ...Object.fromEntries(Object.keys(base.texts).map((key) => [key, ""])), [lang]: text };
    return { ...current, elements: [...current.elements, { ...base, visible: true, texts }] };
  });

  /** 财报季角标文字固定，选中即显示角标；其它样式沿用已填的角标文案。 */
  const setBadgeStyle = (style: SceneBadgeStyle) => updateScene((current) => {
    const badge = current.elements.find((el) => el.role === "badge");
    const earnings = style === "earnings";
    const elements = badge
      ? current.elements.map((el) => el.id === badge.id && earnings ? { ...el, visible: true } : el)
      : earnings ? [...current.elements, { ...sceneDefaultElement("badge", 0), texts: { en: "", sc: "", tc: "" } }] : current.elements;
    return { ...current, elements, badgeStyle: style };
  });

  const setText = (el: SceneElement, text: string) => {
    updateScene((current) => {
      const viewed = version ? sceneVersionView(current, current.versions?.find((item) => item.id === version.id)) : current;
      const viewedEl = viewed.elements.find((item) => item.id === el.id);
      const before = viewedEl ? sceneText(viewedEl, lang) : "";
      const ranges = shiftRanges(viewed.highlights[el.id]?.[lang] ?? [], before, text);
      const fontRuns = shiftRanges(viewed.fontRuns?.[el.id]?.[lang] ?? [], before, text);
      if (version) {
        return editVersion(current, (item) => ({
          ...item,
          texts: { ...item.texts, [el.id]: text },
          highlights: { ...item.highlights, [el.id]: ranges },
          fontRuns: { ...item.fontRuns, [el.id]: fontRuns },
        }));
      }
      return {
        ...current,
        elements: current.elements.map((item) => item.id === el.id ? { ...item, texts: { ...item.texts, [lang]: text } } : item),
        highlights: { ...current.highlights, [el.id]: { ...current.highlights[el.id], [lang]: ranges } },
        fontRuns: { ...current.fontRuns, [el.id]: { ...current.fontRuns?.[el.id], [lang]: fontRuns } },
      };
    });
  };

  const captureRange = (id: string, input: HTMLInputElement | HTMLTextAreaElement) => {
    const start = codePointIndex(input.value, input.selectionStart ?? 0);
    const end = codePointIndex(input.value, input.selectionEnd ?? 0);
    setRange((current) => current && current.id === id && current.start === start && current.end === end ? current : { id, start, end });
  };

  const applyHighlight = (preset: string) => {
    if (!range || range.end <= range.start) return;
    writeHighlights(range.id, (list) => [
      ...list.filter((item) => item.end <= range.start || item.start >= range.end),
      { start: range.start, end: range.end, preset },
    ].sort((a, b) => a.start - b.start));
  };

  const clearRangeHighlight = () => {
    if (!range || range.end <= range.start) return;
    writeHighlights(range.id, (list) => list.filter((item) => item.end <= range.start || item.start >= range.end));
  };

  const removeHighlight = (id: string, index: number) => writeHighlights(id, (list) => list.filter((_, i) => i !== index));

  const setFont = (id: string, fontId: string) => updateScene((current) => ({
    ...current,
    fonts: { ...current.fonts, [id]: { ...current.fonts?.[id], [script]: fontId } },
  }));

  const writeFontRuns = (id: string, recipe: (list: SceneFontRun[]) => SceneFontRun[]) => updateScene((current) => {
    if (version) {
      const item = current.versions?.find((entry) => entry.id === version.id);
      if (!item) return current;
      const list = recipe(sceneVersionView(current, item).fontRuns?.[id]?.[lang] ?? []);
      return editVersion(current, (entry) => ({ ...entry, fontRuns: { ...entry.fontRuns, [id]: list } }));
    }
    return { ...current, fontRuns: { ...current.fontRuns, [id]: { ...current.fontRuns?.[id], [lang]: recipe(current.fontRuns?.[id]?.[lang] ?? []) } } };
  });

  /** 框选了部分文字时只改这一段；与整层字体相同则去掉这段局部字体。 */
  const setRangeFont = (el: SceneElement, start: number, end: number, fontId: string) => writeFontRuns(el.id, (list) => [
    ...withoutRange(list, start, end),
    ...(fontId === sceneFontId(scene, el, lang) ? [] : [{ start, end, font: fontId }]),
  ].sort((a, b) => a.start - b.start));

  const resetEntry = (id: string) => updateScene((current) => {
    if (mode === "board") return { ...current, boardOverrides: withoutEntry(current.boardOverrides, board.key, id) };
    return { ...current, familyEdits: withoutEntry(current.familyEdits, family, id) };
  });

  const clearPlacementKey = (id: string, key: keyof ScenePlacementPatch) => updateScene((current) => {
    const scope = mode === "family" ? current.familyEdits : current.boardOverrides;
    const scopeKey = mode === "family" ? family : board.key;
    const entry = { ...scope[scopeKey]?.[id] };
    delete entry[key];
    const next = { ...scope, [scopeKey]: { ...scope[scopeKey], [id]: entry } };
    return mode === "family" ? { ...current, familyEdits: next } : { ...current, boardOverrides: next };
  });

  const resetBoard = () => updateScene((current) => ({ ...current, boardOverrides: withoutEntry(current.boardOverrides, board.key) }));

  const syncToFamily = () => updateScene((current) => {
    const patch = current.boardOverrides[board.key] ?? {};
    const familyPatch = { ...current.familyEdits[family] };
    for (const [id, value] of Object.entries(patch)) familyPatch[id] = { ...familyPatch[id], ...value };
    return {
      ...current,
      familyEdits: { ...current.familyEdits, [family]: familyPatch },
      boardOverrides: withoutEntry(current.boardOverrides, board.key),
    };
  });

  /** 切换对齐时锚点移到外框对应边，元素视觉位置不跳。 */
  const changeAlign = (id: string, align: SceneAlign) => {
    const box = id === SCENE_GROUP_ID ? output.group?.box : laid.find((item) => item.el.id === id)?.box;
    if (!box) {
      patchPlacement(id, { align });
      return;
    }
    const x = align === "left" ? box.x : align === "center" ? box.x + box.w / 2 : box.x + box.w;
    patchPlacement(id, { align, x: x / board.w });
  };

  const editedKeys = (id: string) => Object.keys((mode === "board" ? boardPatch[id] : scene.familyEdits[family]?.[id]) ?? {});
  const resetButton = (id: string) => editedKeys(id).length ? (
    <button type="button" onClick={() => resetEntry(id)} className="flex items-center gap-1 text-[9px] text-[var(--app-text-3)] hover:text-[var(--app-text)]">
      <RotateCcw size={10} />{mode === "board" ? "恢复继承" : "恢复自动值"}
    </button>
  ) : null;

  const laidOf = (el: SceneElement) => laid.find((item) => item.el.id === el.id);
  const metricsOf = (el: SceneElement) => laidOf(el)?.metrics ?? sceneMetrics(scene, board, el, resolveScenePlacement(scene, board, el), lang);
  const elementVisible = (el: SceneElement) => resolveScenePlacement(scene, board, el).visible;
  const missingRoles = (["cta"] as SceneRole[]).filter((role) => !scene.elements.some((el) => el.role === role));
  const firstMemberIndex = scene.elements.findIndex((el) => isSceneGroupRole(el.role));
  const hasLayerContent = (el: SceneElement) => Boolean(sceneText(el, lang).trim()) || (el.role === "badge" && sceneBadgeStyle(scene).id === "earnings");
  const listed = scene.elements.filter((el) => !isSceneGroupRole(el.role) && (!MODULE_ROLES.has(el.role) || el.role === "logo" || (hasLayerContent(el) && elementVisible(el))));
  const layerMembers = SCENE_GROUP_ROLES.flatMap((role) => scene.elements.filter((el) => el.role === role && hasLayerContent(el)));
  const groupFlagged = members.some((el) => issueIds.has(el.id));

  const layerRow = (el: SceneElement, indent = false) => {
    const visible = elementVisible(el);
    const canToggle = el.role !== "visual" && el.role !== "title";
    return (
      <div
        key={el.id}
        onClick={(event) => selectLayer(el.id, event.shiftKey || event.ctrlKey || event.metaKey)}
        className={cn(
          "group flex h-8 cursor-pointer items-center gap-2 rounded-[4px] px-2 text-[10px]",
          indent && "pl-5",
          selectedId === el.id || multiSet.has(el.id) ? "bg-[var(--app-surface-3)] text-[var(--app-text)]" : "text-[var(--app-text-2)] hover:bg-[var(--app-surface-2)]",
          !visible && "opacity-50",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{el.name}</span>
        {issueIds.has(el.id) ? <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-warn)]" /> : null}
        {canToggle ? (
          <button
            type="button"
            aria-label={visible ? `隐藏${el.name}` : `显示${el.name}`}
            onClick={(event) => {
              event.stopPropagation();
              setVisible(el, !visible);
            }}
            className="grid size-5 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:text-[var(--app-text)]"
          >
            {visible ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
        ) : null}
        {mode === "family" && SCENE_REMOVABLE_ROLES.includes(el.role) ? (
          <button
            type="button"
            aria-label={`删除${el.name}`}
            onClick={(event) => {
              event.stopPropagation();
              removeElement(el.id);
            }}
            className="grid size-5 place-items-center rounded-[3px] text-[var(--app-text-4)] opacity-0 hover:text-[var(--color-up)] group-hover:opacity-100"
          >
            <Trash2 size={11} />
          </button>
        ) : null}
      </div>
    );
  };

  const groupRows = (
    <Fragment key={SCENE_GROUP_ID}>
      <div
        onClick={(event) => selectLayer(SCENE_GROUP_ID, event.shiftKey || event.ctrlKey || event.metaKey)}
        className={cn(
          "flex h-8 cursor-pointer items-center gap-2 rounded-[4px] px-2 text-[10px]",
          groupSelected || multiSet.has(SCENE_GROUP_ID) ? "bg-[var(--app-surface-3)] text-[var(--app-text)]" : "text-[var(--app-text-2)] hover:bg-[var(--app-surface-2)]",
        )}
      >
        <span className="min-w-0 flex-1 truncate">标题组</span>
        {groupFlagged ? <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-warn)]" /> : null}
      </div>
      {layerMembers.map((el) => layerRow(el, true))}
    </Fragment>
  );

  const fontPicker = (el: SceneElement) => {
    const text = sceneText(el, lang);
    const length = Array.from(text).length;
    const part = range && range.id === el.id && range.end > range.start && !(range.start === 0 && range.end >= length) ? range : null;
    const runs = scene.fontRuns?.[el.id]?.[lang] ?? [];
    const layerFont = sceneFontId(scene, el, lang);
    const partFont = part ? runs.find((item) => item.start <= part.start && item.end >= part.end)?.font ?? layerFont : layerFont;
    const partText = part ? Array.from(text).slice(part.start, part.end).join("") : "";
    return (
      <div className="mt-3 text-[9px] text-[var(--app-text-4)]">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate">{part ? `字体 · 选中「${partText.replace(/\n/g, " ")}」` : "字体"}</span>
          {part ? (
            <button type="button" onClick={() => setRange(null)} className="shrink-0 text-[var(--app-text-3)] hover:text-[var(--app-text)]">改整层</button>
          ) : runs.length ? (
            <button type="button" onClick={() => writeFontRuns(el.id, () => [])} className="shrink-0 text-[var(--app-text-3)] hover:text-[var(--app-text)]">清除局部字体</button>
          ) : null}
        </div>
        <FontPicker
          label={`${el.name}字体`}
          value={partFont}
          options={SCENE_FONTS.filter((font) => part ? sceneFontSupportsText(font, script, partText) : sceneFontSupports(font, script))}
          onChange={(id) => part ? setRangeFont(el, part.start, part.end, id) : setFont(el.id, id)}
        />
      </div>
    );
  };

  /** 字间距按字号百分比设置，与 Figma 的「%」字间距一致。 */
  const trackingField = (el: SceneElement) => (
    <ScrubField
      label="字间距"
      ariaLabel={`${el.name}字间距`}
      value={Math.round((scene.tracking?.[el.id] ?? 0) * 1000) / 10}
      decimals={1}
      min={-20}
      max={100}
      step={0.5}
      suffix="%"
      onCommit={(value) => updateScene((current) => {
        const tracking = { ...current.tracking };
        if (value) tracking[el.id] = Math.round(value * 10) / 1000;
        else delete tracking[el.id];
        return { ...current, tracking };
      })}
    />
  );

  const lineRatioFields = (el: SceneElement) => {
    const count = sceneText(el, lang).split("\n").length;
    if (count < 2) return null;
    const ratios = sceneLineRatios(scene, el, count, family);
    const setRatio = (index: number, value: number) => updateScene((current) => {
      const next = sceneLineRatios(current, el, count, family);
      next[index] = value;
      return { ...current, familyLineRatios: { ...current.familyLineRatios, [family]: { ...current.familyLineRatios?.[family], [el.id]: next } } };
    });
    return (
      <div className="mt-3">
        <div className="mb-1 text-[9px] text-[var(--app-text-4)]">逐行字号比例（第 1 行为基准）</div>
        <div className="grid grid-cols-2 gap-2">
          {ratios.slice(1).map((ratio, index) => (
            <ScrubField
              key={index}
              label={`第 ${index + 2} 行`}
              ariaLabel={`第 ${index + 2} 行字号比例`}
              value={ratio}
              decimals={2}
              min={0.4}
              max={1.6}
              step={0.01}
              suffix="×"
              onCommit={(value) => setRatio(index + 1, value)}
            />
          ))}
        </div>
      </div>
    );
  };

  const sizeFields = (el: SceneElement, scale: number, onScale: (value: number) => void) => {
    const metrics = metricsOf(el);
    return (
      <div className="grid grid-cols-2 gap-2">
        <ScrubField label="比例" ariaLabel="比例" value={scale} decimals={2} min={0.3} max={3} step={0.01} suffix="×" onCommit={onScale} />
        {metrics.fontPx > 0 ? (
          <ScrubField
            label="字号"
            ariaLabel="字号"
            value={Math.round(metrics.fontPx)}
            min={8}
            max={400}
            suffix="px"
            onCommit={(value) => onScale(scale * (value / metrics.fontPx))}
          />
        ) : (
          <div className="text-[9px] text-[var(--app-text-4)]">
            尺寸
            <div className="mt-2 text-[10px] tabular-nums text-[var(--app-text-2)]">{Math.round(metrics.w)} × {Math.round(metrics.h)}</div>
          </div>
        )}
      </div>
    );
  };

  const copyField = (el: SceneElement, multiline: boolean) => {
    const value = sceneText(el, lang);
    const common = {
      "aria-label": `${el.name}文案`,
      value,
      onFocus: () => setSelectedId(el.id),
      onSelect: (event: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => captureRange(el.id, event.currentTarget),
      onMouseUp: (event: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => captureRange(el.id, event.currentTarget),
      onKeyUp: (event: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => captureRange(el.id, event.currentTarget),
    };
    return multiline ? (
      <textarea
        {...common}
        rows={Math.max(1, value.split("\n").length)}
        onChange={(event) => setText(el, event.target.value)}
        className={cn(INPUT, "h-auto resize-none py-[7px] leading-[1.45]")}
      />
    ) : (
      <input {...common} onChange={(event) => setText(el, event.target.value)} className={INPUT} />
    );
  };

  const rangeHandlers = (el: SceneElement) => ({
    onFocus: () => setSelectedId(el.id),
    onSelect: (event: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => captureRange(el.id, event.currentTarget),
    onMouseUp: (event: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => captureRange(el.id, event.currentTarget),
    onKeyUp: (event: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => captureRange(el.id, event.currentTarget),
  });

  const slotField = (role: SceneRole) => {
    const el = scene.elements.find((item) => item.role === role);
    const shown = el ? (mode === "board" ? elementVisible(el) : el.visible) : false;
    const optional = OPTIONAL_ROLES.has(role);
    if (optional && !shown) return null;
    const id = el?.id ?? role;
    const label = SCENE_ROLE_LABEL[role];
    const value = el ? sceneText(el, lang) : "";
    const badgeStyle = role === "badge" ? sceneBadgeStyle(scene).id : null;
    const earnings = Boolean(el) && badgeStyle === "earnings";
    const hasCopy = Boolean(value.trim()) || earnings;
    const multiline = isSceneGroupRole(role);
    const required = role === "title";
    const onChange = (text: string) => !el || (!el.visible && !value.trim()) ? fillSlot(role, text) : setText(el, text);
    const clear = () => {
      if (!el) return;
      if (earnings) setBadgeStyle("style1");
      setText(el, "");
    };
    const hidden = Boolean(el) && hasCopy && !shown;
    const common = { "aria-label": `${label}文案`, value, placeholder: required ? "必填" : "选填", ...(el ? rangeHandlers(el) : {}) };
    const aside = (
      <>
        {el ? resetButton(el.id) : null}
        {el && hasCopy && !required && !optional ? (
          <button type="button" aria-label={shown ? `隐藏${label}` : `显示${label}`} title={shown ? "隐藏" : "显示"} onClick={() => setVisible(el, !shown)} className={ICON}>
            {shown ? <Eye size={11} /> : <EyeOff size={11} />}
          </button>
        ) : null}
        {el && hasCopy && !required && !optional && mode === "family" ? (
          <button type="button" aria-label={`清空${label}`} title="清空" onClick={clear} className={ICON}>
            <X size={11} />
          </button>
        ) : null}
        {el && optional ? (
          <button type="button" aria-label={`移除${label}`} title="移除" onClick={() => setVisible(el, false)} className={ICON}>
            <X size={11} />
          </button>
        ) : null}
      </>
    );
    return (
      <Section key={role} id={id} title={label} muted={!hasCopy || hidden} open={isOpen(id)} onToggle={() => togglePanel(id)} aside={aside}>
        <div className={cn(hidden && "opacity-50")}>
          {earnings ? (
            <div className="flex h-8 items-center rounded-[4px] border border-[var(--app-line)] bg-[var(--app-surface-2)] px-2.5 text-[10px] text-[var(--app-text-3)]">
              {lang === "en" ? "Decode Earnings with" : lang === "tc" ? "看財報用" : "看财报用"} ＋ moomoo
            </div>
          ) : multiline ? (
            <textarea
              {...common}
              rows={Math.max(1, value.split("\n").length)}
              onChange={(event) => onChange(event.target.value)}
              className={cn(INPUT, "h-auto resize-none py-[7px] leading-[1.45]")}
            />
          ) : (
            <input {...common} onChange={(event) => onChange(event.target.value)} className={INPUT} />
          )}
        </div>
        {role === "badge" && mode === "family" ? (
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {SCENE_BADGE_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                aria-pressed={badgeStyle === style.id}
                title={style.name}
                onClick={() => setBadgeStyle(style.id)}
                className={cn(
                  "flex h-9 flex-col items-center justify-center gap-0.5 rounded-[4px] border bg-[#121212] px-1",
                  badgeStyle === style.id ? "border-[var(--color-brand)]" : "border-[var(--app-line)] hover:border-[var(--app-line-strong)]",
                )}
              >
                <img src={BADGE_THUMBS[style.id]} alt="" className="h-3 max-w-full" />
                <span className="w-full truncate text-center text-[8px] text-white/60">{style.name}</span>
              </button>
            ))}
          </div>
        ) : null}
        {el && hasCopy ? elementParams(el) : null}
      </Section>
    );
  };

  /** 角标、免责默认不出现，点添加后才显示对应模块。 */
  const showModule = (role: SceneRole) => {
    const el = scene.elements.find((item) => item.role === role);
    if (el) setVisible(el, true);
    else if (mode === "family") fillSlot(role, "");
    else return;
    const id = el?.id ?? sceneDefaultElement(role, 0).id;
    setOpenParams((current) => ({ ...current, [id]: true }));
    setSelectedId(id);
  };

  const placementFields = (el: SceneElement, withSize = true) => {
    const placement = resolveScenePlacement(scene, board, el);
    const laidItem = laidOf(el);
    const metrics = metricsOf(el);
    const badgeStyle = el.role === "badge" ? sceneBadgeStyle(scene) : null;
    const following = Boolean(output.group) && placement.follow !== undefined && placement.follow !== "none";
    const ctaLocked = el.role === "cta" && Boolean(metrics.locked);
    const widthEditable = (el.role === "cta" && !ctaLocked) || badgeStyle?.id === "style1";
    const shownX = laidItem ? laidItem.placement.x : placement.x;
    return (
      <>
        {el.role !== "visual" && output.group ? (
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[9px] text-[var(--app-text-4)]">对齐方式</span>
              <Segmented<SceneFollow>
                size="sm"
                value={placement.follow ?? "none"}
                onChange={(follow) => patchPlacement(el.id, follow === "none" ? { follow, x: shownX, align: laidItem?.placement.align ?? placement.align } : { follow })}
                options={FOLLOW_OPTIONS}
              />
            </div>
          </div>
        ) : null}
        <div className="mb-2 grid grid-cols-2 gap-2">
          <ScrubField label="X" ariaLabel="X 坐标" disabled={following} value={Math.round(shownX * board.w)} min={-board.w} max={board.w * 2} suffix="px" onCommit={(value) => patchPlacement(el.id, { x: value / board.w })} />
          <ScrubField label="Y" ariaLabel="Y 坐标" value={Math.round(placement.y * board.h)} min={-board.h} max={board.h * 2} suffix="px" onCommit={(value) => patchPlacement(el.id, { y: value / board.h })} />
        </div>
        {!withSize ? null : ctaLocked ? (
          <div className="rounded-[4px] bg-[var(--app-surface-2)] px-2 py-1.5 text-[9px] leading-relaxed text-[var(--app-text-3)]">
            站内规范锁定：高 {Math.round(board.ctaSpec!.height)}px · 字号 {board.ctaSpec!.fontPx}px · 左右内边距 {board.ctaSpec!.paddingX}px · 宽 {board.ctaSpec!.minWidth}–{board.ctaSpec!.maxWidth}px（当前 {Math.round(metrics.w)}px）
          </div>
        ) : sizeFields(el, placement.scale, (value) => patchPlacement(el.id, { scale: value }))}
        {withSize && widthEditable ? (
          <div className="mt-2 grid grid-cols-2 items-end gap-2">
            <ScrubField
              label="宽度"
              ariaLabel="宽度"
              value={Math.round(metrics.w)}
              min={8}
              max={board.w}
              suffix="px"
              onCommit={(value) => patchPlacement(el.id, { w: sceneWidthToUnit(board, value) })}
            />
            <button
              type="button"
              disabled={!placement.w}
              onClick={() => clearPlacementKey(el.id, "w")}
              className={cn(GHOST, "h-8")}
            >
              随文案自适应
            </button>
          </div>
        ) : null}
        {el.role !== "visual" && !following ? (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[9px] text-[var(--app-text-4)]">对齐锚点</span>
            <Segmented<SceneAlign> size="sm" value={placement.align} onChange={(align) => changeAlign(el.id, align)} options={ALIGN_OPTIONS} />
          </div>
        ) : null}
      </>
    );
  };

  const customField = (el: SceneElement) => {
    const shown = mode === "board" ? elementVisible(el) : el.visible;
    const hasCopy = Boolean(sceneText(el, lang).trim());
    return (
      <Section
        key={el.id}
        id={el.id}
        title={el.name}
        muted={!hasCopy || !shown}
        open={isOpen(el.id)}
        onToggle={() => togglePanel(el.id)}
        aside={(
          <>
            {resetButton(el.id)}
            <button type="button" aria-label={shown ? `隐藏${el.name}` : `显示${el.name}`} title={shown ? "隐藏" : "显示"} onClick={() => setVisible(el, !shown)} className={ICON}>
              {shown ? <Eye size={11} /> : <EyeOff size={11} />}
            </button>
            {mode === "family" ? (
              <button type="button" aria-label={`删除${el.name}`} title="删除" onClick={() => removeElement(el.id)} className={cn(ICON, "hover:text-[var(--color-up)]")}>
                <Trash2 size={11} />
              </button>
            ) : null}
          </>
        )}
      >
        <div className={cn(!shown && "opacity-50")}>{copyField(el, el.role !== "cta")}</div>
        {hasCopy ? elementParams(el) : null}
      </Section>
    );
  };

  const colorAndHighlight = (el: SceneElement) => {
    const text = sceneText(el, lang);
    const elRange = range && range.id === el.id && range.end > range.start ? range : null;
    const elHighlights = scene.highlights[el.id]?.[lang] ?? [];
    const rangeHighlighted = elRange ? elHighlights.some((item) => item.start < elRange.end && item.end > elRange.start) : false;
    const rangePreset = elRange ? elHighlights.find((item) => item.start === elRange.start && item.end === elRange.end)?.preset : undefined;
    const custom = sceneCustomGradient(scene);
    const solids = SCENE_HIGHLIGHT_PRESETS.filter((preset) => preset.paints.length === 1 && preset.paints[0]!.type === "SOLID");
    const gradients = SCENE_HIGHLIGHT_PRESETS.filter((preset) => !solids.includes(preset));
    /** 提示框贴着色块所在一侧展开，避免被右侧面板裁掉。 */
    const swatch = (id: string, name: string, detail: string, paints: ScenePaint[], index: number) => (
      <button
        key={id}
        type="button"
        aria-label={`高亮 ${name}`}
        aria-pressed={rangePreset === id}
        disabled={!elRange}
        onClick={() => applyHighlight(id)}
        className={cn(
          "group relative size-7 rounded-[4px] border disabled:cursor-not-allowed",
          rangePreset === id ? "border-[var(--color-brand)] ring-1 ring-[var(--color-brand)]" : "border-white/15 hover:border-white/40",
          !elRange && "opacity-60",
        )}
        style={{ backgroundImage: scenePaintsCss(paints).join(", ") }}
      >
        <span
          className={cn(
            "pointer-events-none absolute bottom-full z-20 mb-1.5 hidden whitespace-nowrap rounded-[4px] border border-white/10 bg-[#202124] px-2 py-1 text-left text-[9px] leading-[1.5] text-[var(--app-text-2)] shadow-[0_6px_20px_rgb(0_0_0/0.45)] group-hover:block",
            index < 2 ? "left-0" : index > 4 ? "right-0" : "left-1/2 -translate-x-1/2",
          )}
        >
          <span className="block text-[10px] text-[var(--app-text)]">{name}</span>
          {detail}
        </span>
      </button>
    );
    return (
      <div>
        <div className="mb-1.5 text-[9px] text-[var(--app-text-4)]">整层颜色</div>
        <BackgroundColorControl
          label="文字颜色"
          value={scene.textColors[el.id] ?? "#FFFFFF"}
          onChange={(value) => isSceneHex(value) && updateScene((current) => ({ ...current, textColors: { ...current.textColors, [el.id]: value } }))}
        />

        <div className="mb-1.5 mt-3 text-[9px] text-[var(--app-text-4)]">局部高亮</div>
        <div className="mb-2 flex min-h-8 items-center gap-2 rounded-[4px] bg-[var(--app-surface-2)] px-2 py-1.5 text-[10px]">
          {elRange ? (
            <>
              <span className="min-w-0 flex-1 truncate">已框选「{Array.from(text).slice(elRange.start, elRange.end).join("")}」</span>
              <button type="button" disabled={!rangeHighlighted} onClick={clearRangeHighlight} className="shrink-0 text-[var(--app-text-3)] hover:text-[var(--app-text)] disabled:opacity-35">
                取消高亮
              </button>
            </>
          ) : (
            <span className="text-[var(--app-text-4)]">框选文字后选色</span>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-6 shrink-0 text-[9px] text-[var(--app-text-4)]">纯色</span>
            {solids.map((preset, index) => swatch(preset.id, preset.name, highlightDetail(preset.paints), preset.paints, index))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 shrink-0 text-[9px] text-[var(--app-text-4)]">渐变</span>
            {gradients.map((preset, index) => swatch(preset.id, preset.name, highlightDetail(preset.paints), preset.paints, index))}
            {swatch("custom", "自定义渐变", highlightDetail(highlightPaints(scene, "custom")), highlightPaints(scene, "custom"), gradients.length)}
          </div>
        </div>

        <div className="mt-2 rounded-[4px] border border-[var(--app-line)]">
          <div className="flex h-7 items-center gap-2 pr-2">
            <button
              type="button"
              aria-expanded={customOpen}
              onClick={() => setCustomOpen(!customOpen)}
              className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-2 text-[9px] text-[var(--app-text-3)] hover:text-[var(--app-text)]"
            >
              <ChevronDown size={11} className={cn("transition-transform", !customOpen && "-rotate-90")} />
              <span className="flex-1 text-left">自定义渐变</span>
            </button>
            <button type="button" disabled={!elRange} onClick={() => applyHighlight("custom")} className="text-[9px] text-[var(--app-text-2)] hover:text-[var(--app-text)] disabled:opacity-40">应用</button>
          </div>
          {customOpen ? (
            <div className="border-t border-[var(--app-line-soft)] p-2">
              <GradientEditor value={custom} onChange={(next) => updateScene((current) => ({ ...current, customGradient: next }))} />
            </div>
          ) : null}
        </div>

        {elHighlights.length ? (
          <div className="mt-2">
            <div className="mb-1 text-[9px] text-[var(--app-text-4)]">已设置的高亮</div>
            <div className="space-y-1">
              {elHighlights.map((item, index) => {
                const current = elRange?.start === item.start && elRange.end === item.end;
                return (
                  <div
                    key={`${item.start}-${item.end}`}
                    onClick={() => setRange({ id: el.id, start: item.start, end: item.end })}
                    className={cn(
                      "flex h-7 cursor-pointer items-center gap-2 rounded-[4px] border px-2 text-[10px]",
                      current ? "border-[var(--color-brand)]" : "border-transparent bg-[var(--app-surface-2)] hover:border-[var(--app-line-strong)]",
                    )}
                  >
                    <span className="size-3 shrink-0 rounded-[2px]" style={{ backgroundImage: scenePaintsCss(highlightPaints(scene, item.preset)).join(", ") }} />
                    <span className="min-w-0 flex-1 truncate">「{Array.from(text).slice(item.start, item.end).join("")}」</span>
                    <button
                      type="button"
                      aria-label="取消这条高亮"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeHighlight(el.id, index);
                      }}
                      className="flex items-center gap-0.5 text-[9px] text-[var(--app-text-4)] hover:text-[var(--app-text)]"
                    >
                      <X size={10} />取消
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  /** 文字描边，交互参照 Figma 描边面板：颜色 + 不透明度 + 显隐 + 删除，下一行位置与粗细。 */
  const strokeFields = (el: SceneElement) => {
    const stroke = scene.strokes?.[el.id];
    const fontPx = metricsOf(el).fontPx;
    const setStroke = (next: SceneStroke | null) => updateScene((current) => {
      const strokes = { ...current.strokes };
      if (next) strokes[el.id] = next;
      else delete strokes[el.id];
      return { ...current, strokes };
    });
    const patch = (value: Partial<SceneStroke>) => stroke && setStroke({ ...stroke, ...value });
    const editing = strokeEditing === el.id;
    const icon = "grid size-7 shrink-0 place-items-center rounded-[4px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]";
    return (
      <Section
        title="描边"
        aside={stroke ? null : (
          <button type="button" aria-label={`添加${el.name}描边`} title="添加描边" onClick={() => setStroke(sceneDefaultStroke(fontPx))} className="grid size-5 place-items-center rounded-[4px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">
            <Plus size={13} />
          </button>
        )}
      >
        {stroke ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-0.5">
              <div className={cn("flex h-7 min-w-0 flex-1 items-center gap-2 rounded-[4px] bg-[var(--app-field)] pl-1.5 pr-1", !stroke.visible && "opacity-50")}>
                <button
                  type="button"
                  aria-label="编辑描边颜色"
                  aria-expanded={editing}
                  onClick={() => setStrokeEditing(editing ? null : el.id)}
                  className="size-4 shrink-0 rounded-[3px] border border-white/20"
                  style={{ backgroundImage: scenePaintsCss(sceneFillPaints(stroke.fill)).join(", ") }}
                />
                <button type="button" onClick={() => setStrokeEditing(editing ? null : el.id)} className="min-w-0 flex-1 truncate text-left text-[10px] text-[var(--app-text-2)]">
                  {fillLabel(stroke.fill)}
                </button>
                <span className="h-4 w-px shrink-0 bg-[var(--app-line)]" />
                <input
                  aria-label="描边不透明度"
                  inputMode="numeric"
                  value={Math.round(stroke.opacity * 100)}
                  onChange={(event) => {
                    const next = Number(event.target.value.replace(/[^\d.]/g, ""));
                    if (Number.isFinite(next)) patch({ opacity: Math.max(0, Math.min(100, next)) / 100 });
                  }}
                  className="w-7 bg-transparent text-right text-[10px] tabular-nums outline-none"
                />
                <span className="text-[9px] text-[var(--app-text-4)]">%</span>
              </div>
              <button type="button" aria-label={stroke.visible ? "隐藏描边" : "显示描边"} onClick={() => patch({ visible: !stroke.visible })} className={icon}>
                {stroke.visible ? <Eye size={12} /> : <EyeOff size={12} />}
              </button>
              <button type="button" aria-label="删除描边" onClick={() => setStroke(null)} className={icon}>
                <Minus size={12} />
              </button>
            </div>
            {editing ? (
              <div className="rounded-[4px] border border-[var(--app-line)] p-2">
                <FillEditor label="描边颜色" value={stroke.fill} onChange={(fill) => patch({ fill })} />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <div className="text-[9px] text-[var(--app-text-4)]">
                <div className="mb-1">位置</div>
                <Dropdown
                  label="描边位置"
                  size="sm"
                  value={stroke.align}
                  options={SCENE_STROKE_ALIGNS.map((item) => ({ id: item.id, label: item.name }))}
                  onChange={(id) => patch({ align: id as SceneStrokeAlign })}
                />
              </div>
              <ScrubField
                label="粗细"
                ariaLabel="描边粗细"
                value={Math.round(stroke.weight * fontPx * 10) / 10}
                decimals={1}
                min={0}
                max={40}
                step={0.1}
                suffix="px"
                onCommit={(value) => fontPx > 0 && patch({ weight: value / fontPx })}
              />
            </div>
          </div>
        ) : null}
      </Section>
    );
  };

  /** 文案层参数：标题组成员调单独比例与间距，其它层调位置与大小。 */
  const elementParams = (el: SceneElement) => {
    if (el.role === "cta") return ctaParams(el);
    if (el.role === "badge") {
      return (
        <div className="mt-3">
          {sceneBadgeStyle(scene).widths ? (
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[9px] text-[var(--app-text-4)]">固定规格</span>
              <Segmented<SceneBadgeLength>
                size="sm"
                value={scene.badgeLength ?? "auto"}
                onChange={(value) => updateScene((current) => ({ ...current, badgeLength: value }))}
                options={[{ id: "auto", label: "自动" }, { id: "short", label: "短版" }, { id: "long", label: "长版" }]}
              />
            </div>
          ) : null}
          {placementFields(el)}
          {fontPicker(el)}
        </div>
      );
    }
    const member = isSceneGroupRole(el.role);
    const own = resolveSceneOwn(scene, board, el);
    const gapLabel = el.role === "kicker" ? "与下一层间距" : el.role === "subtitle" ? "与上一层间距" : null;
    const baseGap = sceneGroupBaseGap(board) * group.scale;
    const gapPx = own.gap !== undefined ? baseGap * own.gap : baseGap * (group.gap ?? 1);
    return (
      <div className="mt-3">
        {member ? (
          <>
            {sizeFields(el, own.scale, (value) => patchPlacement(el.id, { scale: value }))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {trackingField(el)}
              {gapLabel ? (
                <ScrubField
                  label={gapLabel}
                  ariaLabel={`${el.name}${gapLabel}`}
                  value={Math.round(gapPx)}
                  min={0}
                  max={Math.round(board.h / 2)}
                  suffix="px"
                  onCommit={(value) => patchPlacement(el.id, { gap: value / baseGap })}
                />
              ) : null}
            </div>
            {lineRatioFields(el)}
          </>
        ) : (
          <>
            {placementFields(el)}
            <div className="mt-2 grid grid-cols-2 gap-2">{trackingField(el)}</div>
          </>
        )}
        {fontPicker(el)}
      </div>
    );
  };

  /** CTA：四种预设横排 + 自定义样式，字号与字体，尺寸受规范限制时只给提示。 */
  const ctaParams = (el: SceneElement) => {
    const placement = resolveScenePlacement(scene, board, el);
    const metrics = metricsOf(el);
    const locked = Boolean(metrics.locked);
    const spec = board.ctaSpec;
    const custom = scene.ctaCustom ?? SCENE_CTA_CUSTOM_DEFAULT;
    const ctaLabel = sceneText(el, lang).trim() || "按钮";
    const chosenFont = SCENE_FONTS.find((font) => font.id === sceneFontId(scene, el, lang));
    const ctaFont = chosenFont ? fontPreviewStyle(chosenFont) : {};
    const fontLocked = locked && !scene.ctaFontUnlocked;
    const choose = (id: SceneState["ctaPreset"]) => updateScene((current) => {
      const textColors = { ...current.textColors };
      delete textColors[el.id];
      return { ...current, ctaPreset: id, textColors };
    });
    const tile = (id: SceneState["ctaPreset"], name: string, background: { backgroundColor?: string; backgroundImage?: string }, color: string) => (
      <button
        key={id}
        type="button"
        aria-pressed={scene.ctaPreset === id}
        title={name}
        onClick={() => choose(id)}
        className={cn(
          "relative grid h-14 place-items-center rounded-[6px] px-2",
          scene.ctaPreset === id ? "bg-[var(--app-surface-3)]" : "bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)]",
        )}
      >
        <span className="flex h-7 max-w-full items-center rounded-full px-4 text-[11px] font-medium leading-none ring-1 ring-inset ring-white/10" style={{ ...background, color, ...ctaFont }}>
          <span className="truncate">{ctaLabel}</span>
        </span>
        {scene.ctaPreset === id ? <Check size={11} className="absolute right-1.5 top-1.5 text-[var(--app-text-2)]" /> : null}
      </button>
    );
    return (
      <div className="mt-3">
        <div className="grid grid-cols-2 gap-1.5">
          {CTA_STYLE_PRESETS.map((item) => tile(item.id, item.name, { backgroundColor: item.backgroundColor, ...(item.backgroundImage ? { backgroundImage: item.backgroundImage } : {}) }, item.defaultTextColor))}
        </div>
        <div className="mt-1.5 rounded-[4px] border border-[var(--app-line)]">
          <div className="flex h-7 items-center gap-2 pr-2">
            <button
              type="button"
              aria-expanded={ctaCustomOpen}
              onClick={() => setCtaCustomOpen(!ctaCustomOpen)}
              className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-2 text-[9px] text-[var(--app-text-3)] hover:text-[var(--app-text)]"
            >
              <ChevronDown size={11} className={cn("transition-transform", !ctaCustomOpen && "-rotate-90")} />
              <span className="flex-1 text-left">自定义样式</span>
              {scene.ctaPreset === "custom" ? <Check size={11} className="text-[var(--app-text-2)]" /> : null}
            </button>
            {scene.ctaPreset === "custom" ? null : (
              <button type="button" onClick={() => choose("custom")} className="text-[9px] text-[var(--app-text-2)] hover:text-[var(--app-text)]">应用</button>
            )}
          </div>
          {ctaCustomOpen ? (
            <div className="space-y-2 border-t border-[var(--app-line-soft)] p-2">
              <div className="text-[9px] text-[var(--app-text-4)]">按钮底色</div>
              <FillEditor label="按钮底色" value={custom.fill} onChange={(fill) => updateScene((current) => ({ ...current, ctaCustom: { ...(current.ctaCustom ?? SCENE_CTA_CUSTOM_DEFAULT), fill } }))} />
              <div className="text-[9px] text-[var(--app-text-4)]">默认文字颜色</div>
              <BackgroundColorControl
                label="自定义按钮文字颜色"
                value={custom.textColor}
                onChange={(value) => isSceneHex(value) && updateScene((current) => ({ ...current, ctaCustom: { ...(current.ctaCustom ?? SCENE_CTA_CUSTOM_DEFAULT), textColor: value } }))}
              />
            </div>
          ) : null}
        </div>

        <div className="mb-1.5 mt-3 text-[9px] text-[var(--app-text-4)]">文字</div>
        <div className="grid grid-cols-2 gap-2">
          <ScrubField
            label="字号"
            ariaLabel="CTA 字号"
            disabled={fontLocked}
            value={Math.round(metrics.fontPx)}
            min={6}
            max={200}
            suffix="px"
            onCommit={(value) => metrics.fontPx > 0 && patchPlacement(el.id, { font: (placement.font ?? 1) * (value / metrics.fontPx) })}
          />
          {trackingField(el)}
        </div>
        {locked && spec ? (
          <div className="mt-1.5 flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[9px] leading-relaxed text-[var(--app-text-4)]">
              {fontLocked ? `广告规范字号 ${spec.fontPx}px` : `规范字号 ${spec.fontPx}px，改动前请确认投放要求`}
            </p>
            <button
              type="button"
              aria-pressed={!fontLocked}
              onClick={() => updateScene((current) => ({ ...current, ctaFontUnlocked: !current.ctaFontUnlocked }))}
              className="flex shrink-0 items-center gap-1 text-[9px] text-[var(--app-text-3)] hover:text-[var(--app-text)]"
            >
              {fontLocked ? <><LockOpen size={10} />解除锁定</> : <><Lock size={10} />恢复锁定</>}
            </button>
          </div>
        ) : null}
        {fontPicker(el)}

        <div className="mb-1.5 mt-3 text-[9px] text-[var(--app-text-4)]">尺寸</div>
        {locked && spec?.lengths ? (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9px] text-[var(--app-text-4)]">预设长度</span>
              <Segmented<SceneCtaLength | "auto" | "custom">
                size="sm"
                value={placement.length ?? (placement.w ? "custom" : "auto")}
                onChange={(value) => value !== "custom" && patchPlacement(el.id, { length: value === "auto" ? undefined : value, w: undefined })}
                options={[{ id: "auto", label: "自适应" }, { id: "short", label: "短" }, { id: "medium", label: "中" }, { id: "long", label: "长" }]}
              />
            </div>
            <ScrubField
              label="宽"
              ariaLabel="CTA 宽度"
              value={Math.round(metrics.w)}
              min={spec.minWidth}
              max={spec.maxWidth}
              suffix="px"
              onCommit={(value) => patchPlacement(el.id, { w: sceneWidthToUnit(board, Math.min(spec.maxWidth, Math.max(spec.minWidth, value))), length: undefined })}
            />
            <p className="mt-1.5 flex items-start gap-1.5 text-[9px] leading-relaxed text-[var(--app-text-4)]">
              <Lock size={10} className="mt-[3px] shrink-0" />
              <span>按广告规范：高 {Math.round(spec.height)}px 固定，宽 {spec.minWidth}–{spec.maxWidth}px（短 {spec.lengths.short} · 中 {spec.lengths.medium} · 长 {spec.lengths.long}）</span>
            </p>
          </>
        ) : locked && spec ? (
          <p className="flex items-start gap-1.5 text-[9px] leading-relaxed text-[var(--app-text-4)]">
            <Lock size={10} className="mt-[3px] shrink-0" />
            <span>按广告规范锁定：高 {Math.round(spec.height)}px · 内边距 {spec.paddingX}px · 宽 {spec.minWidth}–{spec.maxWidth}px 随文案自适应（当前 {Math.round(metrics.w)}px）</span>
          </p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[9px] text-[var(--app-text-4)]">预设长度</span>
              <Segmented<SceneCtaLength | "auto" | "custom">
                size="sm"
                value={placement.length ?? (placement.w ? "custom" : "auto")}
                onChange={(value) => value !== "custom" && patchPlacement(el.id, { length: value === "auto" ? undefined : value, w: undefined })}
                options={[{ id: "auto", label: "自适应" }, { id: "short", label: "短" }, { id: "medium", label: "中" }, { id: "long", label: "长" }]}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ScrubField label="宽" ariaLabel="CTA 宽度" value={Math.round(metrics.w)} min={8} max={board.w} suffix="px" onCommit={(value) => patchPlacement(el.id, { w: sceneWidthToUnit(board, value), length: undefined })} />
              <ScrubField label="高" ariaLabel="CTA 高度" value={Math.round(metrics.h)} min={8} max={board.h} suffix="px" onCommit={(value) => metrics.h > 0 && patchPlacement(el.id, { scale: placement.scale * (value / metrics.h) })} />
              <ScrubField label="比例" ariaLabel="CTA 比例" value={placement.scale} decimals={2} min={0.3} max={3} step={0.01} suffix="×" onCommit={(value) => patchPlacement(el.id, { scale: value })} />
            </div>
          </>
        )}

        <div className="mb-1.5 mt-3 text-[9px] text-[var(--app-text-4)]">位置</div>
        {placementFields(el, false)}
      </div>
    );
  };

  const visualPanel = (el: SceneElement) => {
    const item = laidOf(el);
    const placement = resolveScenePlacement(scene, board, el);
    return (
      <Section id={el.id} title={el.name} open={isOpen(el.id)} onToggle={() => togglePanel(el.id)} aside={resetButton(el.id)}>
        {item ? (
          <VisualCrop
            kvUrl={kvUrl}
            box={item.box}
            board={board}
            onChange={(next) => patchPlacement(el.id, {
              x: (next.x + scene.focal.x * next.w) / board.w,
              y: (next.y + scene.focal.y * next.h) / board.h,
              scale: placement.scale * (next.w / item.box.w),
            })}
          />
        ) : (
          <p className="text-[9px] text-[var(--app-text-4)]">主视觉已隐藏</p>
        )}
        <div className="mt-3">{placementFields(el)}</div>
      </Section>
    );
  };

  const logoPanel = (el: SceneElement) => (
    <Section id={el.id} title={el.name} muted={!elementVisible(el)} open={isOpen(el.id)} onToggle={() => togglePanel(el.id)} aside={resetButton(el.id)}>
      <div className="grid grid-cols-2 gap-1.5">
        {LOGO_PRESET_OPTIONS.map((option) => {
          const logoShown = elementVisible(el);
          const chosen = logoShown && scene.logoPreset === option.id;
          return (
            <button
              key={option.id}
              type="button"
              title={chosen ? `${option.label}（再次点击取消选择）` : option.label}
              aria-pressed={chosen}
              onClick={() => {
                if (chosen) {
                  setVisible(el, false);
                  return;
                }
                updateScene((current) => ({ ...current, logoPreset: option.id }));
                if (!logoShown) setVisible(el, true);
              }}
              className={cn(
                "flex h-12 flex-col items-stretch justify-between rounded-[4px] border p-1.5",
                option.id.includes("Light") ? "bg-[#f4f4f4]" : "bg-[#121212]",
                chosen ? "border-[var(--color-brand)]" : "border-[var(--app-line)] hover:border-[var(--app-line-strong)]",
              )}
            >
              <LogoPresetPreview preset={option.id} className="min-h-0 h-5" />
              <span className={cn("truncate text-[8px]", option.id.includes("Light") ? "text-black/60" : "text-white/55")}>{option.label}</span>
            </button>
          );
        })}
      </div>
      {elementVisible(el) ? <div className="mt-3">{placementFields(el)}</div> : null}
    </Section>
  );

  /** 颜色是固定在参数栏底部的一个模块，作用于当前选中的文字层，参照 Figma 的填充 / 描边面板。 */
  const colorTargets = scene.elements.filter((el) => COLOR_ROLES.has(el.role) && hasLayerContent(el) && elementVisible(el));
  const colorTarget = colorTargets.find((el) => el.id === colorTargetId) ?? colorTargets.find((el) => el.role === "title") ?? colorTargets[0] ?? null;
  const colorModule = () => {
    if (!colorTarget) return null;
    const isCta = colorTarget.role === "cta";
    const ctaCustom = scene.ctaCustom ?? SCENE_CTA_CUSTOM_DEFAULT;
    const ctaPreset = CTA_STYLE_PRESETS.find((item) => item.id === scene.ctaPreset);
    const fallback = isCta ? (scene.ctaPreset === "custom" ? ctaCustom.textColor : ctaPreset?.defaultTextColor ?? "#FFFFFF") : "#FFFFFF";
    const color = scene.textColors[colorTarget.id] ?? fallback;
    return (
      <>
        <Section
          id="color-module"
          title="颜色"
          open={colorOpen}
          onToggle={() => setColorOpen(!colorOpen)}
          aside={(
            <>
              <span className="size-3.5 shrink-0 rounded-[3px] border border-white/20" style={{ backgroundColor: color }} />
              <Dropdown
                label="颜色作用图层"
                size="xs"
                className="w-[120px]"
                value={colorTarget.id}
                options={colorTargets.map((el) => ({ id: el.id, label: el.name }))}
                onChange={setColorTargetId}
              />
            </>
          )}
        >
          {isCta ? (
            <>
              <div className="mb-1.5 text-[9px] text-[var(--app-text-4)]">文字颜色</div>
              <BackgroundColorControl
                label="CTA 文字颜色"
                value={color}
                onChange={(value) => isSceneHex(value) && updateScene((current) => ({ ...current, textColors: { ...current.textColors, [colorTarget.id]: value } }))}
              />
            </>
          ) : colorAndHighlight(colorTarget)}
        </Section>
        {isCta ? null : strokeFields(colorTarget)}
      </>
    );
  };

  const layoutSchemes = sceneLayoutSchemes(scene);
  const [schemeEditing, setSchemeEditing] = useState<string | null>(null);
  /** 多选里标题组以外、可随方案记录的图层（主视觉除外）。 */
  const schemeExtras = [selectedId, ...multiIds].flatMap((id) => {
    const el = scene.elements.find((item) => item.id === id);
    return el && !isSceneGroupRole(el.role) && el.role !== "visual" ? [el] : [];
  });
  const saveScheme = () => {
    const count = layoutSchemes.filter((item) => item.family === family).length;
    const id = `scheme-${Date.now().toString(36)}`;
    const extraIds = schemeExtras.map((el) => el.id);
    updateScene((current) => ({
      ...current,
      layoutSchemes: [
        ...sceneLayoutSchemes(current),
        captureSceneLayoutScheme(current, family, board, id, `${SCENE_FAMILY_LABEL[family]}方案 ${count + 1}`, captureSceneSchemeExtras(current, board, lang, extraIds)),
      ],
    }));
  };
  const editSchemes = (recipe: (list: SceneLayoutScheme[]) => SceneLayoutScheme[]) => updateScene((current) => ({ ...current, layoutSchemes: recipe(sceneLayoutSchemes(current)) }));
  /** 位置留在原文案区域：对齐变了就把锚点移到当前标题组外框对应的边，与手动切换对齐一致。 */
  const applyScheme = (item: SceneLayoutScheme) => {
    const box = output.group?.box;
    const align = item.group.align;
    const position = box && align !== group.align
      ? { x: (align === "left" ? box.x : align === "center" ? box.x + box.w / 2 : box.x + box.w) / board.w, y: group.y }
      : undefined;
    updateScene((current) => placeSceneSchemeExtras(applySceneLayoutScheme(current, item, family, position), item, family, board, lang));
    selectLayer(SCENE_GROUP_ID);
  };
  /** 缩略图只画方案记录的图层：标题组和一并记录的图层，裁到它们的外框。 */
  const schemeThumb = (item: SceneLayoutScheme, box: { w: number; h: number }) => {
    const kept = (el: SceneElement) => isSceneGroupRole(el.role) || Boolean(item.extras?.[el.id]);
    const isolated = { ...scene, elements: scene.elements.map((el) => kept(el) ? (isSceneGroupRole(el.role) ? el : { ...el, visible: true }) : { ...el, visible: false }) };
    const titleOnly = placeSceneSchemeExtras(applySceneLayoutScheme(isolated, item, item.family, { x: item.group.x, y: item.group.y }), item, item.family, item.board, lang);
    const built = buildSceneBoard(titleOnly, item.board, lang);
    const boxes = [...(built.group ? [built.group.box] : []), ...built.layers.filter((layer) => item.extras?.[layer.id]).map((layer) => layer.box)];
    if (!boxes.length) return null;
    const x0 = Math.min(...boxes.map((b) => b.x));
    const y0 = Math.min(...boxes.map((b) => b.y));
    const area = { x: x0, y: y0, w: Math.max(...boxes.map((b) => b.x + b.w)) - x0, h: Math.max(...boxes.map((b) => b.y + b.h)) - y0 };
    if (area.w <= 0 || area.h <= 0) return null;
    const pad = Math.max(area.w, area.h) * 0.06;
    const crop = { x: area.x - pad, y: area.y - pad, w: area.w + pad * 2, h: area.h + pad * 2 };
    const k = Math.min(box.w / crop.w, box.h / crop.h);
    return (
      <div className="relative overflow-hidden" style={{ width: crop.w * k, height: crop.h * k }}>
        <div className="absolute" style={{ left: -crop.x * k, top: -crop.y * k }}>
          <SceneArtboard scene={titleOnly} board={item.board} lang={lang} width={item.board.w * k} />
        </div>
      </div>
    );
  };

  /** 标题组里直接套用方案。 */
  const schemePicker = () => {
    if (mode !== "family" || !layoutSchemes.length) return null;
    const applied = layoutSchemes.find((item) => sceneLayoutSchemeMatches(scene, item, family));
    return (
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="shrink-0 text-[9px] text-[var(--app-text-4)]">排版方案</span>
        <Dropdown
          label="套用标题组方案"
          size="xs"
          className="w-[150px]"
          value={applied?.id ?? ""}
          display={applied?.name ?? "选择方案套用"}
          options={layoutSchemes.map((item) => ({ id: item.id, label: item.name }))}
          onChange={(id) => {
            const item = layoutSchemes.find((entry) => entry.id === id);
            if (item) applyScheme(item);
          }}
        />
      </div>
    );
  };

  /** 标题组方案：只记录标题组的排版（位置、对齐、比例、间距、逐行字号），在其它版式族点缩略图套用。 */
  const schemePanel = () => mode === "family" ? (
    <Section
      id="layout-schemes"
      title="标题组方案"
      aside={(
        <button
          type="button"
          onClick={saveScheme}
          title={schemeExtras.length ? `记录标题组与${schemeExtras.map((el) => el.name).join("、")}的排版` : "记录当前标题组的排版；按住 Shift 点选 Logo 等图层可一起记录"}
          className="flex h-5 max-w-[180px] items-center gap-1 rounded-[4px] px-1.5 text-[9px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
        >
          <Plus size={11} className="shrink-0" />
          <span className="truncate">记录当前{schemeExtras.length ? `（含${schemeExtras.map((el) => el.name).join("、")}）` : ""}</span>
        </button>
      )}
    >
      {layoutSchemes.length ? (
        <div className="grid grid-cols-2 gap-1.5">
          {layoutSchemes.map((item) => {
            const applied = sceneLayoutSchemeMatches(scene, item, family);
            return (
              <div key={item.id} className={cn("group overflow-hidden rounded-[6px]", applied ? "bg-[var(--app-surface-3)]" : "bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)]")}>
                <button
                  type="button"
                  aria-label={`套用${item.name}`}
                  title={applied ? "当前版式族已在使用" : `套用到${SCENE_FAMILY_LABEL[family]}`}
                  onClick={() => applyScheme(item)}
                  className="relative grid h-16 w-full place-items-center bg-[#111317] p-1.5"
                >
                  <span className="pointer-events-none">{schemeThumb(item, { w: 118, h: 52 })}</span>
                  {applied ? <Check size={11} className="absolute right-1.5 top-1.5 text-[var(--app-text-2)]" /> : null}
                </button>
                <div className="flex h-7 items-center gap-1 px-2 text-[10px]">
                  {schemeEditing === item.id ? (
                  <input
                    autoFocus
                    aria-label="方案名称"
                    defaultValue={item.name}
                    onBlur={(event) => {
                      const name = event.target.value.trim();
                      if (name && name !== item.name) editSchemes((list) => list.map((entry) => entry.id === item.id ? { ...entry, name } : entry));
                      setSchemeEditing(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") setSchemeEditing(null);
                    }}
                    className="h-6 min-w-0 flex-1 rounded-[3px] border border-[var(--app-line)] bg-[var(--app-field)] px-1.5 outline-none"
                  />
                ) : (
                  <span onDoubleClick={() => setSchemeEditing(item.id)} title="双击重命名" className="min-w-0 flex-1 truncate">{item.name}</span>
                )}
                {item.extras && schemeEditing !== item.id ? (
                  <span className="shrink-0 text-[9px] text-[var(--app-text-4)]">+{Object.values(item.extras).map((extra) => extra.name).join("、")}</span>
                ) : null}
                <button
                  type="button"
                  aria-label={`删除${item.name}`}
                  onClick={() => editSchemes((list) => list.filter((entry) => entry.id !== item.id))}
                  className="grid size-5 shrink-0 place-items-center rounded-[3px] text-[var(--app-text-4)] opacity-0 hover:text-[var(--app-text)] group-hover:opacity-100"
                >
                  <X size={10} />
                </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[9px] text-[var(--app-text-4)]">调好标题组后记录，到其它版式族点缩略图套用</p>
      )}
    </Section>
  ) : null;

  /** 拖动分隔条调整右侧两栏宽度，向左拖变宽；松手后记住列宽。 */
  const resizer = (key: keyof typeof cols, label: string) => {
    const end = () => {
      if (!colDrag.current) return;
      colDrag.current = null;
      setCols((current) => {
        window.localStorage.setItem(COLUMN_STORE, JSON.stringify(current));
        return current;
      });
    };
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          colDrag.current = { key, x: event.clientX, start: cols[key] };
        }}
        onPointerMove={(event) => {
          const drag = colDrag.current;
          if (!drag) return;
          const [min, max] = COLUMN_LIMITS[drag.key];
          const width = Math.round(Math.max(min, Math.min(max, drag.start - (event.clientX - drag.x))));
          setCols((current) => current[drag.key] === width ? current : { ...current, [drag.key]: width });
        }}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={() => {
          const next = { ...cols, [key]: key === "layers" ? 148 : 320 };
          setCols(next);
          window.localStorage.setItem(COLUMN_STORE, JSON.stringify(next));
        }}
        className="w-3 shrink-0 cursor-col-resize touch-none"
      />
    );
  };

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[5px] border border-[var(--app-line)] bg-[#111317]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-2 text-[9px]">
          <span className="min-w-0 truncate text-[var(--app-text-3)]">
            {mode === "family" ? `${SCENE_FAMILY_LABEL[family]} · 代表画幅 ` : "单板精调 · "}
            <span className="tabular-nums text-[var(--app-text)]">{board.key}</span>
            {board.use ? ` · ${board.use}` : ""}
          </span>
          <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
            <div className="flex items-center gap-0.5">
              <button type="button" aria-label="撤销" title="撤销（Ctrl+Z）" disabled={!canUndoScene} onClick={undoScene} className="flex h-6 items-center gap-1 rounded-[4px] px-1.5 text-[var(--app-text-3)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-35">
                <Undo2 size={11} />撤销
              </button>
              <button type="button" aria-label="重做" title="重做（Ctrl+Shift+Z）" disabled={!canRedoScene} onClick={redoScene} className="flex h-6 items-center gap-1 rounded-[4px] px-1.5 text-[var(--app-text-3)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-35">
                <Redo2 size={11} />重做
              </button>
            </div>
            <CheckToggle
              label="框线"
              title="问题提示框线与标题组虚线框；关掉后只显示选中项的外框"
              checked={outlines}
              onChange={(next) => {
                setOutlines(next);
                saveView({ outlines: next });
              }}
            />
            <CheckToggle
              label="安全区参考线"
              checked={guides}
              onChange={(next) => {
                setGuides(next);
                saveView({ guides: next });
              }}
            />
          </div>
        </div>
        <div
          ref={fit.ref}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) selectLayer(null);
          }}
          className="grid min-h-0 flex-1 place-items-center p-4"
        >
          <SceneArtboard
            scene={scene}
            board={board}
            lang={lang}
            kvUrl={kvUrl}
            width={fit.width}
            selectedId={selectedId}
            selectedIds={multiSet}
            issueIds={issueIds}
            guides={guides}
            outlines={outlines}
            onSelect={selectLayer}
            onPatch={patchPlacement}
            onTextRange={(id, start, end) => {
              if (id !== selectedId) selectLayer(id);
              setRange((current) => current && current.id === id && current.start === start && current.end === end ? current : { id, start, end });
            }}
            onTextChange={(id, text) => {
              const el = scene.elements.find((item) => item.id === id);
              if (el) setText(el, text);
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--app-line)] px-3 py-2">
          <span className="text-[10px] font-semibold">画板底色</span>
          <div className="flex gap-1.5">
            {SCENE_BACKGROUND_PRESETS.map((item) => (
              <button
                key={item.id}
                type="button"
                title={`${item.name} ${item.hex}`}
                aria-label={`底色 ${item.name}`}
                onClick={() => updateScene((current) => ({ ...current, background: item.hex }))}
                className={cn("h-6 w-9 rounded-[4px] border", scene.background.toLowerCase() === item.hex.toLowerCase() ? "border-[var(--color-brand)]" : "border-white/15")}
                style={{ backgroundColor: item.hex }}
              />
            ))}
          </div>
          <BackgroundColorControl
            label="画板底色"
            value={scene.background}
            onChange={(value) => isSceneHex(value) && updateScene((current) => ({ ...current, background: value }))}
          />
          {board.edgeFade ? (
            <p className="basis-full text-[10px] leading-relaxed text-[var(--warn-text)]">
              两侧过渡色为{scene.background.toUpperCase()}（跟随画板底色），交付时请提供此色值
            </p>
          ) : null}
        </div>
      </section>

      {resizer("layers", "调整图层栏宽度")}
      <aside className="flex min-h-0 shrink-0 flex-col overflow-y-auto pr-1" style={{ width: cols.layers }}>
        <Section title="图层" aside={<span className="text-[9px] text-[var(--app-text-4)]">{listed.length + layerMembers.length}</span>}>
          <div className="space-y-0.5">
            {scene.elements.map((el, index) => {
              if (isSceneGroupRole(el.role)) return index === firstMemberIndex ? groupRows : null;
              return listed.includes(el) ? layerRow(el) : null;
            })}
          </div>
          {mode === "family" ? (
            <div className="mt-2 flex flex-wrap gap-1">
              <button type="button" onClick={() => addElement("custom")} className={cn(GHOST, "flex items-center gap-1")}><Plus size={11} />自定义</button>
              {missingRoles.map((role) => (
                <button key={role} type="button" onClick={() => addElement(role)} className={cn(GHOST, "flex items-center gap-1")}><Plus size={11} />{SCENE_ROLE_LABEL[role]}</button>
              ))}
            </div>
          ) : null}
        </Section>
      </aside>

      {resizer("props", "调整参数栏宽度")}
      <aside ref={propsRef} className="flex min-h-0 shrink-0 flex-col overflow-y-auto border-l border-[var(--app-line)] pl-4 pr-1" style={{ width: cols.props }}>
        <Section
          id={SCENE_GROUP_ID}
          title="标题组"
          open={isOpen(SCENE_GROUP_ID)}
          onToggle={() => togglePanel(SCENE_GROUP_ID)}
          aside={mode === "family"
            ? (activeVariant ? (
              <button type="button" onClick={() => chooseVariant(activeVariant)} className="flex items-center gap-1 text-[9px] text-[var(--app-text-3)] hover:text-[var(--app-text)]">
                <RotateCcw size={10} />恢复默认
              </button>
            ) : null)
            : resetButton(SCENE_GROUP_ID)}
        >
          {schemePicker()}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[9px] text-[var(--app-text-4)]">对齐方式</span>
            <Segmented<SceneAlign> size="sm" value={group.align} onChange={(align) => changeAlign(SCENE_GROUP_ID, align)} options={ALIGN_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ScrubField label="X" ariaLabel="标题组 X 坐标" value={Math.round(group.x * board.w)} min={-board.w} max={board.w * 2} suffix="px" onCommit={(value) => patchPlacement(SCENE_GROUP_ID, { x: value / board.w })} />
            <ScrubField label="Y" ariaLabel="标题组 Y 坐标" value={Math.round(group.y * board.h)} min={-board.h} max={board.h * 2} suffix="px" onCommit={(value) => patchPlacement(SCENE_GROUP_ID, { y: value / board.h })} />
            <ScrubField label="整体比例" ariaLabel="标题组整体比例" value={group.scale} decimals={2} min={0.3} max={3} step={0.01} suffix="×" onCommit={(value) => patchPlacement(SCENE_GROUP_ID, { scale: value })} />
            <ScrubField
              label="层间距"
              ariaLabel="标题组层间距"
              disabled={members.length < 2}
              value={Math.round(sceneGroupBaseGap(board) * group.scale * (group.gap ?? 1))}
              min={0}
              max={Math.round(board.h / 2)}
              suffix="px"
              onCommit={(value) => patchPlacement(SCENE_GROUP_ID, { gap: value / (sceneGroupBaseGap(board) * group.scale) })}
            />
          </div>
          {mode === "family" && activeVariant && activeFit?.ok && !activeFit.linesMatch ? (
            <p className="mt-2 text-[9px] text-[var(--app-text-4)]">
              建议主标题断成 {activeItem!.preset.mainTitleLines} 行（回车换行）。
            </p>
          ) : null}
        </Section>

        {COPY_ORDER.map((role) => slotField(role))}
        {scene.elements.filter((el) => el.role === "cta").map((el) => customField(el))}
        {scene.elements.filter((el) => el.role === "custom").map((el) => customField(el))}

        {(() => {
          const addable = [
            ...[...OPTIONAL_ROLES].filter((role) => {
              const el = scene.elements.find((item) => item.role === role);
              const shown = el ? (mode === "board" ? elementVisible(el) : el.visible) : false;
              return !shown && (mode === "family" || Boolean(el));
            }).map((role) => ({ key: role, label: SCENE_ROLE_LABEL[role], onClick: () => showModule(role) })),
            ...(mode === "family" && !scene.elements.some((el) => el.role === "cta") ? [{ key: "cta", label: "CTA", onClick: () => addElement("cta") }] : []),
            ...(mode === "family" ? [{ key: "custom", label: "自定义文字", onClick: () => addElement("custom") }] : []),
          ];
          return addable.length ? (
            <div className="grid grid-cols-2 gap-1.5 border-b border-[var(--app-line-soft)] py-3">
              {addable.map((item) => (
                <button key={item.key} type="button" onClick={item.onClick} className={cn(GHOST, "flex items-center justify-center gap-1 border border-dashed border-[var(--app-line-strong)] text-[var(--app-text-2)]")}>
                  <Plus size={11} />{item.label}
                </button>
              ))}
            </div>
          ) : null;
        })()}

        {colorModule()}

        {scene.elements.filter((el) => el.role === "logo").map((el) => <Fragment key={el.id}>{logoPanel(el)}</Fragment>)}
        {scene.elements.filter((el) => el.role === "visual").map((el) => <Fragment key={el.id}>{visualPanel(el)}</Fragment>)}

        {mode === "board" ? (
          <Section title="本画板">
            <div className="space-y-1.5">
              <button type="button" disabled={!Object.keys(boardPatch).length} onClick={resetBoard} className={cn(GHOST, "flex w-full items-center gap-1.5")}>
                <RotateCcw size={11} />恢复整板自动值
              </button>
              <button type="button" disabled={!Object.keys(boardPatch).length} onClick={syncToFamily} className={cn(GHOST, "flex w-full items-center gap-1.5")}>
                <Plus size={11} />同步到{SCENE_FAMILY_LABEL[family]}（{familyBoards.length} 块）
              </button>
            </div>
          </Section>
        ) : null}

        {schemePanel()}
      </aside>
    </div>
  );
}
