"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Check, ChevronDown, ChevronUp, Copy, Eye, EyeOff, Link2, Lock, LockOpen, Minus, PanelLeftClose, PanelLeftOpen, Plus, Redo2, RotateCcw, Trash2, Undo2, Ungroup, X } from "lucide-react";
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
  roundSceneModulePatch,
  roundScenePatch,
  sceneBadgeStyle,
  sceneBadgeStyle1Svg,
  sceneCopyFit,
  sceneDefaultElement,
  sceneDefaultScale,
  sceneFilledCopy,
  sceneFilledStructure,
  sceneBucketFamily,
  sceneBoardLocked,
  sceneBucketOf,
  sceneGroupBaseGap,
  sceneFontId,
  sceneFontScript,
  sceneFontSupports,
  sceneFontSupportsText,
  captureSceneLayoutScheme,
  applySceneScheme,
  sceneLayoutSchemeMatches,
  SCENE_ATTACH_ROLES,
  sceneAttachToGroup,
  sceneAttachedIds,
  sceneCommitFamily,
  sceneDetachFromGroup,
  sceneFamilyPatch,
  sceneGroupDrift,
  sceneGroupOrder,
  sceneGroupUnit,
  sceneMoveInGroup,
  sceneFamilyCopyEdited,
  sceneFamilyView,
  sceneResetFamilyCopy,
  sceneSyncCopyToAll,
  sceneSyncLanguageContentToAll,
  sceneLayoutSchemes,
  type SceneLayoutScheme,
  SCENE_LINE_HEIGHT,
  sceneLeading,
  sceneLineRatios,
  sceneLineStyles,
  sceneMetrics,
  sceneModuleName,
  sceneNextModuleNumber,
  sceneText,
  sceneVersionView,
  sceneWidthToUnit,
  type Lang,
  type SceneAlign,
  type SceneBadgeLength,
  type SceneBadgeStyle,
  type SceneBoardRef,
  type SceneBox,
  type SceneCopyKind,
  type SceneCtaLength,
  type SceneCopyVariantSpec,
  type SceneCustomBackdropTarget,
  type SceneCustomModule,
  type SceneCustomPlacementMode,
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
import type { FigmaRecognitionResult } from "@/lib/figma-recognition";
import { parseFigmaUrl } from "@/lib/figma-link";
import { LOGO_PRESET_OPTIONS, LogoPresetPreview } from "@/components/logo-preset-preview";
import { arrowStep, ScrubField } from "@/components/ui/field";
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

const CUSTOM_PLACEMENT_OPTIONS: ReadonlyArray<{ id: SceneCustomPlacementMode; label: string; detail: string }> = [
  { id: "title-backdrop", label: "标题底层", detail: "位于文字后方，随标题移动" },
  { id: "above-title", label: "标题组上方", detail: "加入标题组顶部，保留间距" },
  { id: "below-title", label: "标题组下方", detail: "加入标题组底部，保留间距" },
  { id: "free", label: "自由放置", detail: "独立拖动、缩放，不跟随标题" },
];

const INPUT = "h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2.5 text-[10px] outline-none hover:border-[var(--app-line-strong)] focus:border-[var(--app-line-strong)]";
const GHOST = "h-7 rounded-[4px] px-2.5 text-[10px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-35";
const CHIP = "h-7 rounded-[4px] border px-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-40";
const ALIGN_OPTIONS = [{ id: "left" as const, label: "左" }, { id: "center" as const, label: "中" }, { id: "right" as const, label: "右" }];
const MODULE_ROLES = new Set<SceneRole>(["logo", "badge", "disclaimer"]);
/** 字号保留一位小数，如 36.5。 */
const oneDecimal = (px: number) => Math.round(px * 10) / 10;
type AlignEdge = "left" | "center" | "right" | "top" | "middle" | "bottom";
const SELECTION_ALIGN = [
  { id: "left", label: "左对齐", Icon: AlignStartVertical },
  { id: "center", label: "水平居中", Icon: AlignCenterVertical },
  { id: "right", label: "右对齐", Icon: AlignEndVertical },
  { id: "top", label: "顶对齐", Icon: AlignStartHorizontal },
  { id: "middle", label: "垂直居中", Icon: AlignCenterHorizontal },
  { id: "bottom", label: "底对齐", Icon: AlignEndHorizontal },
] as const satisfies ReadonlyArray<{ id: AlignEdge; label: string; Icon: typeof AlignStartVertical }>;

const COLUMN_LIMITS = { layers: [120, 280], props: [280, 640] } as const;
const COLUMN_STORE = "futu:scene-editor-columns";
const VIEW_STORE = "futu:scene-editor-view";
const COPY_ORDER: SceneRole[] = ["title", "subtitle", "kicker"];
const COLOR_ROLES = new Set<SceneRole>(["title", "subtitle", "kicker", "custom", "disclaimer", "cta"]);
const ICON = "grid size-5 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:text-[var(--app-text)]";
const SECTION_ADD = "grid size-5 place-items-center rounded-[4px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]";

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

