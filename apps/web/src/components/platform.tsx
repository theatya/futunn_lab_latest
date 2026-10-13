"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  FileText,
  History,
  Home,
  Info,
  KeyRound,
  Layers3,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Pipette,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import {
  CTA_STYLE_PRESETS,
  LANGS,
  SCENE_FAMILY_LABEL,
  badgeStyleOf,
  disclaimerText,
  emptyLangCopy,
  joinTokens,
  logoOf,
  sizeKey,
  titleStackOf,
  tokenizeTitle,
  withLangLogo,
  type BadgeStyle,
  type CopyLayoutPreset,
  type Lang,
  type LogoSourceMode,
  type RecipeTypography,
  type TargetBoard,
} from "@futu/domain";
import { ALL_SIZES, linkedOf, nativeOf } from "@futu/specs";
import { SizePicker } from "@/components/size-picker";
import {
  StudioProvider,
  createBlankStudioSnapshot,
  emptyMasterRecognitionSource,
  useStudio,
  type MasterRecognitionSource,
  type StudioSnapshot,
  type StepIndex,
} from "@/lib/studio-store";
import { StepFrames } from "@/components/steps/step-frames";
import { StepGenerate } from "@/components/steps/step-generate";
import { BreakPicker } from "@/components/steps/break-picker";
import { LogoBind } from "@/components/steps/asset-bind";
import { LogoPresetPreview } from "@/components/logo-preset-preview";
import { BackgroundColorControl, colorToHex, hexToHsv, hsvToHex } from "@/components/color-control";
import { SceneBatchStep, SceneConfigStep, ScenePrepareStep, sceneFamilies } from "@/components/scene/scene-steps";
import { Button, WorkflowSparkle } from "@/components/ui/button";
import { TextArea, TextField } from "@/components/ui/field";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useFitBoard } from "@/lib/use-fit-board";
import { buildRecommendedCopyPresets } from "@/lib/corpus-recommendation";
import { buildMasterLayoutFingerprint } from "@/lib/layout-fingerprint";
import type { FigmaRecognitionResult, FigmaRecognizedLayer } from "@/lib/figma-recognition";
import type { LayerRole } from "@/lib/recognize";

type Mode = "home" | "extend" | "copy";

const EXTEND_STEPS = ["准备主视觉", "选择资源位", "配置内容与样式", "批量生成并精调"] as const;
const COPY_STEPS = ["选择范围", "匹配文案", "编辑与检查", "写回 Figma"] as const;

type TaskType = "extend" | "copy";
type WorkspaceTask = {
  id: string;
  name: string;
  type: TaskType;
  updatedAt: string;
  studio?: StudioSnapshot;
  copyStep?: number;
  copyDone?: boolean;
};

const TASKS_KEY = "futu:workspace-tasks:v1";

const ROLE_LABEL = {
  title: "主标题",
  sub: "副标题",
  supplement: "补充标题",
  titleGroup: "标题组",
  cta: "CTA",
  disc: "免责",
  kv: "KV",
  logo: "Logo",
  qrcode: "二维码",
  badge: "角标",
  custom: "自定义",
  skip: "跳过",
} as const;

const ROLE_OPTIONS: Array<[LayerRole, string]> = [
  ["title", "主标题"],
  ["sub", "副标题"],
  ["supplement", "补充标题"],
  ["titleGroup", "标题组"],
  ["cta", "CTA"],
  ["disc", "免责"],
  ["logo", "Logo"],
  ["qrcode", "二维码"],
  ["badge", "角标"],
  ["custom", "自定义"],
];

function isPlatformFont(family: string | undefined) {
  if (!family) return false;
  const normalized = family.toLowerCase().replace(/[\s_-]+/g, "");
  return ["brhendrix", "misans", "mplus1p", "sourcehanserif", "fzlantinghei", "hyyakuhei"]
    .some((name) => normalized.includes(name));
}

function estimatedTextWidth(text: string) {
  return Array.from(text).reduce((width, character) => {
    if (/\s/.test(character)) return width + 0.28;
    if (/[\u3000-\u9fff\uac00-\ud7af]/.test(character)) return width + 1;
    if (/[A-Z]/.test(character)) return width + 0.68;
    if (/[0-9$%+]/.test(character)) return width + 0.58;
    return width + 0.52;
  }, 0);
}

function orderedTextNodes(layer: FigmaRecognizedLayer | undefined) {
  if (!layer) return [];
  const nodes = [...layer.textNodes].filter((item) => item.text.trim());
  if (nodes.length <= 1) return nodes;
  const parentIds = new Set(nodes.map((node) => node.parentId).filter(Boolean));
  const sharedLayout = parentIds.size === 1 ? nodes[0].parentLayoutMode : undefined;
  if (sharedLayout === "VERTICAL" || sharedLayout === "HORIZONTAL") {
    return nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
  return nodes.sort((a, b) => {
    if (!a.bounds || !b.bounds) return (a.order ?? 0) - (b.order ?? 0);
    const sameLine = Math.abs(a.bounds.y - b.bounds.y) < Math.max(a.bounds.h, b.bounds.h) * 0.45;
    return sameLine ? a.bounds.x - b.bounds.x : a.bounds.y - b.bounds.y;
  });
}

function recognizedTextLines(layer: FigmaRecognizedLayer | undefined, lang: Lang) {
  if (!layer) return [];
  const ordered = orderedTextNodes(layer);
  if (!ordered.length) return layer.text ? [layer.text] : [];
  if (ordered.length === 1) return ordered[0].text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parentIds = new Set(ordered.map((node) => node.parentId).filter(Boolean));
  const sharedLayout = parentIds.size === 1 ? ordered[0].parentLayoutMode : undefined;
  if (sharedLayout === "VERTICAL") {
    return ordered.flatMap((node) => node.text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  }
  if (sharedLayout === "HORIZONTAL") {
    return [ordered.map((node) => node.text.trim()).join(lang === "en" ? " " : "")];
  }

  const rows: typeof ordered[] = [];
  ordered.forEach((node) => {
    const row = rows.at(-1);
    const first = row?.[0];
    const sameLine = first?.bounds && node.bounds
      ? Math.abs(first.bounds.y - node.bounds.y) < Math.max(first.bounds.h, node.bounds.h) * 0.45
      : false;
    if (row && sameLine) row.push(node);
    else rows.push([node]);
  });
  const separator = lang === "en" ? " " : "";
  return rows.flatMap((row) => {
    const fragments = row.map((item) => item.text.split(/\r?\n/));
    const rowCount = Math.max(...fragments.map((item) => item.length));
    return Array.from({ length: rowCount }, (_, index) =>
      fragments.map((item) => item[index] ?? "").filter(Boolean).join(separator),
    ).filter(Boolean);
  });
}

function recognizedText(layer: FigmaRecognizedLayer | undefined, lang: Lang, preserveLines = false) {
  if (!layer) return "";
  const lines = recognizedTextLines(layer, lang);
  const separator = lang === "en" ? " " : "";
  return lines.join(preserveLines ? "\n" : separator);
}

function recognizedBreaks(layer: FigmaRecognizedLayer | undefined, lang: Lang) {
  const lines = recognizedTextLines(layer, lang);
  if (lines.length <= 1) return [];
  const breaks: number[] = [];
  let tokenCount = 0;
  lines.slice(0, -1).forEach((line) => {
    tokenCount += tokenizeTitle(line, lang).length;
    if (tokenCount > 0) breaks.push(tokenCount);
  });
  return breaks;
}

function layerFromTextNodes(
  layer: FigmaRecognizedLayer | undefined,
  nodes: FigmaRecognizedLayer["textNodes"],
) {
  if (!layer || !nodes.length) return undefined;
  const boxes = nodes.map((node) => node.bounds).filter((bounds): bounds is NonNullable<typeof bounds> => Boolean(bounds));
  const bounds = boxes.length
    ? {
        x: Math.min(...boxes.map((box) => box.x)),
        y: Math.min(...boxes.map((box) => box.y)),
        w: Math.max(...boxes.map((box) => box.x + box.w)) - Math.min(...boxes.map((box) => box.x)),
        h: Math.max(...boxes.map((box) => box.y + box.h)) - Math.min(...boxes.map((box) => box.y)),
      }
    : layer.bounds;
  return { ...layer, textNodes: nodes, bounds };
}

function unionBounds(
  ...items: Array<{ x: number; y: number; w: number; h: number } | undefined>
) {
  const bounds = items.filter((item): item is { x: number; y: number; w: number; h: number } => Boolean(item));
  if (!bounds.length) return undefined;
  return {
    x: Math.min(...bounds.map((item) => item.x)),
    y: Math.min(...bounds.map((item) => item.y)),
    w: Math.max(...bounds.map((item) => item.x + item.w)) - Math.min(...bounds.map((item) => item.x)),
    h: Math.max(...bounds.map((item) => item.y + item.h)) - Math.min(...bounds.map((item) => item.y)),
  };
}

function titleGroupParts(layer: FigmaRecognizedLayer | undefined) {
  if (!layer) return {};
  const namedTitle = layer.textNodes.filter((node) => /主标题|main\s*heading|headline|(^|[\s_-])title($|[\s_-])/i.test(node.name ?? ""));
  const namedSub = layer.textNodes.filter((node) => /副标题|subtitle|subhead|eyebrow|kicker/i.test(node.name ?? ""));
  if (namedTitle.length || namedSub.length) {
    const unassigned = layer.textNodes.filter((node) => !namedTitle.includes(node) && !namedSub.includes(node));
    return {
      title: layerFromTextNodes(layer, namedTitle.length ? namedTitle : unassigned),
      sub: layerFromTextNodes(layer, namedSub.length ? namedSub : namedTitle.length ? unassigned : []),
    };
  }
  const maxSize = Math.max(0, ...layer.textNodes.map((node) => node.fontSize));
  const titleNodes = layer.textNodes.filter((node) => node.fontSize >= maxSize * 0.9);
  const subNodes = layer.textNodes.filter((node) => !titleNodes.includes(node));
  return {
    title: layerFromTextNodes(layer, titleNodes.length ? titleNodes : layer.textNodes),
    sub: layerFromTextNodes(layer, subNodes),
  };
}

function frozenTypography(
  layer: FigmaRecognizedLayer | undefined,
  boardHeight: number,
): RecipeTypography | undefined {
  const node = layer?.textNodes[0];
  if (!node?.fontSize) return undefined;
  const weight = node.fontWeight ?? 400;
  const lineHeight = node.lineHeightPx ?? node.fontSize * 1.2;
  return {
    fontFamily: node.fontFamily ?? "Inter",
    fontStyle: weight >= 700 ? "Bold" : weight >= 500 ? "Medium" : "Regular",
    fontWeight: weight,
    fontSizePx: node.fontSize,
    fontSizeToBoardHeight: node.fontSize / boardHeight,
    lineHeightPx: lineHeight,
    lineHeightToFontSize: lineHeight / node.fontSize,
    letterSpacing: node.letterSpacing,
    alignHorizontal: node.textAlignHorizontal === "CENTER" ? "center" : "left",
    alignVertical: node.textAlignVertical === "TOP" ? "top" : node.textAlignVertical === "BOTTOM" ? "bottom" : "center",
    autoResize: "height",
    color: node.color,
    runs: (node.styleRuns ?? []).map((run) => ({
      start: run.start,
      end: run.end,
      fontFamily: run.fontFamily,
      fontStyle: (run.fontWeight ?? weight) >= 700 ? "Bold" : (run.fontWeight ?? weight) >= 500 ? "Medium" : "Regular",
      fontWeight: run.fontWeight,
      fontSizeRatio: run.fontSize ? run.fontSize / node.fontSize : undefined,
      color: run.color,
      fillCss: run.fillCss,
      italic: run.italic,
    })),
  };
}

function corpusPresetsForRecognition(
  result: FigmaRecognitionResult,
  lang: Lang,
  sourceFrameId: string,
): CopyLayoutPreset[] {
  if (result.frame.width !== 1080 || result.frame.height !== 225) return [];
  const layer = (role: LayerRole) => result.layers.find((item) => item.role === role);
  const titleGroup = layer("titleGroup");
  const groupParts = titleGroupParts(titleGroup);
  const titleSource = layer("title") ?? groupParts.title ?? titleGroup;
  const fingerprint = buildMasterLayoutFingerprint(result, lang);
  const titleTokens = tokenizeTitle(recognizedText(titleSource, lang), lang);

  return buildRecommendedCopyPresets({
    lang,
    board: { width: result.frame.width, height: result.frame.height },
    structure: fingerprint.structure,
    mainTitleLines: fingerprint.mainTitleLines,
    subTitleLines: fingerprint.subTitleLines,
    alignment: fingerprint.alignment,
    modules: fingerprint.modules,
    fingerprint,
    titleTokens,
    masterBreaks: recognizedBreaks(titleSource, lang),
    sourceFrameId,
  });
}

const MASTER_LANGS = [
  { id: "en" as const, label: "英文" },
  { id: "sc" as const, label: "简体" },
  { id: "tc" as const, label: "繁体" },
  { id: "ja" as const, label: "日文" },
];

const MATCH_ROWS = [
  ["主标题", "Transfer to Earn", "27 / 27", "98%"],
  ["副标题", "Welcome offer", "27 / 27", "96%"],
  ["CTA", "Download", "27 / 27", "99%"],
  ["免责", "New user promo…", "27 / 27", "97%"],
  ["角标", "Limited time", "18 / 27", "82%"],
];

function PlatformInner() {
  const studio = useStudio();
  const [mode, setMode] = useState<Mode>("home");
  const [copyStep, setCopyStep] = useState(0);
  const [copyDone, setCopyDone] = useState(false);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [tasksReady, setTasksReady] = useState(false);
  const [namingType, setNamingType] = useState<TaskType | null>(null);
  const [taskName, setTaskName] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!studio.storageReady) return;
    try {
      const raw = window.localStorage.getItem(TASKS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { tasks?: WorkspaceTask[]; activeTaskId?: string | null };
        const savedTasks = saved.tasks ?? [];
        setTasks(savedTasks);
        setActiveTaskId(saved.activeTaskId ?? null);
        const active = savedTasks.find((task) => task.id === saved.activeTaskId);
        if (active?.type === "extend" && active.studio) studio.loadSnapshot(active.studio);
        if (active?.type === "copy") {
          setCopyStep(active.copyStep ?? 0);
          setCopyDone(active.copyDone ?? false);
        }
      } else {
        const hasExistingWork = Object.values(studio.masterSources).some((source) => source?.url || source?.result);
        if (hasExistingWork) {
          const migrated: WorkspaceTask = {
            id: studio.project.id,
            name: studio.project.name,
            type: "extend",
            updatedAt: studio.project.updatedAt,
            studio: studio.snapshot,
          };
          setTasks([migrated]);
          setActiveTaskId(migrated.id);
        }
      }
    } catch {
      window.localStorage.removeItem(TASKS_KEY);
    } finally {
      setTasksReady(true);
    }
  }, [studio.storageReady]);

  useEffect(() => {
    if (!tasksReady) return;
    try {
      window.localStorage.setItem(TASKS_KEY, JSON.stringify({ tasks, activeTaskId }));
    } catch {
      // 多个任务都带上传大图时可能超出本地存储配额；当前会话的任务列表不受影响。
    }
  }, [activeTaskId, tasks, tasksReady]);

  useEffect(() => {
    if (!tasksReady || !activeTaskId) return;
    setTasks((current) => current.map((task) => {
      if (task.id !== activeTaskId) return task;
      if (task.type === "extend") {
        if (task.studio === studio.snapshot) return task;
        return { ...task, studio: studio.snapshot, updatedAt: studio.project.updatedAt };
      }
      return { ...task, copyStep, copyDone, updatedAt: new Date().toISOString() };
    }));
  }, [activeTaskId, copyDone, copyStep, studio.project.updatedAt, studio.snapshot, tasksReady]);

  const goHome = () => setMode("home");

  const openTask = (task: WorkspaceTask) => {
    setActiveTaskId(task.id);
    if (task.type === "extend" && task.studio) {
      studio.loadSnapshot(task.studio);
      setMode("extend");
      return;
    }
    setCopyStep(task.copyStep ?? 0);
    setCopyDone(task.copyDone ?? false);
    setMode("copy");
  };

  const openExtend = () => {
    const active = tasks.find((task) => task.id === activeTaskId && task.type === "extend")
      ?? tasks.find((task) => task.type === "extend");
    if (active) openTask(active);
    else {
      setTaskName("");
      setNamingType("extend");
    }
  };

  const openCopy = () => {
    const active = tasks.find((task) => task.id === activeTaskId && task.type === "copy")
      ?? tasks.find((task) => task.type === "copy");
    if (active) openTask(active);
    else {
      setTaskName("");
      setNamingType("copy");
    }
  };

  const requestNewTask = (type: TaskType) => {
    setTaskName("");
    setEditingTaskId(null);
    setNamingType(type);
  };

  const createTask = () => {
    const name = taskName.trim();
    if (!name || !namingType) return;
    if (editingTaskId) {
      const editing = tasks.find((task) => task.id === editingTaskId);
      if (!editing) return;
      const renamed: WorkspaceTask = {
        ...editing,
        name,
        updatedAt: new Date().toISOString(),
        ...(editing.studio
          ? { studio: { ...editing.studio, project: { ...editing.studio.project, name } } }
          : {}),
      };
      setTasks((current) => current.map((task) => task.id === editingTaskId ? renamed : task));
      if (editingTaskId === activeTaskId && renamed.type === "extend" && renamed.studio) {
        studio.loadSnapshot(renamed.studio);
      }
      setNamingType(null);
      setEditingTaskId(null);
      setTaskName("");
      return;
    }
    const id = `${namingType}-${Date.now()}`;
    const now = new Date().toISOString();
    if (namingType === "extend") {
      const snapshot = createBlankStudioSnapshot(name, id);
      const task: WorkspaceTask = { id, name, type: "extend", updatedAt: now, studio: snapshot };
      setTasks((current) => [task, ...current]);
      setActiveTaskId(id);
      studio.loadSnapshot(snapshot);
      setMode("extend");
    } else {
      const task: WorkspaceTask = { id, name, type: "copy", updatedAt: now, copyStep: 0, copyDone: false };
      setTasks((current) => [task, ...current]);
      setActiveTaskId(id);
      setCopyStep(0);
      setCopyDone(false);
      setMode("copy");
    }
    setNamingType(null);
    setEditingTaskId(null);
    setTaskName("");
  };

  const renameTask = (task: WorkspaceTask) => {
    setEditingTaskId(task.id);
    setNamingType(task.type);
    setTaskName(task.name);
  };

  const duplicateTask = (task: WorkspaceTask) => {
    const id = `${task.type}-${Date.now()}`;
    const name = `${task.name} 副本`;
    const now = new Date().toISOString();
    const duplicate = structuredClone(task);
    duplicate.id = id;
    duplicate.name = name;
    duplicate.updatedAt = now;
    if (duplicate.studio) {
      duplicate.studio.project.id = id;
      duplicate.studio.project.name = name;
      duplicate.studio.project.createdAt = now;
      duplicate.studio.project.updatedAt = now;
    }
    setTasks((current) => [duplicate, ...current]);
  };

  const deleteTask = (task: WorkspaceTask) => {
    if (!window.confirm(`确定删除“${task.name}”吗？`)) return;
    setTasks((current) => current.filter((item) => item.id !== task.id));
    if (activeTaskId === task.id) {
      setActiveTaskId(null);
      setMode("home");
    }
  };

  const activeTask = tasks.find((task) => task.id === activeTaskId);

  return (
    <div
      className="fixed left-0 top-0 h-[66.666667vh] w-[66.666667vw] origin-top-left overflow-hidden bg-[var(--app-page)] text-[var(--app-text)]"
      style={{ transform: "scale(1.5)" }}
    >
      <Topbar />
      <div className="flex h-[calc(100%-48px)] min-h-0">
        <Sidebar
          mode={mode}
          tasks={tasks}
          activeTaskId={activeTaskId}
          onOpenTask={openTask}
          onNewTask={requestNewTask}
          onRenameTask={renameTask}
          onDuplicateTask={duplicateTask}
          onDeleteTask={deleteTask}
          onHome={goHome}
          onExtend={openExtend}
          onCopy={openCopy}
        />
        <main className="min-w-0 flex-1 bg-[var(--app-page)]">
          {mode === "home" ? (
            <HomeScreen
              tasks={tasks}
              onOpenTask={openTask}
              onExtend={() => requestNewTask("extend")}
              onCopy={() => requestNewTask("copy")}
            />
          ) : null}
          {mode === "extend" ? (
            <Workspace
              title={activeTask?.name ?? "延展项目"}
              steps={EXTEND_STEPS}
              step={studio.step}
              onStep={(value) => studio.setStep(value as StepIndex)}
              onBack={goHome}
            >
              {studio.step === 0 ? <ScenePrepareStep onNext={() => studio.setStep(1)} /> : null}
              {studio.step === 1 ? <SceneTargetsStep onBack={() => studio.setStep(0)} onNext={() => studio.setStep(2)} /> : null}
              {studio.step === 2 ? <SceneConfigStep onBack={() => studio.setStep(1)} onNext={() => studio.setStep(3)} /> : null}
              {studio.step === 3 ? <SceneBatchStep onBack={() => studio.setStep(2)} /> : null}
            </Workspace>
          ) : null}
          {mode === "copy" ? (
            <Workspace
              title={activeTask?.name ?? "批量修改文案"}
              steps={COPY_STEPS}
              step={copyStep}
              onStep={setCopyStep}
              onBack={goHome}
            >
              {copyStep === 0 ? <CopyScope onNext={() => setCopyStep(1)} /> : null}
              {copyStep === 1 ? <CopyMatch onNext={() => setCopyStep(2)} /> : null}
              {copyStep === 2 ? <CopyEdit onNext={() => setCopyStep(3)} /> : null}
              {copyStep === 3 ? (
                <CopyWriteback done={copyDone} onRun={() => setCopyDone(true)} />
              ) : null}
            </Workspace>
          ) : null}
        </main>
      </div>
      {namingType ? (
        <TaskNamingDialog
          type={namingType}
          editing={Boolean(editingTaskId)}
          value={taskName}
          onChange={setTaskName}
          onClose={() => {
            setNamingType(null);
            setEditingTaskId(null);
          }}
          onConfirm={createTask}
        />
      ) : null}
    </div>
  );
}

