"use client";

import {
  createContext,
  type Dispatch,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type SetStateAction,
  type ReactNode,
} from "react";
import {
  BOARD_CONFIG_DEFAULT,
  boardConfigOf,
  emptyLangCopy,
  isOverridden,
  nextUnusedLang,
  sizeKey,
  type AssetRef,
  type BoardConfig,
  type Brand,
  type Lang,
  type LangCopy,
  type Project,
  type TargetBoard,
  type TitleBreakChoice,
} from "@futu/domain";
import { ALL_SIZES } from "@futu/specs";
import { createDefaultProject } from "./seed";
import type { FigmaRecognitionResult } from "./figma-recognition";

export const STEPS = ["识别画板", "编辑与延展", "预览与写入"] as const;
export type StepIndex = 0 | 1 | 2;
export type EntryMode = "pick" | "blank";
export type VisualComponentRecognitionSource = {
  url: string;
  result: FigmaRecognitionResult | null;
  error: string | null;
  busy: boolean;
};
export type MasterRecognitionSource = {
  url: string;
  result: FigmaRecognitionResult | null;
  error: string | null;
  busy: boolean;
  confirmed: boolean;
  backgroundColor: string;
  backgroundColorConfirmed: boolean;
  visualComponent: VisualComponentRecognitionSource;
};
export type MasterRecognitionSources = Partial<Record<Lang, MasterRecognitionSource>>;
export type StudioSnapshot = {
  project: Project;
  step: StepIndex;
  entry: EntryMode;
  lang: Lang;
  focusKey: string;
  draft: BoardConfig | null;
  masterSources: MasterRecognitionSources;
  activeMasterLang: Lang;
};

export const emptyMasterRecognitionSource = (): MasterRecognitionSource => ({
  url: "",
  result: null,
  error: null,
  busy: false,
  confirmed: false,
  backgroundColor: "#0f1112",
  backgroundColorConfirmed: false,
  visualComponent: {
    url: "",
    result: null,
    error: null,
    busy: false,
  },
});

type StudioContext = {
  project: Project;
  step: StepIndex;
  setStep: (s: StepIndex) => void;
  entry: EntryMode;
  setEntry: (m: EntryMode) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  focusKey: string;
  setFocusKey: (k: string) => void;
  updateContent: (patch: Partial<Project["content"]>) => void;
  updateCopy: (lang: Lang, patch: Partial<LangCopy>) => void;
  setTitleBreakChoice: (lang: Lang, targetKey: string, choice: TitleBreakChoice) => void;
  setBrand: (brand: Brand) => void;
  toggleLang: (lang: Lang) => void;
  bindSourceFrame: (lang: Lang, frame: AssetRef) => void;
  addSourceLang: () => void;
  removeSourceLang: (lang: Lang) => void;
  retargetSourceLang: (from: Lang, to: Lang) => void;
  setTargets: (keys: string[], customNames?: Record<string, string>) => void;
  patchShared: (patch: Partial<BoardConfig>) => void;
  patchFocus: (patch: Partial<BoardConfig>) => void;
  applySharedToAll: () => void;
  applyDraftToFocus: () => void;
  applyDraftToTargets: (keys: string[]) => void;
  discardDraft: () => void;
  resetProject: () => void;
  focusCfg: BoardConfig;
  focusOverridden: boolean;
  hasDraft: boolean;
  masterSources: MasterRecognitionSources;
  setMasterSources: Dispatch<SetStateAction<MasterRecognitionSources>>;
  activeMasterLang: Lang;
  setActiveMasterLang: (lang: Lang) => void;
  snapshot: StudioSnapshot;
  loadSnapshot: (snapshot: StudioSnapshot) => void;
  storageReady: boolean;
};

const Ctx = createContext<StudioContext | null>(null);
const STORAGE_KEY = "futu:extension-project:v1";