function withPatch(map: SceneState["familyEdits"], scope: string, id: string, patch: ScenePlacementPatch, module = false) {
  const rounded = module ? roundSceneModulePatch(patch) : roundScenePatch(patch);
  return { ...map, [scope]: { ...map[scope], [id]: { ...map[scope]?.[id], ...rounded } } };
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
  groupLabel,
  locked,
}: {
  mode: "family" | "board";
  board: SceneBoardRef & { use?: string };
  lang: Lang;
  familyBoards: SceneBoardRef[];
  /** 编辑分组的名称，缺省为画幅族名。 */
  groupLabel?: string;
  /** 分组是否按规范锁版式，缺省按画板自身判断。 */
  locked?: boolean;
}) {
  const { project, versionId } = useStudio();
  const { scene: rawScene, updateScene: updateRawScene, undoScene, redoScene, canUndoScene, canRedoScene } = useScene();
  const version = rawScene.versions?.find((item) => item.id === versionId && item.lang === lang) ?? null;
  const languageLocked = version ? Boolean(version.locked) : (rawScene.lockedLanguages?.includes(lang) ?? false);
  const family = sceneBucketOf(board);
  const groupName = groupLabel ?? SCENE_FAMILY_LABEL[sceneBucketFamily(family)];
  /** 规范模板分组：族里只改内容与样式，位置、对齐、字号、CTA 按规范；主视觉裁切仍可调。 */
  const specBoard = mode === "family" && locked !== undefined ? locked : sceneBoardLocked(board);
  const layoutLocked = mode === "family" && specBoard;
  const frozen = (current: SceneState, id: string) => layoutLocked && current.elements.find((el) => el.id === id)?.role !== "visual";
  const layoutBlock = (node: ReactNode) => layoutLocked ? <fieldset disabled className="m-0 min-w-0 border-0 p-0 opacity-50">{node}</fieldset> : node;
  const show = board.show;
  const showKey = show?.join() ?? "";
  const visibilityScope = mode === "board" ? `board:${board.key}` : family;
  const withLanguageVisibility = (current: SceneState, scope: string) => {
    const visibility = current.languageVisibility?.[lang]?.[scope];
    const removed = new Set(current.languageRemoved?.[lang]?.[scope] ?? []);
    if (!visibility && !removed.size) return current;
    return {
      ...current,
      elements: current.elements
        .filter((el) => !removed.has(el.id))
        .map((el) => visibility?.[el.id] === undefined ? el : { ...el, visible: visibility[el.id] }),
    };
  };
  const withLanguageLayout = (current: SceneState) => {
    const familyEdit = current.languageFamilyEdits?.[lang]?.[family];
    const boardEdit = current.languageBoardOverrides?.[lang]?.[board.key];
    return {
      ...current,
      familyEdits: familyEdit ? { ...current.familyEdits, [family]: familyEdit } : current.familyEdits,
      boardOverrides: boardEdit ? { ...current.boardOverrides, [board.key]: boardEdit } : current.boardOverrides,
    };
  };
  /**
   * 兼容旧项目：过去基础语言的显隐写在共享 elements / familyContent 里。
   * 旧共享值只归简体；繁体、英文从角色默认值开始，再叠自己的语言覆盖。
   */
  const withoutLegacySharedVisibility = (current: SceneState) => {
    if (lang === "sc") return current;
    const familyContent = { ...current.familyContent };
    const own = familyContent[family];
    if (own?.visibility) {
      const { visibility: _visibility, ...rest } = own;
      if (Object.keys(rest).length) familyContent[family] = rest;
      else delete familyContent[family];
    }
    return {
      ...current,
      familyContent,
      elements: current.elements.map((el) => {
        const fallback = el.role === "custom" || el.role === "module" || el.role === "badge" || el.role === "disclaimer"
          ? false
          : sceneDefaultElement(el.role, 0).visible;
        return { ...el, visible: fallback };
      }),
    };
  };
  const languageFamilyView = (current: SceneState) => {
    const isolated = withLanguageLayout(withoutLegacySharedVisibility(current));
    const modules = isolated.languageModules?.[lang];
    const base = sceneFamilyView(modules
      ? { ...isolated, elements: isolated.elements.map((el) => modules[el.id] ? { ...el, module: modules[el.id] } : el) }
      : isolated, family, show);
    return withLanguageVisibility(withLanguageVisibility(base, "*"), family);
  };
  const languageScopedView = (current: SceneState) => mode === "board"
    ? withLanguageVisibility(languageFamilyView(current), `board:${board.key}`)
    : languageFamilyView(current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const familyScene = useMemo(() => languageScopedView(rawScene), [rawScene, family, showKey, lang, mode, board.key]);
  const scene = useMemo(() => sceneVersionView(familyScene, version), [familyScene, version]);
  /** 编辑器改动落回当前族；基础语言的图层显隐另存，绝不污染其它语言。 */
  const updateScene = (recipe: (current: SceneState) => SceneState) =>
    updateRawScene((current) => {
      if (version ? current.versions?.find((item) => item.id === version.id)?.locked : current.lockedLanguages?.includes(lang)) return current;
      const sharedBase = sceneFamilyView(current, family, show);
      const base = sceneFamilyView(withoutLegacySharedVisibility(current), family, show);
      const globalBase = withLanguageVisibility(base, "*");
      const scopeBase = mode === "board" ? withLanguageVisibility(globalBase, family) : globalBase;
      const view = languageScopedView(current);
      const activeVersion = version ? current.versions?.find((item) => item.id === version.id) : null;
      const editableView = activeVersion ? sceneVersionView(view, activeVersion) : view;
      const next = recipe(editableView);
      const languageFamilyEdit = next.familyEdits[family] ?? {};
      const languageBoardEdit = next.boardOverrides[board.key] ?? {};
      const baseById = new Map(scopeBase.elements.map((el) => [el.id, el]));
      const visibility = { ...current.languageVisibility?.[lang]?.[visibilityScope] };
      if (!version) {
        for (const el of next.elements) {
          const fallback = baseById.get(el.id)?.visible ?? false;
          if (el.visible === fallback) delete visibility[el.id];
          else visibility[el.id] = el.visible;
        }
      }
      const rawById = new Map(sharedBase.elements.map((el) => [el.id, el]));
      const languageModuleMap = { ...current.languageModules?.[lang] };
      if (!version) {
        for (const el of next.elements) {
          const raw = rawById.get(el.id);
          if (!raw || !el.module) continue;
          if (JSON.stringify(el.module) === JSON.stringify(raw.module)) delete languageModuleMap[el.id];
          else languageModuleMap[el.id] = el.module;
        }
      }
      const sharedSafe = {
        ...next,
        elements: next.elements.map((el) => {
          const raw = rawById.get(el.id);
          return {
            ...el,
            visible: raw?.visible ?? false,
            /** 基础语言编辑只把当前语言的文案提交为当前版式族覆盖；其它语言仍取提交前数据，避免跨语言串改。 */
            texts: version
              ? raw?.texts ?? el.texts
              : { ...(raw?.texts ?? el.texts), [lang]: el.texts[lang] ?? "" },
            ...(raw?.module ? { module: raw.module } : {}),
          };
        }),
        ...(version ? { highlights: current.highlights, fontRuns: current.fontRuns } : {}),
        ...(version ? { badgeStyles: current.badgeStyles } : {}),
        familyEdits: { ...next.familyEdits, [family]: current.familyEdits[family] ?? {} },
        boardOverrides: mode === "board"
          ? { ...next.boardOverrides, [board.key]: current.boardOverrides[board.key] ?? {} }
          : next.boardOverrides,
      };
      const committed = sceneCommitFamily(current, family, sharedSafe, show);
      const languageScopes = { ...committed.languageVisibility?.[lang] };
      if (Object.keys(visibility).length) languageScopes[visibilityScope] = visibility;
      else delete languageScopes[visibilityScope];
      const languageVisibility = { ...committed.languageVisibility };
      if (Object.keys(languageScopes).length) languageVisibility[lang] = languageScopes;
      else delete languageVisibility[lang];
      const languageModules = { ...committed.languageModules };
      if (Object.keys(languageModuleMap).length) languageModules[lang] = languageModuleMap;
      else delete languageModules[lang];
      const languageFamilyEdits = { ...committed.languageFamilyEdits };
      const languageBoardOverrides = { ...committed.languageBoardOverrides };
      let versions = committed.versions;
      if (version) {
        versions = (committed.versions ?? []).map((item) => item.id === version.id ? {
          ...item,
          visibility: Object.fromEntries(next.elements.map((el) => [el.id, el.visible])),
          badgeStyles: next.badgeStyles,
          familyEdits: { ...item.familyEdits, [family]: languageFamilyEdit },
          ...(mode === "board" ? { boardOverrides: { ...item.boardOverrides, [board.key]: languageBoardEdit } } : {}),
        } : item);
      } else {
        languageFamilyEdits[lang] = { ...languageFamilyEdits[lang], [family]: languageFamilyEdit };
        if (mode === "board") languageBoardOverrides[lang] = { ...languageBoardOverrides[lang], [board.key]: languageBoardEdit };
      }
      /** 当前语言当前版式族一有改动就重新标为待保存。 */
      const savedFamiliesByLanguage = { ...committed.savedFamiliesByLanguage };
      const saved = (savedFamiliesByLanguage[lang] ?? committed.savedFamilies ?? []).filter((id) => id !== family);
      savedFamiliesByLanguage[lang] = saved;
      return { ...committed, versions, languageVisibility, languageModules, languageFamilyEdits, languageBoardOverrides, savedFamiliesByLanguage };
    });
  const [cols, setCols] = useState({ layers: 148, props: 320 });
  const [guides, setGuides] = useState(true);
  const [outlines, setOutlines] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);
  const [customImportOpen, setCustomImportOpen] = useState(false);
  const [customImportExpanded, setCustomImportExpanded] = useState(true);
  const [customUrl, setCustomUrl] = useState("");
  const customUrlRef = useRef("");
  const [customBusy, setCustomBusy] = useState(false);
  const customBusyRef = useRef(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customRefreshId, setCustomRefreshId] = useState<string | null>(null);
  const [customModuleUrls, setCustomModuleUrls] = useState<Record<string, string>>({});
  const colDrag = useRef<{ key: keyof typeof cols; x: number; start: number } | null>(null);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(COLUMN_STORE) ?? "null") as Partial<typeof cols> | null;
      if (saved) setCols((current) => ({ ...current, ...saved }));
      const view = JSON.parse(window.localStorage.getItem(VIEW_STORE) ?? "null") as { guides?: boolean; outlines?: boolean; layersOpen?: boolean } | null;
      if (typeof view?.guides === "boolean") setGuides(view.guides);
      if (typeof view?.outlines === "boolean") setOutlines(view.outlines);
      if (typeof view?.layersOpen === "boolean") setLayersOpen(view.layersOpen);
    } catch {
      /* 读不到就用默认值 */
    }
  }, []);
  const saveView = (patch: { guides?: boolean; outlines?: boolean; layersOpen?: boolean }) => {
    try {
      const view = JSON.parse(window.localStorage.getItem(VIEW_STORE) ?? "{}") as object;
      window.localStorage.setItem(VIEW_STORE, JSON.stringify({ ...view, ...patch }));
    } catch {
      /* 存不了就只在本次会话生效 */
    }
  };
  const toggleLayers = (open: boolean) => {
    setLayersOpen(open);
    saveView({ layersOpen: open });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      /** 选中标题组里的一层时，↑ / ↓ 调整它在组里的顺序。 */
      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (groupKeys.current.move(event.key === "ArrowUp" ? -1 : 1)) event.preventDefault();
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoScene();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redoScene();
      } else if (key === "g") {
        event.preventDefault();
        if (event.shiftKey) groupKeys.current.ungroup();
        else groupKeys.current.group();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoScene, redoScene]);
  const [selectedId, setSelectedId] = useState<string | null>(SCENE_GROUP_ID);
  const propsRef = useRef<HTMLElement>(null);
  /** 每次点选都展开并定位参数；重复点同一对象时 selectedId 不变，也必须定位。 */
  const revealParams = (id: string) => {
    setOpenParams((current) => current[id] ? current : { ...current, [id]: true });
    requestAnimationFrame(() => {
      propsRef.current?.querySelector(`[data-param-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  };
  /** Shift / Ctrl / ⌘ 点选加入的其它图层。 */
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const multiSet = useMemo(() => new Set(multiIds), [multiIds]);
  /** 标题组选中时，在画布上点到的那一层（高亮、带缩放手柄）。 */
  const [focusId, setFocusId] = useState<string | null>(null);
  const selectLayer = (id: string | null, additive = false) => {
    if (!additive) setFocusId(null);
    if (id) revealParams(id);
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
  const [customOpen, setCustomOpen] = useState<"solid" | "gradient" | null>(null);
  const [ctaCustomOpen, setCtaCustomOpen] = useState(false);
  const [strokeEditing, setStrokeEditing] = useState<string | null>(null);
  const [titleSyncDone, setTitleSyncDone] = useState(false);
  const titleSyncAwaitingRef = useRef(false);
  useEffect(() => {
    if (!titleSyncDone) return;
    if (titleSyncAwaitingRef.current) {
      titleSyncAwaitingRef.current = false;
      return;
    }
    setTitleSyncDone(false);
  }, [rawScene, titleSyncDone]);
  /** 选中元素时展开它的参数面板，并把右侧滚到对应位置。 */
  useEffect(() => {
    if (!selectedId) return;
    revealParams(selectedId);
    // 初始选中与外部状态变化的兜底；交互点击由 selectLayer 立即定位。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  /** 画布上点到标题组里的某一层：标题组保持选中，展开并滚到这一层的参数，颜色也作用于它。 */
  const focusLayer = (id: string) => {
    setFocusId(id);
    revealParams(id);
    const role = scene.elements.find((el) => el.id === id)?.role;
    if (role && COLOR_ROLES.has(role)) setColorTargetId(id);
  };
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

  const patchPlacement = (id: string, patch: ScenePlacementPatch) => updateScene((current) => writePlacement(current, id, patch));
  /** 代表画板在第四步单独调过的同一项会盖住族里的改动：族里改哪项，就去掉代表画板上的那项单独调整。 */
  const withoutOwnOverride = (current: SceneState, id: string, patch: ScenePlacementPatch): SceneState => {
    const own = current.boardOverrides[board.key]?.[id];
    if (!own) return current;
    const keys = Object.keys(patch).flatMap((key) => key === "x" ? ["x", "shiftX"] : key === "y" ? ["y", "shift"] : [key]);
    if (!keys.some((key) => key in own)) return current;
    const rest = Object.fromEntries(Object.entries(own).filter(([key]) => !keys.includes(key)));
    const forBoard = { ...current.boardOverrides[board.key] };
    if (Object.keys(rest).length) forBoard[id] = rest;
    else delete forBoard[id];
    const boardOverrides = { ...current.boardOverrides };
    if (Object.keys(forBoard).length) boardOverrides[board.key] = forBoard;
    else delete boardOverrides[board.key];
    return { ...current, boardOverrides };
  };
  const writePlacement = (current: SceneState, id: string, patch: ScenePlacementPatch): SceneState => {
    if (frozen(current, id)) return current;
    if (mode !== "board") current = withoutOwnOverride(current, id, patch);
    const el = current.elements.find((item) => item.id === id);
    const module = el?.role === "module";
    const resolved = el ? resolveScenePlacement(current, board, el) : null;
    const customMode = resolved?.customMode ?? el?.module?.placementMode;
    /** 标题底层独立拖动：把绝对坐标换成相对目标文字的偏移，不移动标题组，也不丢掉拖动结果。 */
    if (el?.role === "module" && customMode === "title-backdrop" && resolved?.attach) {
      const laidItem = layoutScene(current, board, lang).laid.find((item) => item.el.id === id);
      const unit = sceneGroupUnit(current, board);
      const stored = mode === "board" ? current.boardOverrides[board.key]?.[id] : current.familyEdits[family]?.[id];
      const attach = { ...(stored?.attach ?? resolved.attach) };
      if (patch.x !== undefined && laidItem) attach.dx += ((patch.x - laidItem.placement.x) * board.w) / unit;
      if (patch.y !== undefined && laidItem) attach.dy += ((patch.y - laidItem.placement.y) * board.h) / unit;
      if (patch.align !== undefined) attach.dx = 0;
      const { x: _x, y: _y, follow: _follow, ...next } = patch;
      if (patch.scale !== undefined && mode !== "board") next.scale = patch.scale / resolveSceneGroup(current, board).scale;
      return mode === "board"
        ? { ...current, boardOverrides: withPatch(current.boardOverrides, board.key, id, { ...next, attach }, module) }
        : { ...current, familyEdits: withPatch(current.familyEdits, family, id, { ...next, attach }, module) };
    }
    if (mode === "board") return { ...current, boardOverrides: withPatch(current.boardOverrides, board.key, id, patch, module) };
    if (current.familyEdits[family]?.[id]?.attach) return { ...current, familyEdits: withPatch(current.familyEdits, family, id, attachedPatch(current, id, patch), module) };
    return { ...current, familyEdits: withPatch(current.familyEdits, family, id, sceneFamilyPatch(current, board, id, patch), module) };
  };

  /** 组内图层位置锁定：换对齐时贴齐标题组同一侧，比例换算成相对标题组的倍数。 */
  const attachedPatch = (current: SceneState, id: string, patch: ScenePlacementPatch): ScenePlacementPatch => {
    const { x: _x, y: _y, follow: _follow, ...next } = patch;
    const attach = current.familyEdits[family]?.[id]?.attach;
    if (patch.align && attach) next.attach = { ...attach, dx: 0 };
    if (patch.scale !== undefined) next.scale = patch.scale / resolveSceneGroup(current, board).scale;
    return next;
  };

  /** 显示/隐藏标题组里的一层后，整组顶边留在原处（记成整组的纵向微调）。 */
  const holdGroup = (before: SceneState, after: SceneState): SceneState => {
    const drift = sceneGroupDrift(before, after, board, lang);
    if (layoutLocked || Math.abs(drift) < 1e-4) return after;
    if (mode === "board") {
      const y = after.boardOverrides[board.key]?.[SCENE_GROUP_ID]?.y;
      if (y !== undefined) return { ...after, boardOverrides: withPatch(after.boardOverrides, board.key, SCENE_GROUP_ID, { y: y - (drift * sceneGroupUnit(after, board)) / board.h }) };
      const shift = (resolveSceneGroup(after, board).shift ?? 0) - drift;
      return { ...after, boardOverrides: withPatch(after.boardOverrides, board.key, SCENE_GROUP_ID, { shift }) };
    }
    const shift = (after.familyEdits[family]?.[SCENE_GROUP_ID]?.shift ?? 0) - drift;
    return { ...after, familyEdits: withPatch(after.familyEdits, family, SCENE_GROUP_ID, { shift }) };
  };

  const patchElement = (id: string, recipe: (el: SceneElement) => SceneElement) => updateScene((current) => ({
    ...current,
    elements: current.elements.map((el) => el.id === id ? recipe(el) : el),
  }));

  const editVersion = (current: SceneState, recipe: (item: SceneVersion) => SceneVersion) => ({
    ...current,
    versions: (current.versions ?? []).map((item) => item.id === version?.id ? recipe(item) : item),
  });

  const setVisible = (el: SceneElement, visible: boolean) => {
    if (version) updateScene((current) => ({
      ...current,
      elements: current.elements.map((item) => item.id === el.id ? { ...item, visible } : item),
    }));
    else updateScene((current) => holdGroup(current, { ...current, elements: current.elements.map((item) => item.id === el.id ? { ...item, visible } : item) }));
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
    if (languageLocked) return;
    updateRawScene((current) => {
      if (version) {
        return {
          ...current,
          versions: current.versions?.map((item) => item.id === version.id
            ? { ...item, removed: Array.from(new Set([...(item.removed ?? []), id])) }
            : item),
        };
      }
      const scopes = { ...current.languageRemoved?.[lang] };
      scopes[visibilityScope] = Array.from(new Set([...(scopes[visibilityScope] ?? []), id]));
      return {
        ...current,
        languageRemoved: {
          ...current.languageRemoved,
          [lang]: scopes,
        },
      };
    });
    if (selectedId === id) setSelectedId(null);
  };

  const addElement = (role: SceneRole) => {
    const repeatable = role === "badge" || role === "disclaimer" || role === "custom";
    const reusable = repeatable && role !== "custom"
      ? scene.elements.find((el) => el.id === role && !elementVisible(el) && !sceneText(el, lang).trim())
      : undefined;
    const existing = reusable ?? (repeatable ? undefined : scene.elements.find((el) => el.role === role));
    if (existing) {
      patchElement(existing.id, (item) => ({ ...item, visible: true }));
      setSelectedId(existing.id);
      return;
    }
    const index = scene.elements.filter((el) => el.role === role).length + 1;
    const el = sceneDefaultElement(role, scene.elements.length + index);
    const id = repeatable ? `${role}-${Date.now().toString(36)}-${index}` : el.id;
    const label = role === "badge" ? "角标" : role === "disclaimer" ? "免责" : role === "custom" ? "文字" : el.name;
    updateScene((current) => ({
      ...current,
      elements: [...current.elements, { ...el, id, name: repeatable ? `${label} ${index}` : el.name, visible: true }],
    }));
    setSelectedId(id);
    setOpenParams((current) => ({ ...current, [id]: true }));
  };

  const recognizeCustomElement = async (url: string) => {
    if (customBusyRef.current) return null;
    const value = url.trim();
    if (!value) {
      setCustomError("请粘贴包含 node-id 的 Figma 链接");
      return null;
    }
    customBusyRef.current = true;
    setCustomBusy(true);
    setCustomError(null);
    try {
      const response = await fetch("/api/figma/recognize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: value,
          token: window.sessionStorage.getItem("futu:figma-token") ?? undefined,
          target: "custom-element",
        }),
      });
      const result = await response.json() as FigmaRecognitionResult & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "无法读取这个 Figma 节点");
      const targetUrl = project.content.kv?.figmaUrl
        ?? project.content.sourceFrames?.[lang]?.figmaUrl
        ?? project.content.sourceFrame?.figmaUrl;
      const target = targetUrl ? parseFigmaUrl(targetUrl) : null;
      if (!target?.ok) {
        throw new Error("第一期需要先在准备主视觉中识别当前项目的 Figma 文件，再导入同文件内的自定义元素");
      }
      if (target?.ok && result.fileKey && result.fileKey !== target.fileKey) {
        throw new Error("第一期仅支持导入当前项目 Figma 文件中的节点；请复制到项目文件后重新粘贴链接");
      }
      return result;
    } catch (error) {
      setCustomError(error instanceof Error ? error.message : "无法读取这个 Figma 节点");
      return null;
    } finally {
      customBusyRef.current = false;
      setCustomBusy(false);
    }
  };

  const moduleSource = (
    result: FigmaRecognitionResult,
    url: string,
    placementMode: SceneCustomPlacementMode,
    backdropTarget: SceneCustomBackdropTarget = "title",
  ): SceneCustomModule => ({
    figmaUrl: url.trim(),
    fileKey: result.fileKey ?? "",
    nodeId: result.frame.id,
    nodeType: result.frame.nodeType,
    previewUrl: result.previewUrl,
    width: Math.max(1, result.frame.width),
    height: Math.max(1, result.frame.height),
    stretchable: result.frame.nodeType === "RECTANGLE",
    placementMode,
    backdropTarget,
  });

  const addCustomModule = (
    result: FigmaRecognitionResult,
    url: string,
    customMode: SceneCustomPlacementMode = "title-backdrop",
    customBackdropTarget: SceneCustomBackdropTarget = "title",
  ) => {
    if (languageLocked) return;
    const id = `module-${Date.now().toString(36)}`;
    const source = moduleSource(result, url, customMode, customBackdropTarget);
    const importScope = mode === "board" ? "current" : "family";
    updateScene((current) => {
      const moduleNumber = sceneNextModuleNumber(current);
      const element: SceneElement = { id, role: "module", name: `元素${moduleNumber}`, visible: true, texts: {}, module: source };
      const elements = [...current.elements];
      const targetIndex = elements.findIndex((item) => item.role === customBackdropTarget);
      if (customMode === "title-backdrop" && targetIndex >= 0) elements.splice(targetIndex, 0, element);
      else elements.push(element);
      const draft = { ...current, elements };
      const group = resolveSceneGroup(draft, board);
      const unit = sceneGroupUnit(draft, board);
      /** 首次导入按 Figma 节点原始尺寸放置；仅在超出画板时等比缩小，避免套用通用模块高度把宽标签压得过小。 */
      const initialPlacement = resolveScenePlacement(draft, board, element);
      const initialHeight = sceneMetrics(draft, board, element, initialPlacement, lang).h;
      const fit = Math.min(1, board.w / source.width, board.h / source.height);
      const scaleFactor = Math.max(0.01, (source.height * fit) / Math.max(1, initialHeight));
      const initialScale = mode === "board" && importScope === "current"
        ? initialPlacement.scale * scaleFactor
        : scaleFactor;
      let patch: ScenePlacementPatch = { align: group.align, scale: initialScale, backdropTarget: customBackdropTarget };
      if (customMode === "above-title" || customMode === "below-title") {
        patch = { ...patch, attach: { v: customMode === "above-title" ? "above" : "below", dy: Math.max(8, sceneGroupBaseGap(board) * group.scale) / unit, dx: 0 } };
      } else if (customMode === "title-backdrop") {
        patch = { ...patch, attach: { v: "beside", dy: 0, dx: 0 } };
      }
      const versions = (draft.versions ?? []).map((item) => {
        if (version && item.id === version.id) return { ...item, visibility: { ...item.visibility, [id]: true } };
        if (!version && item.lang === lang) return { ...item, visibility: { ...item.visibility, [id]: false } };
        return item;
      });
      const languageScopes = { ...draft.languageVisibility?.[lang] };
      if (!version && importScope === "family") {
        languageScopes[family] = { ...languageScopes[family], [id]: true };
      }
      return {
        ...draft,
        versions,
        familyEdits: mode === "board" && importScope === "current" ? draft.familyEdits : withPatch(draft.familyEdits, family, id, patch, true),
        boardOverrides: mode === "board" && importScope === "current"
          ? withPatch(draft.boardOverrides, board.key, id, patch, true)
          : draft.boardOverrides,
        languageVisibility: {
          ...draft.languageVisibility,
          [lang]: languageScopes,
        },
      };
    });
    setSelectedId(id);
    /** 识别期间若用户已输入另一条链接，保留输入并继续展开导入区。 */
    if (customUrlRef.current.trim() === url.trim()) {
      customUrlRef.current = "";
      setCustomImportOpen(false);
      setCustomUrl("");
    }
  };

  const importCustomModule = async () => {
    if (languageLocked || customBusyRef.current) return;
    setCustomRefreshId(null);
    const result = await recognizeCustomElement(customUrl);
    if (result) addCustomModule(result, customUrl);
  };

  const writeCustomElementScope = (
    current: SceneState,
    id: string,
    nextScope: "current" | "family" | "all",
  ): SceneState => {
    const scopes: Record<string, Record<string, boolean>> = { ...(current.languageVisibility?.[lang] ?? {}) };
    for (const [scope, values] of Object.entries(scopes)) {
      const next = { ...values };
      delete next[id];
      if (Object.keys(next).length) scopes[scope] = next;
      else delete scopes[scope];
    }
    const setScope = (scope: string, value: boolean) => {
      scopes[scope] = { ...scopes[scope], [id]: value };
    };
    if (nextScope === "all") setScope("*", true);
    else if (nextScope === "family") setScope(family, true);
    else {
      /** 当前族显式隐藏，再由当前画板覆盖显示，避免族级内容使其它画板也出现。 */
      setScope(family, false);
      setScope(`board:${board.key}`, true);
    }
    const allRemoved = { ...current.languageRemoved };
    if (nextScope === "all") {
      const languageRemoved = { ...(allRemoved[lang] ?? {}) };
      for (const [scope, ids] of Object.entries(languageRemoved)) {
        const next = ids.filter((item) => item !== id);
        if (next.length) languageRemoved[scope] = next;
        else delete languageRemoved[scope];
      }
      if (Object.keys(languageRemoved).length) allRemoved[lang] = languageRemoved;
      else delete allRemoved[lang];
    }
    return {
      ...current,
      languageVisibility: {
        ...current.languageVisibility,
        [lang]: scopes,
      },
      languageRemoved: Object.keys(allRemoved).length ? allRemoved : undefined,
    };
  };

  const setCustomElementScope = (id: string, nextScope: "current" | "family" | "all") => {
    if (languageLocked || version) return;
    updateRawScene((current) => {
      const allSnapshots = { ...current.customModuleScopeSnapshots };
      const languageSnapshots = { ...allSnapshots[lang] };
      if (nextScope === "all") {
        const snapshot: Record<string, boolean> = {};
        for (const [scope, values] of Object.entries(current.languageVisibility?.[lang] ?? {})) {
          if (values[id] !== undefined) snapshot[scope] = values[id];
        }
        languageSnapshots[id] = {
          visibility: snapshot,
          removedScopes: Object.entries(current.languageRemoved?.[lang] ?? {})
            .filter(([, ids]) => ids.includes(id))
            .map(([scope]) => scope),
        };
      } else {
        delete languageSnapshots[id];
      }
      if (Object.keys(languageSnapshots).length) allSnapshots[lang] = languageSnapshots;
      else delete allSnapshots[lang];
      return writeCustomElementScope({
        ...current,
        customModuleScopeSnapshots: Object.keys(allSnapshots).length ? allSnapshots : undefined,
      }, id, nextScope);
    });
  };

  const undoCustomElementScope = (id: string) => {
    if (languageLocked || version) return;
    updateRawScene((current) => {
      const snapshot = current.customModuleScopeSnapshots?.[lang]?.[id];
      if (!snapshot) return writeCustomElementScope(current, id, mode === "board" ? "current" : "family");
      const scopes: Record<string, Record<string, boolean>> = { ...(current.languageVisibility?.[lang] ?? {}) };
      for (const [scope, values] of Object.entries(scopes)) {
        const next = { ...values };
        delete next[id];
        if (Object.keys(next).length) scopes[scope] = next;
        else delete scopes[scope];
      }
      /** 兼容上线前已保存的旧快照：旧格式直接是 scope → boolean。 */
      const storedSnapshot = snapshot as unknown as Record<string, unknown>;
      const visibilitySnapshot = storedSnapshot.visibility && typeof storedSnapshot.visibility === "object"
        ? snapshot.visibility
        : Object.fromEntries(Object.entries(storedSnapshot).filter(([, value]) => typeof value === "boolean")) as Record<string, boolean>;
      const removedScopes = Array.isArray(storedSnapshot.removedScopes)
        ? storedSnapshot.removedScopes.filter((scope): scope is string => typeof scope === "string")
        : [];
      for (const [scope, value] of Object.entries(visibilitySnapshot)) {
        scopes[scope] = { ...scopes[scope], [id]: value };
      }
      const allRemoved = { ...current.languageRemoved };
      const languageRemoved = { ...(allRemoved[lang] ?? {}) };
      for (const [scope, ids] of Object.entries(languageRemoved)) {
        const next = ids.filter((item) => item !== id);
        if (next.length) languageRemoved[scope] = next;
        else delete languageRemoved[scope];
      }
      for (const scope of removedScopes) {
        languageRemoved[scope] = Array.from(new Set([...(languageRemoved[scope] ?? []), id]));
      }
      if (Object.keys(languageRemoved).length) allRemoved[lang] = languageRemoved;
      else delete allRemoved[lang];
      const allSnapshots = { ...current.customModuleScopeSnapshots };
      const languageSnapshots = { ...allSnapshots[lang] };
      delete languageSnapshots[id];
      if (Object.keys(languageSnapshots).length) allSnapshots[lang] = languageSnapshots;
      else delete allSnapshots[lang];
      return {
        ...current,
        languageVisibility: {
          ...current.languageVisibility,
          [lang]: scopes,
        },
        languageRemoved: Object.keys(allRemoved).length ? allRemoved : undefined,
        customModuleScopeSnapshots: Object.keys(allSnapshots).length ? allSnapshots : undefined,
      };
    });
  };

  const refreshCustomModule = async (el: SceneElement, nextUrl = el.module?.figmaUrl ?? "") => {
    if (!el.module || customBusyRef.current) return;
    const value = nextUrl.trim();
    const sourceKey = `${el.module.fileKey}:${el.module.nodeId}:${el.module.figmaUrl}:${Boolean(el.module.cleared)}`;
    setCustomRefreshId(el.id);
    let recognized = false;
    try {
      const result = await recognizeCustomElement(value);
      if (!result) return;
      recognized = true;
      updateScene((current) => {
        const baseModule = current.elements.find((item) => item.id === el.id)?.module;
        const versionModule = version
          ? current.versions?.find((item) => item.id === version.id)?.modules?.[el.id]
          : undefined;
        const latest = versionModule ?? baseModule;
        const latestSourceKey = latest
          ? `${latest.fileKey}:${latest.nodeId}:${latest.figmaUrl}:${Boolean(latest.cleared)}`
          : "";
        /** 删除链接或切换了来源后，迟到的识别结果不得覆盖用户的新状态。 */
        if (!latest || latestSourceKey !== sourceKey) return current;
        const module = moduleSource(result, value, latest.placementMode, latest.backdropTarget);
        return {
          ...current,
          elements: version
            ? current.elements
            : current.elements.map((item) => item.id === el.id ? { ...item, module } : item),
          versions: version
            ? (current.versions ?? []).map((item) => item.id === version.id ? { ...item, modules: { ...item.modules, [el.id]: module } } : item)
            : current.versions,
        };
      });
    } finally {
      if (recognized) setCustomRefreshId((current) => current === el.id ? null : current);
    }
  };

  const clearCustomModuleSource = (el: SceneElement) => {
    if (!el.module || languageLocked) return;
    const module: SceneCustomModule = {
      ...el.module,
      figmaUrl: "",
      fileKey: "",
      nodeId: "",
      nodeType: "",
      cleared: true,
    };
    delete module.previewUrl;
    updateScene((current) => ({
      ...current,
      elements: version
        ? current.elements
        : current.elements.map((item) => item.id === el.id ? { ...item, module } : item),
      versions: version
        ? (current.versions ?? []).map((item) => item.id === version.id ? { ...item, modules: { ...item.modules, [el.id]: module } } : item)
        : current.versions,
    }));
    setCustomModuleUrls((current) => ({ ...current, [el.id]: "" }));
    setCustomRefreshId(null);
    setCustomError(null);
  };

  const changeCustomPlacement = (
    el: SceneElement,
    placementMode: SceneCustomPlacementMode,
    backdropTarget?: SceneCustomBackdropTarget,
  ) => {
    if (!el.module) return;
    const target = backdropTarget
      ?? (mode === "board" ? boardPatch[el.id]?.backdropTarget : scene.familyEdits[family]?.[el.id]?.backdropTarget)
      ?? el.module.backdropTarget
      ?? "title";
    const currentLayout = layoutScene(scene, board, lang);
    const currentLaid = currentLayout.laid.find((item) => item.el.id === el.id);
    updateScene((current) => {
      const unit = sceneGroupUnit(current, board);
      const scope = mode === "board" ? board.key : family;
      const source = mode === "board" ? current.boardOverrides : current.familyEdits;
      const edits = { ...source[scope] };
      const entry: ScenePlacementPatch = { ...edits[el.id], align: resolveSceneGroup(current, board).align };
      delete entry.attach;
      /** family 的编组比例相对标题组，自由比例相对版式；切换模式时换算，保持画面尺寸不跳。board 一律存绝对比例。 */
      if (currentLaid) {
        const effectiveScale = currentLaid.placement.scale;
        if (mode === "board") entry.scale = effectiveScale;
        else if (placementMode === "free") entry.scale = sceneFamilyPatch(current, board, el.id, { scale: effectiveScale }).scale ?? effectiveScale;
        else entry.scale = effectiveScale / resolveSceneGroup(current, board).scale;
      }
      if (placementMode === "free" && currentLaid) {
        entry.x = currentLaid.placement.x;
        entry.y = currentLaid.placement.y;
        entry.align = currentLaid.placement.align;
      } else {
        delete entry.x;
        delete entry.y;
      }
      if (placementMode === "above-title" || placementMode === "below-title") {
        entry.attach = { v: placementMode === "above-title" ? "above" : "below", dy: Math.max(8, sceneGroupBaseGap(board)) / unit, dx: 0 };
      } else if (placementMode === "title-backdrop") {
        entry.attach = { v: "beside", dy: 0, dx: 0 };
      }
      entry.customMode = placementMode;
      entry.backdropTarget = target;
      if (mode === "board" && placementMode === "free") entry.detached = true;
      else delete entry.detached;
      edits[el.id] = roundSceneModulePatch(entry);
      const module = { ...el.module!, placementMode, backdropTarget: target };
      return {
        ...current,
        elements: version || mode === "board" ? current.elements : current.elements.map((item) => item.id === el.id ? { ...item, module } : item),
        versions: version && mode !== "board"
          ? (current.versions ?? []).map((item) => item.id === version.id ? { ...item, modules: { ...item.modules, [el.id]: module } } : item)
          : current.versions,
        ...(mode === "board"
          ? { boardOverrides: { ...current.boardOverrides, [board.key]: edits } }
          : { familyEdits: { ...current.familyEdits, [family]: edits } }),
      };
    });
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
      const next = applySceneCopyVariant(current, variant.key, variantSpec(variant.kind, preset), family);
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
  const setBadgeStyle = (id: string, style: SceneBadgeStyle) => updateScene((current) => {
    const badge = current.elements.find((el) => el.id === id && el.role === "badge");
    const earnings = style === "earnings";
    const elements = badge
      ? current.elements.map((el) => el.id === badge.id && earnings ? { ...el, visible: true } : el)
      : earnings ? [...current.elements, { ...sceneDefaultElement("badge", 0), texts: { en: "", sc: "", tc: "" } }] : current.elements;
    return { ...current, elements, badgeStyles: { ...current.badgeStyles, [id]: style } };
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
    languageFonts: {
      ...current.languageFonts,
      [lang]: { ...current.languageFonts?.[lang], [id]: fontId },
    },
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

  /** 恢复 CTA 规范锁定：字号、对齐与位置回到规范，选好的预设长度保留。 */
  const relockCta = (id: string) => updateScene((current) => {
    const strip = (scope: SceneState["familyEdits"], key: string) => {
      const entry = scope[key]?.[id];
      if (!entry) return scope;
      const { font: _font, x: _x, y: _y, align: _align, follow: _follow, shift: _shift, shiftX: _shiftX, scale: _scale, ...rest } = entry;
      return { ...scope, [key]: { ...scope[key], [id]: rest } };
    };
    return {
      ...current,
      ctaFontUnlocked: false,
      familyEdits: strip(current.familyEdits, family),
      boardOverrides: strip(current.boardOverrides, board.key),
    };
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
    if (frozen(scene, id)) return;
    const box = id === SCENE_GROUP_ID ? output.group?.box : laid.find((item) => item.el.id === id)?.box;
    /** 族里选的标题组对齐优先于规范。 */
    const overSpec = id === SCENE_GROUP_ID && mode === "family" ? { overSpec: true } : {};
    /** 编入组的图层跟着标题组换对齐，贴齐同一侧。 */
    const withRiders = (current: SceneState): SceneState => {
      if (id !== SCENE_GROUP_ID || mode !== "family") return current;
      const edits = { ...current.familyEdits[family] };
      for (const riderId of sceneAttachedIds(current, family)) {
        const attach = edits[riderId]?.attach;
        const rider = current.elements.find((item) => item.id === riderId);
        const titleBackdrop = rider?.role === "module"
          && (edits[riderId]?.customMode ?? rider.module?.placementMode) === "title-backdrop";
        if (attach && (attach.v !== "beside" || titleBackdrop)) edits[riderId] = { ...edits[riderId], align, attach: { ...attach, dx: 0 } };
      }
      return { ...current, familyEdits: { ...current.familyEdits, [family]: edits } };
    };
    const x = box ? (align === "left" ? box.x : align === "center" ? box.x + box.w / 2 : box.x + box.w) / board.w : undefined;
    updateScene((current) => writePlacement(withRiders(current), id, { align, ...(x === undefined ? {} : { x }), ...overSpec }));
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
  /** 规范 CTA 没解除锁定时位置也锁住，解除锁定后才能挪。 */
  const ctaPinned = (el: SceneElement) => el.role === "cta" && Boolean(board.ctaSpec) && Boolean(metricsOf(el).locked) && !scene.ctaFontUnlocked;
  const pinnedIds = new Set(scene.elements.filter(ctaPinned).map((el) => el.id));
  const firstMemberIndex = scene.elements.findIndex((el) => isSceneGroupRole(el.role));
  const hasLayerContent = (el: SceneElement) => (el.role === "module" && Boolean(el.module)) || Boolean(sceneText(el, lang).trim()) || (el.role === "badge" && sceneBadgeStyle(scene, el.id).id === "earnings");
  const attachedIds = scene.elements
    .filter((el) => SCENE_ATTACH_ROLES.includes(el.role) && Boolean(resolveScenePlacement(scene, board, el).attach))
    .map((el) => el.id);
  const attachedEls = scene.elements.filter((el) => attachedIds.includes(el.id) && (el.role === "logo" || hasLayerContent(el)));
  /** 元素的放置模式就是它与标题组的关系，不提供第二套取消编组入口。 */
  const detachableEls = attachedEls.filter((el) => el.role !== "module");
  const listed = scene.elements.filter((el) => !isSceneGroupRole(el.role) && !attachedEls.includes(el) && (!MODULE_ROLES.has(el.role) || el.role === "logo" || hasLayerContent(el) || elementVisible(el)));
  /** 图层栏里标题组的子层按层序排，并排编入的图层排在最后。 */
  const groupOrder = sceneGroupOrder(scene, family, board.key);
  const orderRank = (el: SceneElement) => groupOrder.includes(el.id) ? groupOrder.indexOf(el.id) : groupOrder.length;
  const groupChildren = [
    ...SCENE_GROUP_ROLES.flatMap((role) => scene.elements.filter((el) => el.role === role && hasLayerContent(el))),
    ...attachedEls,
  ].sort((a, b) => orderRank(a) - orderRank(b));
  const layerMembers = groupChildren.filter((el) => isSceneGroupRole(el.role));
  const stackIds = output.group?.stackIds ?? [];
  const canReorder = mode === "family" && !layoutLocked && Boolean(output.group);
  /** 在可见层序里上移/下移一层。 */
  const moveInGroup = (id: string, step: -1 | 1) => {
    const index = stackIds.indexOf(id);
    const neighbor = stackIds[index + step];
    if (!canReorder || index < 0 || !neighbor) return;
    updateScene((current) => sceneMoveInGroup(current, family, id, neighbor, step < 0 ? "before" : "after"));
  };
  const [rowDrag, setRowDrag] = useState<{ id: string; over?: string; place?: "before" | "after" } | null>(null);
  /** 图层栏顶层：标题组整体算一层，从上到下 = 画面从前到后。 */
  const unitOf = (el: SceneElement) => isSceneGroupRole(el.role) ? SCENE_GROUP_ID : el.id;
  const topUnits = scene.elements.flatMap((el, index) => isSceneGroupRole(el.role)
    ? index === firstMemberIndex ? [SCENE_GROUP_ID] : []
    : listed.includes(el) ? [el.id] : []).reverse();
  const canStack = mode === "family";
  /** 拖到顶层图层上调整前后：放在目标上方 = 在它前面。 */
  const moveLayer = (targetId: string, place: "before" | "after") => {
    const id = rowDrag?.id;
    setRowDrag(null);
    if (!id || id === targetId || !canStack || !topUnits.includes(id)) return;
    updateScene((current) => {
      const moving = current.elements.filter((el) => unitOf(el) === id);
      const rest = current.elements.filter((el) => unitOf(el) !== id);
      const first = rest.findIndex((el) => unitOf(el) === targetId);
      if (!moving.length || first < 0) return current;
      const last = rest.reduce((at, el, index) => unitOf(el) === targetId ? index : at, first);
      const at = place === "before" ? last + 1 : first;
      return { ...current, elements: [...rest.slice(0, at), ...moving, ...rest.slice(at)] };
    });
  };
  const topDropProps = (id: string) => rowDrag && topUnits.includes(rowDrag.id) ? {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const place = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
      if (rowDrag.over !== id || rowDrag.place !== place) setRowDrag({ ...rowDrag, over: id, place });
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      moveLayer(id, rowDrag.place ?? "after");
    },
  } : {};
  const dropMarkOf = (id: string) => rowDrag?.over === id && rowDrag.id !== id ? rowDrag.place : undefined;
  const [groupOpen, setGroupOpen] = useState(true);
  /** 拖到标题组子层上：组内的层调整顺序，组外可编组的图层编进组里放到该位置。 */
  const dropOnRow = (targetId: string, place: "before" | "after") => {
    const id = rowDrag?.id;
    setRowDrag(null);
    if (!id || id === targetId || !canReorder) return;
    const el = scene.elements.find((item) => item.id === id);
    if (!el) return;
    const inGroup = isSceneGroupRole(el.role) || attachedIds.includes(id);
    if (!inGroup && !(SCENE_ATTACH_ROLES.includes(el.role) && elementVisible(el))) return;
    updateScene((current) => {
      const next = inGroup ? current : sceneAttachToGroup(current, family, board, lang, [id]);
      return sceneMoveInGroup(next, family, id, targetId, place);
    });
  };
  const groupFlagged = members.some((el) => issueIds.has(el.id));

  /** 编组：选中标题组（或其中一层）加上 Logo、角标、免责、自定义文字或自定义元素。 */
  const selection = [selectedId, ...multiIds].filter((id): id is string => Boolean(id));
  const selectionHasGroup = selection.some((id) => id === SCENE_GROUP_ID || scene.elements.some((el) => el.id === id && isSceneGroupRole(el.role)));
  const groupable = selection.flatMap((id) => {
    const el = scene.elements.find((item) => item.id === id);
    return el && el.role !== "module" && SCENE_ATTACH_ROLES.includes(el.role) && !attachedIds.includes(el.id) && elementVisible(el) ? [el] : [];
  });
  const canGroup = mode === "family" && !layoutLocked && selectionHasGroup && groupable.length > 0 && Boolean(output.group);
  const ungroupIds = mode !== "family" || layoutLocked ? [] : selection.includes(SCENE_GROUP_ID) ? detachableEls.map((el) => el.id) : selection.filter((id) => detachableEls.some((el) => el.id === id));
  const groupLayers = () => {
    if (!canGroup) return;
    const ids = groupable.map((el) => el.id);
    updateScene((current) => sceneAttachToGroup(current, family, board, lang, ids));
    selectLayer(SCENE_GROUP_ID);
  };
  /** 多选的对象临时当成一组对齐：标题组（含编入的层）算一个整体，不建组，取消选择就恢复各自独立。 */
  const alignTargets = new Map<string, SceneBox>();
  for (const id of selection) {
    const el = scene.elements.find((item) => item.id === id);
    const toGroup = Boolean(output.group) && (id === SCENE_GROUP_ID || Boolean(el && (isSceneGroupRole(el.role) || resolveScenePlacement(scene, board, el).attach)));
    const box = toGroup ? output.group?.frame : output.layers.find((layer) => layer.id === id)?.box;
    if (box) alignTargets.set(toGroup ? SCENE_GROUP_ID : id, box);
  }
  const alignSelection = (edge: AlignEdge) => {
    const boxes = [...alignTargets.values()];
    if (layoutLocked || boxes.length < 2) return;
    const left = Math.min(...boxes.map((box) => box.x));
    const right = Math.max(...boxes.map((box) => box.x + box.w));
    const top = Math.min(...boxes.map((box) => box.y));
    const bottom = Math.max(...boxes.map((box) => box.y + box.h));
    const horizontal = edge === "left" || edge === "center" || edge === "right";
    updateScene((current) => {
      let next = current;
      for (const [id, box] of alignTargets) {
        const delta = edge === "left" ? left - box.x
          : edge === "center" ? (left + right) / 2 - (box.x + box.w / 2)
            : edge === "right" ? right - (box.x + box.w)
              : edge === "top" ? top - box.y
                : edge === "middle" ? (top + bottom) / 2 - (box.y + box.h / 2)
                  : bottom - (box.y + box.h);
        if (Math.abs(delta) < 0.5 || pinnedIds.has(id)) continue;
        if (id === SCENE_GROUP_ID) {
          const at = resolveSceneGroup(next, board);
          next = writePlacement(next, id, horizontal ? { x: at.x + delta / board.w } : { y: at.y + delta / board.h });
          continue;
        }
        const el = next.elements.find((item) => item.id === id);
        if (!el) continue;
        const placement = resolveScenePlacement(next, board, el);
        const laidItem = laid.find((item) => item.el.id === id);
        /** 跟随标题组对齐的元素改成自由放置再挪。 */
        if (horizontal && output.group && placement.follow && placement.follow !== "none" && laidItem) {
          next = writePlacement(next, id, { follow: "none", x: laidItem.placement.x + delta / board.w, align: laidItem.placement.align });
        } else {
          next = writePlacement(next, id, horizontal ? { x: placement.x + delta / board.w } : { y: placement.y + delta / board.h });
        }
      }
      return next;
    });
  };
  const ungroupLayers = (ids = ungroupIds) => {
    const detachable = ids.filter((id) => scene.elements.find((el) => el.id === id)?.role !== "module");
    if (!detachable.length) return;
    updateScene((current) => sceneDetachFromGroup(current, family, board, lang, detachable));
  };
  const groupKeys = useRef({ group: groupLayers, ungroup: () => ungroupLayers(), move: (_step: -1 | 1): boolean => false });
  groupKeys.current = {
    group: groupLayers,
    ungroup: () => ungroupLayers(),
    move: (step: -1 | 1) => {
      if (!selectedId || multiIds.length || !canReorder || !stackIds.includes(selectedId)) return false;
      moveInGroup(selectedId, step);
      return true;
    },
  };

  const layerRow = (el: SceneElement, indent = false) => {
    const visible = elementVisible(el);
    const label = sceneModuleName(scene, el);
    const canToggle = el.role !== "visual" && el.role !== "title";
    const orderable = (canReorder && (indent || (SCENE_ATTACH_ROLES.includes(el.role) && visible))) || (!indent && canStack);
    const dropMark = indent ? rowDrag?.over === el.id && rowDrag.id !== el.id ? rowDrag.place : undefined : dropMarkOf(el.id);
    return (
      <div
        key={el.id}
        draggable={orderable}
        onDragStart={orderable ? (event) => {
          event.dataTransfer.effectAllowed = "move";
          setRowDrag({ id: el.id });
        } : undefined}
        onDragEnd={() => setRowDrag(null)}
        onDragOver={indent && rowDrag ? (event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const place = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
          if (rowDrag.over !== el.id || rowDrag.place !== place) setRowDrag({ ...rowDrag, over: el.id, place });
        } : indent ? undefined : topDropProps(el.id).onDragOver}
        onDrop={indent && rowDrag ? (event) => {
          event.preventDefault();
          dropOnRow(el.id, rowDrag.place ?? "after");
        } : indent ? undefined : topDropProps(el.id).onDrop}
        onClick={(event) => selectLayer(el.id, event.shiftKey || event.ctrlKey || event.metaKey)}
        className={cn(
          "group relative flex h-8 cursor-pointer items-center gap-2 rounded-[4px] px-2 text-[10px]",
          indent && "pl-7",
          selectedId === el.id || multiSet.has(el.id) ? "bg-[var(--app-surface-3)] text-[var(--app-text)]" : "text-[var(--app-text-2)] hover:bg-[var(--app-surface-2)]",
          !visible && el.role !== "logo" && "opacity-50",
        )}
      >
        {dropMark ? <span className={cn("pointer-events-none absolute inset-x-2 h-px bg-[var(--app-text-3)]", dropMark === "before" ? "top-0" : "bottom-0")} /> : null}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {!version && sceneFamilyCopyEdited(rawScene, family, el.id) ? <span title={`文案仅${groupName}使用`} className="size-1.5 shrink-0 rounded-full bg-[var(--app-text-4)]" /> : null}
        {issueIds.has(el.id) ? <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-warn)]" /> : null}
        {canToggle ? (
          <button
            type="button"
            aria-label={visible ? `隐藏${label}` : `显示${label}`}
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
            aria-label={`删除${label}`}
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
        draggable={canStack}
        onDragStart={canStack ? (event) => {
          event.dataTransfer.effectAllowed = "move";
          setRowDrag({ id: SCENE_GROUP_ID });
        } : undefined}
        onDragEnd={() => setRowDrag(null)}
        {...topDropProps(SCENE_GROUP_ID)}
        onClick={(event) => selectLayer(SCENE_GROUP_ID, event.shiftKey || event.ctrlKey || event.metaKey)}
        className={cn(
          "relative flex h-8 cursor-pointer items-center gap-1 rounded-[4px] pl-0.5 pr-2 text-[10px]",
          groupSelected || multiSet.has(SCENE_GROUP_ID) ? "bg-[var(--app-surface-3)] text-[var(--app-text)]" : "text-[var(--app-text-2)] hover:bg-[var(--app-surface-2)]",
        )}
      >
        {dropMarkOf(SCENE_GROUP_ID) ? <span className={cn("pointer-events-none absolute inset-x-2 h-px bg-[var(--app-text-3)]", dropMarkOf(SCENE_GROUP_ID) === "before" ? "top-0" : "bottom-0")} /> : null}
        <button
          type="button"
          aria-expanded={groupOpen}
          aria-label={groupOpen ? "收起标题组图层" : "展开标题组图层"}
          onClick={(event) => {
            event.stopPropagation();
            setGroupOpen(!groupOpen);
          }}
          className="grid size-5 shrink-0 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:text-[var(--app-text)]"
        >
          <ChevronDown size={11} className={cn("transition-transform", !groupOpen && "-rotate-90")} />
        </button>
        <span className="min-w-0 flex-1 truncate">标题组</span>
        {groupFlagged ? <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-warn)]" /> : null}
        {mode === "family" && detachableEls.length ? (
          <button
            type="button"
            aria-label="取消编组"
            title={`取消编组：${detachableEls.map((el) => el.name).join("、")}移出标题组（Ctrl+Shift+G）`}
            onClick={(event) => {
              event.stopPropagation();
              ungroupLayers(detachableEls.map((el) => el.id));
            }}
            className="grid size-5 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:text-[var(--app-text)]"
          >
            <Ungroup size={12} />
          </button>
        ) : null}
      </div>
      {groupOpen ? groupChildren.map((el) => layerRow(el, true)) : null}
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

  /** 行高与 Figma 一致按字号百分比设置，换画幅时跟字号等比。 */
  const leadingField = (el: SceneElement) => (
    <ScrubField
      label="行高"
      ariaLabel={`${el.name}行高`}
      value={Math.round(sceneLeading(scene, el) * 100)}
      min={50}
      max={400}
      suffix="%"
      onCommit={(value) => updateScene((current) => {
        const leading = { ...current.leading };
        const next = Math.round(value) / 100;
        if (next !== SCENE_LINE_HEIGHT) leading[el.id] = next;
        else delete leading[el.id];
        return { ...current, leading };
      })}
    />
  );

  /** 换行后第 2 行起逐行调字号、字间距、行高；没单独设的行跟整体。 */
  const lineFields = (el: SceneElement) => {
    const count = sceneText(el, lang).split("\n").length;
    if (count < 2) return null;
    const metrics = metricsOf(el);
    const styles = sceneLineStyles(scene, el, count, family);
    const setRatio = (index: number, value: number) => !layoutLocked && updateScene((current) => {
      const next = sceneLineRatios(current, el, count, family);
      next[index] = value;
      return { ...current, familyLineRatios: { ...current.familyLineRatios, [family]: { ...current.familyLineRatios?.[family], [el.id]: next } } };
    });
    const setLine = (key: "lineLeading" | "lineTracking", index: number, value: number | undefined) => updateScene((current) => {
      const own = { ...current[key]?.[el.id] };
      if (value === undefined) delete own[index];
      else own[index] = value;
      const map = { ...current[key] };
      if (Object.keys(own).length) map[el.id] = own;
      else delete map[el.id];
      return { ...current, [key]: map };
    });
    return (
      <div className="mt-3 space-y-2">
        {styles.slice(1).map((style, offset) => {
          const index = offset + 1;
          const linePx = metrics.fontPx * style.ratio;
          const label = `第 ${index + 1} 行`;
          return (
            <div key={index}>
              <div className="mb-1 text-[9px] text-[var(--app-text-4)]">{label}</div>
              <div className="grid grid-cols-3 gap-2">
                {layoutBlock(
                  <ScrubField
                    label="字号"
                    ariaLabel={`${el.name}${label}字号`}
                    value={oneDecimal(linePx)}
                    min={Math.max(1, oneDecimal(metrics.fontPx * 0.4))}
                    max={oneDecimal(metrics.fontPx * 1.6)}
                    suffix="px"
                    onCommit={(value) => metrics.fontPx > 0 && setRatio(index, Math.round(Math.max(0.4, Math.min(1.6, value / metrics.fontPx)) * 10000) / 10000)}
                  />,
                )}
                <ScrubField
                  label="字间距"
                  ariaLabel={`${el.name}${label}字间距`}
                  value={Math.round(style.tracking * 1000) / 10}
                  decimals={1}
                  min={-20}
                  max={100}
                  step={0.5}
                  suffix="%"
                  onCommit={(value) => setLine("lineTracking", index, Math.round(value * 10) / 1000)}
                />
                <ScrubField
                  label="行高"
                  ariaLabel={`${el.name}${label}行高`}
                  value={Math.round(style.leading * 100)}
                  min={50}
                  max={400}
                  suffix="%"
                  onCommit={(value) => setLine("lineLeading", index, Math.round(value) / 100)}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const sizeFields = (el: SceneElement, scale: number, onScale: (value: number) => void, lead?: ReactNode) => {
    const metrics = metricsOf(el);
    return (
      <div className="grid grid-cols-2 gap-2">
        {lead}
        <ScrubField label="比例" ariaLabel="比例" value={scale} decimals={2} min={0.3} max={3} step={0.01} suffix="×" onCommit={onScale} />
        {metrics.fontPx > 0 ? (
          <ScrubField
            label="字号"
            ariaLabel="字号"
            value={oneDecimal(metrics.fontPx)}
            min={8}
            max={400}
            suffix="px"
            onCommit={(value) => onScale(scale * (oneDecimal(value) / metrics.fontPx))}
          />
        ) : null}
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

  /** 文案只在当前版式族改过时：可同步给全部版式族，或恢复通用文案。 */
  const familyCopyNote = (el: SceneElement) => !version && sceneFamilyCopyEdited(rawScene, family, el.id) ? (
    <div className="mt-1.5 flex items-center gap-2 text-[9px] text-[var(--app-text-4)]">
      <span className="min-w-0 flex-1 truncate">文案仅{groupName}使用</span>
      <button type="button" onClick={() => updateRawScene((current) => sceneSyncCopyToAll(current, family, el.id))} className="shrink-0 text-[var(--app-text-3)] hover:text-[var(--app-text)]">
        同步到全部分组
      </button>
      <button type="button" onClick={() => updateRawScene((current) => sceneResetFamilyCopy(current, family, el.id))} className="shrink-0 text-[var(--app-text-3)] hover:text-[var(--app-text)]">
        恢复通用文案
      </button>
    </div>
  ) : null;
  const syncTitleCopyToAll = () => {
    if (languageLocked) return;
    titleSyncAwaitingRef.current = true;
    updateRawScene((current) => {
      if (version?.independent) {
        const texts = Object.fromEntries(scene.elements.map((item) => [item.id, sceneText(item, lang)]));
        const highlights = Object.fromEntries(scene.elements.map((item) => [item.id, structuredClone(scene.highlights[item.id]?.[lang] ?? [])]));
        const fontRuns = Object.fromEntries(scene.elements.map((item) => [item.id, structuredClone(scene.fontRuns?.[item.id]?.[lang] ?? [])]));
        const visibility = Object.fromEntries(scene.elements.map((item) => [item.id, item.visible]));
        return {
          ...current,
          versions: (current.versions ?? []).map((item) => item.id === version.id ? { ...item, texts, highlights, fontRuns, visibility } : item),
        };
      }
      const next = sceneSyncLanguageContentToAll(current, scene, lang);
      return {
        ...next,
        savedFamiliesByLanguage: { ...next.savedFamiliesByLanguage, [lang]: [] },
      };
    });
    setTitleSyncDone(true);
  };
  const undoTitleCopyToAll = () => {
    undoScene();
    setTitleSyncDone(false);
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
    const id = el?.id ?? role;
    const label = SCENE_ROLE_LABEL[role];
    const value = el ? sceneText(el, lang) : "";
    const badgeStyle = role === "badge" ? sceneBadgeStyle(scene, el?.id).id : null;
    const earnings = Boolean(el) && badgeStyle === "earnings";
    const hasCopy = Boolean(value.trim()) || earnings;
    const multiline = isSceneGroupRole(role);
    const required = role === "title";
    const onChange = (text: string) => !el || (!el.visible && !value.trim()) ? fillSlot(role, text) : setText(el, text);
    const hidden = Boolean(el) && hasCopy && !shown;
    const common = { "aria-label": `${label}文案`, value, placeholder: required ? "必填" : "选填", ...(el ? rangeHandlers(el) : {}) };
    return (
      <Section key={role} id={id} title={label} muted={!hasCopy || hidden} open={isOpen(id)} onToggle={() => togglePanel(id)}>
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
        {el && !isSceneGroupRole(el.role) ? familyCopyNote(el) : null}
        {role === "badge" && mode === "family" ? (
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {SCENE_BADGE_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                aria-pressed={badgeStyle === style.id}
                title={style.name}
                onClick={() => setBadgeStyle(id, style.id)}
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

  /** 标题组里的层：上移/下移一层，选中后也可按 ↑ ↓。 */
  const orderButtons = (el: SceneElement) => {
    const index = stackIds.indexOf(el.id);
    if (!canReorder || index < 0 || stackIds.length < 2) return null;
    return (
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" aria-label={`${el.name}上移一层`} title="上移一层（↑）" disabled={index === 0} onClick={() => moveInGroup(el.id, -1)} className={cn(ICON, "disabled:opacity-30")}>
          <ChevronUp size={12} />
        </button>
        <button type="button" aria-label={`${el.name}下移一层`} title="下移一层（↓）" disabled={index === stackIds.length - 1} onClick={() => moveInGroup(el.id, 1)} className={cn(ICON, "disabled:opacity-30")}>
          <ChevronDown size={12} />
        </button>
      </div>
    );
  };
  const placementFields = (el: SceneElement, withSize = true) => {
    const placement = resolveScenePlacement(scene, board, el);
    const laidItem = laidOf(el);
    const metrics = metricsOf(el);
    const badgeStyle = el.role === "badge" ? sceneBadgeStyle(scene, el.id) : null;
    const following = Boolean(output.group) && placement.follow !== undefined && placement.follow !== "none";
    const ctaLocked = el.role === "cta" && Boolean(metrics.locked);
    const widthEditable = (el.role === "cta" && !ctaLocked) || badgeStyle?.id === "style1";
    const shownX = laidItem ? laidItem.placement.x : placement.x;
    const inGroup = Boolean(placement.attach);
    const attach = placement.attach;
    const unit = sceneGroupUnit(scene, board);
    /** 自定义元素的比例对用户始终以 Figma 原始节点为 1×；内部仍保存版式相对比例。 */
    const moduleScale = el.role === "module" && el.module
      ? metrics.h / Math.max(1, el.module.height)
      : placement.scale;
    const commitModuleScale = (value: number) => {
      const factor = value / Math.max(0.01, moduleScale);
      patchPlacement(el.id, {
        scale: placement.scale * factor,
        ...(placement.w !== undefined ? { w: sceneWidthToUnit(board, metrics.w * factor) } : {}),
      });
    };
    const wrap = el.role === "visual" ? (node: ReactNode) => node : layoutBlock;
    /** 没有字号的层（Logo 等）间距和比例放一排。 */
    const sizeHere = withSize && !ctaLocked && !(metrics.fontPx > 0);
    const attachGap = attach && attach.v !== "beside" ? (
      <ScrubField
        label={attach.v === "above" ? "与下一层间距" : "与上一层间距"}
        ariaLabel={`${el.name}${attach.v === "above" ? "与下一层间距" : "与上一层间距"}`}
        value={Math.round(attach.dy * unit)}
        min={0}
        max={Math.round(board.h / 2)}
        suffix="px"
        onCommit={(value) => patchPlacement(el.id, { attach: { ...attach, dy: Math.max(0, value) / sceneGroupUnit(scene, board) } })}
      />
    ) : null;
    return wrap(
      <>
        {inGroup ? el.role === "module" || mode !== "family" ? null : (
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-[9px] text-[var(--app-text-4)]">已编入标题组</span>
            <button type="button" title="取消编组（Ctrl+Shift+G）" onClick={() => ungroupLayers([el.id])} className="shrink-0 text-[9px] text-[var(--app-text-3)] hover:text-[var(--app-text)]">
              取消编组
            </button>
            {orderButtons(el)}
          </div>
        ) : el.role !== "visual" && el.role !== "module" && output.group ? (
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
        {attachGap && el.role !== "module" && !sizeHere ? <div className="mb-2 grid grid-cols-2 gap-2">{attachGap}</div> : inGroup || el.role === "visual" ? null : (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <ScrubField label="X" ariaLabel="X 坐标" disabled={following} value={Math.round(shownX * board.w)} min={-board.w} max={board.w * 2} suffix="px" onCommit={(value) => patchPlacement(el.id, { x: value / board.w })} />
            <ScrubField label="Y" ariaLabel="Y 坐标" value={Math.round(placement.y * board.h)} min={-board.h} max={board.h * 2} suffix="px" onCommit={(value) => patchPlacement(el.id, { y: value / board.h })} />
          </div>
        )}
        {!withSize ? null : ctaLocked ? (
          <div className="rounded-[4px] bg-[var(--app-surface-2)] px-2 py-1.5 text-[9px] leading-relaxed text-[var(--app-text-3)]">
            站内规范锁定：高 {Math.round(board.ctaSpec!.height)}px · 字号 {board.ctaSpec!.fontPx}px · 左右内边距 {board.ctaSpec!.paddingX}px · 宽 {board.ctaSpec!.minWidth}–{board.ctaSpec!.maxWidth}px（当前 {Math.round(metrics.w)}px）
          </div>
        ) : el.role === "module" && el.module?.stretchable ? (
          <div className="grid grid-cols-2 gap-2">
            {attachGap}
            <ScrubField
              label="比例"
              ariaLabel="比例"
              value={moduleScale}
              decimals={2}
              min={0.01}
              max={Math.max(20, Math.ceil(moduleScale))}
              step={0.01}
              suffix="×"
              onCommit={commitModuleScale}
            />
            <ScrubField
              label="宽度"
              ariaLabel="宽度"
              value={Math.round(metrics.w)}
              min={8}
              max={board.w}
              suffix="px"
              onCommit={(value) => patchPlacement(el.id, { w: sceneWidthToUnit(board, value) })}
            />
          </div>
        ) : el.role === "module" ? (
          <div className="grid grid-cols-2 gap-2">
            {attachGap}
            <ScrubField
              label="比例"
              ariaLabel="比例"
              value={moduleScale}
              decimals={2}
              min={0.01}
              max={Math.max(20, Math.ceil(moduleScale))}
              step={0.01}
              suffix="×"
              onCommit={commitModuleScale}
            />
          </div>
        ) : sizeFields(el, placement.scale, (value) => patchPlacement(el.id, { scale: value }), sizeHere ? attachGap : null)}
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
              aria-pressed={placement.w === undefined}
              onClick={() => placement.w === undefined
                ? patchPlacement(el.id, { w: sceneWidthToUnit(board, metrics.w) })
                : clearPlacementKey(el.id, "w")}
              className={cn(
                GHOST,
                "flex h-8 items-center justify-center gap-1",
                placement.w === undefined && "bg-[var(--app-surface-3)] text-[var(--app-text)]",
              )}
            >
              {placement.w === undefined ? <Check size={10} /> : null}
              随文案自适应
            </button>
          </div>
        ) : null}
        {el.role !== "visual" && el.role !== "module" && !following && !(attach && attach.v !== "beside") ? (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[9px] text-[var(--app-text-4)]">对齐锚点</span>
            <Segmented<SceneAlign> size="sm" value={placement.align} onChange={(align) => changeAlign(el.id, align)} options={ALIGN_OPTIONS} />
          </div>
        ) : null}
      </>,
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
      >
        <div className={cn(!shown && "opacity-50")}>{copyField(el, el.role !== "cta")}</div>
        {familyCopyNote(el)}
        {el.role === "badge" && mode === "family" ? (
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {SCENE_BADGE_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                aria-pressed={sceneBadgeStyle(scene, el.id).id === style.id}
                title={style.name}
                onClick={() => setBadgeStyle(el.id, style.id)}
                className={cn(
                  "flex h-9 flex-col items-center justify-center gap-0.5 rounded-[4px] border bg-[#121212] px-1",
                  sceneBadgeStyle(scene, el.id).id === style.id ? "border-[var(--color-brand)]" : "border-[var(--app-line)] hover:border-[var(--app-line-strong)]",
                )}
              >
                <img src={BADGE_THUMBS[style.id]} alt="" className="h-3 max-w-full" />
                <span className="w-full truncate text-center text-[8px] text-white/60">{style.name}</span>
              </button>
            ))}
          </div>
        ) : null}
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
          "group relative size-7 rounded-[4px] border outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/50 disabled:cursor-not-allowed",
          rangePreset === id ? "border-white/60 ring-1 ring-white/20" : "border-white/15 hover:border-white/40",
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
    /** 自定义色：点开下方编辑器；已框选文字时同时套用。 */
    const customTile = (kind: "solid" | "gradient", id: string, name: string) => (
      <button
        type="button"
        aria-label={name}
        title={name}
        aria-pressed={rangePreset === id}
        aria-expanded={customOpen === kind}
        onClick={() => {
          if (elRange && rangePreset !== id) {
            applyHighlight(id);
            setCustomOpen(kind);
          } else setCustomOpen(customOpen === kind ? null : kind);
        }}
        className={cn(
          "grid size-7 place-items-center rounded-[4px] border border-dashed text-[var(--app-text-3)] outline-none hover:text-[var(--app-text)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/50",
          rangePreset === id
            ? "border-solid border-white/40 bg-[var(--app-surface-3)] text-[var(--app-text)]"
            : customOpen === kind ? "border-white/50 bg-[var(--app-surface-2)]" : "border-white/20 hover:border-white/40",
        )}
      >
        <Plus size={12} />
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
            {customTile("solid", "custom-solid", "自定义纯色")}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-6 shrink-0 text-[9px] text-[var(--app-text-4)]">渐变</span>
            {gradients.map((preset, index) => swatch(preset.id, preset.name, highlightDetail(preset.paints), preset.paints, index))}
            {customTile("gradient", "custom", "自定义渐变")}
          </div>
        </div>

        {customOpen ? (
          <div className="mt-2 rounded-[4px] border border-[var(--app-line)] p-2">
            {customOpen === "solid" ? (
              <BackgroundColorControl
                label="自定义高亮纯色"
                value={scene.customSolid ?? "#FFFFFF"}
                onChange={(value) => isSceneHex(value) && updateScene((current) => ({ ...current, customSolid: value }))}
              />
            ) : (
              <GradientEditor value={custom} onChange={(next) => updateScene((current) => ({ ...current, customGradient: next }))} />
            )}
          </div>
        ) : null}

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
                      current
                        ? "border-[var(--app-line-strong)] bg-[var(--app-surface-3)]"
                        : "border-transparent bg-[var(--app-surface-2)] hover:border-[var(--app-line-strong)]",
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
          <button type="button" aria-label={`添加${el.name}描边`} title="添加描边" onClick={() => setStroke(sceneDefaultStroke(fontPx))} className={SECTION_ADD}>
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
                  onKeyDown={(event) => arrowStep(event, Math.round(stroke.opacity * 100), (next) => patch({ opacity: next / 100 }), 0, 100)}
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
        <>
        {fontPicker(el)}
        <div className="mt-3">
          {sceneBadgeStyle(scene, el.id).widths ? (
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
        </div>
        </>
      );
    }
    const member = isSceneGroupRole(el.role);
    const own = resolveSceneOwn(scene, board, el);
    const gapLabel = el.role === "kicker" ? "与下一层间距" : el.role === "subtitle" ? "与上一层间距" : null;
    const baseGap = sceneGroupBaseGap(board) * group.scale;
    const gapPx = own.gap !== undefined ? baseGap * own.gap : baseGap * (group.gap ?? 1);
    return (
      <>
      {fontPicker(el)}
      <div className="mt-3">
        {member ? (
          <>
            {layoutBlock(sizeFields(el, own.scale, (value) => patchPlacement(el.id, { scale: value })))}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {trackingField(el)}
              {leadingField(el)}
              {gapLabel ? layoutBlock(
                <ScrubField
                  label={gapLabel}
                  ariaLabel={`${el.name}${gapLabel}`}
                  value={Math.round(gapPx)}
                  min={0}
                  max={Math.round(board.h / 2)}
                  suffix="px"
                  onCommit={(value) => patchPlacement(el.id, { gap: value / baseGap })}
                />,
              ) : null}
            </div>
            {lineFields(el)}
          </>
        ) : (
          <>
            {placementFields(el)}
            <div className="mt-2 grid grid-cols-2 gap-2">
              {trackingField(el)}
              {leadingField(el)}
            </div>
            {lineFields(el)}
          </>
        )}
      </div>
      </>
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
      <div>
        {fontPicker(el)}
        <div className="mt-3 grid grid-cols-2 gap-1.5">
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

        {spec && (locked || spec.soft) && !(layoutLocked && !spec.soft) ? (
          <div className="mt-3 flex h-7 items-center gap-1.5 rounded-[4px] bg-[var(--app-surface-2)] px-2 text-[9px]">
            {fontLocked ? <Lock size={10} className="shrink-0 text-[var(--app-text-3)]" /> : <LockOpen size={10} className="shrink-0 text-[var(--app-text-3)]" />}
            <span className="min-w-0 flex-1 truncate text-[var(--app-text-3)]" title={`规范 高 ${spec.height}px · 字号 ${spec.fontPx}px`}>
              {fontLocked ? "按广告规范锁定" : "已解除规范锁定"}
            </span>
            <button
              type="button"
              aria-pressed={!fontLocked}
              onClick={() => (fontLocked ? updateScene((current) => ({ ...current, ctaFontUnlocked: true })) : relockCta(el.id))}
              className="shrink-0 text-[var(--app-text-2)] hover:text-[var(--app-text)]"
            >
              {fontLocked ? "解除锁定" : "恢复锁定"}
            </button>
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {layoutBlock(
            <ScrubField
              label="字号"
              ariaLabel="CTA 字号"
              disabled={fontLocked}
              value={oneDecimal(metrics.fontPx)}
              min={6}
              max={200}
              suffix="px"
              onCommit={(value) => metrics.fontPx > 0 && patchPlacement(el.id, { font: (placement.font ?? 1) * (oneDecimal(value) / metrics.fontPx) })}
            />,
          )}
          {trackingField(el)}
        </div>

        <div className="mt-3">
        {layoutBlock(locked && spec?.lengths ? (
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
          </>
        ) : locked && spec ? (
          fontLocked ? null : (
            <p className="flex items-center gap-1.5 text-[9px] text-[var(--app-text-4)]">
              <Lock size={10} className="shrink-0" />
              <span>尺寸按广告规范锁定</span>
            </p>
          )
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
        ))}
        </div>

        {pinnedIds.has(el.id) ? null : <div className="mt-3">{placementFields(el, false)}</div>}
      </div>
    );
  };

  const visualPanel = (el: SceneElement) => {
    const item = laidOf(el);
    const placement = resolveScenePlacement(scene, board, el);
    const baseScale = sceneDefaultScale(scene, board, "visual");
    const visualScale = placement.scale / baseScale;
    type VisualSize = "auto" | "small" | "medium" | "large" | "custom";
    const visualSizes: ReadonlyArray<{ id: Exclude<VisualSize, "custom">; label: string; scale: number }> = [
      { id: "auto", label: "自适应", scale: 1 },
      { id: "small", label: "小", scale: 0.75 },
      { id: "medium", label: "中", scale: 1.25 },
      { id: "large", label: "大", scale: 1.55 },
    ];
    const activeSize: VisualSize = visualSizes.find((option) => Math.abs(option.scale - visualScale) < 0.005)?.id ?? "custom";
    return (
      <Section id={el.id} title={el.name} open={isOpen(el.id)} onToggle={() => togglePanel(el.id)}>
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
        <div className="mt-3 grid grid-cols-2 items-end gap-2">
          <ScrubField
            label="比例"
            ariaLabel="主视觉比例"
            value={Math.round(visualScale * 100) / 100}
            decimals={2}
            min={0.3}
            max={3}
            step={0.01}
            suffix="×"
            onCommit={(value) => patchPlacement(el.id, { scale: baseScale * value })}
          />
          <Segmented<VisualSize>
            size="sm"
            className="justify-self-end"
            value={activeSize}
            onChange={(id) => {
              const option = visualSizes.find((item) => item.id === id);
              if (option) patchPlacement(el.id, { scale: baseScale * option.scale });
            }}
            options={visualSizes}
          />
        </div>
      </Section>
    );
  };

  const logoPanel = (el: SceneElement) => (
    <Section id={el.id} title={el.name} open={isOpen(el.id)} onToggle={() => togglePanel(el.id)}>
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

  const customModePreview = (mode: SceneCustomPlacementMode) => {
    const moduleClass = mode === "title-backdrop"
      ? "left-3 right-3 top-[25px] h-3"
      : mode === "above-title"
        ? "left-4 right-8 top-2 h-2.5"
        : mode === "below-title"
          ? "left-4 right-8 bottom-2 h-2.5"
          : "right-2 top-2 h-4 w-9";
    return (
      <div className="relative h-12 overflow-hidden rounded-[3px] bg-[#111317]">
        <span className="absolute left-4 top-[19px] z-10 h-1.5 w-12 rounded-full bg-white/80" />
        <span className="absolute left-4 top-[29px] z-10 h-1 w-8 rounded-full bg-white/45" />
        <span className={cn("absolute rounded-[2px] border border-[#f0c88b]/45 bg-gradient-to-r from-[#d9c1b2]/75 to-[#8d8d8d]/35", moduleClass)} />
      </div>
    );
  };

  const customModeCards = (value: SceneCustomPlacementMode, onChange: (mode: SceneCustomPlacementMode) => void) => (
    <div className="grid w-full max-w-[360px] grid-cols-2 gap-1.5">
      {CUSTOM_PLACEMENT_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "relative overflow-hidden rounded-[6px] p-1.5 text-left transition-colors",
            value === option.id ? "bg-[var(--app-surface-3)]" : "bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)]",
          )}
        >
          {customModePreview(option.id)}
          <span className="mt-1.5 flex items-center justify-between text-[9px] font-medium text-[var(--app-text)]">
            {option.label}{value === option.id ? <Check size={10} className="text-[var(--app-text-2)]" /> : null}
          </span>
          <span className="mt-0.5 block text-[9px] leading-[1.35] text-[var(--app-text-4)]">{option.detail}</span>
        </button>
      ))}
    </div>
  );

  const customElementsPanel = () => {
    const modules = scene.elements.filter((el) => el.role === "module" && el.module);
    const nextModuleName = `元素${sceneNextModuleNumber(scene)}`;
    return (
      <>
        {customImportOpen ? (
          <Section
            id="custom-elements"
            title={nextModuleName}
            open={customImportExpanded}
            onToggle={() => setCustomImportExpanded((open) => !open)}
            aside={<button type="button" aria-label="取消添加元素" title="取消添加" onClick={() => setCustomImportOpen(false)} className={ICON}><X size={11} /></button>}
          >
          <div>
            <p className="mb-2 whitespace-nowrap text-[9px] text-[var(--app-text-4)]">
              标题框、特殊标签、活动时间、二维码等平台未预设元素
            </p>
            <div className="flex gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Link2 size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--app-text-4)]" />
                <input
                  aria-label={`${nextModuleName} Figma 链接`}
                  value={customUrl}
                  onChange={(event) => {
                    customUrlRef.current = event.target.value;
                    setCustomUrl(event.target.value);
                    setCustomError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !customBusy) {
                      event.preventDefault();
                      void importCustomModule();
                    }
                  }}
                  placeholder="粘贴figma链接"
                  className={cn(INPUT, "pl-7")}
                />
              </div>
              <button type="button" aria-live="polite" disabled={customBusy || languageLocked || !customUrl.trim()} onClick={() => void importCustomModule()} className={cn(GHOST, "h-8 shrink-0 bg-[var(--app-surface-2)] px-3")}>
                {customBusy ? "识别中" : "识别"}
              </button>
            </div>
            {customError && !customRefreshId ? <p role="alert" className="mt-1.5 text-[9px] leading-relaxed text-[var(--warn-text)]">{customError}</p> : null}
          </div>
          </Section>
        ) : null}
        {modules.map((el) => {
          const moduleName = sceneModuleName(scene, el);
          const shown = elementVisible(el);
          const activeMode = (mode === "board" ? boardPatch[el.id]?.customMode : scene.familyEdits[family]?.[el.id]?.customMode)
            ?? el.module!.placementMode;
          const activeTarget = (mode === "board" ? boardPatch[el.id]?.backdropTarget : scene.familyEdits[family]?.[el.id]?.backdropTarget)
            ?? el.module!.backdropTarget
            ?? "title";
          const languageScopes = rawScene.languageVisibility?.[lang];
          const allApplied = languageScopes?.["*"]?.[el.id] === true;
          const sourceCleared = Boolean(el.module!.cleared);
          return (
            <Section
              key={el.id}
              id={el.id}
              title={moduleName}
              muted={!shown}
              open={isOpen(el.id)}
              onToggle={() => togglePanel(el.id)}
              aside={!version && !sourceCleared ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`${moduleName}${allApplied ? "已应用到全部版式" : "应用到全部版式"}`}
                    aria-pressed={allApplied}
                    disabled={allApplied || languageLocked}
                    onClick={() => setCustomElementScope(el.id, "all")}
                    className={cn(
                      "flex h-6 items-center gap-1 rounded-[4px] border px-2 text-[9px] transition-colors disabled:cursor-not-allowed",
                      allApplied
                        ? "border-[var(--color-down)] bg-[var(--app-surface-3)] text-[var(--color-down)]"
                        : "border-[var(--app-line-strong)] bg-[var(--app-surface-2)] text-[var(--app-text-2)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]",
                    )}
                  >
                    {allApplied ? <Check size={11} /> : <Copy size={10} />}
                    {allApplied ? "已应用" : "应用到全部版式"}
                  </button>
                  {allApplied ? (
                    <button
                      type="button"
                      aria-label={`撤销${moduleName}应用到全部版式`}
                      disabled={languageLocked}
                      onClick={() => undoCustomElementScope(el.id)}
                      className="flex h-6 items-center gap-1 rounded-[4px] px-1.5 text-[9px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Undo2 size={10} />撤销
                    </button>
                  ) : null}
                </div>
              ) : null}
            >
              <div className={cn(!shown && "opacity-50")}>
                <div className="mb-2 flex items-center gap-1.5">
                  <div className="relative min-w-0 flex-1">
                    <Link2 size={11} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--app-text-4)]" />
                    <input
                      aria-label={`${moduleName} Figma 链接`}
                      value={customModuleUrls[el.id] ?? el.module?.figmaUrl ?? ""}
                      placeholder="粘贴figma链接"
                      onChange={(event) => {
                        setCustomModuleUrls((current) => ({ ...current, [el.id]: event.target.value }));
                        setCustomError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !customBusy && (customModuleUrls[el.id] ?? el.module?.figmaUrl ?? "").trim()) {
                          event.preventDefault();
                          void refreshCustomModule(el, customModuleUrls[el.id] ?? el.module?.figmaUrl ?? "");
                        }
                      }}
                      className={cn(INPUT, "pl-7")}
                    />
                  </div>
                  {sourceCleared ? (
                    <button
                      type="button"
                      aria-label={`识别${moduleName} Figma 链接`}
                      disabled={customBusy || !(customModuleUrls[el.id] ?? "").trim()}
                      onClick={() => void refreshCustomModule(el, customModuleUrls[el.id] ?? "")}
                      className={cn(GHOST, "h-8 shrink-0 bg-[var(--app-surface-2)] px-3 hover:bg-[var(--app-surface-3)]")}
                    >
                      {customBusy && customRefreshId === el.id ? "识别中…" : "识别"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-label={`${moduleName}重新识别`}
                        title="重新识别"
                        disabled={customBusy || !(customModuleUrls[el.id] ?? el.module?.figmaUrl ?? "").trim()}
                        onClick={() => void refreshCustomModule(el, customModuleUrls[el.id] ?? el.module?.figmaUrl ?? "")}
                        className={cn(ICON, "shrink-0 disabled:cursor-not-allowed disabled:opacity-40")}
                      >
                        <RotateCcw size={12} className={cn(customBusy && customRefreshId === el.id && "animate-spin")} />
                      </button>
                      <button
                        type="button"
                        aria-label={`${moduleName}删除链接`}
                        title="删除链接"
                        disabled={languageLocked}
                        onClick={() => clearCustomModuleSource(el)}
                        className={cn(ICON, "shrink-0 disabled:cursor-not-allowed disabled:opacity-40")}
                      >
                        <X size={12} />
                      </button>
                    </>
                  )}
                </div>
                {customRefreshId === el.id && customError ? <p role="alert" className="mb-2 text-[9px] leading-relaxed text-[var(--color-up)]">{customError}</p> : null}
                {sourceCleared ? null : (
                  <>
                    <div className="mb-1.5 text-[9px] text-[var(--app-text-3)]">放置模式</div>
                    {customModeCards(activeMode, (placementMode) => changeCustomPlacement(el, placementMode))}
                    {activeMode === "title-backdrop" ? (
                      <div className="mt-2 flex max-w-[360px] items-center justify-between gap-2">
                        <span className="text-[9px] text-[var(--app-text-3)]">标题底层</span>
                        <Segmented<SceneCustomBackdropTarget>
                          size="sm"
                          value={activeTarget}
                          onChange={(target) => changeCustomPlacement(el, activeMode, target)}
                          options={[
                            { id: "kicker", label: "小标题" },
                            { id: "title", label: "主标题" },
                            { id: "subtitle", label: "副标题" },
                          ]}
                        />
                      </div>
                    ) : null}
                    <div className="mt-2 max-w-[360px]">{placementFields(el)}</div>
                  </>
                )}
              </div>
            </Section>
          );
        })}
      </>
    );
  };

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

  /** 同一项目里的标题组方案跨语言共用；其它版本删除时只在该版本隐藏。 */
  const schemeViewKey = version?.id ?? lang;
  const languageName = lang === "sc" ? "简体版" : lang === "tc" ? "繁体版" : "英文版";
  const schemeSourceLabel = version?.name ?? languageName;
  const hiddenSchemeIds = new Set(scene.hiddenLayoutSchemes?.[schemeViewKey] ?? []);
  const layoutSchemes = sceneLayoutSchemes(scene).filter((item) => (item.lang ?? "sc") === lang && !hiddenSchemeIds.has(item.id));
  const [schemeEditing, setSchemeEditing] = useState<string | null>(null);
  /** 随方案记录的图层：编入标题组的，加上多选的 Logo、角标、免责、自定义文字。 */
  const pickedExtras = groupable.map((el) => el.id);
  const schemeExtras = [...attachedEls, ...groupable];
  const saveScheme = () => {
    const count = layoutSchemes.filter((item) => item.family === family).length;
    const id = `scheme-${Date.now().toString(36)}`;
    updateScene((current) => ({
      ...current,
      layoutSchemes: [
        ...sceneLayoutSchemes(current),
        {
          ...captureSceneLayoutScheme(current, family, board, lang, id, `${groupName}方案 ${count + 1}`, pickedExtras),
          sourceKey: schemeViewKey,
          sourceLabel: schemeSourceLabel,
        },
      ],
    }));
  };
  const editSchemes = (recipe: (list: SceneLayoutScheme[]) => SceneLayoutScheme[]) => updateScene((current) => ({ ...current, layoutSchemes: recipe(sceneLayoutSchemes(current)) }));
  const removeScheme = (item: SceneLayoutScheme) => updateScene((current) => {
    const sourceKey = item.sourceKey ?? item.lang ?? "sc";
    if (sourceKey === schemeViewKey) {
      const hiddenLayoutSchemes = Object.fromEntries(Object.entries(current.hiddenLayoutSchemes ?? {})
        .map(([key, ids]) => [key, ids.filter((id) => id !== item.id)])
        .filter(([, ids]) => ids.length));
      return {
        ...current,
        layoutSchemes: sceneLayoutSchemes(current).filter((entry) => entry.id !== item.id),
        hiddenLayoutSchemes,
      };
    }
    const hiddenLayoutSchemes = { ...current.hiddenLayoutSchemes };
    hiddenLayoutSchemes[schemeViewKey] = [...new Set([...(hiddenLayoutSchemes[schemeViewKey] ?? []), item.id])];
    return { ...current, hiddenLayoutSchemes };
  });
  /** 位置留在原文案区域：对齐变了就把锚点移到当前标题组外框对应的边，与手动切换对齐一致。 */
  const applyScheme = (item: SceneLayoutScheme) => {
    const box = output.group?.box;
    const align = item.group.align;
    const position = box && align !== group.align
      ? { x: (align === "left" ? box.x : align === "center" ? box.x + box.w / 2 : box.x + box.w) / board.w, y: group.y }
      : undefined;
    updateScene((current) => applySceneScheme(current, item, family, board, lang, position));
    selectLayer(SCENE_GROUP_ID);
  };
  /** 缩略图只画方案记录的图层：标题组和一并记录的图层，裁到它们的外框。 */
  const schemeThumb = (item: SceneLayoutScheme, box: { w: number; h: number }) => {
    const isolated: SceneState = {
      ...scene,
      familyContent: undefined,
      elements: scene.elements.map((el) => isSceneGroupRole(el.role) ? el : { ...el, visible: false }),
    };
    const titleOnly = applySceneScheme(isolated, item, item.family, item.board, lang, { x: item.group.x, y: item.group.y });
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
    if (mode !== "family" || layoutLocked || !layoutSchemes.length) return null;
    const applied = layoutSchemes.find((item) => sceneLayoutSchemeMatches(scene, item, family, board));
    return (
      <div className="min-w-0">
        <div className="mb-1 text-[9px] text-[var(--app-text-4)]">排版方案</div>
        <Dropdown
          label="套用标题组方案"
          size="xs"
          className="w-full"
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

  const schemeCard = (item: SceneLayoutScheme) => {
    const applied = sceneLayoutSchemeMatches(scene, item, family, board);
    return (
      <div key={item.id} className={cn("group overflow-hidden rounded-[6px]", applied ? "bg-[var(--app-surface-3)]" : "bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)]")}>
        <button
          type="button"
          aria-label={`套用${item.name}`}
          title={applied ? "当前版式族已在使用" : `套用到${groupName}`}
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
              aria-label="预设名称"
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
            <span
              onDoubleClick={() => setSchemeEditing(item.id)}
              title="双击重命名"
              className="min-w-0 flex-1 truncate"
            >
              {item.name}
            </span>
          )}
          {schemeEditing !== item.id ? (
            <span className="shrink-0 text-[9px] text-[var(--app-text-4)]">
              来源于{item.sourceLabel ?? (item.lang === "tc" ? "繁体版" : item.lang === "en" ? "英文版" : "简体版")}
            </span>
          ) : null}
          <button
            type="button"
            aria-label={`删除${item.name}`}
            title={(item.sourceKey ?? item.lang ?? "sc") === schemeViewKey ? "从全部版本删除" : `仅从${schemeSourceLabel}移除`}
            onClick={() => removeScheme(item)}
            className="grid size-5 shrink-0 place-items-center rounded-[3px] text-[var(--app-text-4)] opacity-0 hover:text-[var(--app-text)] group-hover:opacity-100"
          >
            <X size={10} />
          </button>
        </div>
      </div>
    );
  };

  /** 标题组方案：由用户记录，并按当前语言独立保存。 */
  const schemePanel = () => mode === "family" && !layoutLocked ? (
    <Section
      id="layout-schemes"
      title="标题组方案"
      aside={(
        <button
          type="button"
          aria-label="记录当前标题组方案"
          onClick={saveScheme}
          title={schemeExtras.length ? `记录标题组与${schemeExtras.map((el) => el.name).join("、")}的排版` : "记录当前标题组的排版；按住 Shift 点选 Logo 等图层可一起记录"}
          className={SECTION_ADD}
        >
          <Plus size={13} />
        </button>
      )}
    >
      {layoutSchemes.length ? (
        <div className="grid grid-cols-2 gap-1.5">{layoutSchemes.map(schemeCard)}</div>
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
    <div className="relative flex h-full min-h-0">
      {languageLocked ? (
        <div
          className="absolute inset-0 z-50 cursor-not-allowed"
          title={`${lang === "sc" ? "简体" : lang === "tc" ? "繁体" : "英文"}已锁定，请先在左侧解锁`}
        />
      ) : null}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[5px] border border-[var(--app-line)] bg-[#111317]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-2 text-[9px]">
          <span className="min-w-0 truncate text-[var(--app-text-3)]">
            {mode === "family" ? `${groupName} · 代表画幅 ` : "单板细化 · "}
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
            focusId={focusId}
            onFocusLayer={focusLayer}
            onPatch={patchPlacement}
            fixedLayout={layoutLocked}
            pinnedIds={pinnedIds}
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

      {layersOpen ? resizer("layers", "调整图层栏宽度") : null}
      {layersOpen ? (
      <aside className="flex min-h-0 shrink-0 flex-col overflow-y-auto pr-1" style={{ width: cols.layers }}>
        <Section
          title="图层"
          aside={(
            <button type="button" aria-label="收起图层栏" title="收起图层栏" onClick={() => toggleLayers(false)} className="grid size-5 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:text-[var(--app-text)]">
              <PanelLeftClose size={12} />
            </button>
          )}
        >
          <div className="space-y-0.5">
            {topUnits.map((id) => {
              if (id === SCENE_GROUP_ID) return groupRows;
              const el = scene.elements.find((item) => item.id === id);
              return el ? layerRow(el) : null;
            })}
          </div>
          {mode === "family" ? (
            <div className="mt-3 space-y-0.5 border-t border-[var(--app-line)] pt-2">
              {([
                ["badge", "角标"],
                ["disclaimer", "免责"],
                ["custom", "文字"],
              ] as const).map(([role, label]) => (
                <button key={role} type="button" onClick={() => addElement(role)} className="flex h-7 w-full items-center gap-2 rounded-[4px] px-2 text-[10px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">
                  <Plus size={11} /> {label}
                </button>
              ))}
              <button type="button" onClick={() => {
                setCustomImportOpen(true);
                setCustomImportExpanded(true);
                setCustomError(null);
                setTimeout(() => propsRef.current?.querySelector<HTMLElement>('[data-param-id="custom-elements"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
              }} className="flex h-7 w-full items-center gap-2 rounded-[4px] px-2 text-[10px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">
                <Plus size={11} /> 元素
              </button>
            </div>
          ) : null}
        </Section>
      </aside>
      ) : (
        <aside className="flex shrink-0 flex-col items-center px-1 py-3">
          <button type="button" aria-label="展开图层栏" title="展开图层栏" onClick={() => toggleLayers(true)} className="grid size-6 place-items-center rounded-[4px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">
            <PanelLeftOpen size={13} />
          </button>
        </aside>
      )}

      {resizer("props", "调整参数栏宽度")}
      <aside ref={propsRef} className="flex min-h-0 shrink-0 flex-col overflow-y-auto border-l border-[var(--app-line)] pl-4 pr-1" style={{ width: cols.props }}>
        {layoutLocked ? (
          <p className="flex items-center gap-1.5 border-b border-[var(--app-line-soft)] py-2 text-[9px] text-[var(--app-text-3)]">
            <Lock size={10} className="shrink-0" />
            <span>版式按广告规范锁定</span>
          </p>
        ) : null}
        {alignTargets.size >= 2 && !layoutLocked ? (
          <div className="flex items-center justify-between gap-2 border-b border-[var(--app-line-soft)] py-2">
            <span className="min-w-0 truncate text-[9px] text-[var(--app-text-3)]">已选 {alignTargets.size} 个对象 · 对齐</span>
            <div className="flex shrink-0 items-center gap-0.5">
              {SELECTION_ALIGN.map(({ id, label, Icon }) => (
                <button key={id} type="button" title={label} aria-label={`多选${label}`} onClick={() => alignSelection(id)} className={ICON}>
                  <Icon size={12} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {canGroup || ungroupIds.length ? (
          <div className="flex items-center justify-between gap-2 border-b border-[var(--app-line-soft)] py-2">
            <span className="min-w-0 truncate text-[9px] text-[var(--app-text-3)]">
              {canGroup ? `标题组 + ${groupable.map((el) => el.name).join("、")}` : `标题组已编入 ${attachedEls.filter((el) => ungroupIds.includes(el.id)).map((el) => el.name).join("、")}`}
            </span>
            {canGroup ? (
              <button type="button" title="编组（Ctrl+G）：一起移动、缩放，套用方案时一起带走" onClick={groupLayers} className={cn(GHOST, "shrink-0 border border-[var(--app-line)]")}>编组</button>
            ) : (
              <button type="button" title="取消编组（Ctrl+Shift+G）" onClick={() => ungroupLayers()} className={cn(GHOST, "shrink-0")}>取消编组</button>
            )}
          </div>
        ) : null}
        <Section
          id={SCENE_GROUP_ID}
          title="标题组"
          open={isOpen(SCENE_GROUP_ID)}
          onToggle={() => togglePanel(SCENE_GROUP_ID)}
          aside={mode === "family" && (!version || version.independent) ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={titleSyncDone || languageLocked}
                onClick={syncTitleCopyToAll}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-[4px] border px-2 text-[9px] transition-colors",
                  titleSyncDone
                    ? "border-[var(--color-down)] bg-[var(--app-surface-3)] text-[var(--color-down)]"
                    : "border-[var(--app-line-strong)] bg-[var(--app-surface-2)] text-[var(--app-text-2)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]",
                )}
              >
                {titleSyncDone ? <Check size={11} /> : <Copy size={10} />}
                {titleSyncDone ? "已应用" : "内容应用到全部版式"}
              </button>
              {titleSyncDone ? (
                <button
                  type="button"
                  onClick={undoTitleCopyToAll}
                  className="flex h-6 items-center gap-1 rounded-[4px] px-1.5 text-[9px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
                >
                  <Undo2 size={10} />撤销
                </button>
              ) : null}
            </div>
          ) : null}
        >
          {layoutBlock(<>
          <div className={cn("mb-3 grid items-end gap-2", layoutSchemes.length && mode === "family" && !layoutLocked ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-1")}>
            {schemePicker()}
            <div className="justify-self-end">
              <div className="mb-1 text-[9px] text-[var(--app-text-4)]">对齐方式</div>
              <Segmented<SceneAlign> size="sm" value={group.align} onChange={(align) => changeAlign(SCENE_GROUP_ID, align)} options={ALIGN_OPTIONS} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ScrubField label="X" ariaLabel="标题组 X 坐标" value={Math.round(group.x * board.w)} min={-board.w} max={board.w * 2} suffix="px" onCommit={(value) => patchPlacement(SCENE_GROUP_ID, { x: value / board.w })} />
            <ScrubField label="Y" ariaLabel="标题组 Y 坐标" value={Math.round(group.y * board.h)} min={-board.h} max={board.h * 2} suffix="px" onCommit={(value) => patchPlacement(SCENE_GROUP_ID, { y: value / board.h })} />
            <ScrubField label="整体比例" ariaLabel="标题组整体比例" value={group.scale} decimals={2} min={0.3} max={3} step={0.01} suffix="×" onCommit={(value) => patchPlacement(SCENE_GROUP_ID, { scale: value })} />
            <ScrubField
              label="层间距"
              ariaLabel="标题组层间距"
              disabled={stackIds.length < 2}
              value={Math.round(sceneGroupBaseGap(board) * group.scale * (group.gap ?? 1))}
              min={0}
              max={Math.round(board.h / 2)}
              suffix="px"
              onCommit={(value) => updateScene((current) => {
                const gap = value / (sceneGroupBaseGap(board) * resolveSceneGroup(current, board).scale);
                let next = writePlacement(current, SCENE_GROUP_ID, { gap });
                /** 眉题、副标题单独设过间距时会盖过整组层间距，整组改时一起改。 */
                for (const el of next.elements) {
                  if ((el.role === "kicker" || el.role === "subtitle") && resolveSceneOwn(next, board, el).gap !== undefined) next = writePlacement(next, el.id, { gap });
                }
                if (mode !== "family" || layoutLocked) return next;
                /** 编入组的上下层间距一起改成整组层间距。 */
                const edits = { ...next.familyEdits[family] };
                const unit = sceneGroupUnit(next, board);
                for (const riderId of sceneAttachedIds(next, family)) {
                  const attach = edits[riderId]?.attach;
                  if (attach && attach.v !== "beside") edits[riderId] = { ...edits[riderId], attach: { ...attach, dy: Math.max(0, value) / unit } };
                }
                return { ...next, familyEdits: { ...next.familyEdits, [family]: edits } };
              })}
            />
          </div>
          </>)}
        </Section>

        {COPY_ORDER.map((role) => slotField(role))}
        {scene.elements
          .filter((el) => (
            el.role === "cta"
            || el.role === "custom"
            || ((el.role === "badge" || el.role === "disclaimer") && (hasLayerContent(el) || elementVisible(el)))
          ))
          .map((el) => customField(el))}
        {customElementsPanel()}

        {scene.elements.filter((el) => el.role === "logo").map((el) => <Fragment key={el.id}>{logoPanel(el)}</Fragment>)}
        {scene.elements.filter((el) => el.role === "visual").map((el) => <Fragment key={el.id}>{visualPanel(el)}</Fragment>)}

        {colorModule()}

        {mode === "board" ? (
          <Section title="本画板">
            <div className="space-y-1.5">
              <button type="button" disabled={!Object.keys(boardPatch).length} onClick={resetBoard} className={cn(GHOST, "flex w-full items-center gap-1.5")}>
                <RotateCcw size={11} />恢复整板自动值
              </button>
              {specBoard ? null : (
                <button type="button" disabled={!Object.keys(boardPatch).length} onClick={syncToFamily} className={cn(GHOST, "flex w-full items-center gap-1.5")}>
                  <Plus size={11} />同步到{groupName}（{familyBoards.length} 块）
                </button>
              )}
            </div>
            {specBoard && Object.keys(boardPatch).length ? (
              <p className="mt-2 text-[9px] leading-relaxed text-[var(--warn-text)]">这块画板已偏离规范，写入后请按投放要求复核</p>
            ) : null}
          </Section>
        ) : null}

        {schemePanel()}
      </aside>
    </div>
  );
}