export function Platform() {
  return (
    <StudioProvider>
      <PlatformInner />
    </StudioProvider>
  );
}

function TaskNamingDialog({
  type,
  editing,
  value,
  onChange,
  onClose,
  onConfirm,
}: {
  type: TaskType;
  editing: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const label = type === "extend" ? "延展项目" : "批量改文案任务";
  return (
    <div className="absolute inset-0 z-[90] grid place-items-center bg-black/65 p-6">
      <section role="dialog" aria-modal="true" aria-label={`命名${label}`} className="w-full max-w-[420px] rounded-[8px] border border-[var(--app-line-strong)] bg-[var(--app-surface)] shadow-[0_24px_80px_rgb(0_0_0/0.55)]">
        <header className="flex items-center justify-between border-b border-[var(--app-line)] px-5 py-4">
          <h2 className="text-[14px] font-semibold">{editing ? "重命名" : "新建"}{label}</h2>
          <button type="button" aria-label="关闭" onClick={onClose} className="grid size-7 place-items-center rounded-[5px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)]">
            <X size={15} />
          </button>
        </header>
        <div className="p-5">
          <label className="block text-[11px] text-[var(--app-text-2)]">
            文件名称
            <input
              autoFocus
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && value.trim() && onConfirm()}
              placeholder={type === "extend" ? "例如：26Q3 入金活动延展" : "例如：26Q3 入金活动文案修改"}
              className="mt-2 h-9 w-full rounded-[5px] border border-[var(--app-line-strong)] bg-[var(--app-field)] px-3 text-[12px] outline-none focus:border-[var(--app-line-strong)]"
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[var(--app-line)] px-5 py-3">
          <Button size="sm" onClick={onClose}>取消</Button>
          <Button variant="primary" size="sm" disabled={!value.trim()} onClick={onConfirm}>{editing ? "保存" : "创建"}</Button>
        </footer>
      </section>
    </div>
  );
}

function Topbar() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [figmaConfigured, setFigmaConfigured] = useState(false);

  useEffect(() => {
    setFigmaConfigured(Boolean(window.sessionStorage.getItem("futu:figma-token")));
  }, []);

  return (
    <header className="h-12 border-b border-[var(--app-line)] bg-[var(--app-rail)] px-4 flex items-center">
      <div className="relative flex items-center gap-2.5 min-w-0">
        <img
          src="/brand/platform-logo.svg"
          width={24}
          height={24}
          alt="富途牛牛"
          className="size-6 rounded-full"
        />
        <span className="text-[14px] font-semibold text-[var(--app-text)]">素材延展平台</span>
        <button
          type="button"
          aria-label="打开平台设置"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen((value) => !value)}
          className="grid size-6 place-items-center rounded-[4px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
        >
          <ChevronDown size={14} className={cn("transition-transform duration-[var(--dur-fast)]", settingsOpen && "rotate-180")} />
        </button>
        {settingsOpen ? (
          <div className="absolute left-0 top-[calc(100%+9px)] z-50 w-[216px] rounded-[6px] border border-[var(--app-line-strong)] bg-[var(--app-surface)] p-1.5 shadow-[var(--glass-shadow)]">
            <div className="px-2.5 py-2 text-[10px] font-medium text-[var(--app-text-4)]">工作区设置</div>
            <SettingsItem icon={<Sparkles size={13} />} label="界面偏好" detail="深色 · 标准密度" />
            <div className="mx-1.5 my-1 h-px bg-[var(--app-line)]" />
            <button className="w-full rounded-[4px] px-2.5 py-2 text-left text-[11px] text-[var(--app-text-2)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">
              查看帮助与使用说明
            </button>
          </div>
        ) : null}
      </div>
      <div className="flex-1" />
      <button className="top-action">
        <span className={cn("size-1.5 rounded-full", figmaConfigured ? "bg-[var(--color-down)]" : "bg-[var(--app-text-4)]")} />
        {figmaConfigured ? "Figma 已配置" : "Figma 未配置"}
      </button>
      <button className="top-action" onClick={() => setApiOpen(true)}>
        <KeyRound size={13} />
        API 配置
      </button>
      <button className="ml-2 size-7 rounded-full border border-[var(--app-line-strong)] bg-[var(--app-surface-2)] grid place-items-center">
        <UserRound size={14} />
      </button>
      {apiOpen ? (
        <ApiConfigDialog
          onClose={() => setApiOpen(false)}
          onSaved={() => {
            setFigmaConfigured(true);
            setApiOpen(false);
          }}
        />
      ) : null}
    </header>
  );
}

function ApiConfigDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : (window.sessionStorage.getItem("futu:figma-token") ?? ""),
  );

  const save = () => {
    if (!token.trim()) return;
    window.sessionStorage.setItem("futu:figma-token", token.trim());
    onSaved();
  };

  return (
    <div className="absolute inset-0 z-[80] grid place-items-center bg-black/65 p-6">
      <section role="dialog" aria-modal="true" aria-label="API 配置" className="w-full max-w-[440px] rounded-[8px] border border-[var(--app-line-strong)] bg-[var(--app-surface)] shadow-[0_24px_80px_rgb(0_0_0/0.55)]">
        <header className="flex items-center justify-between border-b border-[var(--app-line)] px-5 py-4">
          <h2 className="text-[14px] font-semibold">Figma API 配置</h2>
          <button type="button" aria-label="关闭 API 配置" onClick={onClose} className="grid size-7 place-items-center rounded-[5px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)]">
            <X size={15} />
          </button>
        </header>
        <div className="p-5">
          <label className="block text-[11px] text-[var(--app-text-2)]">
            Personal Access Token
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="figd_..."
              autoComplete="off"
              className="mt-2 h-9 w-full rounded-[5px] border border-[var(--app-line-strong)] bg-[var(--app-field)] px-3 text-[12px] outline-none focus:border-[var(--color-brand)]"
            />
          </label>
          <p className="mt-2 text-[10px] text-[var(--app-text-4)]">仅保存在当前浏览器会话，关闭窗口后清除。</p>
        </div>
        <footer className="flex justify-end gap-2 border-t border-[var(--app-line)] px-5 py-3">
          <Button size="sm" onClick={onClose}>取消</Button>
          <Button variant="primary" size="sm" disabled={!token.trim()} onClick={save}>保存</Button>
        </footer>
      </section>
    </div>
  );
}

function SettingsItem({ icon, label, detail }: { icon: React.ReactNode; label: string; detail: string }) {
  return (
    <button className="grid w-full grid-cols-[18px_1fr_auto] items-center gap-1.5 rounded-[4px] px-2.5 py-2 text-left hover:bg-[var(--app-surface-2)]">
      <span className="grid place-items-center text-[var(--app-text-3)]">{icon}</span>
      <span className="text-[11px] text-[var(--app-text)]">{label}</span>
      <span className="text-[10px] text-[var(--app-text-4)]">{detail}</span>
    </button>
  );
}

function taskMeta(task: WorkspaceTask) {
  if (task.type === "copy") return `批量改文案 · 第 ${(task.copyStep ?? 0) + 1} 步`;
  const languages = task.studio?.project.content.langs.length ?? 0;
  return `${languages} 语言 · 第 ${(task.studio?.step ?? 0) + 1} 步`;
}

function taskTime(value: string) {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (elapsed < 60 * 60 * 1000) return "刚刚";
  if (elapsed < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.floor(elapsed / 3_600_000))} 小时前`;
  return `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`;
}

function taskThumbnail(task: WorkspaceTask) {
  if (task.type !== "extend") return undefined;
  const kv = task.studio?.project.content.kv;
  if (kv?.source === "figma" || kv?.source === "upload") return kv.previewUrl;
  return Object.values(task.studio?.masterSources ?? {})
    .find((source) => source?.result?.previewUrl)?.result?.previewUrl;
}

function Sidebar({
  mode,
  tasks,
  activeTaskId,
  onOpenTask,
  onNewTask,
  onRenameTask,
  onDuplicateTask,
  onDeleteTask,
  onHome,
  onExtend,
  onCopy,
}: {
  mode: Mode;
  tasks: WorkspaceTask[];
  activeTaskId: string | null;
  onOpenTask: (task: WorkspaceTask) => void;
  onNewTask: (type: TaskType) => void;
  onRenameTask: (task: WorkspaceTask) => void;
  onDuplicateTask: (task: WorkspaceTask) => void;
  onDeleteTask: (task: WorkspaceTask) => void;
  onHome: () => void;
  onExtend: () => void;
  onCopy: () => void;
}) {
  const [recentOpen, setRecentOpen] = useState(true);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [menuTaskId, setMenuTaskId] = useState<string | null>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const taskMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!newMenuOpen && !menuTaskId) return;
    const closeMenus = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!newMenuRef.current?.contains(target)) setNewMenuOpen(false);
      if (!taskMenuRef.current?.contains(target)) setMenuTaskId(null);
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, [menuTaskId, newMenuOpen]);

  return (
    <aside className="w-[168px] shrink-0 border-r border-[var(--app-line)] bg-[var(--app-rail)] p-2 flex flex-col">
      <nav className="space-y-0.5">
        <NavButton active={mode === "home"} icon={<Home size={14} />} onClick={onHome}>
          首页
        </NavButton>
        <NavButton active={mode === "extend"} icon={<Layers3 size={14} />} onClick={onExtend}>
          延展项目
        </NavButton>
        <NavButton active={mode === "copy"} icon={<FileText size={14} />} onClick={onCopy}>
          批量改文案
        </NavButton>
      </nav>

      <div className="relative mt-5 flex h-8 items-center px-1">
        <button
          type="button"
          aria-expanded={recentOpen}
          onClick={() => setRecentOpen((value) => !value)}
          className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-[4px] px-1 text-[10px] font-medium text-[var(--app-text-4)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text-2)]"
        >
          <History size={12} />
          <span>最近任务</span>
          <ChevronDown size={12} className={cn("ml-auto transition-transform", !recentOpen && "-rotate-90")} />
        </button>
        <button
          type="button"
          aria-label="新建项目"
          onClick={() => setNewMenuOpen((value) => !value)}
          className="ml-1 grid size-7 shrink-0 place-items-center rounded-[4px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
        >
          <Plus size={14} />
        </button>
        {newMenuOpen ? (
          <div ref={newMenuRef} className="absolute left-1 right-1 top-9 z-40 rounded-[6px] border border-[var(--app-line-strong)] bg-[var(--app-surface)] p-1 shadow-[var(--glass-shadow)]">
            <button onClick={() => { setNewMenuOpen(false); onNewTask("extend"); }} className="w-full rounded-[4px] px-2.5 py-2 text-left text-[10px] hover:bg-[var(--app-surface-2)]">新建延展项目</button>
            <button onClick={() => { setNewMenuOpen(false); onNewTask("copy"); }} className="w-full rounded-[4px] px-2.5 py-2 text-left text-[10px] hover:bg-[var(--app-surface-2)]">新建批量改文案</button>
          </div>
        ) : null}
      </div>
      {recentOpen ? <div className="relative mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto">
        {tasks.map((item) => {
          const thumbnail = taskThumbnail(item);
          return (
          <div
            key={item.id}
            ref={menuTaskId === item.id ? taskMenuRef : undefined}
            className={cn(
              "group relative flex w-full items-center gap-2 rounded-[6px] p-1.5 text-left hover:bg-[var(--app-surface-2)]",
              activeTaskId === item.id && mode !== "home" && "bg-[var(--app-surface-2)]",
              menuTaskId === item.id && "z-50",
            )}
          >
            <button onClick={() => onOpenTask(item)} className="absolute inset-0 rounded-[6px]" aria-label={`打开 ${item.name}`} />
            <div className="pointer-events-none relative size-10 shrink-0 overflow-hidden rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-3)]">
              {thumbnail ? (
                <img src={thumbnail} alt="" className="size-full object-cover" />
              ) : (
                <div className="grid size-full place-items-center text-[var(--app-text-3)]">
                  {item.type === "copy" ? <FileText size={14} /> : <Layers3 size={14} />}
                </div>
              )}
            </div>
            <div className="relative min-w-0 flex-1 pointer-events-none">
              <div className="truncate pr-5 text-[11px] font-medium">{item.name}</div>
              <div className="mt-0.5 truncate text-[9px] text-[var(--app-text-4)]">
                {taskMeta(item)} · {taskTime(item.updatedAt)}
              </div>
            </div>
            <button
              type="button"
              aria-label={`${item.name} 更多操作`}
              onClick={() => setMenuTaskId((current) => current === item.id ? null : item.id)}
              className="relative z-10 grid size-6 shrink-0 place-items-center rounded-[4px] text-[var(--app-text-3)] opacity-60 hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)] hover:opacity-100"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuTaskId === item.id ? (
              <div className="absolute right-1 top-10 z-50 w-[142px] rounded-[6px] border border-[var(--app-line-strong)] bg-[var(--app-surface)] p-1 shadow-[var(--glass-shadow)]">
                <TaskMenuItem icon={<ArrowRight size={13} />} label="打开项目" onClick={() => { setMenuTaskId(null); onOpenTask(item); }} />
                <TaskMenuItem icon={<Pencil size={13} />} label="重命名" onClick={() => { setMenuTaskId(null); onRenameTask(item); }} />
                <TaskMenuItem icon={<Copy size={13} />} label="复制项目" onClick={() => { setMenuTaskId(null); onDuplicateTask(item); }} />
                <div className="my-1 h-px bg-[var(--app-line)]" />
                <TaskMenuItem danger icon={<Trash2 size={13} />} label="删除项目" onClick={() => { setMenuTaskId(null); onDeleteTask(item); }} />
              </div>
            ) : null}
          </div>
          );
        })}
        {!tasks.length ? <div className="px-2 py-3 text-[9px] text-[var(--app-text-4)]">暂无任务</div> : null}
      </div> : <div className="flex-1" />}
    </aside>
  );
}

function TaskMenuItem({
  icon,
  label,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-[4px] px-2.5 text-left text-[10px] hover:bg-[var(--app-surface-2)]",
        danger ? "text-[#ff6262]" : "text-[var(--app-text-2)] hover:text-[var(--app-text)]",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function NavButton({
  active,
  icon,
  children,
  onClick,
}: {
  active?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full h-8 px-2.5 rounded-[5px] flex items-center gap-2 text-[12px]",
        active
          ? "bg-[var(--app-surface-3)] text-[var(--app-text)]"
          : "text-[var(--app-text-2)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function HomeScreen({
  tasks,
  onOpenTask,
  onExtend,
  onCopy,
}: {
  tasks: WorkspaceTask[];
  onOpenTask: (task: WorkspaceTask) => void;
  onExtend: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="h-full overflow-y-auto px-8 py-7 xl:px-12">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex items-end justify-between">
          <h1 className="text-[24px] font-semibold tracking-[-0.03em]">选择任务</h1>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          <ModeCard
            title="新建延展项目"
            icon={<Sparkles size={18} />}
            action="新建项目"
            onClick={onExtend}
          />
          <ModeCard
            title="批量修改文案"
            icon={<FileText size={18} />}
            action="开始修改"
            onClick={onCopy}
            secondary
          />
        </div>

        <div className="mt-10 flex items-center justify-between border-b border-[var(--app-line)] pb-3">
          <h2 className="text-[13px] font-medium">最近任务</h2>
          <button className="text-[11px] text-[var(--app-text-3)] hover:text-[var(--app-text)]">查看全部</button>
        </div>
        <div className="divide-y divide-[var(--app-line-soft)]">
          {tasks.map((item, index) => (
            <button key={item.id} onClick={() => onOpenTask(item)} className="w-full grid grid-cols-[1.5fr_1fr_90px] gap-4 py-3 text-left hover:bg-[var(--app-surface-2)] px-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 rounded-[4px] bg-[var(--app-surface-3)] grid place-items-center text-[10px] text-[var(--app-text-3)]">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <span className="truncate text-[12px] font-medium">{item.name}</span>
              </div>
              <span className="self-center text-[11px] text-[var(--app-text-3)]">{taskMeta(item)}</span>
              <span className="self-center text-right text-[10px] text-[var(--app-text-4)]">{taskTime(item.updatedAt)}</span>
            </button>
          ))}
          {!tasks.length ? <div className="py-8 text-center text-[11px] text-[var(--app-text-4)]">暂无任务</div> : null}
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  title,
  action,
  icon,
  onClick,
  secondary,
}: {
  title: string;
  action: string;
  icon: React.ReactNode;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <section className="group min-h-[178px] border border-[var(--app-line)] bg-[var(--app-surface)] rounded-[7px] p-6 flex flex-col hover:border-[var(--app-line-strong)]">
      <div className="size-9 rounded-[6px] border border-[var(--app-line)] bg-[var(--app-surface-2)] grid place-items-center text-[var(--app-text-2)]">
        {icon}
      </div>
      <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.02em]">{title}</h2>
      <div className="mt-auto pt-4">
        <Button variant={secondary ? "secondary" : "primary"} size="md" onClick={onClick}>
          {action}
        </Button>
      </div>
    </section>
  );
}

function Workspace({
  title,
  steps,
  step,
  onStep,
  onBack,
  children,
}: {
  title: string;
  steps: readonly string[];
  step: number;
  onStep: (value: number) => void;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="h-16 shrink-0 border-b border-[var(--app-line)] px-5 flex items-center">
        <button onClick={onBack} className="mr-3 grid size-7 place-items-center rounded-[5px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">
          <ArrowLeft size={14} />
        </button>
        <span className="w-[170px] truncate text-[13px] font-medium">{title}</span>
        <div className="flex flex-1 justify-center">
          <ol className="flex items-center gap-2">
            {steps.map((name, index) => (
              <li key={name} className="flex items-center">
                {index > 0 ? <span className="mx-2 h-px w-8 bg-[var(--app-line-strong)]" /> : null}
                <button
                  onClick={() => onStep(index)}
                  className={cn(
                    "h-10 rounded-[6px] px-4 flex items-center gap-2 whitespace-nowrap text-[13px]",
                    index === step
                      ? "bg-[var(--app-surface-3)] text-[var(--app-text)] shadow-[inset_0_0_0_1px_var(--app-line-strong)]"
                      : "text-[var(--app-text-3)] hover:text-[var(--app-text-2)]",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 place-items-center rounded-full text-[10px]",
                      index < step || index === step
                        ? "bg-[var(--color-brand)] text-white"
                        : "bg-[var(--app-surface-3)]",
                    )}
                  >
                    {index < step ? <Check size={12} /> : index + 1}
                  </span>
                  {name}
                </button>
              </li>
            ))}
          </ol>
        </div>
        <div className="w-[170px]" />
      </div>
      <motion.div
        key={`${title}-${step}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.12 }}
        className="relative min-h-0 flex-1 p-3"
      >
        {children}
      </motion.div>
    </div>
  );
}