export function createBlankStudioSnapshot(name: string, id = `extend-${Date.now()}`): StudioSnapshot {
  const project = createDefaultProject();
  const now = new Date().toISOString();
  project.id = id;
  project.name = name;
  project.createdAt = now;
  project.updatedAt = now;
  return {
    project,
    step: 0,
    entry: "pick",
    lang: "en",
    focusKey: project.targets[0]?.key ?? "1080×1080",
    draft: null,
    masterSources: { en: emptyMasterRecognitionSource() },
    activeMasterLang: "en",
  };
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

function normalizeProjectTargets(project: Project): Project {
  const normalizedTargets = project.targets.flatMap((target) => {
    const catalogItem = ALL_SIZES.find((item) => item.w === target.w && item.h === target.h);
    if (catalogItem) {
      return [{
        ...target,
        key: sizeKey(catalogItem.w, catalogItem.h),
        w: catalogItem.w,
        h: catalogItem.h,
        sizeId: catalogItem.id,
        use: catalogItem.use,
      }];
    }
    return target.sizeId?.startsWith("custom-") ? [target] : [];
  });
  const targets = [...new Map(normalizedTargets.map((target) => [target.key, target])).values()];
  const targetKeys = new Set(targets.map((target) => target.key));
  return {
    ...project,
    targets,
    overrides: Object.fromEntries(
      Object.entries(project.overrides).filter(([key]) => targetKeys.has(key)),
    ),
  };
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project>(() => createDefaultProject());
  const [step, setStep] = useState<StepIndex>(0);
  const [entry, setEntryState] = useState<EntryMode>("pick");
  const [lang, setLang] = useState<Lang>("en");
  const [focusKey, setFocusKey] = useState(() => project.targets[0]?.key ?? "1080×1080");
  const [draft, setDraft] = useState<BoardConfig | null>(null);
  const [masterSources, setMasterSources] = useState<MasterRecognitionSources>({
    en: emptyMasterRecognitionSource(),
  });
  const [activeMasterLang, setActiveMasterLang] = useState<Lang>("en");
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          project?: Project;
          step?: StepIndex;
          entry?: EntryMode;
          lang?: Lang;
          focusKey?: string;
          draft?: BoardConfig | null;
          masterSources?: MasterRecognitionSources;
          activeMasterLang?: Lang;
        };
        if (saved.project) setProject(normalizeProjectTargets(saved.project));
        if (saved.step != null) setStep(saved.step >= 3 ? 2 : saved.step >= 1 ? 1 : 0);
        if (saved.entry === "pick" || saved.entry === "blank") setEntryState(saved.entry);
        if (saved.lang) setLang(saved.lang);
        if (saved.focusKey) setFocusKey(saved.focusKey);
        if (saved.draft) setDraft(saved.draft);
        if (saved.masterSources && Object.keys(saved.masterSources).length) {
          setMasterSources(
            Object.fromEntries(
              Object.entries(saved.masterSources).map(([id, source]) => [
                id,
                source ? {
                  ...source,
                  busy: false,
                  error: null,
                  visualComponent: {
                    ...emptyMasterRecognitionSource().visualComponent,
                    ...source.visualComponent,
                    busy: false,
                    error: null,
                  },
                } : source,
              ]),
            ) as MasterRecognitionSources,
          );
        }
        if (saved.activeMasterLang) setActiveMasterLang(saved.activeMasterLang);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      project,
      step,
      entry,
      lang,
      focusKey,
      draft,
      masterSources,
      activeMasterLang,
    }));
  }, [activeMasterLang, draft, entry, focusKey, lang, masterSources, project, step, storageReady]);

  const focusCfg = useMemo(() => {
    if (draft) return draft;
    return boardConfigOf(project, focusKey);
  }, [draft, project, focusKey]);

  const focusOverridden = isOverridden(project, focusKey);

  const update = useCallback((fn: (p: Project) => Project) => {
    setProject((prev) => {
      const next = fn(clone(prev));
      next.updatedAt = new Date().toISOString();
      return next;
    });
  }, []);

  const updateContent: StudioContext["updateContent"] = (patch) => {
    update((p) => ({ ...p, content: { ...p.content, ...patch } }));
  };

  const updateCopy: StudioContext["updateCopy"] = (id, patch) => {
    update((p) => ({
      ...p,
      content: {
        ...p.content,
        copy: {
          ...p.content.copy,
          [id]: { ...(p.content.copy[id] ?? emptyLangCopy()), ...patch },
        },
      },
    }));
  };

  const setTitleBreakChoice: StudioContext["setTitleBreakChoice"] = (id, targetKey, choice) => {
    update((p) => {
      const choices = { ...p.content.titleBreakChoices };
      const langChoices = { ...(choices[id] ?? {}) };
      if (choice.mode === "auto") {
        delete langChoices[targetKey];
      } else {
        langChoices[targetKey] = choice;
      }
      if (Object.keys(langChoices).length) choices[id] = langChoices;
      else delete choices[id];
      return { ...p, content: { ...p.content, titleBreakChoices: choices } };
    });
  };

  const setBrand: StudioContext["setBrand"] = (brand) => updateContent({ brand });

  const bindSourceFrame: StudioContext["bindSourceFrame"] = (id, frame) => {
    setLang(id);
    update((p) => {
      const langs = p.content.langs.includes(id) ? p.content.langs : [...p.content.langs, id];
      return {
        ...p,
        content: {
          ...p.content,
          langs,
          sourceFrames: { ...p.content.sourceFrames, [id]: frame },
          sourceFrame: frame,
        },
      };
    });
  };

  const addSourceLang: StudioContext["addSourceLang"] = () => {
    const next = nextUnusedLang(project.content.langs);
    if (!next) return;
    update((p) => ({ ...p, content: { ...p.content, langs: [...p.content.langs, next] } }));
    setLang(next);
  };

  const removeSourceLang: StudioContext["removeSourceLang"] = (id) => {
    if (project.content.langs.length <= 1) return;
    const langs = project.content.langs.filter((x) => x !== id);
    update((p) => {
      const sourceFrames = { ...p.content.sourceFrames };
      const logos = { ...p.content.logos };
      const logoPresets = { ...p.content.logoPresets };
      const titleBreakChoices = { ...p.content.titleBreakChoices };
      const copyLayoutAssignments = { ...p.content.copyLayoutAssignments };
      const ctaStyles = { ...p.content.ctaStyles };
      delete sourceFrames[id];
      delete logos[id];
      delete logoPresets[id];
      delete titleBreakChoices[id];
      delete copyLayoutAssignments[id];
      delete ctaStyles[id];
      return { ...p, content: { ...p.content, langs, sourceFrames, logos, logoPresets, titleBreakChoices, copyLayoutAssignments, ctaStyles } };
    });
    if (lang === id) setLang(langs[0]!);
  };

  const retargetSourceLang: StudioContext["retargetSourceLang"] = (from, to) => {
    if (from === to || project.content.langs.includes(to)) return;
    update((p) => {
      const langs = p.content.langs.map((x) => (x === from ? to : x));
      const sourceFrames = { ...p.content.sourceFrames };
      const logos = { ...p.content.logos };
      const logoPresets = { ...p.content.logoPresets };
      const titleBreakChoices = { ...p.content.titleBreakChoices };
      const copyLayoutAssignments = { ...p.content.copyLayoutAssignments };
      const ctaStyles = { ...p.content.ctaStyles };
      if (sourceFrames[from]) {
        sourceFrames[to] = sourceFrames[from];
        delete sourceFrames[from];
      }
      if (logos[from]) {
        logos[to] = logos[from];
        delete logos[from];
      }
      if (logoPresets[from]) {
        logoPresets[to] = logoPresets[from];
        delete logoPresets[from];
      }
      if (titleBreakChoices[from]) {
        titleBreakChoices[to] = titleBreakChoices[from];
        delete titleBreakChoices[from];
      }
      if (copyLayoutAssignments[from]) {
        copyLayoutAssignments[to] = copyLayoutAssignments[from];
        delete copyLayoutAssignments[from];
      }
      if (ctaStyles[from]) {
        ctaStyles[to] = ctaStyles[from];
        delete ctaStyles[from];
      }
      return {
        ...p,
        content: { ...p.content, langs, sourceFrames, logos, logoPresets, titleBreakChoices, copyLayoutAssignments, ctaStyles },
      };
    });
    if (lang === from) setLang(to);
  };

  const setEntry: StudioContext["setEntry"] = (m) => {
    setEntryState(m);
  };

  const toggleLang: StudioContext["toggleLang"] = (id) => {
    const has = project.content.langs.includes(id);
    const langs = has ? project.content.langs.filter((x) => x !== id) : [...project.content.langs, id];
    if (langs.length === 0) return;
    update((p) => {
      if (!has) return { ...p, content: { ...p.content, langs } };

      const ctaStyles = { ...p.content.ctaStyles };
      const copyLayoutPresets = { ...p.content.copyLayoutPresets };
      const copyLayoutSelections = { ...p.content.copyLayoutSelections };
      const copyLayoutAdjustments = { ...p.content.copyLayoutAdjustments };
      const copyLayoutAssignments = { ...p.content.copyLayoutAssignments };
      delete ctaStyles[id];
      delete copyLayoutPresets[id];
      delete copyLayoutSelections[id];
      delete copyLayoutAdjustments[id];
      delete copyLayoutAssignments[id];

      return {
        ...p,
        content: {
          ...p.content,
          langs,
          ctaStyles,
          copyLayoutPresets,
          copyLayoutSelections,
          copyLayoutAdjustments,
          copyLayoutAssignments,
        },
      };
    });
    if (!langs.includes(lang)) setLang(langs[0]!);
  };

  const setTargets: StudioContext["setTargets"] = (keys, customNames = {}) => {
    const targets: TargetBoard[] = [];
    for (const key of new Set(keys)) {
      const item = ALL_SIZES.find((s) => sizeKey(s.w, s.h) === key);
      if (item) {
        targets.push({ key, w: item.w, h: item.h, sizeId: item.id, use: item.use });
        continue;
      }
      const dimensions = key.match(/^(\d+)×(\d+)$/);
      if (dimensions) {
        const w = Number(dimensions[1]);
        const h = Number(dimensions[2]);
        const existing = project.targets.find((target) => target.key === key);
        if (w > 0 && h > 0) {
          targets.push({
            key,
            w,
            h,
            sizeId: `custom-${w}-${h}`,
            use: customNames[key]?.trim() || existing?.use || "自定义画幅",
          });
        }
      }
    }
    update((p) => ({ ...p, targets }));
    if (targets.length && !targets.some((t) => t.key === focusKey)) {
      setFocusKey(targets[0]!.key);
      setDraft(null);
    }
  };

  const patchShared: StudioContext["patchShared"] = (patch) => {
    update((p) => {
      const current = boardConfigOf(p, focusKey);
      const next = {
        ...current,
        ...patch,
        margin: { ...current.margin, ...patch.margin },
        show: { ...current.show, ...patch.show },
        extra: { ...current.extra, ...patch.extra },
      };
      return { ...p, overrides: { ...p.overrides, [focusKey]: next } };
    });
    setDraft(null);
  };

  const applySharedToAll = () => {
    const source = draft ?? boardConfigOf(project, focusKey);
    update((p) => ({ ...p, shared: clone(source), overrides: {} }));
    setDraft(null);
  };

  const applyDraftToFocus = () => {
    const source = draft ?? boardConfigOf(project, focusKey);
    update((p) => ({ ...p, overrides: { ...p.overrides, [focusKey]: clone(source) } }));
    setDraft(null);
  };

  const applyDraftToTargets: StudioContext["applyDraftToTargets"] = (keys) => {
    if (!keys.length) return;
    const source = draft ?? boardConfigOf(project, focusKey);
    update((p) => {
      const overrides = { ...p.overrides };
      keys.forEach((key) => {
        overrides[key] = clone(source);
      });
      return { ...p, overrides };
    });
    setDraft(null);
  };

  const discardDraft = () => setDraft(null);

  const resetProject = () => {
    const next = createDefaultProject();
    setProject(next);
    setStep(0);
    setEntryState("pick");
    setLang("en");
    setFocusKey(next.targets[0]?.key ?? "1080×1080");
    setDraft(null);
    setMasterSources({ en: emptyMasterRecognitionSource() });
    setActiveMasterLang("en");
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const snapshot = useMemo<StudioSnapshot>(() => ({
    project,
    step,
    entry,
    lang,
    focusKey,
    draft,
    masterSources,
    activeMasterLang,
  }), [activeMasterLang, draft, entry, focusKey, lang, masterSources, project, step]);

  const loadSnapshot: StudioContext["loadSnapshot"] = (next) => {
    const normalizedProject = normalizeProjectTargets(clone(next.project));
    setProject(normalizedProject);
    setStep(next.step >= 3 ? 2 : next.step >= 1 ? 1 : 0);
    setEntryState(next.entry);
    setLang(next.lang);
    setFocusKey(
      normalizedProject.targets.some((target) => target.key === next.focusKey)
        ? next.focusKey
        : normalizedProject.targets[0]?.key ?? "1080×1080",
    );
    setDraft(next.draft ? clone(next.draft) : null);
    setMasterSources(clone(next.masterSources));
    setActiveMasterLang(next.activeMasterLang);
  };

  const value: StudioContext = {
    project,
    step,
    setStep,
    entry,
    setEntry,
    lang,
    setLang,
    focusKey,
    setFocusKey: (k) => {
      setFocusKey(k);
      setDraft(null);
    },
    updateContent,
    updateCopy,
    setTitleBreakChoice,
    setBrand,
    toggleLang,
    bindSourceFrame,
    addSourceLang,
    removeSourceLang,
    retargetSourceLang,
    setTargets,
    patchShared,
    patchFocus: patchShared,
    applySharedToAll,
    applyDraftToFocus,
    applyDraftToTargets,
    discardDraft,
    resetProject,
    focusCfg,
    focusOverridden,
    hasDraft: draft !== null,
    masterSources,
    setMasterSources,
    activeMasterLang,
    setActiveMasterLang,
    snapshot,
    loadSnapshot,
    storageReady,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStudio 必须在 StudioProvider 内使用");
  return ctx;
}

export { BOARD_CONFIG_DEFAULT };