function RecognizeMaster({ onNext }: { onNext: () => void }) {
  const {
    project,
    updateContent,
    updateCopy,
    bindSourceFrame,
    masterSources: sources,
    setMasterSources: setSources,
    activeMasterLang: activeLang,
    setActiveMasterLang: setActiveLang,
  } = useStudio();
  const [guideKind, setGuideKind] = useState<"visual" | "master" | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [queuedRecognitionKeys, setQueuedRecognitionKeys] = useState<string[]>([]);
  const recognitionQueueRef = useRef<Promise<void>>(Promise.resolve());
  const cancelledRecognitionKeysRef = useRef(new Set<string>());
  const recognitionAbortRef = useRef<Record<string, AbortController>>({});
  const recognizeRequestRef = useRef<Partial<Record<Lang, number>>>({});
  const visualRequestRef = useRef<Partial<Record<Lang, number>>>({});
  const source = sources[activeLang] ?? emptyMasterRecognitionSource();
  const visualComponent = source.visualComponent ?? emptyMasterRecognitionSource().visualComponent;
  const visualComponentId = visualComponent.result?.frame.componentId ?? visualComponent.result?.frame.id;
  const explicitlyBoundVisualLayer = source.result?.layers.find((layer) =>
    Boolean(visualComponentId) && (
      layer.componentId === visualComponentId
      || (layer.nodeType === "COMPONENT" && layer.id === visualComponentId)
      || layer.id === visualComponent.result?.frame.id
    ),
  );
  const visualInstanceLayer = explicitlyBoundVisualLayer ?? source.result?.layers.find((layer) =>
    layer.role === "kv"
    || layer.suggestedRole === "kv"
    || (
      (layer.nodeType === "INSTANCE" || layer.nodeType === "COMPONENT")
      && /主视觉|key\s*visual|(^|[\s_-])kv($|[\s_-])/i.test(layer.name)
    ),
  );

  const patchSource = (lang: Lang, patch: Partial<MasterRecognitionSource>) => {
    setSources((current) => ({
      ...current,
      [lang]: { ...(current[lang] ?? emptyMasterRecognitionSource()), ...patch },
    }));
  };

  const enqueueRecognition = (key: string, task: () => Promise<void>) => {
    if (queuedRecognitionKeys.includes(key)) return;
    setQueuedRecognitionKeys((current) => [...current, key]);
    const run = async () => {
      setQueuedRecognitionKeys((current) => current.filter((item) => item !== key));
      if (cancelledRecognitionKeysRef.current.delete(key)) return;
      await task();
    };
    recognitionQueueRef.current = recognitionQueueRef.current.then(run, run);
  };

  const runRecognize = async () => {
    if (source.busy || !source.url.trim()) return;
    const requestLang = activeLang;
    const requestId = (recognizeRequestRef.current[requestLang] ?? 0) + 1;
    recognizeRequestRef.current[requestLang] = requestId;
    const requestKey = `${requestLang}:master`;
    const controller = new AbortController();
    recognitionAbortRef.current[requestKey] = controller;
    const timeout = window.setTimeout(() => controller.abort("识别超时"), 90_000);
    patchSource(activeLang, { busy: true, error: null, confirmed: false, result: null });
    setSelectedLayerId(null);
    try {
      const response = await fetch("/api/figma/recognize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          url: source.url,
          token: window.sessionStorage.getItem("futu:figma-token") ?? undefined,
        }),
      });
      const data = (await response.json()) as FigmaRecognitionResult | { error: string };
      if (requestId !== recognizeRequestRef.current[requestLang]) return;
      if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "识别失败");
      patchSource(activeLang, {
        result: data,
        busy: false,
        confirmed: false,
        backgroundColor: colorToHex(data.frame.backgroundColor),
        backgroundColorConfirmed: false,
      });
    } catch (cause) {
      if (requestId !== recognizeRequestRef.current[requestLang]) return;
      patchSource(activeLang, {
        result: null,
        busy: false,
        error: controller.signal.aborted ? "母版画板识别超时，请重试" : cause instanceof Error ? cause.message : "识别失败",
      });
    } finally {
      window.clearTimeout(timeout);
      delete recognitionAbortRef.current[requestKey];
    }
  };

  const runRecognizeVisualComponent = async () => {
    if (visualComponent.busy || !visualComponent.url.trim()) return;
    const requestLang = activeLang;
    const requestId = (visualRequestRef.current[requestLang] ?? 0) + 1;
    visualRequestRef.current[requestLang] = requestId;
    const requestKey = `${requestLang}:visual`;
    const controller = new AbortController();
    recognitionAbortRef.current[requestKey] = controller;
    const timeout = window.setTimeout(() => controller.abort("识别超时"), 90_000);
    patchSource(activeLang, {
      confirmed: false,
      visualComponent: { ...visualComponent, busy: true, error: null, result: null },
    });
    try {
      const response = await fetch("/api/figma/recognize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          url: visualComponent.url,
          target: "visual-component",
          token: window.sessionStorage.getItem("futu:figma-token") ?? undefined,
        }),
      });
      const data = (await response.json()) as FigmaRecognitionResult | { error: string };
      if (requestId !== visualRequestRef.current[requestLang]) return;
      if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "识别失败");
      patchSource(requestLang, {
        visualComponent: { ...visualComponent, result: data, busy: false, error: null },
      });
      if (source.url.trim() && !source.busy && !masterQueued) {
        enqueueRecognition(masterQueueKey, runRecognize);
      }
    } catch (cause) {
      if (requestId !== visualRequestRef.current[requestLang]) return;
      patchSource(requestLang, {
        visualComponent: {
          ...visualComponent,
          result: null,
          busy: false,
          error: controller.signal.aborted ? "主视觉组件识别超时，请重试" : cause instanceof Error ? cause.message : "识别失败",
        },
      });
    } finally {
      window.clearTimeout(timeout);
      delete recognitionAbortRef.current[requestKey];
    }
  };

  const masterQueueKey = `${activeLang}:master`;
  const visualQueueKey = `${activeLang}:visual`;
  const masterQueued = queuedRecognitionKeys.includes(masterQueueKey);
  const visualQueued = queuedRecognitionKeys.includes(visualQueueKey);
  const recognize = () => enqueueRecognition(masterQueueKey, runRecognize);
  const recognizeVisualComponent = () => enqueueRecognition(visualQueueKey, runRecognizeVisualComponent);
  const cancelRecognition = (kind: "master" | "visual") => {
    const key = `${activeLang}:${kind}`;
    const runningController = recognitionAbortRef.current[key];
    if (runningController) runningController.abort();
    else cancelledRecognitionKeysRef.current.add(key);
    setQueuedRecognitionKeys((current) => current.filter((item) => item !== key));
    if (kind === "master") {
      recognizeRequestRef.current[activeLang] = (recognizeRequestRef.current[activeLang] ?? 0) + 1;
      patchSource(activeLang, { busy: false, error: null, confirmed: false });
      return;
    }
    visualRequestRef.current[activeLang] = (visualRequestRef.current[activeLang] ?? 0) + 1;
    patchSource(activeLang, {
      confirmed: false,
      visualComponent: { ...visualComponent, busy: false, error: null },
    });
  };

  const mappedRoles = new Set(source.result?.layers.filter((layer) => layer.role !== "skip").map((layer) => layer.role));
  const hasTitle = mappedRoles.has("title") || mappedRoles.has("titleGroup");
  const canConfirm = Boolean(
    source.result
    && !source.busy
    && hasTitle
    && (visualComponent.result || visualInstanceLayer)
    && !visualComponent.busy,
  );

  const confirmMapping = () => {
    const result = source.result;
    const visualResult = visualComponent.result;
    if (!result || (!visualResult && !visualInstanceLayer)) return;
    const layer = (role: LayerRole) => result.layers.find((item) => item.role === role);
    const title = layer("title");
    const sub = layer("sub");
    const supplement = layer("supplement");
    const titleGroup = layer("titleGroup");
    const cta = layer("cta");
    const disc = layer("disc");
    const badge = layer("badge");
    const logo = layer("logo");
    const qrcode = layer("qrcode");
    const groupParts = titleGroupParts(titleGroup);
    const titleSource = title ?? groupParts.title ?? titleGroup;
    const subSource = sub ?? groupParts.sub;
    const titleText = recognizedText(titleSource, activeLang);
    const titleBreaks = recognizedBreaks(titleSource, activeLang);
    const subText = recognizedText(subSource, activeLang);
    const supplementText = recognizedText(supplement, activeLang);
    const masterTitleStack = titleSource?.bounds && subSource?.bounds && subSource.bounds.y < titleSource.bounds.y
      ? "sub-first"
      : "title-first";
    const sourceFrameKey = `${result.fileKey ?? "legacy"}:${result.frame.id}`;
    const recommendedPresets = corpusPresetsForRecognition(result, activeLang, sourceFrameKey);
    const autoPreset = recommendedPresets[0];
    const storedRecommendedPresets = recommendedPresets.map((preset, index) =>
      index === 0 ? { ...preset, applicationState: "applied" as const } : preset);
    const retainedPresets = (project.content.copyLayoutPresets?.[activeLang] ?? [])
      .filter((preset) => !preset.id.startsWith("corpus:"));
    const nextAdjustments = { ...project.content.copyLayoutAdjustments };
    const nextAssignments = { ...project.content.copyLayoutAssignments };
    delete nextAdjustments[activeLang];
    delete nextAssignments[activeLang];
    if (autoPreset && result.frame.width === 1080 && result.frame.height === 225) {
      nextAssignments[activeLang] = {
        [sizeKey(result.frame.width, result.frame.height)]: autoPreset.id,
      };
    }

    updateCopy(activeLang, {
      ...(titleText ? { title: titleText, titleBreaks, titleStack: masterTitleStack } : {}),
      sub: subText,
      supplement: supplementText,
      ctaLong: cta ? recognizedText(cta, activeLang) : "",
      ctaShort: cta ? recognizedText(cta, activeLang).replace(/\s*[→›>]\s*$/, "") : "",
      disclaimer: disc ? [recognizedText(disc, activeLang, true)] : [],
      badge: badge ? recognizedText(badge, activeLang) : "",
    });
    updateContent({
      masterLayoutFingerprints: {
        ...project.content.masterLayoutFingerprints,
        [activeLang]: buildMasterLayoutFingerprint(result, activeLang),
      },
      masterTextStyles: {
        ...project.content.masterTextStyles,
        [activeLang]: {
          title: frozenTypography(titleSource, result.frame.height),
          sub: frozenTypography(subSource, result.frame.height),
          cta: frozenTypography(cta, result.frame.height),
          disc: frozenTypography(disc, result.frame.height),
        },
      },
      corpusVersion: recommendedPresets[0]?.corpusVersion ?? project.content.corpusVersion,
      copyLayoutAdjustments: nextAdjustments,
      copyLayoutSelections: {
        ...project.content.copyLayoutSelections,
        [activeLang]: autoPreset?.id ?? "master",
      },
      copyLayoutAssignments: nextAssignments,
      copyLayoutPresets: {
        ...project.content.copyLayoutPresets,
        [activeLang]: [...storedRecommendedPresets, ...retainedPresets],
      },
      ...(cta ? {
        ctaStyles: {
          ...project.content.ctaStyles,
          [activeLang]: {
            presetId: CTA_STYLE_PRESETS.find((preset) =>
              preset.backgroundColor.toLowerCase() === (cta.backgroundColor ?? "#ff6900").toLowerCase(),
            )?.id ?? "brand-orange",
            backgroundColor: cta.backgroundColor ?? "#ff6900",
            textColor: cta.textNodes[0]?.color ?? "#14100c",
          },
        },
      } : {}),
      ...(badge ? {
        badgeStyles: {
          ...project.content.badgeStyles,
          [activeLang]: {
            alignment: "left",
            backgroundColor: badge.backgroundColor ?? "#6a5a50",
            textColor: badge.textNodes[0]?.color ?? "#ffffff",
          },
        },
      } : {}),
    });
    bindSourceFrame(activeLang, {
      id: result.frame.id,
      name: result.frame.name,
      source: "figma",
      kind: "component",
      figmaUrl: source.url,
      previewUrl: result.previewUrl,
      backgroundColor: source.backgroundColor,
    });
    const logoPatch = logo
      ? withLangLogo(project.content, activeLang, {
          preset: "custom",
          logo: { id: logo.id, name: logo.name, source: "figma", kind: "component", figmaUrl: source.url },
        })
      : (() => {
          const { [activeLang]: _logo, ...logos } = project.content.logos ?? {};
          const { [activeLang]: _preset, ...logoPresets } = project.content.logoPresets ?? {};
          const { [activeLang]: _mode, ...logoSourceModes } = project.content.logoSourceModes ?? {};
          return { logos, logoPresets, logoSourceModes };
        })();
    const nextQrCodes = { ...project.content.qrCodes };
    if (qrcode) {
      nextQrCodes[activeLang] = { id: qrcode.id, name: qrcode.name, source: "figma", kind: "component", figmaUrl: source.url };
    } else {
      delete nextQrCodes[activeLang];
    }
    updateContent({
      ...logoPatch,
      ...(!logo ? { logo: undefined, logoPreset: undefined } : {}),
      kv: {
        id: visualResult?.frame.componentId ?? visualResult?.frame.id ?? visualInstanceLayer!.componentId ?? visualInstanceLayer!.id,
        name: visualResult?.frame.name ?? visualInstanceLayer!.name,
        source: "figma" as const,
        kind: "component" as const,
        figmaUrl: visualResult ? visualComponent.url : source.url,
        previewUrl: visualResult?.previewUrl ?? visualInstanceLayer!.previewUrl,
      },
      ...(qrcode ? {
        qrCode: project.content.qrCode ?? { id: qrcode.id, name: qrcode.name, source: "figma" as const, kind: "component" as const, figmaUrl: source.url },
      } : { qrCode: undefined }),
      qrCodes: nextQrCodes,
      customMappings: {
        ...project.content.customMappings,
        [activeLang]: result.layers
          .filter((item) => item.role === "custom" && item.id !== visualInstanceLayer?.id)
          .map((item) => ({ id: item.id, name: item.name, label: item.customRoleName?.trim() || "自定义", text: item.text })),
      },
    });

    const nextSources = {
      ...sources,
      [activeLang]: { ...source, confirmed: true },
    };
    setSources(nextSources);
    const nextPending = MASTER_LANGS.find((item) => nextSources[item.id] && !nextSources[item.id]?.confirmed);
    if (nextPending) {
      setActiveLang(nextPending.id);
      setSelectedLayerId(null);
    } else {
      onNext();
    }
  };

  const setLayerRole = (id: string, role: LayerRole) => {
    if (!source.result) return;
    patchSource(activeLang, {
      confirmed: false,
      result: {
        ...source.result,
        layers: source.result.layers.map((layer) => {
          if (layer.id === id) return { ...layer, role };
          if (role !== "skip" && role !== "custom" && layer.role === role) return { ...layer, role: "skip" };
          if (role === "titleGroup" && (layer.role === "title" || layer.role === "sub")) return { ...layer, role: "skip" };
          if ((role === "title" || role === "sub") && layer.role === "titleGroup") return { ...layer, role: "skip" };
          return layer;
        }),
      },
    });
  };

  const setCustomRoleName = (id: string, customRoleName: string) => {
    if (!source.result) return;
    patchSource(activeLang, {
      confirmed: false,
      result: {
        ...source.result,
        layers: source.result.layers.map((layer) => layer.id === id ? { ...layer, customRoleName } : layer),
      },
    });
  };

  const addLanguage = () => {
    const next = MASTER_LANGS.find((item) => !sources[item.id]);
    if (!next) return;
    setSources((current) => ({ ...current, [next.id]: emptyMasterRecognitionSource() }));
    setActiveLang(next.id);
    setSelectedLayerId(null);
  };

  const removeLanguage = (lang: Lang) => {
    const activeSources = MASTER_LANGS.filter((item) => sources[item.id]);
    if (activeSources.length <= 1) return;
    const next = { ...sources };
    delete next[lang];
    const { [lang]: _sourceFrame, ...sourceFrames } = project.content.sourceFrames ?? {};
    const { [lang]: _qrCode, ...qrCodes } = project.content.qrCodes ?? {};
    const { [lang]: _customMapping, ...customMappings } = project.content.customMappings ?? {};
    const { [lang]: _logo, ...logos } = project.content.logos ?? {};
    const { [lang]: _logoPreset, ...logoPresets } = project.content.logoPresets ?? {};
    const { [lang]: _logoSourceMode, ...logoSourceModes } = project.content.logoSourceModes ?? {};
    const { [lang]: _layoutAdjustment, ...copyLayoutAdjustments } = project.content.copyLayoutAdjustments ?? {};
    const { [lang]: _layoutPresets, ...copyLayoutPresets } = project.content.copyLayoutPresets ?? {};
    const { [lang]: _layoutSelection, ...copyLayoutSelections } = project.content.copyLayoutSelections ?? {};
    const { [lang]: _layoutAssignments, ...copyLayoutAssignments } = project.content.copyLayoutAssignments ?? {};
    const { [lang]: _ctaStyle, ...ctaStyles } = project.content.ctaStyles ?? {};
    const { [lang]: _breakChoices, ...titleBreakChoices } = project.content.titleBreakChoices ?? {};
    updateContent({
      langs: project.content.langs.filter((item) => item !== lang),
      sourceFrames,
      qrCodes,
      customMappings,
      logos,
      logoPresets,
      logoSourceModes,
      copyLayoutAdjustments,
      copyLayoutPresets,
      copyLayoutSelections,
      copyLayoutAssignments,
      ctaStyles,
      titleBreakChoices,
    });
    setSources(next);
    if (activeLang === lang) setActiveLang(activeSources.find((item) => item.id !== lang)!.id);
    setSelectedLayerId(null);
  };

  return (
    <>
      <div className="h-full min-h-0">
        <section className="min-h-0 p-1 flex flex-col">
          <div className="mb-3 flex items-center gap-1 pb-3">
            <span className="mr-2 text-[10px] text-[var(--app-text-4)]">母版语言</span>
            {MASTER_LANGS.filter((item) => sources[item.id]).map((item) => {
              const itemSource = sources[item.id]!;
              return (
                <div key={item.id} className={cn("flex h-7 items-center rounded-[4px]", activeLang === item.id ? "bg-[var(--app-surface-3)]" : "")}>
                  <button
                    onClick={() => {
                      setActiveLang(item.id);
                      setSelectedLayerId(null);
                    }}
                    className="flex h-full items-center gap-1.5 px-2.5 text-[10px]"
                  >
                    <span>{item.label}</span>
                    <span className={itemSource.confirmed ? "text-[var(--color-down)]" : itemSource.result ? "text-[var(--color-warn)]" : "text-[var(--app-text-4)]"}>
                      {itemSource.confirmed ? "已确认" : itemSource.result ? "待确认" : "待识别"}
                    </span>
                  </button>
                  {Object.keys(sources).length > 1 ? (
                    <button aria-label={`删除 ${item.label} 母版`} onClick={() => removeLanguage(item.id)} className="mr-1 grid size-5 place-items-center text-[var(--app-text-4)] hover:text-[var(--app-text)]">
                      <X size={11} />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {MASTER_LANGS.some((item) => !sources[item.id]) ? (
              <button onClick={addLanguage} className="h-7 rounded-[4px] px-2.5 text-[10px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">+ 添加语言</button>
            ) : null}
            <span className="ml-auto text-[9px] text-[var(--app-text-4)]">
              {Object.values(sources).filter((item) => item?.confirmed).length} / {Object.keys(sources).length}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex shrink-0 items-center gap-0.5">
                <h2 className="text-[10px] font-medium">母版画板链接</h2>
                <button
                  type="button"
                  aria-label="查看识别画板规则"
                  onClick={() => setGuideKind("master")}
                  className="grid size-4 place-items-center rounded-full text-[var(--app-text-3)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]"
                >
                  <Info size={11} />
                </button>
              </div>
              <label className="relative block min-w-0 flex-1">
                <Link2 size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-3)]" />
                <input
                  value={source.url}
                  onChange={(event) => {
                    if (source.busy || masterQueued) cancelRecognition("master");
                    recognizeRequestRef.current[activeLang] = (recognizeRequestRef.current[activeLang] ?? 0) + 1;
                    setSelectedLayerId(null);
                    patchSource(activeLang, { url: event.target.value, result: null, busy: false, error: null, confirmed: false });
                  }}
                  onKeyDown={(event) => event.key === "Enter" && !source.busy && recognize()}
                  placeholder={`粘贴 ${MASTER_LANGS.find((item) => item.id === activeLang)?.label} 母版链接`}
                  className="h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] pl-8 pr-2.5 text-[10px] outline-none focus:border-[var(--color-brand)]"
                />
              </label>
              <Button
                size="sm"
                disabled={!source.busy && !masterQueued && !source.url.trim()}
                onClick={() => source.busy || masterQueued ? cancelRecognition("master") : recognize()}
              >
                {masterQueued
                  ? "取消排队"
                  : source.busy
                    ? <><X size={12} />取消识别</>
                    : source.result ? "重新识别" : "识别画板"}
              </Button>
            </div>
            {source.result && visualInstanceLayer ? (
              <div className="flex items-center justify-between rounded-[4px] border border-[var(--color-ok)]/30 bg-[var(--color-ok)]/5 px-3 py-2 text-[10px]">
                <span>已从母版自动关联主视觉组件：{visualInstanceLayer.name}</span>
                <span className="text-[var(--app-text-4)]">无需重复粘贴组件链接</span>
              </div>
            ) : source.result ? (
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium">
                  主视觉组件链接（识别不到时补充）
                <button
                  type="button"
                  aria-label="查看主视觉组件要求"
                  onClick={() => setGuideKind("visual")}
                  className="grid size-4 place-items-center rounded-full text-[var(--app-text-3)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]"
                >
                  <Info size={11} />
                </button>
              </div>
              <label className="relative block min-w-0 flex-1">
                <Link2 size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-3)]" />
                <input
                  value={visualComponent.url}
                  onChange={(event) => {
                    if (visualComponent.busy || visualQueued) cancelRecognition("visual");
                    visualRequestRef.current[activeLang] = (visualRequestRef.current[activeLang] ?? 0) + 1;
                    patchSource(activeLang, {
                      confirmed: false,
                      visualComponent: { ...visualComponent, url: event.target.value, result: null, busy: false, error: null },
                    });
                  }}
                  onKeyDown={(event) => event.key === "Enter" && !visualComponent.busy && recognizeVisualComponent()}
                  placeholder="粘贴主视觉 Component / Instance 链接"
                  className="h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] pl-8 pr-2.5 text-[10px] outline-none focus:border-[var(--color-brand)]"
                />
              </label>
              <Button size="sm" disabled={!visualComponent.busy && !visualQueued && !visualComponent.url.trim()} onClick={() => visualComponent.busy || visualQueued ? cancelRecognition("visual") : recognizeVisualComponent()}>
                {visualQueued ? "取消排队" : visualComponent.busy ? <><X size={12} />取消识别</> : visualComponent.result ? "重新识别" : "识别组件"}
              </Button>
              </div>
            ) : null}
          </div>
          {visualComponent.error || source.error ? (
            <div className="mt-1.5 flex justify-between gap-4 px-1 text-[9px] text-[var(--color-up)]">
              <span>{visualComponent.error}</span>
              <span>{source.error}</span>
            </div>
          ) : null}
          <div className={cn("mt-4 min-h-0 flex-1 grid gap-3", visualInstanceLayer ? "grid-cols-[minmax(280px,1fr)_minmax(360px,1.2fr)]" : "grid-cols-[minmax(180px,0.72fr)_minmax(280px,1.15fr)_minmax(360px,1.35fr)]")}>
            {!visualInstanceLayer ? <VisualComponentPreview result={visualComponent.result} busy={visualComponent.busy} queued={visualQueued} /> : null}
            <MasterBoard
              result={source.result}
              selectedId={selectedLayerId}
              onSelect={setSelectedLayerId}
              busy={source.busy}
              queued={masterQueued}
              visualLayerId={visualInstanceLayer?.id}
            />
            <LayerMappingTable
              result={source.result}
              selectedId={selectedLayerId}
              onSelect={setSelectedLayerId}
              onRoleChange={setLayerRole}
              onCustomRoleNameChange={setCustomRoleName}
              excludedLayerId={visualInstanceLayer?.id}
              backgroundColor={source.backgroundColor ?? colorToHex(source.result?.frame.backgroundColor)}
              onBackgroundColorChange={(backgroundColor) => patchSource(activeLang, { backgroundColor, backgroundColorConfirmed: true, confirmed: false })}
            />
          </div>
          <div className="mt-3 flex shrink-0 items-center justify-end gap-2">
            <Button size="lg" disabled>上一步</Button>
            <Button variant="workflow" size="lg" disabled={!canConfirm} onClick={confirmMapping}>确认映射</Button>
          </div>
        </section>
      </div>
      {guideKind ? <RecognitionGuide kind={guideKind} onClose={() => setGuideKind(null)} /> : null}
    </>
  );
}

type LayoutFamilyId = "landscape" | "square" | "portrait" | "special";

const LAYOUT_FAMILY_META: Record<LayoutFamilyId, { label: string; description: string }> = {
  landscape: { label: "横版族", description: "常规横向画幅，共用左文右图规则" },
  square: { label: "方版族", description: "接近方形的画幅，共用均衡布局" },
  portrait: { label: "竖版族", description: "常规竖向画幅，共用上下布局" },
  special: { label: "特殊比例", description: "超宽或超长画幅，建议单独检查" },
};

function layoutFamilyOf(target: TargetBoard): LayoutFamilyId {
  const ratio = target.w / target.h;
  if (ratio >= 2.6 || ratio <= 0.48) return "special";
  if (ratio > 1.18) return "landscape";
  if (ratio < 0.82) return "portrait";
  return "square";
}

function groupedTargets(targets: TargetBoard[]) {
  return (Object.keys(LAYOUT_FAMILY_META) as LayoutFamilyId[]).map((id) => {
    const items = targets.filter((target) => layoutFamilyOf(target) === id);
    const ideal = id === "landscape" ? 1.91 : id === "portrait" ? 9 / 16 : id === "square" ? 1 : 4;
    const representative = [...items].sort((a, b) => Math.abs(a.w / a.h - ideal) - Math.abs(b.w / b.h - ideal))[0];
    return { id, ...LAYOUT_FAMILY_META[id], items, representative };
  }).filter((family) => family.items.length);
}

function EditExtendFlow({ onNext }: { onNext: () => void }) {
  const { project, masterSources, setStep, setTargets, focusKey, setFocusKey } = useStudio();
  const [phase, setPhase] = useState<"select" | "group" | "edit">("select");
  const families = groupedTargets(project.targets);
  const activeFamily = families.find((family) => family.items.some((item) => item.key === focusKey)) ?? families[0];
  const phaseIndex = phase === "select" ? 0 : phase === "group" ? 1 : 2;
  const phases = ["选择画幅", "智能分组", "编辑代表画幅"];
  const mappingReady = Boolean(
    project.content.kv?.source === "figma"
    && project.content.langs.every((language) => {
      const source = masterSources[language];
      return source?.confirmed && source.result;
    }),
  );

  const openPhaseTab = (index: number) => {
    if (index === 0) setPhase("select");
    if (index === 1 && project.targets.length) setPhase("group");
    if (index === 2 && project.targets.length) setPhase("edit");
  };

  if (!mappingReady) {
    return (
      <div className="grid h-full place-items-center">
        <div className="max-w-[520px] text-center">
          <Layers3 size={28} className="mx-auto text-[var(--color-warn)]" />
          <div className="mt-3 text-[14px] font-semibold">第一步映射需要重新确认</div>
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--app-text-3)]">
            编辑与延展必须连接到已确认的母版图层和主视觉组件关系。当前数据不完整，为避免生成错误画幅，系统不会使用名称重新猜测。
          </p>
          <Button className="mt-4" variant="workflow" size="lg" onClick={() => setStep(0)}>返回识别画板</Button>
        </div>
      </div>
    );
  }

  if (phase === "edit") {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative mb-3 flex min-h-8 shrink-0 items-center justify-center">
          <div className="flex rounded-full bg-[var(--app-surface-2)] p-1 text-[10px]">
            {phases.map((label, index) => (
              <button
                key={label}
                type="button"
                disabled={index > 0 && !project.targets.length}
                onClick={() => openPhaseTab(index)}
                className={cn(
                  "h-7 rounded-full px-4 transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                  index === 2 ? "bg-[var(--app-page)] text-[var(--app-text)] shadow-sm" : "text-[var(--app-text-3)] hover:text-[var(--app-text)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3 flex shrink-0 items-center gap-2">
          <span className="text-[9px] text-[var(--app-text-4)]">布局族</span>
          {families.map((family) => (
            <button
              key={family.id}
              type="button"
              onClick={() => family.representative && setFocusKey(family.representative.key)}
              className={cn("h-7 rounded-[4px] px-3 text-[10px]", activeFamily?.id === family.id ? "bg-[var(--color-brand-soft)] text-[var(--app-text)]" : "text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)]")}
            >
              {family.label} · {family.items.length}
            </button>
          ))}
          <span className="ml-auto text-[9px] text-[var(--app-text-4)]">当前代表画幅 {activeFamily?.representative?.key}</span>
        </div>
        <div className="min-h-0 flex-1">
          <StepFrames embedded familyKeys={activeFamily?.items.map((item) => item.key)} familyLabel={activeFamily?.label} />
        </div>
        <div className="mt-3 flex shrink-0 items-center justify-between">
          <div className="text-[10px] text-[var(--app-text-4)]">
            {families.length} 个布局族 · {project.targets.length} 个画幅 · 主视觉保持原始比例，背景继承第一步确认色
          </div>
          <div className="flex gap-2">
            <Button size="lg" onClick={() => setPhase("group")}>上一步</Button>
            <Button variant="workflow" size="lg" icon={<WorkflowSparkle />} onClick={onNext}>预览并写入</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto mb-4 flex shrink-0 rounded-full bg-[var(--app-surface-2)] p-1 text-[10px]">
        {phases.map((label, index) => (
          <button
            key={label}
            type="button"
            disabled={index > 0 && !project.targets.length}
            onClick={() => openPhaseTab(index)}
            className={cn(
              "h-7 rounded-full px-4 transition-colors disabled:cursor-not-allowed disabled:opacity-35",
              index === phaseIndex ? "bg-[var(--app-page)] text-[var(--app-text)] shadow-sm" : "text-[var(--app-text-3)] hover:text-[var(--app-text)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {phase === "select" ? (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_250px] gap-3">
          <SizePicker />
          <aside className="flex min-h-0 flex-col border-l border-[var(--app-line)] pl-4">
            <div className="text-[11px] font-semibold">本次延展</div>
            <div className="mt-1 text-[9px] text-[var(--app-text-4)]">已选择 {project.targets.length} 个画幅</div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
              {families.map((family) => (
                <div key={family.id} className="mb-3">
                  <div className="flex justify-between text-[10px]"><span>{family.label}</span><span className="text-[var(--app-text-4)]">{family.items.length}</span></div>
                  <div className="mt-1 text-[9px] text-[var(--app-text-4)]">{family.items.map((item) => item.key).join("、")}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-4">
          <section className="min-h-0 overflow-y-auto">
            <div className="mb-3">
              <div className="text-[12px] font-semibold">系统已生成 {families.length} 个布局族</div>
              <div className="mt-1 text-[9px] text-[var(--app-text-4)]">调整代表画幅后，同组尺寸会按锚点、占比和安全区规则同步。</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {families.map((family) => (
                <button
                  key={family.id}
                  type="button"
                  onClick={() => family.representative && setFocusKey(family.representative.key)}
                  className="rounded-[6px] border border-[var(--app-line)] p-4 text-left hover:border-[var(--app-line-strong)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">{family.label}</span>
                    <span className="text-[9px] text-[var(--color-down)]">同步 {family.items.length} 个尺寸</span>
                  </div>
                  <div className="mt-2 text-[9px] text-[var(--app-text-4)]">{family.description}</div>
                  <div className="mt-4 flex items-end gap-3">
                    <span className="grid h-20 w-28 place-items-center bg-[var(--app-surface-2)]">
                      {family.representative ? <span className="max-h-16 max-w-24 bg-[var(--app-surface-3)]" style={{ aspectRatio: `${family.representative.w}/${family.representative.h}`, width: family.representative.w >= family.representative.h ? 86 : undefined, height: family.representative.h > family.representative.w ? 62 : undefined }} /> : null}
                    </span>
                    <span>
                      <span className="block text-[10px] text-[var(--app-text-3)]">代表画幅</span>
                      <span className="mt-1 block text-[13px] font-semibold tabular-nums">{family.representative?.key}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <aside className="border-l border-[var(--app-line)] pl-4">
            <div className="text-[11px] font-semibold">自动排版规则</div>
            <div className="mt-3 space-y-3 text-[9px] leading-relaxed text-[var(--app-text-3)]">
              <p>主视觉锁定原始比例，默认完整显示，不拉伸、不裁切。</p>
              <p>横版优先左文右图，竖版优先上下布局，方版保持均衡。</p>
              <p>背景画板继承第一步确认色，填充主视觉暗角之外的区域。</p>
              <p>标题、CTA、Logo 与角标使用相对锚点同步，不复制绝对坐标。</p>
              <p>超宽和超长尺寸进入特殊比例族，并在最终检查中重点提示。</p>
            </div>
          </aside>
        </div>
      )}

      <div className="mt-3 flex shrink-0 justify-end gap-2">
        <Button size="lg" onClick={() => phase === "select" ? setStep(0) : setPhase("select")}>上一步</Button>
        <Button variant="workflow" size="lg" disabled={!project.targets.length} onClick={() => setPhase(phase === "select" ? "group" : "edit")}>
          {phase === "select" ? "智能分组并继续" : "编辑代表画幅"}
        </Button>
      </div>
    </div>
  );
}

function SceneTargetsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { project } = useStudio();
  const families = sceneFamilies(project.targets);
  const linkedCount = project.targets.filter((target) => linkedOf(target)).length;
  const nativeCount = project.targets.filter((target) => nativeOf(target)).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_250px] gap-3">
        <SizePicker />
        <aside className="flex min-h-0 flex-col border-l border-[var(--app-line)] pl-4">
          <div className="text-[11px] font-semibold">本次延展</div>
          <div className="mt-1 text-[9px] text-[var(--app-text-4)]">已选择 {project.targets.length} 个画幅</div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
            {families.map((group) => (
              <div key={group.family} className="mb-3">
                <div className="flex justify-between text-[10px]">
                  <span>{SCENE_FAMILY_LABEL[group.family]}</span>
                  <span className="text-[var(--app-text-4)]">{group.items.length}</span>
                </div>
                <div className="mt-1 text-[9px] text-[var(--app-text-4)]">代表画幅 {group.representative.w}×{group.representative.h}</div>
                <div className="mt-0.5 text-[9px] leading-relaxed text-[var(--app-text-4)]">{group.items.map((item) => `${item.use ?? ""} ${item.w}×${item.h}`.trim()).join("、")}</div>
              </div>
            ))}
            {linkedCount ? (
              <div className="mb-3">
                <div className="flex justify-between text-[10px]">
                  <span>闪屏联动</span>
                  <span className="text-[var(--app-text-4)]">{linkedCount}</span>
                </div>
                <div className="mt-1 text-[9px] text-[var(--app-text-4)]">跟随 2000×2400 母版自动适配</div>
              </div>
            ) : null}
            {nativeCount ? (
              <div className="mb-3">
                <div className="flex justify-between text-[10px]">
                  <span>仿原生</span>
                  <span className="text-[var(--app-text-4)]">{nativeCount}</span>
                </div>
                <div className="mt-1 text-[9px] text-[var(--app-text-4)]">固定模板 1080×225，深浅两版</div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
      <div className="mt-3 flex shrink-0 justify-end gap-2">
        <Button size="lg" onClick={onBack}>上一步</Button>
        <Button variant="workflow" size="lg" disabled={!project.targets.length} onClick={onNext}>下一步：配置内容与样式</Button>
      </div>
    </div>
  );
}

function RecognitionGuide({ kind, onClose }: { kind: "visual" | "master"; onClose: () => void }) {
  const visual = kind === "visual";
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/65 p-6">
      <section role="dialog" aria-modal="true" aria-label={visual ? "主视觉组件要求" : "识别画板规则"} className="w-full max-w-[760px] rounded-[9px] border border-[var(--app-line-strong)] bg-[var(--app-surface)] shadow-[0_24px_80px_rgb(0_0_0/0.55)]">
        <header className="flex items-center justify-between border-b border-[var(--app-line)] px-5 py-4">
          <div>
            <div className="text-[15px] font-semibold">{visual ? "主视觉组件要求" : "识别画板规则"}</div>
            <div className="mt-1 text-[11px] text-[var(--app-text-3)]">
              {visual ? "主视觉将以 Figma 组件实例写入延展画板" : "选择一个已完成的设计模板画板"}
            </div>
          </div>
          <button type="button" aria-label="关闭提示" onClick={onClose} className="grid size-7 place-items-center rounded-[5px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]">
            <X size={15} />
          </button>
        </header>
        {visual ? (
          <div className="grid grid-cols-3 gap-3 p-5">
            {[
              ["01", "准备组件", "在 Figma 中将完整主视觉制作为 Component，或选中它的 Instance。"],
              ["02", "复制链接", "右键目标 Component / Instance，选择 Copy link to selection。"],
              ["03", "保持关联", "平台生成时创建组件实例；修改主组件后，生成画板可同步更新。"],
            ].map(([index, title, description]) => (
              <div key={index} className="rounded-[6px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-4">
                <span className="text-[9px] text-[var(--color-brand)]">{index}</span>
                <div className="mt-3 text-[12px] font-medium">{title}</div>
                <p className="mt-2 text-[10px] leading-5 text-[var(--app-text-3)]">{description}</p>
              </div>
            ))}
            <div className="col-span-3 rounded-[5px] bg-[var(--warn-soft)] px-3 py-2 text-[10px] text-[var(--warn-text)]">
              必需：链接须指向 Component 或 Instance；普通 Frame、Group 或图片无法保留组件同步关系。
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[1.15fr_0.85fr] gap-5 p-5">
            <div>
            <div className="text-[11px] font-medium">可识别画板示例</div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <GuideBoard good />
              <GuideBoard />
            </div>
          </div>
            <div>
            <div className="text-[11px] font-medium">模板要求</div>
            <ul className="mt-3 space-y-3 text-[11px] leading-5 text-[var(--app-text-2)]">
              <li><span className="mr-2 text-[var(--color-brand)]">01</span>选择单个完整广告画板</li>
              <li><span className="mr-2 text-[var(--color-brand)]">02</span>第一层按标题、CTA、Logo 等语义命名</li>
              <li><span className="mr-2 text-[var(--color-brand)]">03</span>另行粘贴主视觉 Component 或 Instance 链接</li>
              <li><span className="mr-2 text-[var(--color-brand)]">04</span>内部图层无需统一命名；隐藏图层不参与识别</li>
            </ul>
            </div>
          </div>
        )}
        <footer className="flex justify-end border-t border-[var(--app-line)] px-5 py-3">
          <Button size="sm" onClick={onClose}>知道了</Button>
        </footer>
      </section>
    </div>
  );
}

function GuideBoard({ good = false }: { good?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[5px] border border-[var(--app-line)] bg-[var(--app-bg)]">
      <div className="relative aspect-[1.55] bg-[#14161b] p-3">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_70%,#283248_0%,transparent_38%)]" />
        <span className="relative text-[7px] font-semibold">FUTU</span>
        <div className="relative mt-4 w-[55%] text-[13px] font-semibold leading-[0.95]">Grow cash.<br />Stay flexible.</div>
        <span className="absolute bottom-3 left-3 rounded-[2px] bg-white px-1.5 py-1 text-[6px] text-black">Explore</span>
        {good ? (
          <>
            <span className="absolute right-2 top-7 rounded-[2px] border border-[var(--color-brand)] px-1 text-[6px] text-[var(--color-brand)]">标题</span>
            <span className="absolute right-2 top-12 rounded-[2px] border border-[var(--color-brand)] px-1 text-[6px] text-[var(--color-brand)]">KV</span>
            <span className="absolute right-2 bottom-4 rounded-[2px] border border-[var(--color-brand)] px-1 text-[6px] text-[var(--color-brand)]">CTA</span>
          </>
        ) : (
          <span className="absolute inset-x-2 bottom-2 rounded-[3px] bg-black/60 p-1.5 text-center text-[7px] text-[var(--app-text-3)]">图层已合并，无法识别</span>
        )}
      </div>
      <div className="flex items-center justify-between px-2.5 py-2 text-[10px]">
        <span>{good ? "推荐" : "不推荐"}</span>
        <span className={good ? "text-[var(--color-down)]" : "text-[var(--color-warn)]"}>{good ? "可识别" : "已合并"}</span>
      </div>
    </div>
  );
}

function RecognitionProgress({ queued, label }: { queued: boolean; label: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (queued) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [queued]);

  if (queued) {
    return (
      <div className="text-center">
        <div className="mx-auto grid size-8 place-items-center rounded-full border border-[var(--app-line)] text-[var(--app-text-3)]">2</div>
        <div className="mt-2 text-[10px] text-[var(--app-text-2)]">{label}排队中</div>
        <div className="mt-1 text-[8px] text-[var(--app-text-4)]">前一个识别完成后自动开始</div>
      </div>
    );
  }
  return (
    <div className="text-center">
      <Loader2 size={24} className="mx-auto animate-spin text-[var(--color-brand)]" />
      <div className="mt-2 text-[10px] text-[var(--app-text-2)]">正在识别{label}</div>
      <div className="mt-1 text-[8px] tabular-nums text-[var(--app-text-4)]">正在读取 Figma 节点与预览 · {seconds} 秒</div>
    </div>
  );
}

function VisualComponentPreview({
  result,
  busy,
  queued,
}: {
  result: FigmaRecognitionResult | null;
  busy: boolean;
  queued: boolean;
}) {
  const pending = busy || queued;
  return (
    <div className="min-h-0 overflow-hidden rounded-[5px] border border-[var(--app-line)] bg-[#111317] flex flex-col">
      <div className="border-b border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-2 text-[9px]">
        <span className="text-[var(--app-text-3)]">主视觉组件</span>
      </div>
      <div className="min-h-0 flex-1 grid place-items-center p-4">
        {pending ? (
          <RecognitionProgress queued={queued} label="主视觉组件" />
        ) : result?.previewUrl ? (
          <div className="flex size-full min-h-0 flex-col items-center justify-center">
            <img src={result.previewUrl} alt={result.frame.name} className="max-h-[calc(100%-34px)] max-w-full object-contain" />
            <div className="mt-2 max-w-full truncate text-[9px] text-[var(--app-text-3)]">{result.frame.name}</div>
          </div>
        ) : (
          <div className="text-center">
            <Layers3 size={21} className="mx-auto text-[var(--app-text-4)]" />
            <div className="mt-2 text-[10px] text-[var(--app-text-4)]">识别后预览主视觉组件</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MasterBoard({
  result,
  selectedId,
  onSelect,
  busy,
  queued,
  visualLayerId,
}: {
  result: FigmaRecognitionResult | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  busy: boolean;
  queued: boolean;
  visualLayerId?: string;
}) {
  const pending = busy || queued;
  if (!result) {
    return (
      <div className="min-h-0 rounded-[5px] border border-[var(--app-line)] bg-[#111317] flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-2 text-[9px]">
          <span className="text-[var(--app-text-3)]">母版画板</span>
          <span className={pending ? "text-[var(--color-brand)]" : "text-[var(--color-warn)]"}>
            {queued ? "排队中" : busy ? "识别中" : "待识别"}
          </span>
        </div>
        <div className="min-h-0 flex-1 grid place-items-center">
          {pending ? <RecognitionProgress queued={queued} label="母版画板" /> : <div className="text-center">
            <Link2 size={20} className="mx-auto text-[var(--app-text-4)]" />
            <div className="mt-2 text-[10px] text-[var(--app-text-4)]">粘贴画板链接开始识别</div>
          </div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 overflow-hidden rounded-[5px] border border-[var(--app-line)] bg-[#111317] flex flex-col">
      <div className="flex items-center justify-between border-b border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-2 text-[9px]">
        <span className="text-[var(--app-text-3)]">母版画板</span>
        <span className="text-[var(--color-down)]">已识别</span>
      </div>
      <div className="min-h-0 flex-1 grid place-items-center p-2">
        <div className="relative max-h-full max-w-full" style={{ aspectRatio: `${result.frame.width} / ${result.frame.height}`, width: "100%" }}>
          {result.previewUrl ? <img src={result.previewUrl} alt={result.frame.name} className="absolute inset-0 size-full object-contain" /> : null}
          {result.layers.filter((layer) => layer.bounds).map((layer) => (
            <button
              key={layer.id}
              type="button"
              aria-label={`选择 ${layer.name}`}
              title={layer.name}
              onClick={() => onSelect(layer.id)}
              className={cn(
                "absolute border transition-colors",
                selectedId === layer.id
                  ? visualLayerId === layer.id
                    ? "z-10 border-[var(--color-brand)] bg-[rgb(255_105_0/0.06)]"
                    : "z-10 border-[var(--color-brand)] bg-[rgb(255_105_0/0.08)]"
                  : layer.role === "skip"
                    ? "border-transparent hover:border-[var(--app-line-strong)]"
                    : "border-transparent hover:border-[var(--color-brand-line)]",
              )}
              style={{
                left: `${layer.bounds!.x * 100}%`,
                top: `${layer.bounds!.y * 100}%`,
                width: `${layer.bounds!.w * 100}%`,
                height: `${layer.bounds!.h * 100}%`,
              }}
            />
          ))}
          <div className="absolute bottom-2 left-2 rounded-[3px] bg-black/70 px-2 py-1 text-[8px] text-white/65">
            {result.frame.width} × {result.frame.height}
          </div>
        </div>
      </div>
      <div className="flex h-[61px] shrink-0 items-center justify-end px-3">
        {visualLayerId && selectedId === visualLayerId ? (
          <div className="text-[11px] text-[var(--color-down)]">
            已关联主视觉组件实例
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LayerMappingTable({
  result,
  selectedId,
  onSelect,
  onRoleChange,
  onCustomRoleNameChange,
  excludedLayerId,
  backgroundColor,
  onBackgroundColorChange,
}: {
  result: FigmaRecognitionResult | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRoleChange: (id: string, role: LayerRole) => void;
  onCustomRoleNameChange: (id: string, value: string) => void;
  excludedLayerId?: string;
  backgroundColor: string;
  onBackgroundColorChange: (value: string) => void;
}) {
  const selectedLayer = result?.layers.find((layer) => layer.id === selectedId && layer.id !== excludedLayerId);
  const visibleLayers = result?.layers.filter((layer) => layer.id !== excludedLayerId) ?? [];
  // “自定义识别”是用户追加的映射，始终放在已识别图层之后，
  // 避免看起来像是替换了原列表中的某一行。
  const orderedLayers = [
    ...visibleLayers.filter((layer) => layer.role !== "custom"),
    ...visibleLayers.filter((layer) => layer.role === "custom"),
  ];
  return (
    <div className="min-h-0 overflow-hidden rounded-[5px] border border-[var(--app-line)] bg-[#0b0c0e] flex flex-col">
      <div className="grid grid-cols-[minmax(0,1fr)_160px_minmax(0,1.1fr)_24px] gap-3 border-b border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-2 text-[9px] text-[var(--app-text-3)]">
        <span>图层</span>
        <span>识别为</span>
        <span>依据</span>
        <span />
      </div>
      <div className="mapping-scrollbar min-h-0 flex-1 overflow-y-scroll overscroll-contain">
        {orderedLayers.map((layer) => (
          <div
            key={layer.id}
            onClick={() => onSelect(layer.id)}
            className={cn(
              "grid cursor-pointer grid-cols-[minmax(0,1fr)_160px_minmax(0,1.1fr)_24px] items-center gap-3 border-b border-[var(--app-line-soft)] px-3 py-2.5 text-[10px]",
              selectedId === layer.id ? "bg-[var(--app-surface-3)]" : "hover:bg-[var(--app-surface-2)]",
              layer.role === "skip" && "opacity-50",
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-[var(--app-text)]">{layer.text}</div>
              <div className="mt-0.5 truncate text-[8px] text-[var(--app-text-4)]">{layer.name}</div>
            </div>
            {layer.role === "skip" ? (
              <span className="text-[var(--app-text-4)]">已排除</span>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <select
                  aria-label={`${layer.name} 识别角色`}
                  value={layer.role}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onRoleChange(layer.id, event.target.value as LayerRole)}
                  className="h-7 min-w-0 flex-1 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2 text-[10px] outline-none focus:border-[var(--app-line)]"
                >
                  {ROLE_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                <span className="shrink-0 text-[9px] text-[var(--color-down)]">已映射</span>
              </div>
            )}
            {layer.role === "custom" ? (
              <input
                value={layer.customRoleName ?? ""}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onCustomRoleNameChange(layer.id, event.target.value)}
                placeholder="输入自定义名称"
                className="h-7 min-w-0 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2 text-[10px] outline-none focus:border-[var(--app-line)]"
              />
            ) : (
              <span className="line-clamp-2 text-[var(--app-text-3)]">{layer.reason}</span>
            )}
            {layer.role !== "skip" || layer.suggestedRole !== "skip" ? (
              <button
                type="button"
                aria-label={layer.role === "skip" ? `恢复 ${layer.name}` : `排除 ${layer.name}`}
                title={layer.role === "skip" ? "恢复" : "排除"}
                onClick={(event) => {
                  event.stopPropagation();
                  onRoleChange(layer.id, layer.role === "skip" ? layer.suggestedRole : "skip");
                }}
                className="grid size-6 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
              >
                {layer.role === "skip" ? "↶" : <X size={12} />}
              </button>
            ) : <span />}
          </div>
        ))}
        {result ? (
          <div className="sticky bottom-0 bg-[#0b0c0e]/95 px-3 py-2 backdrop-blur">
            <div className="flex items-center">
              <button
                type="button"
                disabled={!selectedLayer}
                onClick={() => selectedLayer && onRoleChange(selectedLayer.id, "custom")}
                className="text-[10px] text-[var(--app-text-3)] transition-colors hover:text-[var(--app-text-2)] disabled:cursor-not-allowed disabled:text-[var(--app-text-4)]"
              >
                {selectedLayer ? "＋ 将所选图层设为自定义识别" : "＋ 选择图层后添加自定义识别"}
              </button>
            </div>
            <div className="mt-2 flex items-center py-1">
              <span className="mr-auto text-[10px] text-[var(--app-text)]">背景色</span>
              <BackgroundColorControl value={backgroundColor} onChange={onBackgroundColorChange} />
            </div>
          </div>
        ) : null}
        {!result ? <div className="h-full grid place-items-center text-[10px] text-[var(--app-text-4)]">识别后确认图层角色</div> : null}
      </div>
    </div>
  );
}

type ContentObjectId = "title" | "sub" | "supplement" | "cta" | "disc" | "badge" | "logo" | "qrcode";
type ActionRelation = "right" | "left" | "below" | "above";

function ContentLayout({ onNext, embedded = false }: { onNext: () => void; embedded?: boolean }) {
  const { project, lang, setLang, setStep, updateCopy, updateContent, masterSources, setMasterSources } = useStudio();
  const confirmedLangs = useMemo<Lang[]>(
    () => MASTER_LANGS.filter((item) => masterSources[item.id]?.confirmed).map((item) => item.id),
    [masterSources],
  );
  const activeLang = confirmedLangs.includes(lang) ? lang : (confirmedLangs[0] ?? lang);
  const copy = project.content.copy[activeLang] ?? emptyLangCopy();
  const recognitionSource = masterSources[activeLang];
  const recognition = recognitionSource?.result;
  const needsRecognitionUpgrade = Boolean(recognition && recognition.schemaVersion !== 2);
  const mapped = (role: LayerRole) => recognition?.layers.find((layer) => layer.role === role);
  const mappedTitle = mapped("title");
  const mappedSub = mapped("sub");
  const mappedTitleGroup = mapped("titleGroup");
  const titleGroup = mappedTitle || mappedSub ? undefined : mappedTitleGroup;
  const groupParts = titleGroupParts(mappedTitleGroup);
  const effectiveTitle = mappedTitle ?? groupParts.title ?? titleGroup;
  const effectiveSub = mappedSub ?? groupParts.sub;
  const hasSub = Boolean(effectiveSub);
  const usesTitleGroup = Boolean(mappedTitleGroup || (effectiveTitle && effectiveSub));
  const hasSupplement = Boolean(mapped("supplement"));
  const hasCta = Boolean(mapped("cta"));
  const hasBadge = Boolean(mapped("badge"));
  const hasDisclaimer = Boolean(mapped("disc"));
  const hasQrCode = Boolean(mapped("qrcode"));
  const mappedLogoLayer = mapped("logo");
  const mappedLogo = mappedLogoLayer
    ? {
        id: mappedLogoLayer.id,
        name: mappedLogoLayer.name,
        source: "figma" as const,
        kind: "component" as const,
        figmaUrl: masterSources[activeLang]?.url,
        previewUrl: mappedLogoLayer.previewUrl,
      }
    : undefined;
  const logoMode: LogoSourceMode = mappedLogo
    ? (project.content.logoSourceModes?.[activeLang] ?? "master")
    : "replace";

  const objects = useMemo<Array<{ id: ContentObjectId; label: string }>>(() => [
    { id: "title", label: usesTitleGroup ? "标题组" : "主标题" },
    ...(hasSupplement ? [{ id: "supplement" as const, label: "补充标题" }] : []),
    ...(hasCta ? [{ id: "cta" as const, label: "CTA" }] : []),
    ...(hasDisclaimer ? [{ id: "disc" as const, label: "免责" }] : []),
    ...(hasBadge ? [{ id: "badge" as const, label: "角标" }] : []),
    ...(mappedLogo ? [{ id: "logo" as const, label: "Logo" }] : []),
    ...(hasQrCode ? [{ id: "qrcode" as const, label: "二维码" }] : []),
  ], [hasBadge, hasCta, hasDisclaimer, hasQrCode, hasSupplement, mappedLogo, usesTitleGroup]);
  const [selectedObject, setSelectedObject] = useState<ContentObjectId>("title");
  const unsupportedFonts = useMemo(() => Array.from(new Set(
    recognition?.layers.flatMap((layer) => layer.textNodes.map((node) => node.fontFamily).filter((family): family is string => Boolean(family))) ?? [],
  )).filter((family) => !isPlatformFont(family)), [recognition]);
  const sourceFrameKey = recognition ? `${recognition.fileKey ?? "legacy"}:${recognition.frame.id}` : undefined;
  const allPresets = useMemo(
    () => project.content.copyLayoutPresets?.[activeLang] ?? [],
    [activeLang, project.content.copyLayoutPresets],
  );
  const presets = useMemo(
    () => allPresets.filter((preset) => preset.sourceFrameId === sourceFrameKey),
    [allPresets, sourceFrameKey],
  );
  const corpusRecommendations = useMemo(
    () => recognition && sourceFrameKey
      ? corpusPresetsForRecognition(recognition, activeLang, sourceFrameKey)
      : [],
    [activeLang, recognition, sourceFrameKey],
  );
  const recommendationVersion = corpusRecommendations[0]?.corpusVersion;
  const hasCurrentCorpusRecommendations = presets.some((preset) =>
    preset.recipeId && preset.corpusVersion === recommendationVersion);
  useEffect(() => {
    if (!sourceFrameKey || hasCurrentCorpusRecommendations || corpusRecommendations.length === 0) return;
    const staleAssignments = Object.fromEntries(
      Object.entries(project.content.copyLayoutAssignments?.[activeLang] ?? {})
        .filter(([, presetId]) => !presetId.startsWith("corpus:")),
    );
    updateContent({
      ...(recognition ? {
        masterLayoutFingerprints: {
          ...project.content.masterLayoutFingerprints,
          [activeLang]: buildMasterLayoutFingerprint(recognition, activeLang),
        },
        masterTextStyles: {
          ...project.content.masterTextStyles,
          [activeLang]: {
            title: frozenTypography(effectiveTitle, recognition.frame.height),
            sub: frozenTypography(effectiveSub, recognition.frame.height),
            cta: frozenTypography(mapped("cta"), recognition.frame.height),
            disc: frozenTypography(mapped("disc"), recognition.frame.height),
          },
        },
      } : {}),
      corpusVersion: corpusRecommendations[0]?.corpusVersion ?? project.content.corpusVersion,
      copyLayoutPresets: {
        ...project.content.copyLayoutPresets,
        [activeLang]: [
          ...corpusRecommendations,
          ...allPresets.filter((preset) =>
            !preset.id.startsWith("corpus:") || preset.sourceFrameId !== sourceFrameKey),
        ],
      },
      copyLayoutSelections: {
        ...project.content.copyLayoutSelections,
        [activeLang]: "master",
      },
      copyLayoutAssignments: {
        ...project.content.copyLayoutAssignments,
        [activeLang]: staleAssignments,
      },
    });
  }, [
    activeLang,
    allPresets,
    corpusRecommendations,
    hasCurrentCorpusRecommendations,
    project.content.corpusVersion,
    project.content.copyLayoutAssignments,
    project.content.copyLayoutSelections,
    project.content.masterLayoutFingerprints,
    project.content.masterTextStyles,
    project.content.copyLayoutPresets,
    recognition,
    sourceFrameKey,
    updateContent,
  ]);
  const layoutSelection = project.content.copyLayoutSelections?.[activeLang] ?? "master";
  const selectedPresetId = layoutSelection !== "master" && layoutSelection !== "draft" ? layoutSelection : null;
  const isFollowingMaster = layoutSelection === "master";
  const [presetName, setPresetName] = useState("跟随母版");

  const setLayoutSelection = (value: "master" | "draft" | string) => {
    updateContent({
      copyLayoutSelections: {
        ...project.content.copyLayoutSelections,
        [activeLang]: value,
      },
    });
  };

  const enterDraft = () => {
    if (layoutSelection !== "draft") setLayoutSelection("draft");
  };

  const verticalGap = (
    first?: { x: number; y: number; w: number; h: number },
    second?: { x: number; y: number; w: number; h: number },
  ) => {
    if (!first || !second || !recognition?.frame.height) return undefined;
    const [upper, lower] = first.y <= second.y ? [first, second] : [second, first];
    return Math.max(0, Math.round((lower.y - upper.y - upper.h) * recognition.frame.height));
  };
  const titleBounds = effectiveTitle?.bounds ?? titleGroup?.bounds;
  const subBounds = effectiveSub?.bounds;
  const baselineTitleStack = titleBounds && subBounds && subBounds.y < titleBounds.y ? "sub-first" : "title-first";
  const baselineTitleGap = verticalGap(titleBounds, subBounds) ?? 12;
  const adjustments = project.content.copyLayoutAdjustments?.[activeLang];
  const titleGap = adjustments?.titleGap ?? baselineTitleGap;
  const mappedCta = mapped("cta");
  const mappedCtaColor = mappedCta?.backgroundColor ?? "#ff6900";
  const inferredCtaPreset = CTA_STYLE_PRESETS.find((preset) =>
    preset.backgroundColor.toLowerCase() === mappedCtaColor.toLowerCase(),
  ) ?? CTA_STYLE_PRESETS[1]!;
  const ctaStyle = project.content.ctaStyles?.[activeLang] ?? {
    presetId: inferredCtaPreset.id,
    backgroundColor: mappedCtaColor,
    backgroundImage: inferredCtaPreset.backgroundImage,
    textColor: mappedCta?.textNodes[0]?.color ?? inferredCtaPreset.defaultTextColor,
  };
  const badgeStyle = badgeStyleOf(project.content, activeLang);
  const lineCount = Math.max(1, copy.titleBreaks.length + 1);

  const setGap = (patch: { titleGap?: number }) => {
    updateContent({
      copyLayoutAdjustments: {
        ...project.content.copyLayoutAdjustments,
        [activeLang]: { ...adjustments, ...patch },
      },
      copyLayoutSelections: {
        ...project.content.copyLayoutSelections,
        [activeLang]: "draft",
      },
    });
  };

  const setCtaStyle = (patch: Partial<typeof ctaStyle>) => {
    updateContent({
      ctaStyles: {
        ...project.content.ctaStyles,
        [activeLang]: { ...ctaStyle, ...patch },
      },
    });
  };

  const setBadgeStyle = (patch: Partial<BadgeStyle>) => {
    updateContent({
      badgeStyles: {
        ...project.content.badgeStyles,
        [activeLang]: { ...badgeStyle, ...patch },
      },
    });
  };

  const setLogoMode = (mode: LogoSourceMode) => {
    updateContent({
      ...(mode === "master" && mappedLogo
        ? withLangLogo(project.content, activeLang, { preset: "custom", logo: mappedLogo })
        : {}),
      logoSourceModes: { ...project.content.logoSourceModes, [activeLang]: mode },
    });
  };

  const applyLineCount = (count: number) => {
    const tokens = tokenizeTitle(copy.title, activeLang);
    const breaks = Array.from({ length: Math.max(0, count - 1) }, (_, index) =>
      Math.round((tokens.length * (index + 1)) / count),
    ).filter((point, index, values) => point > 0 && point < tokens.length && values.indexOf(point) === index);
    updateCopy(activeLang, { titleBreaks: breaks });
    setLayoutSelection("draft");
    setPresetName(`${Math.max(1, breaks.length + 1)} 行方案`);
  };

  const applyPreset = (preset?: CopyLayoutPreset) => {
    if (!preset) {
      const nextAdjustments = { ...project.content.copyLayoutAdjustments };
      delete nextAdjustments[activeLang];
      const masterTitle = effectiveTitle;
      updateContent({
        copyLayoutAdjustments: nextAdjustments,
        copyLayoutSelections: {
          ...project.content.copyLayoutSelections,
          [activeLang]: "master",
        },
      });
      updateCopy(activeLang, {
        title: recognizedText(masterTitle, activeLang),
        titleBreaks: recognizedBreaks(masterTitle, activeLang),
        titleStack: baselineTitleStack,
        ...(effectiveSub ? { sub: recognizedText(effectiveSub, activeLang) } : {}),
        ...(mapped("supplement") ? { supplement: recognizedText(mapped("supplement"), activeLang) } : {}),
        ...(mapped("cta") ? {
          ctaLong: recognizedText(mapped("cta"), activeLang),
          ctaShort: recognizedText(mapped("cta"), activeLang).replace(/\s*[→›>]\s*$/, ""),
        } : {}),
        ...(mapped("disc") ? { disclaimer: [recognizedText(mapped("disc"), activeLang, true)] } : {}),
        ...(mapped("badge") ? { badge: recognizedText(mapped("badge"), activeLang) } : {}),
      });
      setPresetName("跟随母版");
      return;
    }
    updateCopy(activeLang, { titleBreaks: preset.titleBreaks, titleStack: preset.titleStack });
    updateContent({
      copyLayoutAdjustments: {
        ...project.content.copyLayoutAdjustments,
        [activeLang]: { titleGap: preset.titleGap },
      },
      copyLayoutSelections: {
        ...project.content.copyLayoutSelections,
        [activeLang]: preset.id,
      },
    });
    setPresetName(preset.name);
  };

  const recommendedPreset = presets
    .filter((preset) => preset.recipeId)
    .sort((left, right) => (right.recommendationScore ?? 0) - (left.recommendationScore ?? 0))[0];
  const applied1080PresetId = project.content.copyLayoutAssignments?.[activeLang]?.[sizeKey(1080, 225)];
  const applyTrainingPreset = (preset: CopyLayoutPreset) => {
    updateCopy(activeLang, { titleBreaks: preset.titleBreaks, titleStack: preset.titleStack });
    updateContent({
      copyLayoutAdjustments: {
        ...project.content.copyLayoutAdjustments,
        [activeLang]: { titleGap: preset.titleGap },
      },
      copyLayoutSelections: {
        ...project.content.copyLayoutSelections,
        [activeLang]: preset.id,
      },
      copyLayoutAssignments: {
        ...project.content.copyLayoutAssignments,
        [activeLang]: {
          ...(project.content.copyLayoutAssignments?.[activeLang] ?? {}),
          [sizeKey(1080, 225)]: preset.id,
        },
      },
      copyLayoutPresets: {
        ...project.content.copyLayoutPresets,
        [activeLang]: allPresets.map((item) => item.id === preset.id
          ? { ...item, applicationState: "applied" }
          : item.recipeId ? { ...item, applicationState: "recommended" } : item),
      },
    });
    setPresetName(preset.name);
  };

  const savePreset = (asNew = false) => {
    const name = presetName.trim() || `${lineCount} 行方案`;
    const existingPreset = !asNew && selectedPresetId
      ? presets.find((preset) => preset.id === selectedPresetId)
      : undefined;
    const current: CopyLayoutPreset = {
      ...existingPreset,
      id: !asNew && selectedPresetId ? selectedPresetId : `layout-${Date.now()}`,
      name,
      sourceFrameId: sourceFrameKey,
      titleBreaks: [...copy.titleBreaks],
      titleStack: titleStackOf(copy),
      titleGap,
      ...(existingPreset?.recipeId ? { applicationState: "modified" as const } : {}),
    };
    const next = !asNew && selectedPresetId
      ? presets.map((preset) => preset.id === selectedPresetId ? current : preset)
      : [...presets, current];
    updateContent({
      copyLayoutPresets: {
        ...project.content.copyLayoutPresets,
        [activeLang]: [
          ...allPresets.filter((preset) => preset.sourceFrameId !== sourceFrameKey),
          ...next,
        ],
      },
      copyLayoutSelections: {
        ...project.content.copyLayoutSelections,
        [activeLang]: current.id,
      },
    });
    setPresetName(current.name);
  };

  const deletePreset = (id: string) => {
    const assignments = { ...(project.content.copyLayoutAssignments?.[activeLang] ?? {}) };
    Object.entries(assignments).forEach(([targetKey, presetId]) => {
      if (presetId === id) delete assignments[targetKey];
    });
    updateContent({
      copyLayoutPresets: {
        ...project.content.copyLayoutPresets,
        [activeLang]: allPresets.filter((preset) => preset.id !== id),
      },
      copyLayoutAssignments: {
        ...project.content.copyLayoutAssignments,
        [activeLang]: assignments,
      },
    });
    if (selectedPresetId === id) {
      setLayoutSelection("draft");
      setPresetName("自定义方案");
    }
  };

  useEffect(() => {
    if (confirmedLangs.length && activeLang !== lang) setLang(activeLang);
  }, [activeLang, confirmedLangs, lang, setLang]);

  useEffect(() => {
    if (!objects.some((item) => item.id === selectedObject)) setSelectedObject(objects[0]?.id ?? "title");
  }, [objects, selectedObject]);

  useEffect(() => {
    if (layoutSelection === "master") {
      setPresetName((current) => current === "跟随母版" ? current : "跟随母版");
    }
    else if (layoutSelection === "draft") {
      setPresetName((current) => current === "跟随母版" ? `${lineCount} 行方案` : current);
    } else {
      const name = presets.find((preset) => preset.id === layoutSelection)?.name ?? "自定义方案";
      setPresetName((current) => current === name ? current : name);
    }
  }, [activeLang, layoutSelection, lineCount, presets]);

  useEffect(() => {
    if (
      !needsRecognitionUpgrade
      || recognitionSource?.busy
      || !recognitionSource?.url
      || recognitionSource.error?.startsWith("升级预览失败")
      || !recognition
    ) return;
    const token = window.sessionStorage.getItem("futu:figma-token");
    if (!token) return;

    const requestLang = activeLang;
    const oldLayers = new Map(recognition.layers.map((layer) => [layer.id, layer]));
    let cancelled = false;
    setMasterSources((current) => ({
      ...current,
      [requestLang]: { ...current[requestLang]!, busy: true, error: null },
    }));

    void fetch("/api/figma/recognize", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: recognitionSource.url, token }),
    })
      .then(async (response) => {
        const data = (await response.json()) as FigmaRecognitionResult | { error: string };
        if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "识别失败");
        if (cancelled) return;
        const upgraded: FigmaRecognitionResult = {
          ...data,
          layers: data.layers.map((layer) => {
            const previous = oldLayers.get(layer.id);
            return previous
              ? { ...layer, role: previous.role, customRoleName: previous.customRoleName }
              : layer;
          }),
        };
        setMasterSources((current) => ({
          ...current,
          [requestLang]: {
            ...current[requestLang]!,
            result: upgraded,
            busy: false,
            error: null,
            confirmed: true,
          },
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        setMasterSources((current) => ({
          ...current,
          [requestLang]: {
            ...current[requestLang]!,
            busy: false,
            error: `升级预览失败：${error instanceof Error ? error.message : "请返回第一步重新识别"}`,
          },
        }));
      });

    return () => {
      cancelled = true;
      setMasterSources((current) => {
        const pending = current[requestLang];
        if (!pending?.busy || pending.result?.schemaVersion === 2) return current;
        return {
          ...current,
          [requestLang]: { ...pending, busy: false },
        };
      });
    };
  }, [
    activeLang,
    needsRecognitionUpgrade,
    recognition,
    recognitionSource?.url,
    setMasterSources,
  ]);

  if (!confirmedLangs.length) {
    return (
      <div className="grid h-full place-items-center rounded-[7px] border border-[var(--app-line)] bg-[var(--app-bg)] text-[11px] text-[var(--app-text-3)]">
        请先返回第一步确认至少一个语言母版
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(560px,1.15fr)_minmax(340px,0.85fr)] gap-3">
      <section className="flex min-h-0 flex-col overflow-hidden rounded-[7px] border border-[var(--app-line)] bg-[var(--app-bg)]">
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-[var(--app-line)] px-3">
          {confirmedLangs.map((id) => {
            const item = LANGS.find((candidate) => candidate.id === id)!;
            return (
              <button
                key={item.id}
                onClick={() => setLang(item.id)}
                className={cn(
                  "h-7 rounded-[4px] px-3 text-[11px]",
                  activeLang === item.id ? "bg-[var(--app-surface-3)] text-[var(--app-text)]" : "text-[var(--app-text-3)]",
                )}
              >
                {item.name}
              </button>
            );
          })}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[104px_minmax(0,1fr)]">
          <nav className="min-h-0 border-r border-[var(--app-line)] p-2">
            {objects.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedObject(item.id)}
                className={cn(
                  "mb-1 flex h-8 w-full items-center rounded-[4px] px-2.5 text-left text-[10px]",
                  selectedObject === item.id
                    ? "bg-[var(--app-surface-3)] text-[var(--app-text)]"
                    : "text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)]",
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="min-h-0 overflow-y-auto p-4">
            {selectedObject === "title" ? (
              <div className="space-y-4">
                <div className="space-y-2.5">
                  <TextField label="主标题" value={copy.title} onChange={(event) => { enterDraft(); updateCopy(activeLang, { title: event.target.value }); }} />
                  {hasSub ? <TextField label="副标题" value={copy.sub} onChange={(event) => { enterDraft(); updateCopy(activeLang, { sub: event.target.value }); }} /> : null}
                </div>
                <div className="border-t border-[var(--app-line)] pt-4">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-medium">排版方案</span>
                    <span className="text-[9px] text-[var(--app-text-4)]">按语言保存</span>
                  </div>
                  {recommendedPreset ? (
                    <div className="mb-3 rounded-[6px] border border-[var(--color-brand)]/45 bg-[var(--color-brand)]/5 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] font-semibold text-[var(--app-text)]">推荐训练方案</div>
                          <div className="mt-1 truncate text-[11px] text-[var(--app-text-2)]">{recommendedPreset.name.replace(/^推荐｜/, "")}</div>
                          <p className="mt-1.5 text-[9px] leading-relaxed text-[var(--app-text-4)]">{recommendedPreset.recommendationReason}</p>
                          <div className="mt-1 text-[9px] text-[var(--app-text-4)]">
                            Recipe {recommendedPreset.recipeId} · 语料 {recommendedPreset.corpusVersion}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={applied1080PresetId === recommendedPreset.id ? "secondary" : "workflow"}
                          disabled={applied1080PresetId === recommendedPreset.id}
                          onClick={() => applyTrainingPreset(recommendedPreset)}
                        >
                          {applied1080PresetId === recommendedPreset.id ? "已应用" : "应用到 1080×225"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-3 rounded-[6px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-3 text-[10px] text-[var(--app-text-3)]">
                      当前结构没有可交付训练方案，将保持母版；不会静默套用通用条幅。
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => applyPreset()} className={cn("h-7 rounded-[4px] px-2.5 text-[9px]", isFollowingMaster ? "choice-on" : "choice-idle")}>跟随母版</button>
                    {presets.map((preset) => (
                      <span key={preset.id} className="group relative">
                        <button type="button" onClick={() => applyPreset(preset)} className={cn("h-7 rounded-[4px] px-2.5 pr-6 text-[9px]", selectedPresetId === preset.id ? "choice-on" : "choice-idle")}>{preset.name}</button>
                        {!preset.recipeId ? <button type="button" aria-label={`删除 ${preset.name}`} onClick={() => deletePreset(preset.id)} className="absolute right-1 top-1/2 hidden -translate-y-1/2 text-[var(--app-text-4)] hover:text-[var(--app-text)] group-hover:block"><X size={10} /></button> : null}
                      </span>
                    ))}
                    <button type="button" onClick={() => { setLayoutSelection("draft"); setPresetName(`自定义 ${lineCount} 行`); }} className="h-7 rounded-[4px] border border-dashed border-[var(--app-line-strong)] px-2.5 text-[9px] text-[var(--app-text-3)] hover:text-[var(--app-text)]">+ 新建方案</button>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[10px] text-[var(--app-text-3)]">快速生成断行</div>
                  <div className="flex rounded-[5px] bg-[var(--app-surface-2)] p-0.5">
                    {[1, 2, 3].map((count) => (
                      <button key={count} type="button" onClick={() => applyLineCount(count)} className={cn("h-7 flex-1 rounded-[4px] text-[9px]", lineCount === count ? "bg-[var(--app-surface-3)] text-[var(--app-text)]" : "text-[var(--app-text-3)]")}>{count} 行</button>
                    ))}
                    <button type="button" className={cn("h-7 flex-1 rounded-[4px] text-[9px]", lineCount > 3 ? "bg-[var(--app-surface-3)] text-[var(--app-text)]" : "text-[var(--app-text-3)]")}>自定义</button>
                  </div>
                </div>
                <BreakPicker
                  title={copy.title}
                  sub={copy.sub}
                  lang={activeLang}
                  breaks={copy.titleBreaks}
                  stack={titleStackOf(copy)}
                  onChange={(titleBreaks) => { enterDraft(); updateCopy(activeLang, { titleBreaks }); }}
                  onStackChange={(titleStack) => { enterDraft(); updateCopy(activeLang, { titleStack }); }}
                  showPreview={false}
                  showStackControls={hasSub}
                />
                {hasSub ? (
                  <div className="space-y-3 border-t border-[var(--app-line)] pt-4">
                    <Slider label="标题组内部间距" value={titleGap} min={0} max={40} step={1} suffix="px" onChange={(value) => setGap({ titleGap: value })} />
                    <p className="text-[9px] leading-relaxed text-[var(--app-text-4)]">
                      主副标题作为一个整体排版；这里只调整组内关系，不改变母版中的 CTA 位置。
                    </p>
                  </div>
                ) : null}
                <div className="flex items-end gap-2 border-t border-[var(--app-line)] pt-4">
                  <div className="min-w-0 flex-1">
                    <TextField label="方案名称" value={presetName} readOnly={isFollowingMaster} onChange={(event) => setPresetName(event.target.value)} />
                  </div>
                  {selectedPresetId ? <Button size="sm" onClick={() => savePreset(true)}>另存为</Button> : null}
                  <Button size="sm" variant="primary" disabled={isFollowingMaster} onClick={() => savePreset(false)}>{selectedPresetId ? "保存修改" : "保存方案"}</Button>
                </div>
                {isFollowingMaster ? <div className="-mt-2 text-[9px] text-[var(--app-text-4)]">调整断行、顺序或间距后，可保存为新的排版方案。</div> : null}
              </div>
            ) : null}
            {selectedObject === "sub" ? <TextField label="副标题" value={copy.sub} onChange={(event) => { enterDraft(); updateCopy(activeLang, { sub: event.target.value }); }} /> : null}
            {selectedObject === "supplement" ? <TextField label="补充标题" value={copy.supplement ?? ""} onChange={(event) => { enterDraft(); updateCopy(activeLang, { supplement: event.target.value }); }} /> : null}
            {selectedObject === "cta" ? (
              <div className="space-y-4">
                <TextField label="CTA 文案" value={copy.ctaLong} onChange={(event) => updateCopy(activeLang, { ctaLong: event.target.value })} />
                <div>
                  <div className="mb-2 text-[10px] text-[var(--app-text-3)]">全局默认样式 · 全圆角</div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {CTA_STYLE_PRESETS.map((preset) => {
                      const selected = ctaStyle.presetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          aria-label={`使用${preset.name} CTA`}
                          aria-pressed={selected}
                          title={preset.name}
                          onClick={() => setCtaStyle({
                            presetId: preset.id,
                            backgroundColor: preset.backgroundColor,
                            backgroundImage: preset.backgroundImage,
                            textColor: preset.defaultTextColor,
                          })}
                          className={cn(
                            "rounded-[5px] border p-1.5",
                            selected ? "border-[var(--color-brand)]" : "border-[var(--app-line)]",
                          )}
                        >
                          <span
                            className="block h-7 rounded-full"
                            style={{ backgroundColor: preset.backgroundColor, backgroundImage: preset.backgroundImage }}
                          />
                          <span className="mt-1 block truncate text-[8px] text-[var(--app-text-4)]">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[10px] text-[var(--app-text-3)]">颜色微调</div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2">
                      <span className="mb-2 block text-[9px] text-[var(--app-text-4)]">按钮颜色</span>
                      <span className="flex items-center gap-2">
                        <input aria-label="CTA 按钮颜色" type="color" value={ctaStyle.backgroundColor} onChange={(event) => setCtaStyle({ presetId: undefined, backgroundColor: event.target.value, backgroundImage: undefined })} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                        <span className="text-[9px] uppercase text-[var(--app-text-2)]">{ctaStyle.backgroundColor}</span>
                      </span>
                    </label>
                    <label className="rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2">
                      <span className="mb-2 block text-[9px] text-[var(--app-text-4)]">文字颜色</span>
                      <span className="flex items-center gap-2">
                        <input aria-label="CTA 文字颜色" type="color" value={ctaStyle.textColor} onChange={(event) => setCtaStyle({ textColor: event.target.value })} className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                        <span className="text-[9px] uppercase text-[var(--app-text-2)]">{ctaStyle.textColor}</span>
                      </span>
                    </label>
                  </div>
                </div>
                <p className="text-[9px] leading-relaxed text-[var(--app-text-4)]">这里设置全局默认文案与颜色。CTA 位置和与标题的间距，进入第三步后按画幅调整。</p>
              </div>
            ) : null}
            {selectedObject === "disc" ? <TextArea label="免责" rows={5} value={disclaimerText(copy.disclaimer)} onChange={(event) => { enterDraft(); updateCopy(activeLang, { disclaimer: [event.target.value] }); }} /> : null}
            {selectedObject === "badge" ? (
              <div className="space-y-4">
                <TextField label="角标文案" value={copy.badge} onChange={(event) => { enterDraft(); updateCopy(activeLang, { badge: event.target.value }); }} />
                <div>
                  <div className="mb-2 text-[10px] text-[var(--app-text-3)]">全局默认对齐</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(["left", "center", "right"] as const).map((alignment) => (
                      <button
                        key={alignment}
                        type="button"
                        aria-pressed={badgeStyle.alignment === alignment}
                        onClick={() => setBadgeStyle({ alignment })}
                        className={cn("h-8 rounded-[4px] text-[9px]", badgeStyle.alignment === alignment ? "choice-on" : "choice-idle")}
                      >
                        {alignment === "left" ? "左对齐" : alignment === "center" ? "居中" : "右对齐"}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 h-10 overflow-hidden bg-[#444]">
                    <div
                      className={cn(
                        "flex h-full w-[58%] items-center justify-center px-3 text-[9px]",
                        badgeStyle.alignment === "center" && "mx-auto rounded-b-[18px]",
                        badgeStyle.alignment === "left" && "rounded-br-[18px]",
                        badgeStyle.alignment === "right" && "ml-auto rounded-bl-[18px]",
                      )}
                      style={{ backgroundColor: badgeStyle.backgroundColor, color: badgeStyle.textColor }}
                    >
                      {copy.badge || "角标"}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2">
                    <span className="mb-2 block text-[9px] text-[var(--app-text-4)]">背景颜色</span>
                    <span className="flex items-center gap-2">
                      <input aria-label="角标背景颜色" type="color" value={badgeStyle.backgroundColor} onChange={(event) => setBadgeStyle({ backgroundColor: event.target.value })} className="h-6 w-8 cursor-pointer bg-transparent p-0" />
                      <span className="text-[9px] uppercase text-[var(--app-text-2)]">{badgeStyle.backgroundColor}</span>
                    </span>
                  </label>
                  <label className="rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2">
                    <span className="mb-2 block text-[9px] text-[var(--app-text-4)]">文字颜色</span>
                    <span className="flex items-center gap-2">
                      <input aria-label="角标文字颜色" type="color" value={badgeStyle.textColor} onChange={(event) => setBadgeStyle({ textColor: event.target.value })} className="h-6 w-8 cursor-pointer bg-transparent p-0" />
                      <span className="text-[9px] uppercase text-[var(--app-text-2)]">{badgeStyle.textColor}</span>
                    </span>
                  </label>
                </div>
              </div>
            ) : null}
            {selectedObject === "logo" ? (
              <div>
                <div className="rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2.5">
                  <LogoPresetPreview asset={mappedLogo} className="h-10 justify-start rounded-[4px] bg-[#444] px-2" />
                  <div className="mt-2 text-[10px]">{mappedLogo?.name}</div>
                  <div className="mt-1 text-[9px] text-[var(--app-text-4)]">来自 {MASTER_LANGS.find((item) => item.id === activeLang)?.label} 母版</div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1 rounded-[5px] bg-[var(--app-surface-2)] p-0.5">
                  <button onClick={() => setLogoMode("master")} className={cn("h-7 rounded-[4px] text-[10px]", logoMode === "master" ? "bg-[var(--app-surface-3)]" : "text-[var(--app-text-3)]")}>跟随母版</button>
                  <button onClick={() => setLogoMode("replace")} className={cn("h-7 rounded-[4px] text-[10px]", logoMode === "replace" ? "bg-[var(--app-surface-3)]" : "text-[var(--app-text-3)]")}>替换 Logo</button>
                </div>
                {logoMode === "replace" ? <div className="mt-4"><LogoBind content={project.content} lang={activeLang} onChange={updateContent} onLangChange={setLang} single /></div> : null}
              </div>
            ) : null}
            {selectedObject === "qrcode" ? <div className="rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-3 text-[10px]"><div>二维码跟随母版</div><div className="mt-1 text-[9px] text-[var(--app-text-4)]">已使用第一步确认映射的二维码。</div></div> : null}
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-[7px] border border-[var(--app-line)] bg-[var(--app-bg)] p-4">
        <div className="flex shrink-0 items-center justify-between">
          <div>
            <div className="text-[12px] font-medium">标题组与元素预演</div>
            <div className="mt-1 text-[9px] text-[var(--app-text-4)]">只预演结构和默认样式，不重排整张画板</div>
          </div>
          <div className="flex items-center gap-2">
            {needsRecognitionUpgrade ? (
              <div className="rounded-[4px] bg-[var(--warn-soft)] px-2 py-1 text-[9px] text-[var(--warn-text)]">
                {recognitionSource?.busy
                  ? "正在升级预览图层…"
                  : recognitionSource?.error ?? "请返回第一步重新识别画板"}
              </div>
            ) : null}
            {unsupportedFonts.length ? (
              <div className="rounded-[4px] bg-[rgb(245_70_93/0.1)] px-2 py-1 text-[9px] text-[var(--color-up)]">
                未匹配字体：{unsupportedFonts.join("、")}
              </div>
            ) : null}
            <div className="rounded-[4px] bg-[var(--app-surface-2)] px-2 py-1 text-[9px] text-[var(--app-text-3)]">
              {isFollowingMaster ? "跟随母版" : selectedPresetId ? presetName : "未保存方案"}{isFollowingMaster ? "" : ` · ${lineCount} 行`}
            </div>
          </div>
        </div>
        <ContentPlanPreview
          activeLang={activeLang}
          copy={copy}
          titleGap={titleGap}
          followMaster={isFollowingMaster}
          titleLayer={effectiveTitle}
          subLayer={effectiveSub}
          ctaStyle={ctaStyle}
          logo={logoMode === "master" ? mappedLogo : logoOf(project.content, activeLang)}
          badgeStyle={badgeStyle}
        />
        {!embedded ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--app-line)] pt-3">
            <Button size="lg" onClick={() => setStep(0)}>上一步</Button>
            <Button variant="workflow" size="lg" icon={<WorkflowSparkle />} onClick={onNext}>确认内容与版式</Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ContentPlanPreview({
  activeLang,
  copy,
  titleGap,
  followMaster,
  titleLayer,
  subLayer,
  ctaStyle,
  logo,
  badgeStyle,
}: {
  activeLang: Lang;
  copy: ReturnType<typeof emptyLangCopy>;
  titleGap: number;
  followMaster: boolean;
  titleLayer?: FigmaRecognizedLayer;
  subLayer?: FigmaRecognizedLayer;
  ctaStyle: { backgroundColor: string; backgroundImage?: string; textColor: string };
  logo?: ReturnType<typeof logoOf>;
  badgeStyle: BadgeStyle;
}) {
  const titleLines = useMemo(() => {
    const tokens = tokenizeTitle(copy.title, activeLang);
    const points = [...new Set(copy.titleBreaks)]
      .filter((point) => point > 0 && point < tokens.length)
      .sort((a, b) => a - b);
    const lines: string[] = [];
    let start = 0;
    points.forEach((point) => {
      lines.push(joinTokens(tokens.slice(start, point), activeLang));
      start = point;
    });
    lines.push(joinTokens(tokens.slice(start), activeLang));
    return lines.filter(Boolean);
  }, [activeLang, copy.title, copy.titleBreaks]);

  const titleSource = orderedTextNodes(titleLayer)[0];
  const subSource = orderedTextNodes(subLayer)[0];
  const widestLine = Math.max(1, ...titleLines.map(estimatedTextWidth));
  const titleSize = Math.max(16, Math.min(36, (titleSource?.fontSize ?? 42) * 0.72, 236 / widestLine));
  const subSize = Math.max(11, Math.min(20, (subSource?.fontSize ?? titleSize * 0.45) * 0.72));
  const titleNode = (
    <div
      className="flex flex-col"
      style={{
        color: titleSource?.color ?? "var(--app-text)",
        fontFamily: titleSource?.fontFamily || "var(--font-sans)",
        fontSize: titleSize,
        fontWeight: titleSource?.fontWeight ?? 700,
        letterSpacing: titleSource?.letterSpacing,
        lineHeight: titleSource?.lineHeightPx
          ? `${Math.max(1, titleSource.lineHeightPx / Math.max(1, titleSource.fontSize))}`
          : 1.08,
        textAlign: titleSource?.textAlignHorizontal?.toLowerCase() as React.CSSProperties["textAlign"],
      }}
    >
      {titleLines.map((line, index) => <span key={`${line}-${index}`} className="whitespace-nowrap">{line}</span>)}
    </div>
  );
  const subNode = copy.sub ? (
    <div
      style={{
        color: subSource?.color ?? "var(--app-text-3)",
        fontFamily: subSource?.fontFamily || titleSource?.fontFamily || "var(--font-sans)",
        fontSize: subSize,
        fontWeight: subSource?.fontWeight ?? 500,
        letterSpacing: subSource?.letterSpacing,
        lineHeight: 1.2,
      }}
    >
      {copy.sub}
    </div>
  ) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-3">
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[9px] text-[var(--app-text-4)]">
            <span>标题组结构预演</span>
            <span>{followMaster ? "跟随母版" : `${titleLines.length} 行方案`}</span>
          </div>
          <div className="relative flex min-h-[184px] items-center overflow-hidden rounded-[6px] border border-[var(--app-line)] bg-[linear-gradient(135deg,#17191d,#202329)] px-8 py-6">
            <div
              className="flex max-w-full flex-col"
              style={{ gap: copy.sub ? titleGap : 0 }}
            >
              {titleStackOf(copy) === "sub-first" ? <>{subNode}{titleNode}</> : <>{titleNode}{subNode}</>}
            </div>
            <span className="absolute bottom-2 right-2 rounded-[3px] bg-black/30 px-1.5 py-0.5 text-[8px] text-white/45">结构预演 · 非成品画板</span>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="rounded-[6px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2.5">
            <div className="mb-2 text-[8px] text-[var(--app-text-4)]">CTA 全局默认</div>
            <div className="inline-flex min-h-7 max-w-full items-center rounded-full px-3 text-[9px] font-semibold" style={{ backgroundColor: ctaStyle.backgroundColor, backgroundImage: ctaStyle.backgroundImage, color: ctaStyle.textColor }}>
              <span className="truncate">{copy.ctaLong || "未映射 CTA"}</span>
            </div>
          </div>
          <div className="rounded-[6px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2.5">
            <div className="mb-2 text-[8px] text-[var(--app-text-4)]">Logo 全局默认</div>
            <LogoPresetPreview asset={logo} className="h-8 max-w-[220px] justify-start rounded-[4px] bg-[#444] px-2" />
          </div>
          <div className="rounded-[6px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2.5">
            <div className="mb-2 text-[8px] text-[var(--app-text-4)]">角标全局默认 · {badgeStyle.alignment === "left" ? "左对齐" : badgeStyle.alignment === "center" ? "居中" : "右对齐"}</div>
            <div className="h-8 overflow-hidden bg-[#444]">
              <div
                className={cn(
                  "flex h-full w-[58%] items-center justify-center px-2 text-[8px]",
                  badgeStyle.alignment === "center" && "mx-auto rounded-b-[16px]",
                  badgeStyle.alignment === "left" && "rounded-br-[16px]",
                  badgeStyle.alignment === "right" && "ml-auto rounded-bl-[16px]",
                )}
                style={{ backgroundColor: badgeStyle.backgroundColor, color: badgeStyle.textColor }}
              >
                {copy.badge || "角标"}
              </div>
            </div>
          </div>
        </div>

        <p className="rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-2 text-[9px] leading-relaxed text-[var(--app-text-4)]">
          主副标题在这里作为同一个标题组预演。真实画幅中的标题组与 CTA 位置，下一步再按尺寸调整。
        </p>
      </div>
    </div>
  );
}

function ContentMasterPreview({
  recognition,
  activeLang,
  copy,
  titleGap,
  actionGap,
  baselineTitleGap,
  baselineActionGap,
  baselineTitleStack,
  actionRelation,
  followMaster,
  selectedObject,
  onSelect,
}: {
  recognition: FigmaRecognitionResult | null | undefined;
  activeLang: Lang;
  copy: ReturnType<typeof emptyLangCopy>;
  titleGap: number;
  actionGap: number;
  baselineTitleGap: number;
  baselineActionGap: number;
  baselineTitleStack: "title-first" | "sub-first";
  actionRelation: ActionRelation;
  followMaster: boolean;
  selectedObject: ContentObjectId;
  onSelect: (id: ContentObjectId) => void;
}) {
  const frameW = recognition?.frame.width ?? 1200;
  const frameH = recognition?.frame.height ?? 628;
  const fit = useFitBoard(frameW, frameH, 16);
  const previewLanguage = activeLang === "sc" ? "zh-CN" : activeLang === "tc" ? "zh-HK" : activeLang;
  const canComposeUnits = Boolean(recognition?.renderUnits?.some((unit) => unit.previewUrl || unit.background));
  const canComposeLayers = Boolean(recognition?.layers.some((layer) => layer.previewUrl));
  const canCompose = canComposeUnits || canComposeLayers;
  const titleLines = useMemo(() => {
    const tokens = tokenizeTitle(copy.title, activeLang);
    const breaks = [...new Set(copy.titleBreaks)]
      .filter((point) => point > 0 && point < tokens.length)
      .sort((a, b) => a - b);
    const lines: string[] = [];
    let start = 0;
    breaks.forEach((point) => {
      lines.push(joinTokens(tokens.slice(start, point), activeLang));
      start = point;
    });
    lines.push(joinTokens(tokens.slice(start), activeLang));
    return lines;
  }, [activeLang, copy.title, copy.titleBreaks]);

  const objectForRole = (role: LayerRole): ContentObjectId | null => {
    if (role === "title" || role === "titleGroup") return "title";
    if (role === "sub") return "sub";
    if (role === "supplement" || role === "cta" || role === "disc" || role === "badge" || role === "logo" || role === "qrcode") return role;
    return null;
  };

  const previewMappedTitle = recognition?.layers.find((layer) => layer.role === "title");
  const previewMappedSub = recognition?.layers.find((layer) => layer.role === "sub");
  const availableTitleGroup = recognition?.layers.find((layer) => layer.role === "titleGroup");
  const previewTitleGroup = previewMappedTitle || previewMappedSub
    ? undefined
    : availableTitleGroup;
  const previewGroupParts = titleGroupParts(availableTitleGroup);
  const titleLayer = previewMappedTitle
    ?? previewGroupParts.title
    ?? previewTitleGroup;
  const subLayer = previewMappedSub ?? previewGroupParts.sub;
  const groupedTitle = Boolean(titleLayer && subLayer);
  const titleContentBounds = unionBounds(titleLayer?.bounds, subLayer?.bounds) ?? previewTitleGroup?.bounds;
  const titleEditLayer: FigmaRecognizedLayer | undefined = previewTitleGroup
    ?? (titleLayer && subLayer
      ? {
          ...titleLayer,
          id: `${titleLayer.id}::${subLayer.id}`,
          name: "标题组",
          role: "titleGroup",
          suggestedRole: "titleGroup",
          text: `${titleLayer.text} ${subLayer.text}`,
          textNodes: [...titleLayer.textNodes, ...subLayer.textNodes],
          bounds: titleContentBounds,
          previewUrl: undefined,
          backgroundColor: undefined,
        }
      : titleLayer);
  const titlePrimary = [...(titleLayer?.textNodes ?? [])].sort((a, b) => b.fontSize - a.fontSize)[0];
  const masterLineWidth = Math.max(1, ...recognizedTextLines(titleLayer, activeLang).map(estimatedTextWidth));
  const currentLineWidth = Math.max(1, ...titleLines.map(estimatedTextWidth));
  const titleFitScale = Math.min(1, masterLineWidth / currentLineWidth);
  const titleHeight = titleLayer?.bounds
    ? ((titlePrimary?.lineHeightPx ?? (titlePrimary?.fontSize ?? 34) * 1.15) * titleFitScale * titleLines.length) / frameH
    : 0;
  const groupTop = Math.min(
    titleLayer?.bounds?.y ?? Number.POSITIVE_INFINITY,
    subLayer?.bounds?.y ?? Number.POSITIVE_INFINITY,
  );
  const layoutTop = Number.isFinite(groupTop) ? groupTop : (titleLayer?.bounds?.y ?? 0);
  const gapY = titleGap / frameH;
  const titleY = titleStackOf(copy) === "sub-first" && subLayer?.bounds
    ? layoutTop + subLayer.bounds.h + gapY
    : layoutTop;
  const subY = titleStackOf(copy) === "sub-first"
    ? layoutTop
    : titleY + titleHeight + gapY;
  const groupedHeight = titleHeight + (subLayer?.bounds?.h ?? 0) + (subLayer ? gapY : 0);
  const groupBottom = groupedTitle
    ? layoutTop + groupedHeight
    : subLayer?.bounds
    ? Math.max(titleY + titleHeight, subY + subLayer.bounds.h)
    : titleY + titleHeight;
  const masterTitle = recognizedText(titleLayer, activeLang);
  const masterSub = recognizedText(subLayer, activeLang);
  const masterBreaks = recognizedBreaks(titleLayer, activeLang);
  const breaksMatchMaster = masterBreaks.length === copy.titleBreaks.length
    && masterBreaks.every((point, index) => point === copy.titleBreaks[index]);
  const titleContentModified = copy.title !== masterTitle;
  const titleGeometryModified = !breaksMatchMaster
    || titleStackOf(copy) !== baselineTitleStack
    || titleGap !== baselineTitleGap;
  const groupedSubModified = Boolean(groupedTitle && copy.sub !== masterSub);
  const titleLayoutModified = titleContentModified || titleGeometryModified || groupedSubModified;

  const objectModified = (layer: FigmaRecognizedLayer, object: ContentObjectId) => {
    if (followMaster) return false;
    if (object === "title") return titleLayoutModified;
    if (object === "sub") return copy.sub !== recognizedText(layer, activeLang) || titleGeometryModified;
    if (object === "supplement") return (copy.supplement ?? "") !== recognizedText(layer, activeLang);
    if (object === "cta") return copy.ctaLong !== recognizedText(layer, activeLang) || titleGeometryModified || actionGap !== baselineActionGap;
    if (object === "disc") return disclaimerText(copy.disclaimer) !== recognizedText(layer, activeLang, true);
    if (object === "badge") return copy.badge !== recognizedText(layer, activeLang);
    return false;
  };

  const objectNeedsRerender = (layer: FigmaRecognizedLayer, object: ContentObjectId) => {
    if (followMaster) return false;
    if (object === "title") return titleLayoutModified;
    if (object === "sub") return groupedTitle ? titleLayoutModified : copy.sub !== recognizedText(layer, activeLang);
    if (object === "supplement") return (copy.supplement ?? "") !== recognizedText(layer, activeLang);
    if (object === "cta") return copy.ctaLong !== recognizedText(layer, activeLang);
    if (object === "disc") return disclaimerText(copy.disclaimer) !== recognizedText(layer, activeLang, true);
    if (object === "badge") return copy.badge !== recognizedText(layer, activeLang);
    return false;
  };

  const adjustedBounds = (layer: FigmaRecognizedLayer) => {
    const object = objectForRole(layer.role);
    if (!layer.bounds || !object) return layer.bounds;
    const modified = objectModified(layer, object);
    if (groupedTitle && layer.id === previewTitleGroup?.id && titleContentBounds) {
      return modified ? { ...titleContentBounds, y: layoutTop, h: groupedHeight } : titleContentBounds;
    }
    if (!modified) return layer.bounds;
    if (layer.id === titleLayer?.id) return { ...layer.bounds, y: titleY, h: titleHeight };
    if (layer.id === subLayer?.id) return { ...layer.bounds, y: subY };
    if (layer.role === "cta") {
      const titleContainer = titleContentBounds ?? titleLayer?.bounds;
      if (!titleContainer) return layer.bounds;
      if (actionRelation === "right") return { ...layer.bounds, x: titleContainer.x + titleContainer.w + actionGap / frameW };
      if (actionRelation === "left") return { ...layer.bounds, x: titleContainer.x - layer.bounds.w - actionGap / frameW };
      if (actionRelation === "above") return { ...layer.bounds, y: layoutTop - layer.bounds.h - actionGap / frameH };
      return { ...layer.bounds, y: groupBottom + actionGap / frameH };
    }
    return layer.bounds;
  };

  const editableTextNodeIds = (layer: FigmaRecognizedLayer, object: ContentObjectId) => {
    if (object !== "title" || layer.role !== "titleGroup") {
      return new Set(layer.textNodes.map((node) => node.id).filter((id): id is string => Boolean(id)));
    }
    const parts = titleGroupParts(layer);
    return new Set(
      [...(parts.title?.textNodes ?? []), ...(parts.sub?.textNodes ?? [])]
        .map((node) => node.id)
        .filter((id): id is string => Boolean(id)),
    );
  };

  const shouldHideRenderUnit = (unit: NonNullable<FigmaRecognitionResult["renderUnits"]>[number]) => {
    const owner = recognition?.layers.find((layer) => layer.id === unit.ownerLayerId);
    if (!owner) return false;
    const object = objectForRole(owner.role);
    if (!object || !objectNeedsRerender(owner, object)) return false;
    const editableIds = editableTextNodeIds(owner, object);
    return unit.textNodeIds.some((id) => editableIds.has(id));
  };

  const adjustedRenderUnitBounds = (unit: NonNullable<FigmaRecognitionResult["renderUnits"]>[number]) => {
    if (!unit.bounds) return undefined;
    const owner = recognition?.layers.find((layer) => layer.id === unit.ownerLayerId);
    if (!owner?.bounds || (owner.role !== "cta" && owner.role !== "sub")) return unit.bounds;
    const nextOwnerBounds = adjustedBounds(owner);
    if (!nextOwnerBounds) return unit.bounds;
    return {
      ...unit.bounds,
      x: unit.bounds.x + nextOwnerBounds.x - owner.bounds.x,
      y: unit.bounds.y + nextOwnerBounds.y - owner.bounds.y,
    };
  };

  const replacement = (layer: FigmaRecognizedLayer, object: ContentObjectId) => {
    const primary = [...layer.textNodes].sort((a, b) => b.fontSize - a.fontSize)[0];
    const scale = fit.width / frameW;
    const commonStyle = {
      fontFamily: primary?.fontFamily,
      fontSize: Math.max(6, (primary?.fontSize || (object === "title" ? 34 : 14)) * scale),
      fontWeight: primary?.fontWeight ?? (object === "title" ? 650 : 450),
      lineHeight: primary?.lineHeightPx && primary.fontSize ? primary.lineHeightPx / primary.fontSize : 1.15,
      letterSpacing: primary?.letterSpacing ? primary.letterSpacing * scale : undefined,
      textAlign: primary?.textAlignHorizontal === "CENTER" ? "center" as const
        : primary?.textAlignHorizontal === "RIGHT" ? "right" as const
          : "left" as const,
      fontStyle: primary?.italic ? "italic" : undefined,
      color: primary?.color ?? "#fff",
    };
    if (object === "title") {
      const isSyntheticTitleGroup = Boolean(groupedTitle && !previewTitleGroup && layer.id === titleEditLayer?.id);
      const styleLayer = isSyntheticTitleGroup
        ? titleLayer ?? layer
        : layer.role === "titleGroup"
          ? titleGroupParts(layer).title ?? layer
          : layer;
      const sourceStyles: Array<FigmaRecognizedLayer["textNodes"][number] | NonNullable<FigmaRecognizedLayer["textNodes"][number]["styleRuns"]>[number]> = [];
      orderedTextNodes(styleLayer).forEach((node, nodeIndex, orderedNodes) => {
        for (let index = 0; index < node.text.length; index += 1) {
          const character = node.text[index];
          if (character === "\r") continue;
          const run = node.styleRuns?.find((item) => index >= item.start && index < item.end);
          if (character === "\n") {
            sourceStyles.push(run ?? node);
            continue;
          }
          sourceStyles.push(run ?? node);
        }
        if (activeLang === "en" && nodeIndex < orderedNodes.length - 1) sourceStyles.push(node);
      });
      const tokens = tokenizeTitle(copy.title, activeLang);
      const breakSet = new Set(copy.titleBreaks);
      let sourceOffset = 0;
      const styledLines: React.ReactNode[][] = [[]];
      tokens.forEach((token, tokenIndex) => {
        if (breakSet.has(tokenIndex)) styledLines.push([]);
        const line = styledLines.at(-1)!;
        if (activeLang === "en" && line.length) {
          const spaceStyle = sourceStyles[sourceOffset] ?? primary;
          line.push(
            <span
              key={`space-${tokenIndex}`}
              style={{
                fontFamily: spaceStyle?.fontFamily,
                fontSize: Math.max(6, (spaceStyle?.fontSize ?? primary?.fontSize ?? 34) * scale * titleFitScale),
                fontWeight: spaceStyle?.fontWeight ?? primary?.fontWeight ?? 650,
                lineHeight: spaceStyle?.lineHeightPx && spaceStyle.fontSize
                  ? spaceStyle.lineHeightPx / spaceStyle.fontSize
                  : commonStyle.lineHeight,
                letterSpacing: spaceStyle?.letterSpacing ? spaceStyle.letterSpacing * scale * titleFitScale : undefined,
              }}
            >
              {" "}
            </span>,
          );
        }
        const tokenStart = copy.title.indexOf(token, sourceOffset);
        const start = tokenStart >= 0 ? tokenStart : sourceOffset;
        Array.from(token).forEach((character, characterIndex) => {
          const style = sourceStyles[start + characterIndex] ?? primary;
          const fillCss = style?.fillCss ?? style?.color ?? primary?.fillCss ?? primary?.color ?? "#fff";
          const gradientText = fillCss.startsWith("linear-gradient");
          line.push(
            <span
              key={`${tokenIndex}-${characterIndex}`}
              style={{
                fontFamily: style?.fontFamily,
                fontSize: Math.max(6, (style?.fontSize ?? primary?.fontSize ?? 34) * scale * titleFitScale),
                fontWeight: style?.fontWeight ?? primary?.fontWeight ?? 650,
                lineHeight: style?.lineHeightPx && style.fontSize ? style.lineHeightPx / style.fontSize : commonStyle.lineHeight,
                letterSpacing: style?.letterSpacing ? style.letterSpacing * scale * titleFitScale : undefined,
                fontStyle: style?.italic ? "italic" : undefined,
                color: gradientText ? "transparent" : fillCss,
                backgroundImage: gradientText ? fillCss : undefined,
                backgroundClip: gradientText ? "text" : undefined,
                WebkitBackgroundClip: gradientText ? "text" : undefined,
              }}
            >
              {character}
            </span>,
          );
        });
        sourceOffset = start + token.length;
      });
      const title = (
        <div style={{ fontSize: Math.max(6, (primary?.fontSize ?? 34) * scale * titleFitScale), lineHeight: commonStyle.lineHeight }}>
          {styledLines.map((line, index) => <div key={index}>{line.length ? line : " "}</div>)}
        </div>
      );
      if (layer.role !== "titleGroup") return <div style={commonStyle}>{title}</div>;
      const groupSub = isSyntheticTitleGroup ? subLayer : titleGroupParts(layer).sub;
      const subNode = [...(groupSub?.textNodes ?? [])].sort((a, b) => b.fontSize - a.fontSize)[0];
      const sub = copy.sub ? (
        <div style={{
          fontFamily: subNode?.fontFamily ?? primary?.fontFamily,
          fontSize: Math.max(6, (subNode?.fontSize ?? (primary?.fontSize ?? 20) * 0.58) * scale),
          fontWeight: subNode?.fontWeight ?? 450,
          lineHeight: subNode?.lineHeightPx && subNode.fontSize ? subNode.lineHeightPx / subNode.fontSize : 1.15,
          letterSpacing: subNode?.letterSpacing ? subNode.letterSpacing * scale : undefined,
          textAlign: subNode?.textAlignHorizontal === "CENTER" ? "center" : subNode?.textAlignHorizontal === "RIGHT" ? "right" : "left",
          fontStyle: subNode?.italic ? "italic" : undefined,
          color: subNode?.color ?? primary?.color ?? "#fff",
        }}>{copy.sub}</div>
      ) : null;
      const gap = Math.max(2, titleGap * scale);
      return (
        <div className="flex h-full flex-col justify-center" style={{ ...commonStyle, gap }}>
          {titleStackOf(copy) === "sub-first" ? <>{sub}{title}</> : <>{title}{sub}</>}
        </div>
      );
    }
    const value = object === "sub" ? copy.sub
      : object === "supplement" ? copy.supplement
        : object === "cta" ? copy.ctaLong
          : object === "disc" ? disclaimerText(copy.disclaimer)
            : object === "badge" ? copy.badge
              : "";
    return <div style={commonStyle}>{value}</div>;
  };

  return (
    <div ref={fit.ref} className="my-3 grid min-h-0 flex-1 place-items-center overflow-hidden rounded-[5px] bg-[#0b0c0e] p-2">
      <div
        className="relative max-h-full max-w-full overflow-hidden bg-[#15181e] shadow-[0_16px_48px_rgb(0_0_0/0.28)]"
        style={{ width: fit.width, aspectRatio: `${frameW} / ${frameH}`, background: recognition?.frame.backgroundColor }}
      >
        {(followMaster || !canCompose) && recognition?.previewUrl ? <img src={recognition.previewUrl} alt={recognition.frame.name} className="absolute inset-0 size-full object-cover" /> : null}
        {!followMaster && canComposeUnits ? recognition?.renderUnits?.map((unit) => {
          const bounds = adjustedRenderUnitBounds(unit);
          if (!bounds || shouldHideRenderUnit(unit)) return null;
          const style = {
            left: `${bounds.x * 100}%`,
            top: `${bounds.y * 100}%`,
            width: `${bounds.w * 100}%`,
            height: `${bounds.h * 100}%`,
          };
          if (unit.background) {
            return (
              <span
                key={unit.id}
                className="pointer-events-none absolute"
                style={{
                  ...style,
                  background: unit.background,
                  borderRadius: unit.cornerRadius != null ? unit.cornerRadius * fit.width / frameW : undefined,
                }}
              />
            );
          }
          if (!unit.previewUrl) return null;
          return <img key={unit.id} src={unit.previewUrl} alt="" className="pointer-events-none absolute" style={style} />;
        }) : null}
        {!followMaster && !canComposeUnits && canComposeLayers ? recognition?.layers.map((layer) => {
          const object = objectForRole(layer.role);
          const hiddenForEdit = object ? objectNeedsRerender(layer, object) : false;
          const bounds = object ? adjustedBounds(layer) : layer.bounds;
          if (!layer.previewUrl || !bounds || hiddenForEdit) return null;
          return (
            <img
              key={`source-${layer.id}`}
              src={layer.previewUrl}
              alt=""
              className="pointer-events-none absolute"
              style={{
                left: `${bounds.x * 100}%`,
                top: `${bounds.y * 100}%`,
                width: `${bounds.w * 100}%`,
                height: `${bounds.h * 100}%`,
              }}
            />
          );
        }) : null}
        {!followMaster && !canCompose ? recognition?.layers.map((layer) => {
          const object = objectForRole(layer.role);
          if (!object || !layer.bounds || !objectModified(layer, object) || ["logo", "qrcode"].includes(object)) return null;
          return (
            <span
              key={`legacy-mask-${layer.id}`}
              className="absolute"
              style={{
                left: `${layer.bounds.x * 100}%`,
                top: `${layer.bounds.y * 100}%`,
                width: `${layer.bounds.w * 100}%`,
                height: `${layer.bounds.h * 100}%`,
                background: recognition?.frame.backgroundColor ?? "rgba(16,18,22,0.96)",
              }}
            />
          );
        }) : null}
        {recognition?.layers.map((layer) => {
          if (
            availableTitleGroup
            && !previewTitleGroup
            && layer.id === availableTitleGroup.id
            && layer.id !== titleLayer?.id
          ) return null;
          const isCombinedTitleAnchor = Boolean(
            groupedTitle
            && titleEditLayer
            && (layer.id === previewTitleGroup?.id || layer.id === titleLayer?.id),
          );
          if (groupedTitle && layer.id === subLayer?.id && !isCombinedTitleAnchor) return null;
          const renderLayer = isCombinedTitleAnchor ? titleEditLayer! : layer;
          const object = isCombinedTitleAnchor ? "title" : objectForRole(layer.role);
          const bounds = isCombinedTitleAnchor && titleContentBounds
            ? (!followMaster && titleLayoutModified
              ? { ...titleContentBounds, y: layoutTop, h: groupedHeight }
              : titleContentBounds)
            : adjustedBounds(layer);
          if (!object || !bounds) return null;
          const editableText = !["logo", "qrcode"].includes(object);
          const rerender = isCombinedTitleAnchor
            ? !followMaster && titleLayoutModified
            : objectNeedsRerender(layer, object);
          const selected = selectedObject === object;
          return (
            <button
              key={renderLayer.id}
              type="button"
              lang={previewLanguage}
              data-title-fit-scale={object === "title" ? titleFitScale : undefined}
              aria-label={`编辑 ${isCombinedTitleAnchor ? "标题组" : ROLE_LABEL[layer.role]}`}
              onClick={() => onSelect(object)}
              className={cn(
                "absolute overflow-hidden border text-left transition-colors",
                selected ? "z-10 border-white/70" : "border-transparent hover:border-white/35",
                object === "cta" && "flex items-center justify-center text-center",
              )}
              style={{
                left: `${bounds.x * 100}%`,
                top: `${bounds.y * 100}%`,
                width: `${bounds.w * 100}%`,
                height: `${bounds.h * 100}%`,
                padding: object === "cta" ? 0 : Math.max(1, 2 * fit.width / frameW),
                borderRadius: renderLayer.cornerRadius != null ? Math.max(0, renderLayer.cornerRadius * fit.width / frameW) : object === "cta" ? Math.max(2, 6 * fit.width / frameW) : 1,
                background: editableText && rerender
                  ? object === "title" && canCompose
                    ? "transparent"
                    : renderLayer.backgroundColor ?? (canCompose ? "transparent" : recognition?.frame.backgroundColor ?? "rgba(16, 18, 22, 0.96)")
                  : undefined,
              }}
            >
              {editableText && rerender ? replacement(renderLayer, object) : null}
            </button>
          );
        })}
        <div className="absolute bottom-1.5 right-1.5 rounded-[3px] bg-black/65 px-1.5 py-0.5 text-[7px] text-white/60">
          {frameW} × {frameH}
        </div>
      </div>
    </div>
  );
}

function CopyScope({ onNext }: { onNext: () => void }) {
  const channels = ["站内", "Paid Ads", "KOL", "Partnership"];
  return (
    <div className="h-full grid grid-cols-[minmax(0,1fr)_300px] gap-3">
      <section className="rounded-[7px] border border-[var(--app-line)] bg-[var(--app-bg)] p-5 overflow-y-auto">
        <h2 className="text-[13px] font-medium">选择现有画板范围</h2>
        <label className="mt-5 block">
          <span className="text-[10px] text-[var(--app-text-3)]">Figma 链接</span>
          <div className="mt-1.5 h-9 rounded-[5px] border border-[var(--app-line-strong)] bg-[var(--app-field)] px-3 flex items-center gap-2 text-[11px]">
            <Link2 size={13} className="text-[var(--app-text-3)]" />
            https://www.figma.com/design/Project_V2/…?node-id=120-88
          </div>
        </label>
        <div className="mt-5 border border-[var(--app-line)] rounded-[6px]">
          <div className="border-b border-[var(--app-line)] px-3 py-2 text-[11px]">
            Project_V2.fig / Campaign Delivery / All Final Boards
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 xl:grid-cols-4">
            {channels.map((channel, index) => (
              <button key={channel} className="rounded-[5px] border border-[var(--accent-line)] bg-[var(--accent-soft)] p-2 text-left">
                <div className="aspect-[1.6] rounded-[3px] bg-[var(--app-surface-3)] p-2 grid grid-cols-2 gap-1">
                  {Array.from({ length: 4 }).map((_, i) => <span key={i} className="rounded-[2px] bg-[var(--app-text-4)]/20" />)}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span>{channel}</span>
                  <span className="text-[var(--app-text-3)]">{[8, 7, 6, 6][index]} 块</span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex gap-6 text-[11px] text-[var(--app-text-2)]">
          <span>27 个画板</span>
          <span>135 个文本层</span>
          <span>3 种语言</span>
        </div>
      </section>
      <Inspector title="识别范围">
        {[
          ["只扫描文本图层", true],
          ["排除隐藏图层", true],
          ["排除锁定图层", false],
          ["保留样式与位置", true],
          ["自动识别语言", true],
        ].map(([label, enabled]) => (
          <ToggleRow key={String(label)} label={String(label)} enabled={Boolean(enabled)} />
        ))}
        <div className="mt-auto pt-4">
          <Button variant="primary" block onClick={onNext}>扫描并匹配文案</Button>
        </div>
      </Inspector>
    </div>
  );
}

function CopyMatch({ onNext }: { onNext: () => void }) {
  return (
    <div className="h-full grid grid-cols-[minmax(0,1fr)_300px] gap-3">
      <section className="rounded-[7px] border border-[var(--app-line)] bg-[var(--app-bg)] p-4 overflow-y-auto">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[13px] font-medium">匹配结果</h2>
            <p className="mt-1 text-[10px] text-[var(--app-text-4)]">27 画板 · 135 文本层</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => <MiniBoard key={i} index={i} />)}
        </div>
        <div className="mt-4 overflow-hidden rounded-[5px] border border-[var(--app-line)]">
          <div className="grid grid-cols-[100px_1fr_100px_100px] bg-[var(--app-surface-2)] px-3 py-2 text-[10px] text-[var(--app-text-3)]">
            <span>文案角色</span><span>原文示例</span><span>匹配图层</span><span>置信度</span>
          </div>
          {MATCH_ROWS.map(([role, text, count, confidence]) => (
            <button key={role} className="grid w-full grid-cols-[100px_1fr_100px_100px] border-t border-[var(--app-line-soft)] px-3 py-2.5 text-left text-[11px] hover:bg-[var(--app-surface-2)]">
              <span>{role}</span>
              <span className="truncate text-[var(--app-text-2)]">{text}</span>
              <span>{count}</span>
              <span className={confidence === "82%" ? "text-[var(--color-warn)]" : ""}>{confidence}</span>
            </button>
          ))}
        </div>
      </section>
      <Inspector title="匹配依据">
        {["图层名称", "相对位置", "文字样式指纹", "原文相似度"].map((label, index) => (
          <div key={label} className="border-b border-[var(--app-line-soft)] py-3">
            <div className="flex justify-between text-[11px]"><span>{label}</span><span>{[98, 96, 94, 99][index]}%</span></div>
            <div className="mt-2 h-1 rounded-full bg-[var(--app-surface-3)]"><div className="h-full rounded-full bg-[var(--control-active)]" style={{ width: `${[98, 96, 94, 99][index]}%` }} /></div>
          </div>
        ))}
        <div className="mt-3 rounded-[5px] bg-[var(--warn-soft)] p-2.5 text-[10px] text-[var(--warn-text)]">1 组低置信度文本需要确认。</div>
        <div className="mt-auto pt-4"><Button variant="primary" block onClick={onNext}>确认匹配并编辑文案</Button></div>
      </Inspector>
    </div>
  );
}

function CopyEdit({ onNext }: { onNext: () => void }) {
  const [lang, setLang] = useState("简体");
  const copyRows = useMemo(
    () => [
      ["主标题", "资产配置新选择", "让闲置资金持续增值"],
      ["副标题", "专业可靠", "灵活配置，稳健起步"],
      ["CTA", "立即体验", "查看详情"],
      ["免责", "市场有风险", "投资涉及风险，详情请参阅活动条款"],
      ["角标", "热销", "限时活动"],
    ],
    [],
  );
  return (
    <div className="h-full grid grid-cols-[minmax(0,1fr)_300px] gap-3">
      <section className="rounded-[7px] border border-[var(--app-line)] bg-[var(--app-bg)] overflow-hidden flex flex-col">
        <div className="h-11 border-b border-[var(--app-line)] px-4 flex items-center gap-1">
          {["简体", "繁体", "English"].map((item) => (
            <button key={item} onClick={() => setLang(item)} className={cn("h-7 rounded-[4px] px-3 text-[11px]", lang === item ? "bg-[var(--app-surface-3)]" : "text-[var(--app-text-3)]")}>{item}</button>
          ))}
          <span className="ml-auto text-[10px] text-[var(--app-text-4)]">81 处</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-[var(--app-line-soft)]">
          {copyRows.map(([role, oldText, newText]) => (
            <div key={role} className="grid grid-cols-[90px_1fr_1fr_70px] items-start gap-3 p-4">
              <div className="text-[11px] font-medium">{role}</div>
              <label><span className="text-[9px] text-[var(--app-text-4)]">原文</span><div className="mt-1 min-h-8 rounded-[4px] bg-[var(--app-surface-2)] px-2.5 py-2 text-[11px] text-[var(--app-text-3)]">{oldText}</div></label>
              <label><span className="text-[9px] text-[var(--app-text-4)]">替换为</span><input defaultValue={newText} className="mt-1 h-8 w-full rounded-[4px] border border-[var(--app-line-strong)] bg-[var(--app-field)] px-2.5 text-[11px] outline-none focus:border-[var(--accent-strong)]" /></label>
              <span className="mt-5 rounded-[4px] bg-[var(--accent-soft)] px-2 py-1 text-center text-[10px] text-[var(--accent-strong)]">{role === "角标" ? 18 : 27} 处</span>
            </div>
          ))}
        </div>
      </section>
      <Inspector title="修改范围">
        <div className="rounded-[5px] border border-[var(--app-line)] p-2">
          <MiniBoard index={2} />
        </div>
        <div className="mt-3"><ToggleRow label="保留原文字样式" enabled /></div>
        <ToggleRow label="只替换精确匹配" enabled />
        <ToggleRow label="溢出时允许重新排版" enabled={false} />
        <div className="mt-auto pt-4"><Button variant="primary" block onClick={onNext}>预览 81 处修改</Button></div>
      </Inspector>
    </div>
  );
}

function CopyWriteback({ done, onRun }: { done: boolean; onRun: () => void }) {
  return (
    <div className="h-full grid grid-cols-[minmax(0,1fr)_300px] gap-3">
      <section className="rounded-[7px] border border-[var(--app-line)] bg-[var(--app-bg)] p-5 overflow-y-auto">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[16px] font-semibold">{done ? "批量修改完成" : "写回确认"}</h2>
            <p className="mt-1 text-[11px] text-[var(--app-text-3)]">
              {done ? "80 已更新 · 1 已跳过 · 81 总修改" : "27 个现有画板 · 81 处文本修改 · 0 阻塞"}
            </p>
          </div>
          {done ? <span className="rounded-[4px] bg-[var(--success-soft)] px-2 py-1 text-[10px] text-[var(--success-text)]">部分完成</span> : null}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="relative"><MiniBoard index={i} />{done ? <span className={cn("absolute right-2 top-2 rounded-[3px] px-1.5 py-0.5 text-[9px]", i === 4 ? "bg-[var(--warn-soft)] text-[var(--warn-text)]" : "bg-[var(--success-soft)] text-[var(--success-text)]")}>{i === 4 ? "跳过" : "已更新"}</span> : null}</div>
          ))}
        </div>
      </section>
      <Inspector title={done ? "本次修改" : "写回设置"}>
        <KeyValue label="Figma 文件" value="Project_V2.fig" />
        <KeyValue label="页面" value="Campaign Delivery" />
        <KeyValue label="源 Section" value="All Final Boards" />
        <KeyValue label="输出 Section" value="Copy Update 0909" />
        <div className="my-3 h-px bg-[var(--app-line)]" />
        <ToggleRow label="复制 Section 后修改" enabled />
        <ToggleRow label="保留文字样式与位置" enabled />
        <ToggleRow label="创建回滚记录" enabled />
        <div className="mt-auto space-y-2 pt-4">
          <Button variant="primary" block onClick={onRun}>{done ? "仅重试 1 处" : "写回 81 处文案到 Figma"}</Button>
          <Button block>{done ? "在 Figma 中打开" : "返回检查"}</Button>
          {done ? <Button variant="ghost" block>回滚本次修改</Button> : null}
        </div>
      </Inspector>
    </div>
  );
}

function Inspector({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <aside className="min-h-0 rounded-[7px] border border-[var(--app-line)] bg-[var(--app-surface)] p-4 flex flex-col overflow-y-auto">
      <div className="mb-2">
        <h2 className="text-[12px] font-medium">{title}</h2>
      </div>
      {children}
    </aside>
  );
}

function ToggleRow({ label, enabled }: { label: string; enabled: boolean }) {
  const [on, setOn] = useState(enabled);
  return (
    <button onClick={() => setOn(!on)} className="flex w-full items-center justify-between border-b border-[var(--app-line-soft)] py-3 text-left text-[11px]">
      <span>{label}</span>
      <span className={cn("relative h-4 w-7 rounded-full", on ? "bg-[var(--control-active)]" : "bg-[var(--app-surface-3)]")}>
        <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-transform", on ? "translate-x-3.5" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-[var(--app-line-soft)] py-2.5">
      <div className="text-[9px] text-[var(--app-text-4)]">{label}</div>
      <div className="mt-1 text-[11px]">{value}</div>
    </div>
  );
}

function MiniBoard({ index }: { index: number }) {
  return (
    <div className="relative aspect-[1.75] overflow-hidden rounded-[4px] border border-[var(--app-line)] bg-[#15181e] p-3">
      <div className="absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_80%_70%,#263244_0%,transparent_45%)]" />
      <div className="relative text-[8px] font-semibold">FUTU</div>
      <div className="relative mt-2 text-[11px] font-semibold">Grow cash with confidence.</div>
      <div className="relative mt-1 text-[6px] text-white/45">Campaign board {String(index + 1).padStart(2, "0")}</div>
    </div>
  );
}
