"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ImageUp, Layers3, Link2, Loader2, X } from "lucide-react";
import {
  LANGS,
  NATIVE_SKINS,
  SCENE_FAMILY_LABEL,
  buildNativeBoard,
  buildSceneBoard,
  linkedPlacement,
  presetLogo,
  sceneFamilyOf,
  splashLogoOf,
  sceneSolution,
  sceneVersionView,
  type Lang,
  type NativeBoard,
  type SceneBoard,
  type SceneBoardRef,
  type SceneFamily,
  type SceneState,
  type TargetBoard,
} from "@futu/domain";
import type { BoardPlan, FigmaWriteResult } from "@futu/ports";
import { linkedOf, nativeOf, slotBoardRef, specOf } from "@futu/specs";
import { createWebPorts } from "@futu/adapters-web";
import { colorToHex } from "@/components/color-control";
import { Button, WorkflowSparkle } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import type { FigmaRecognitionResult } from "@/lib/figma-recognition";
import { buildLogoSvg } from "@/lib/logo-svg";
import { useFitBoard } from "@/lib/use-fit-board";
import { useScene, useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";
import { Dropdown } from "./font-picker";
import { SceneArtboard, SceneLinkedPreview } from "./scene-artboard";
import { SceneEditor } from "./scene-editor";
import { NativeBanner, NativeEditor, useNative, useNativeMeasure } from "./native-editor";

const ports = createWebPorts();
const INPUT = "h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] pl-8 pr-2.5 text-[10px] outline-none focus:border-[var(--color-brand)]";
const GHOST = "h-7 rounded-[4px] px-2.5 text-[10px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]";
const PILL_TABS = "flex rounded-full bg-[var(--app-surface-2)] p-1 text-[10px]";
const FEATHER_LABELS = ["关", "弱", "中", "强"] as const;
const FAMILY_ORDER: SceneFamily[] = ["strip", "landscape", "square", "portrait"];
const FAMILY_IDEAL: Record<SceneFamily, number> = { strip: 1080 / 225, landscape: 1.91, square: 1, portrait: 810 / 1110 };

export const sceneRef = slotBoardRef;

/** 把角标用到的 SVG 文件读成文本塞进画板数据，插件端直接 createNodeFromSvg。 */
async function inlineBadgeSvgs(boards: SceneBoard[]) {
  const urls = new Set<string>();
  for (const board of boards) {
    for (const layer of board.layers) {
      if (layer.badge?.bgUrl) urls.add(layer.badge.bgUrl);
      if (layer.badge?.markUrl) urls.add(layer.badge.markUrl);
    }
  }
  const texts = new Map<string, string>();
  await Promise.all([...urls].map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`角标素材读取失败：${url}`);
    texts.set(url, await response.text());
  }));
  return boards.map((board) => ({
    ...board,
    layers: board.layers.map((layer) => layer.badge ? {
      ...layer,
      badge: {
        ...layer.badge,
        ...(layer.badge.bgUrl ? { bgSvg: texts.get(layer.badge.bgUrl) } : {}),
        ...(layer.badge.markUrl ? { markSvg: texts.get(layer.badge.markUrl) } : {}),
      },
    } : layer),
  }));
}

/** 仿原生用到的 ICON / 箭头读成 SVG 文本，配图读成 PNG base64，插件端不能访问平台 URL。 */
async function inlineNativeAssets(boards: NativeBoard[]) {
  const urls = new Set<string>();
  for (const board of boards) {
    for (const node of board.nodes) {
      if (node.kind === "svg" || node.kind === "image") urls.add(node.url);
      if (node.kind === "link") urls.add(node.chevron.url);
    }
  }
  const assets: Record<string, string> = {};
  await Promise.all([...urls].map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`仿原生素材读取失败：${url}`);
    if (url.endsWith(".svg")) {
      assets[url] = await response.text();
      return;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    assets[url] = btoa(binary);
  }));
  return assets;
}

function pillTab(active: boolean) {
  return cn(
    "h-7 rounded-full px-4 transition-colors",
    active ? "bg-[var(--app-page)] text-[var(--app-text)] shadow-sm" : "text-[var(--app-text-3)] hover:text-[var(--app-text)]",
  );
}

/** 取图片四边像素的平均色作为默认画板底色；跨域图片读不到像素时返回 null。 */
async function sampleEdgeColor(src: string): Promise<string | null> {
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    await image.decode();
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (x > 1 && y > 1 && x < size - 2 && y < size - 2) continue;
        const offset = (y * size + x) * 4;
        if (data[offset + 3]! < 200) continue;
        r += data[offset]!;
        g += data[offset + 1]!;
        b += data[offset + 2]!;
        count += 1;
      }
    }
    if (!count) return null;
    return colorToHex(`rgb(${r / count}, ${g / count}, ${b / count})`);
  } catch {
    return null;
  }
}

async function readUpload(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法读取图片");
    context.drawImage(image, 0, 0, width, height);
    const png = file.type === "image/png";
    let transparent = false;
    if (png) {
      const { data } = context.getImageData(0, 0, width, height);
      for (let index = 3; index < data.length; index += 16) {
        if (data[index]! < 250) {
          transparent = true;
          break;
        }
      }
    }
    return {
      dataUrl: canvas.toDataURL(png ? "image/png" : "image/jpeg", 0.92),
      width,
      height,
      type: png ? "png" as const : "jpg" as const,
      transparent,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** 版式族只收独立排版的画板；闪屏设备尺寸由母版联动生成、仿原生用固定模板，都不进族。 */
export function sceneFamilies(targets: TargetBoard[]) {
  return FAMILY_ORDER.map((family) => {
    const items = targets.filter((target) => !linkedOf(target) && !nativeOf(target) && sceneFamilyOf(target.w, target.h) === family);
    const representative = [...items].sort((a, b) => {
      const specA = specOf(a.w, a.h, a.sizeId)?.spec ? 0 : 1;
      const specB = specOf(b.w, b.h, b.sizeId)?.spec ? 0 : 1;
      if (specA !== specB) return specA - specB;
      return Math.abs(Math.log(a.w / a.h / FAMILY_IDEAL[family])) - Math.abs(Math.log(b.w / b.h / FAMILY_IDEAL[family]));
    })[0];
    return { family, items, representative };
  }).filter((group) => group.items.length && group.representative) as Array<{ family: SceneFamily; items: TargetBoard[]; representative: TargetBoard }>;
}

const langName = (id: string) => LANGS.find((item) => item.id === id)?.name ?? id;

/** 当前语种或自定义版本对应的场景视图。 */
function useActiveVersion() {
  const { project, lang, versionId } = useStudio();
  const { scene } = useScene();
  const version = scene.versions?.find((item) => item.id === versionId && item.lang === lang && project.content.langs.includes(item.lang)) ?? null;
  const view = useMemo(() => sceneVersionView(scene, version), [scene, version]);
  return { version, view };
}

/** 左侧版本栏：语种与基于语种的自定义版本（如「英文版2」「英文无 Logo 版」）。仿原生按语种出图，只列语种。 */
function VersionRail({ langsOnly = false }: { langsOnly?: boolean }) {
  const { project, lang, versionId, setLang, setVersion, toggleLang } = useStudio();
  const { scene, updateScene } = useScene();
  const langs = project.content.langs;
  const versions = langsOnly ? [] : (scene.versions ?? []).filter((item) => langs.includes(item.lang));
  const activeVersion = versions.find((item) => item.id === versionId && item.lang === lang) ?? null;
  const activeLang = langs.includes(lang) ? lang : langs[0]!;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [base, setBase] = useState<Lang>(activeLang);
  const [renaming, setRenaming] = useState<string | null>(null);
  useEffect(() => {
    if (activeLang !== lang) setLang(activeLang);
  }, [activeLang, lang, setLang]);

  const create = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const basis = langs.includes(base) ? base : activeLang;
    const id = `v-${Date.now().toString(36)}`;
    updateScene((current) => ({ ...current, versions: [...(current.versions ?? []), { id, name: trimmed, lang: basis }] }));
    setVersion(id, basis);
    setAdding(false);
    setName("");
  };
  const rename = (id: string, value: string) => {
    const trimmed = value.trim();
    if (trimmed) updateScene((current) => ({ ...current, versions: (current.versions ?? []).map((item) => item.id === id ? { ...item, name: trimmed } : item) }));
    setRenaming(null);
  };
  const remove = (id: string, lang: Lang) => {
    updateScene((current) => ({ ...current, versions: (current.versions ?? []).filter((item) => item.id !== id) }));
    if (versionId === id) setLang(lang);
  };
  const row = (active: boolean, indent: boolean) => cn(
    "group flex h-8 cursor-pointer items-center gap-1 rounded-[4px] px-2 text-[10px]",
    indent && "pl-5",
    active ? "bg-[var(--app-surface-3)] text-[var(--app-text)]" : "text-[var(--app-text-2)] hover:bg-[var(--app-surface-2)]",
  );
  const removeButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="grid size-5 shrink-0 place-items-center rounded-[3px] text-[var(--app-text-4)] opacity-0 hover:text-[var(--app-text)] group-hover:opacity-100"
    >
      <X size={11} />
    </button>
  );

  return (
    <aside className="flex w-[132px] shrink-0 flex-col overflow-y-auto border-r border-[var(--app-line)] py-3 pr-3">
      <div className="mb-2 text-[11px] font-semibold">版本</div>
      <div className="space-y-0.5">
        {langs.map((id) => (
          <Fragment key={id}>
            <div role="button" tabIndex={0} onClick={() => setLang(id)} onKeyDown={(event) => event.key === "Enter" && setLang(id)} className={row(!activeVersion && activeLang === id, false)}>
              <span className="min-w-0 flex-1 truncate">{langName(id)}</span>
              {langs.length > 1 ? removeButton(`移除${langName(id)}`, () => toggleLang(id)) : null}
            </div>
            {versions.filter((item) => item.lang === id).map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                title={`基于${langName(item.lang)} · 双击重命名`}
                onClick={() => setVersion(item.id, item.lang)}
                onDoubleClick={() => setRenaming(item.id)}
                onKeyDown={(event) => event.key === "Enter" && setVersion(item.id, item.lang)}
                className={row(activeVersion?.id === item.id, true)}
              >
                {renaming === item.id ? (
                  <input
                    autoFocus
                    aria-label="版本名称"
                    defaultValue={item.name}
                    onClick={(event) => event.stopPropagation()}
                    onBlur={(event) => rename(item.id, event.target.value)}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter") rename(item.id, event.currentTarget.value);
                      if (event.key === "Escape") setRenaming(null);
                    }}
                    className="h-6 min-w-0 flex-1 rounded-[3px] border border-[var(--app-line-strong)] bg-[var(--app-field)] px-1.5 text-[10px] outline-none"
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                )}
                {renaming === item.id ? null : removeButton(`删除${item.name}`, () => remove(item.id, item.lang))}
              </div>
            ))}
          </Fragment>
        ))}
      </div>

      {adding ? (
        <div className="mt-2 space-y-1.5 rounded-[4px] border border-[var(--app-line)] p-1.5">
          <input
            autoFocus
            aria-label="新版本名称"
            value={name}
            placeholder="如 英文版2"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") create();
              if (event.key === "Escape") setAdding(false);
            }}
            className="h-7 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2 text-[10px] outline-none focus:border-[var(--app-line-strong)]"
          />
          <Dropdown
            label="基于语种"
            size="sm"
            value={langs.includes(base) ? base : activeLang}
            options={langs.map((id) => ({ id, label: `基于${langName(id)}` }))}
            onChange={(id) => setBase(id as Lang)}
          />
          <div className="flex gap-1">
            <button type="button" disabled={!name.trim()} onClick={create} className={cn(GHOST, "flex-1 bg-[var(--app-surface-2)] px-0 disabled:opacity-40")}>添加</button>
            <button type="button" onClick={() => setAdding(false)} className={cn(GHOST, "flex-1 px-0")}>取消</button>
          </div>
        </div>
      ) : null}
      <div className="mt-2 flex flex-col items-start gap-1">
        {LANGS.filter((item) => !langs.includes(item.id)).map((item) => (
          <button key={item.id} type="button" onClick={() => toggleLang(item.id)} className={cn(GHOST, "px-2")}>+ {item.name}</button>
        ))}
        {adding || langsOnly ? null : (
          <button
            type="button"
            onClick={() => {
              setBase(activeLang);
              setAdding(true);
            }}
            className={cn(GHOST, "px-2")}
          >
            + 自定义
          </button>
        )}
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* 第一步：准备主视觉                                                   */
/* ------------------------------------------------------------------ */

function SubjectEditor({ src, aspect }: { src?: string; aspect: number }) {
  const { scene, updateScene } = useScene();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: "move" | "resize" | "focal"; x: number; y: number; box: typeof scene.safeBox; focal: typeof scene.focal } | null>(null);

  const begin = (event: ReactPointerEvent<HTMLElement>, kind: "move" | "resize" | "focal") => {
    event.stopPropagation();
    drag.current = { kind, x: event.clientX, y: event.clientY, box: scene.safeBox, focal: scene.focal };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    const rect = ref.current?.getBoundingClientRect();
    if (!state || !rect) return;
    const dx = (event.clientX - state.x) / rect.width;
    const dy = (event.clientY - state.y) / rect.height;
    const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
    const round = (value: number) => Math.round(value * 1000) / 1000;
    updateScene((current) => {
      if (state.kind === "focal") {
        return { ...current, focal: { x: round(clamp(state.focal.x + dx)), y: round(clamp(state.focal.y + dy)) } };
      }
      if (state.kind === "move") {
        return {
          ...current,
          safeBox: {
            ...state.box,
            x: round(clamp(state.box.x + dx, 0, 1 - state.box.w)),
            y: round(clamp(state.box.y + dy, 0, 1 - state.box.h)),
          },
        };
      }
      return {
        ...current,
        safeBox: {
          ...state.box,
          w: round(clamp(state.box.w + dx, 0.08, 1 - state.box.x)),
          h: round(clamp(state.box.h + dy, 0.08, 1 - state.box.y)),
        },
      };
    });
  };
  const end = (event: ReactPointerEvent<HTMLElement>) => {
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handlers = { onPointerMove: move, onPointerUp: end, onPointerCancel: end };

  return (
    <div ref={ref} className="relative max-h-full max-w-full select-none" style={{ aspectRatio: `${aspect}`, width: "100%" }}>
      {src ? <img src={src} alt="" draggable={false} className="absolute inset-0 size-full object-contain" /> : null}
      {scene.visualMode === "upload" && scene.feather > 0 ? (
        <div className="pointer-events-none absolute inset-0">
          {(["right", "left", "bottom", "top"] as const).map((direction) => {
            const edge = `${[0, 8, 14, 20][scene.feather]! * (direction === "left" || direction === "right" ? Math.min(1, 1 / aspect) : Math.min(1, aspect))}%`;
            const side = direction === "right" ? { left: 0, top: 0, bottom: 0, width: edge } : direction === "left" ? { right: 0, top: 0, bottom: 0, width: edge } : direction === "bottom" ? { top: 0, left: 0, right: 0, height: edge } : { bottom: 0, left: 0, right: 0, height: edge };
            return <span key={direction} className="absolute" style={{ ...side, backgroundImage: `linear-gradient(to ${direction}, ${scene.background}, transparent)` }} />;
          })}
        </div>
      ) : null}
      <div
        role="presentation"
        onPointerDown={(event) => begin(event, "move")}
        {...handlers}
        className="absolute cursor-move border border-dashed border-[var(--color-brand)]"
        style={{ left: `${scene.safeBox.x * 100}%`, top: `${scene.safeBox.y * 100}%`, width: `${scene.safeBox.w * 100}%`, height: `${scene.safeBox.h * 100}%` }}
      >
        <span className="absolute left-1 top-1 rounded-[3px] bg-[#111317] px-1.5 py-0.5 text-[8px] text-[var(--app-text-2)]">主体保护区</span>
        <span
          role="presentation"
          onPointerDown={(event) => begin(event, "resize")}
          {...handlers}
          className="absolute -bottom-1 -right-1 size-2 cursor-nwse-resize rounded-[1px] border border-[var(--color-brand)] bg-white"
        />
      </div>
      <span
        role="presentation"
        onPointerDown={(event) => begin(event, "focal")}
        {...handlers}
        title="焦点：延展时这一点对齐到主视觉锚点"
        className="absolute grid size-4 -translate-x-1/2 -translate-y-1/2 cursor-crosshair place-items-center rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.45)]"
        style={{ left: `${scene.focal.x * 100}%`, top: `${scene.focal.y * 100}%` }}
      >
        <span className="size-1 rounded-full bg-[var(--color-brand)]" />
      </span>
    </div>
  );
}

export function ScenePrepareStep({ onNext }: { onNext: () => void }) {
  const { project, updateContent } = useStudio();
  const { scene, updateScene } = useScene();
  const kv = project.content.kv;
  const [url, setUrl] = useState(kv?.source === "figma" ? kv.figmaUrl ?? "" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mode = scene.visualMode;
  const figmaReady = kv?.source === "figma" && Boolean(kv.figmaUrl);
  const uploadReady = kv?.source === "upload" && Boolean(kv.previewUrl?.startsWith("data:"));
  const ready = mode === "figma" ? figmaReady : uploadReady;
  const previewSrc = ready ? kv?.previewUrl : undefined;
  const fit = useFitBoard(scene.visualAspect * 1000, 1000, 48);

  const adoptBackground = async (src: string | undefined) => {
    if (!src) return;
    const edge = await sampleEdgeColor(src);
    if (edge) updateScene((current) => ({ ...current, background: edge }));
  };

  const recognize = async () => {
    if (busy) {
      abortRef.current?.abort();
      return;
    }
    if (!url.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 90_000);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/figma/recognize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          url,
          target: "visual-component",
          token: window.sessionStorage.getItem("futu:figma-token") ?? undefined,
        }),
      });
      const data = (await response.json()) as FigmaRecognitionResult | { error: string };
      if (!response.ok || "error" in data) throw new Error("error" in data ? data.error : "识别失败");
      updateContent({
        kv: {
          id: data.frame.componentId ?? data.frame.id,
          name: data.frame.name,
          source: "figma",
          kind: "component",
          figmaUrl: url,
          previewUrl: data.previewUrl,
        },
      });
      setFrame({ w: data.frame.width, h: data.frame.height });
      updateScene((current) => ({ ...current, visualMode: "figma", feather: 0, visualAspect: data.frame.width / Math.max(1, data.frame.height) }));
      void adoptBackground(data.previewUrl);
    } catch (cause) {
      setError(controller.signal.aborted ? "已取消或识别超时，请重试" : cause instanceof Error ? cause.message : "识别失败");
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
      abortRef.current = null;
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setError("只支持 PNG 或 JPG 图片");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const image = await readUpload(file);
      updateContent({
        kv: {
          id: `upload-${Date.now().toString(36)}`,
          name: file.name.replace(/\.[^.]+$/, ""),
          source: "upload",
          kind: "component",
          previewUrl: image.dataUrl,
        },
      });
      updateScene((current) => ({
        ...current,
        visualMode: "upload",
        uploadType: image.type,
        upload: { name: file.name, width: image.width, height: image.height },
        visualAspect: image.width / image.height,
        feather: image.transparent ? 0 : Math.max(current.feather, 2),
      }));
      setFrame({ w: image.width, h: image.height });
      if (!image.transparent) void adoptBackground(image.dataUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "图片读取失败");
    } finally {
      setBusy(false);
    }
  };

  const size = frame ?? (scene.upload && mode === "upload" ? { w: scene.upload.width, h: scene.upload.height } : null);
  const generatedLayers = mode === "upload"
    ? [
      ["主视觉组件", "Component · 写入时在 Figma 创建"],
      ["底图", `Image · ${scene.uploadType.toUpperCase()}`],
      ...(scene.feather > 0 ? [["四边过渡 × 4", `渐变到画板底色 ${scene.background.toUpperCase()}`]] : []),
    ]
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mx-auto mb-4 flex shrink-0">
        <div className={PILL_TABS}>
          <button type="button" className={pillTab(mode === "figma")} onClick={() => updateScene((current) => ({ ...current, visualMode: "figma" }))}>识别 Figma 主视觉组件</button>
          <button type="button" className={pillTab(mode === "upload")} onClick={() => updateScene((current) => ({ ...current, visualMode: "upload" }))}>上传图片并转换为组件</button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-3 rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-3">
        {mode === "figma" ? (
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="shrink-0 text-[10px] font-medium">主视觉组件链接</h2>
            <label className="relative block min-w-0 flex-1">
              <Link2 size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-3)]" />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && !busy && recognize()}
                placeholder="粘贴主视觉 Component / Instance 链接"
                className={INPUT}
              />
            </label>
            <Button size="sm" disabled={!busy && !url.trim()} onClick={recognize}>
              {busy ? <><X size={12} />取消识别</> : figmaReady ? "重新识别" : "识别组件"}
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="shrink-0 text-[10px] font-medium">主视觉图片</h2>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }} />
            <Button size="sm" icon={busy ? <Loader2 size={12} className="animate-spin" /> : <ImageUp size={12} />} disabled={busy} onClick={() => fileRef.current?.click()}>
              {uploadReady ? "更换图片" : "选择 PNG / JPG"}
            </Button>
            <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--app-text-3)]">
              {uploadReady && scene.upload ? `${scene.upload.name} · ${scene.upload.width} × ${scene.upload.height}` : "PNG 保留透明通道作为主体；JPG 没有透明通道，靠主体保护区和四边过渡融入底色"}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[9px] text-[var(--app-text-4)]">四边过渡</span>
              <Segmented
                size="sm"
                value={String(scene.feather)}
                onChange={(value) => updateScene((current) => ({ ...current, feather: Number(value) }))}
                options={FEATHER_LABELS.map((label, index) => ({ id: String(index), label }))}
              />
            </div>
          </div>
        )}
      </div>
      {error ? <div className="mt-1.5 px-1 text-[9px] text-[var(--color-up)]">{error}</div> : null}

      <div className="mt-4 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_280px] gap-3">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-[5px] border border-[var(--app-line)] bg-[#111317]">
          <div className="flex items-center justify-between border-b border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-2 text-[9px]">
            <span className="text-[var(--app-text-3)]">主视觉组件</span>
            <span className={busy ? "text-[var(--color-brand)]" : ready ? "text-[var(--color-down)]" : "text-[var(--color-warn)]"}>
              {busy ? (mode === "figma" ? "识别中" : "读取中") : ready ? (mode === "figma" ? "已识别" : "已转换") : "待准备"}
            </span>
          </div>
          <div ref={fit.ref} className="grid min-h-0 flex-1 place-items-center overflow-hidden p-6">
            {ready ? (
              <div style={{ width: fit.width, background: scene.background }}>
                <SubjectEditor src={previewSrc} aspect={scene.visualAspect} />
              </div>
            ) : busy ? (
              <Loader2 size={20} className="animate-spin text-[var(--app-text-4)]" />
            ) : (
              <div className="text-center">
                {mode === "figma" ? <Layers3 size={21} className="mx-auto text-[var(--app-text-4)]" /> : <ImageUp size={21} className="mx-auto text-[var(--app-text-4)]" />}
                <div className="mt-2 text-[10px] text-[var(--app-text-4)]">{mode === "figma" ? "识别后预览主视觉组件" : "上传后直接在这里转换，不跳转页面"}</div>
              </div>
            )}
          </div>
          {ready ? (
            <div className="border-t border-[var(--app-line)] px-3 py-2 text-[9px] text-[var(--app-text-4)]">
              拖动虚线框标出不可遮挡的主体，拖右下角调整大小；拖动白色圆点设置焦点，延展时焦点对齐到主视觉锚点。
            </div>
          ) : null}
        </div>

        <aside className="min-h-0 overflow-y-auto border-l border-[var(--app-line)] pl-4">
          <div className="text-[11px] font-semibold">组件信息</div>
          <dl className="mt-2 space-y-1.5 text-[10px]">
            <div className="flex justify-between gap-3"><dt className="text-[var(--app-text-4)]">名称</dt><dd className="truncate">{ready ? kv?.name : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--app-text-4)]">来源</dt><dd>{ready ? (mode === "figma" ? "Figma 组件" : `上传 ${scene.uploadType.toUpperCase()}`) : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--app-text-4)]">尺寸</dt><dd className="tabular-nums">{ready && size ? `${size.w} × ${size.h}` : ready ? `比例 ${scene.visualAspect.toFixed(2)}` : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--app-text-4)]">焦点</dt><dd className="tabular-nums">{scene.focal.x.toFixed(2)}, {scene.focal.y.toFixed(2)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-[var(--app-text-4)]">主体保护区</dt><dd className="tabular-nums">{Math.round(scene.safeBox.w * 100)}% × {Math.round(scene.safeBox.h * 100)}%</dd></div>
          </dl>

          {mode === "upload" ? (
            <>
              <div className="mt-5 text-[11px] font-semibold">将生成的图层</div>
              <div className="mt-2 space-y-1">
                {generatedLayers.map(([name, note]) => (
                  <div key={name} className="rounded-[4px] bg-[var(--app-surface-2)] px-2.5 py-2 text-[10px]">
                    <div>{name}</div>
                    <div className="mt-0.5 text-[9px] text-[var(--app-text-4)]">{note}</div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-[var(--app-text-4)]">
                {scene.uploadType === "jpg" ? "JPG 不做自动抠图：主体保护区用于避让检查，四边过渡负责与底色衔接。" : "PNG 透明区域直接透出画板底色。"}
              </p>
            </>
          ) : (
            <p className="mt-5 text-[9px] leading-relaxed text-[var(--app-text-4)]">写入时创建该组件的 Instance，不复制图层；组件自带的暗角和过渡保持原样。</p>
          )}
        </aside>
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-end gap-2">
        <Button size="lg" disabled>上一步</Button>
        <Button variant="workflow" size="lg" disabled={!ready || busy} onClick={onNext}>下一步：选择资源位</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 第三步：配置内容与样式                                               */
/* ------------------------------------------------------------------ */

export function SceneConfigStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { project, lang } = useStudio();
  const { scene, updateScene } = useScene();
  const families = useMemo(() => sceneFamilies(project.targets), [project.targets]);
  const hasNative = project.targets.some((target) => nativeOf(target));
  const saved = scene.savedFamilies ?? [];
  const [familyId, setFamilyId] = useState<SceneFamily | "native" | null>(() => families.find((item) => !saved.includes(item.family))?.family ?? families[0]?.family ?? (hasNative ? "native" : null));
  const nativeOpen = hasNative && (familyId === "native" || !families.length);
  const active = nativeOpen ? undefined : families.find((item) => item.family === familyId) ?? families[0];
  const unsaved = families.filter((item) => !saved.includes(item.family));
  const activeSaved = active ? saved.includes(active.family) : false;
  const nextUnsaved = unsaved.find((item) => item.family !== active?.family);

  const savePreset = () => {
    if (!active) return;
    updateScene((current) => ({ ...current, savedFamilies: [...new Set([...(current.savedFamilies ?? []), active.family])] }));
    if (nextUnsaved) setFamilyId(nextUnsaved.family);
  };

  if (!active && !nativeOpen) {
    return (
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <div className="text-[13px] font-semibold">还没有选择资源位</div>
          <Button className="mt-4" variant="workflow" size="lg" onClick={onBack}>返回选择资源位</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <span className="text-[9px] text-[var(--app-text-4)]">版式族</span>
        {families.map((group) => {
          const done = saved.includes(group.family);
          return (
            <button
              key={group.family}
              type="button"
              title={done ? "已保存预设" : "未保存预设"}
              onClick={() => setFamilyId(group.family)}
              className={cn("flex h-7 items-center gap-1.5 rounded-[4px] px-3 text-[10px]", active?.family === group.family ? "bg-[var(--color-brand-soft)] text-[var(--app-text)]" : "text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)]")}
            >
              {done ? <CheckCircle2 size={11} className="text-[var(--color-down)]" /> : <span className="size-1.5 rounded-full border border-[var(--app-text-4)]" />}
              {SCENE_FAMILY_LABEL[group.family]} · {group.items.length}
            </button>
          );
        })}
        {hasNative ? (
          <button
            type="button"
            onClick={() => setFamilyId("native")}
            className={cn("flex h-7 items-center gap-1.5 rounded-[4px] px-3 text-[10px]", nativeOpen ? "bg-[var(--color-brand-soft)] text-[var(--app-text)]" : "text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)]")}
          >
            仿原生
          </button>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 gap-3">
        <VersionRail langsOnly={!active} />
        <div className="min-h-0 min-w-0 flex-1">
          {active ? (
            <SceneEditor
              mode="family"
              board={{ ...sceneRef(active.representative), use: active.representative.use }}
              lang={lang}
              familyBoards={active.items}
            />
          ) : (
            <NativeEditor />
          )}
        </div>
      </div>
      <div className="mt-3 flex shrink-0 items-center justify-between">
        <div className="text-[10px] text-[var(--app-text-4)]">
          {families.length ? (
            <>
              已保存 {families.length - unsaved.length}/{families.length} 个版式族预设
              {unsaved.length ? `，还差 ${unsaved.map((item) => SCENE_FAMILY_LABEL[item.family]).join("、")}` : ""}
            </>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button size="lg" onClick={onBack}>上一步</Button>
          {!active ? (
            nextUnsaved ? <Button size="lg" onClick={() => setFamilyId(nextUnsaved.family)}>下一个：{SCENE_FAMILY_LABEL[nextUnsaved.family]}</Button> : null
          ) : !activeSaved ? (
            <Button size="lg" onClick={savePreset}>
              保存{SCENE_FAMILY_LABEL[active.family]}预设{nextUnsaved ? `，下一个：${SCENE_FAMILY_LABEL[nextUnsaved.family]}` : ""}
            </Button>
          ) : nextUnsaved ? (
            <Button size="lg" onClick={() => setFamilyId(nextUnsaved.family)}>下一个：{SCENE_FAMILY_LABEL[nextUnsaved.family]}</Button>
          ) : null}
          <Button variant="workflow" size="lg" icon={<WorkflowSparkle />} disabled={unsaved.length > 0} onClick={onNext}>批量生成</Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 第四步：批量生成并精调                                               */
/* ------------------------------------------------------------------ */

function Thumb({ scene, target, lang, selected, onOpen }: { scene: SceneState; target: TargetBoard; lang: Lang; selected?: boolean; onOpen: () => void }) {
  const { project } = useStudio();
  const ref = sceneRef(target);
  const issues = buildSceneBoard(scene, ref, lang).issues;
  const width = Math.min(220, 128 * (target.w / target.h));
  const overridden = Object.keys(scene.boardOverrides[target.key] ?? {}).length > 0;
  const spec = specOf(target.w, target.h, target.sizeId)?.spec;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={issues.length ? issues.map((issue) => issue.text).join("\n") : undefined}
      className={cn(
        "min-w-0 rounded-[6px] border p-2 text-left",
        selected ? "border-[var(--color-brand)]" : issues.length ? "border-[var(--color-warn)]/50 hover:border-[var(--color-warn)]" : "border-[var(--app-line)] hover:border-[var(--app-line-strong)]",
      )}
    >
      <div className="grid h-[136px] place-items-center rounded-[4px] bg-[#111317]">
        <SceneArtboard scene={scene} board={ref} lang={lang} kvUrl={project.content.kv?.previewUrl} width={width} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium tabular-nums">{target.key}</span>
        <span className={cn("text-[9px]", issues.length ? "text-[var(--warn-text)]" : "text-[var(--color-down)]")}>
          {issues.length ? `${issues.length} 项提示` : "检查通过"}
        </span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 text-[9px] text-[var(--app-text-4)]">
        <span className="truncate">{target.use}</span>
        <span className="shrink-0">{ref.edgeFade ? `两侧底色 ${scene.background.toUpperCase()}` : overridden ? "已单独调整" : spec ? "已录规范" : "规范待录"}</span>
      </div>
    </button>
  );
}

export function SceneBatchStep({ onBack }: { onBack: () => void }) {
  const { project, lang } = useStudio();
  const { scene } = useScene();
  const { view } = useActiveVersion();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [page, setPage] = useState<"new" | "current">("new");
  const [arrange, setArrange] = useState<"group" | "lang" | "flat">("group");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<FigmaWriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bridgeLabel, setBridgeLabel] = useState("");
  const families = useMemo(() => sceneFamilies(project.targets), [project.targets]);
  const kv = project.content.kv;
  const visualReady = scene.visualMode === "figma"
    ? kv?.source === "figma" && Boolean(kv.figmaUrl)
    : kv?.source === "upload" && Boolean(kv.previewUrl?.startsWith("data:"));

  useEffect(() => {
    void ports.figma.identity().then((identity) => setBridgeLabel(identity.label));
  }, []);

  /** 每个语种和自定义版本各出一套；自定义版本用版本 id 作为 plan.lang，便于区分与重试。 */
  const outputs = useMemo(() => [
    ...project.content.langs.map((id) => ({ id: id as string, lang: id, label: id as string, view: scene })),
    ...(scene.versions ?? []).filter((item) => project.content.langs.includes(item.lang)).map((item) => ({ id: item.id, lang: item.lang, label: item.name, view: sceneVersionView(scene, item) })),
  ], [project.content.langs, scene]);
  const outputLabel = (id: string) => outputs.find((item) => item.id === id)?.label ?? langName(id);
  const boardTargets = useMemo(() => project.targets.filter((target) => !nativeOf(target)), [project.targets]);
  const nativeTargets = useMemo(() => project.targets.filter((target) => nativeOf(target)), [project.targets]);
  const linkedTargets = useMemo(() => boardTargets.filter((target) => linkedOf(target)), [boardTargets]);
  const { state: native } = useNative();
  const { measure, version: fontVersion } = useNativeMeasure();
  /** 仿原生每个语种出深浅两块；key 带上肤色，失败重试按块定位。 */
  const nativePlans = useMemo<BoardPlan[]>(() => nativeTargets.flatMap((target) => project.content.langs.flatMap((lang) => NATIVE_SKINS.map((skin) => {
    const board = buildNativeBoard(native, skin.id, lang, measure);
    return {
      key: `${target.key}·${skin.id}`,
      lang,
      name: `${project.name} / ${target.use ? `${target.use}-` : ""}${target.w}*${target.h} / ${langName(lang)} / ${skin.name}`,
      solution: sceneSolution(sceneRef(target)),
      backgroundColor: board.background,
      native: { ...board, assets: {} },
    };
  // fontVersion 变化代表字体加载完成，需要重新量宽度。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }))), [measure, native, nativeTargets, project.content.langs, project.name, fontVersion]);
  /** 联动画板排在最后：插件先建母版，再用母版组件实例生成设备尺寸。 */
  const boardPlans = useMemo<BoardPlan[]>(() => outputs.flatMap((output) => [
    ...boardTargets.filter((target) => !linkedOf(target)),
    ...linkedTargets,
  ].map((target) => {
    const link = linkedOf(target);
    const masterTarget = link ? project.targets.find((item) => item.sizeId === link.master.id) : undefined;
    const ref = sceneRef(masterTarget ?? target);
    const board = buildSceneBoard(output.view, ref, output.lang);
    const name = `${project.name} / ${target.use ? `${target.use}-` : ""}${target.w}*${target.h} / ${output.label}`;
    if (link && masterTarget) {
      const place = linkedPlacement(link.linked, target, masterTarget);
      return {
        key: target.key,
        lang: output.id,
        name,
        solution: sceneSolution(sceneRef(target)),
        backgroundColor: "#FFFFFF",
        scene: board,
        linked: { masterKey: masterTarget.key, scale: place.scale, x: place.x, bar: link.linked.bar, logo: link.linked.logo },
      };
    }
    return {
      key: target.key,
      lang: output.id,
      name,
      solution: sceneSolution(ref),
      backgroundColor: scene.background,
      scene: board,
      ...(board.layers.some((layer) => layer.role === "logo") ? { logo: presetLogo(scene.logoPreset) } : {}),
    };
  })), [boardTargets, linkedTargets, outputs, project.name, project.targets, scene.background, scene.logoPreset]);
  const plans = useMemo(() => [...boardPlans, ...nativePlans], [boardPlans, nativePlans]);
  const issueCount = plans.reduce((sum, plan) => sum + (plan.linked ? 0 : plan.native ? plan.native.issues.length : plan.scene?.issues.length ?? 0), 0);
  /** 当前语种下有提示的画板，「只看有提示」按它筛。 */
  const issueKeys = useMemo(
    () => new Set(boardTargets.filter((target) => !linkedOf(target) && buildSceneBoard(view, sceneRef(target), lang).issues.length).map((target) => target.key)),
    [boardTargets, lang, view],
  );
  const shownFamilies = onlyIssues
    ? families.map((group) => ({ ...group, items: group.items.filter((target) => issueKeys.has(target.key)) })).filter((group) => group.items.length)
    : families;
  const needsVisual = boardPlans.length > 0;

  useEffect(() => {
    setDone(null);
  }, [plans]);

  const run = async (only?: FigmaWriteResult["failures"]) => {
    const failed = (plan: BoardPlan) => Boolean(only?.some((failure) => failure.key === plan.key && failure.lang === plan.lang));
    const subset = only
      ? plans.filter((plan) => failed(plan) || plans.some((item) => item.linked?.masterKey === plan.key && item.lang === plan.lang && failed(item)))
      : plans;
    if (!subset.length || (subset.some((plan) => !plan.native) && !kv)) return;
    setBusy(true);
    setDone(null);
    setError(null);
    try {
      const logoSvg = subset.some((plan) => plan.logo) ? await buildLogoSvg(scene.logoPreset) : undefined;
      const splashSvg = subset.some((plan) => plan.linked) ? await fetch(splashLogoOf(scene.logoPreset).url).then((res) => res.text()) : undefined;
      const regular = subset.filter((plan) => !plan.native);
      const scenes = await inlineBadgeSvgs(regular.map((plan) => plan.scene!));
      const nativeAssets = await inlineNativeAssets(subset.flatMap((plan) => plan.native ? [plan.native] : []));
      const boards = subset.map((plan) => plan.native ? { ...plan, native: { ...plan.native, assets: nativeAssets } } : {
        ...plan,
        scene: scenes[regular.indexOf(plan)],
        ...(logoSvg && plan.logo ? { logoSvg } : {}),
        ...(plan.linked ? { linked: { ...plan.linked, logoSvg: splashSvg } } : {}),
      });
      const result = await ports.figma.write(boards, {
        page,
        pageName: project.name,
        arrange,
        ...(kv && regular.length ? { visualComponent: kv } : {}),
        ...(scene.visualMode === "upload" ? { uploadFeather: { level: scene.feather, color: scene.background } } : {}),
      });
      setDone(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Figma 写入失败");
    } finally {
      setBusy(false);
    }
  };

  const masterOf = (target: TargetBoard) => {
    const link = linkedOf(target);
    return link ? project.targets.find((item) => item.sizeId === link.master.id) : undefined;
  };
  const openIndex = boardTargets.findIndex((target) => target.key === openKey);
  const openRaw = openIndex >= 0 ? boardTargets[openIndex] : undefined;
  const openTarget = openRaw ? masterOf(openRaw) ?? openRaw : undefined;
  if (openTarget) {
    const family = sceneFamilyOf(openTarget.w, openTarget.h);
    const familyBoards = families.find((item) => item.family === family)?.items ?? [openTarget];
    const step = (delta: number) => {
      const next = boardTargets[(openIndex + delta + boardTargets.length) % boardTargets.length];
      if (next) setOpenKey(next.key);
    };
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="mb-3 flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => setOpenKey(null)} className={cn(GHOST, "flex items-center gap-1")}><ArrowLeft size={12} />全部画板</button>
          <span className="text-[9px] text-[var(--app-text-4)]">{openIndex + 1} / {boardTargets.length}</span>
          <button type="button" aria-label="上一块画板" onClick={() => step(-1)} className="grid size-7 place-items-center rounded-[4px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"><ChevronLeft size={13} /></button>
          <button type="button" aria-label="下一块画板" onClick={() => step(1)} className="grid size-7 place-items-center rounded-[4px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"><ChevronRight size={13} /></button>
        </div>
        <div className="flex min-h-0 flex-1 gap-3">
          <VersionRail />
          <div className="min-h-0 min-w-0 flex-1">
            <SceneEditor
              mode="board"
              board={{ ...sceneRef(openTarget), use: openTarget.use }}
              lang={lang}
              familyBoards={familyBoards}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[auto_minmax(0,1fr)_320px] gap-3">
      <VersionRail />
      <section className="flex min-h-0 flex-col">
        <div className="mb-3 flex shrink-0 items-center gap-3">
          <span className="text-[12px] font-semibold">{plans.length} 块画板</span>
          <span className={cn("text-[9px]", issueCount ? "text-[var(--warn-text)]" : "text-[var(--color-down)]")}>
            {issueCount ? `共 ${issueCount} 项提示，点击画板逐个精调` : "全部检查通过"}
          </span>
          {issueKeys.size || onlyIssues ? (
            <button
              type="button"
              aria-pressed={onlyIssues}
              onClick={() => setOnlyIssues((value) => !value)}
              className={cn(GHOST, "ml-auto", onlyIssues && "bg-[var(--app-surface-2)] text-[var(--app-text)]")}
            >
              {onlyIssues ? `只看有提示 · ${issueKeys.size}` : "只看有提示"}
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {onlyIssues && !shownFamilies.length ? <div className="py-8 text-center text-[10px] text-[var(--app-text-4)]">{langName(lang)}画板全部检查通过</div> : null}
          {shownFamilies.map((group) => (
            <div key={group.family} className="mb-4">
              <div className="mb-2 text-[10px] text-[var(--app-text-3)]">{SCENE_FAMILY_LABEL[group.family]} · {group.items.length}</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                {group.items.map((target) => (
                  <Thumb key={target.key} scene={view} target={target} lang={lang} onOpen={() => setOpenKey(target.key)} />
                ))}
              </div>
            </div>
          ))}
          {linkedTargets.length ? (
            <div className="mb-4">
              <div className="mb-2 text-[10px] text-[var(--app-text-3)]">闪屏联动 · {linkedTargets.length}</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
                {linkedTargets.map((target) => {
                  const link = linkedOf(target)!;
                  const master = masterOf(target);
                  if (!master) return null;
                  return (
                    <button
                      key={target.key}
                      type="button"
                      onClick={() => setOpenKey(master.key)}
                      className="flex flex-col items-center gap-1.5 rounded-[5px] bg-[var(--app-surface-2)] p-2 hover:bg-[var(--app-surface-3)]"
                    >
                      <SceneLinkedPreview
                        scene={view}
                        master={sceneRef(master)}
                        board={sceneRef(target)}
                        linked={link.linked}
                        lang={lang}
                        kvUrl={kv?.previewUrl}
                        logoUrl={splashLogoOf(scene.logoPreset).url}
                        width={Math.min(110, Math.round((160 * target.w) / target.h))}
                      />
                      <span className="w-full truncate text-center text-[9px] text-[var(--app-text-3)]">{target.use} · {target.w}×{target.h}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {nativeTargets.length ? (
            <div className="mb-4">
              <div className="mb-2 text-[10px] text-[var(--app-text-3)]">仿原生 · {langName(lang)} · {nativePlans.length} 块</div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
                {nativePlans.filter((plan) => plan.lang === lang).map((plan) => (
                  <button key={plan.key} type="button" title="回第三步修改仿原生" onClick={onBack} className="min-w-0 rounded-[6px] border border-[var(--app-line)] p-2 text-left hover:border-[var(--app-line-strong)]">
                    <div className="grid h-[136px] place-items-center rounded-[4px] bg-[#111317]">
                      <NativeBanner board={plan.native!} width={200} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium tabular-nums">1080×225 · {NATIVE_SKINS.find((skin) => plan.key.endsWith(skin.id))?.name}</span>
                      <span className={cn("text-[9px]", plan.native!.issues.length ? "text-[var(--warn-text)]" : "text-[var(--color-down)]")}>
                        {plan.native!.issues.length ? `${plan.native!.issues.length} 项提示` : "检查通过"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <aside className="flex min-h-0 flex-col border-l border-[var(--app-line)] pl-4">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div>
            <div className="text-[11px] font-semibold">写入 Figma</div>
            <div className="mt-3 space-y-3">
              <div>
                <div className="mb-1.5 text-[10px] text-[var(--app-text-3)]">目标页</div>
                <Segmented value={page} onChange={setPage} options={[{ id: "new", label: "新建一页" }, { id: "current", label: "当前页" }]} />
              </div>
              <div>
                <div className="mb-1.5 text-[10px] text-[var(--app-text-3)]">排列</div>
                <Segmented value={arrange} onChange={setArrange} options={[{ id: "group", label: "按尺寸" }, { id: "lang", label: "按语种" }, { id: "flat", label: "平铺" }]} />
              </div>
              <div className="rounded-[5px] border border-[var(--app-line)] bg-[var(--app-surface-2)] p-2.5 text-[10px]">
                <div className="text-[var(--app-text-3)]">在 Figma Desktop 中加载 <code className="text-[var(--color-brand)]">figma-plugin/manifest.json</code>，保持插件开启后填入配对码：</div>
                <code className="mt-1.5 block select-all text-[12px] text-[var(--app-text)]">{bridgeLabel || "正在生成…"}</code>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold">本次写入</div>
            <dl className="mt-2 space-y-1.5 text-[10px]">
              <div className="flex justify-between"><dt className="text-[var(--app-text-4)]">画板</dt><dd className="tabular-nums">{boardTargets.length} 个尺寸 × {outputs.length} 个版本 = {boardPlans.length} 块</dd></div>
              {nativePlans.length ? <div className="flex justify-between"><dt className="text-[var(--app-text-4)]">仿原生</dt><dd className="tabular-nums">{project.content.langs.length} 个语种 × 深浅 = {nativePlans.length} 块</dd></div> : null}
              <div className="flex justify-between"><dt className="text-[var(--app-text-4)]">主视觉</dt><dd className="truncate pl-3">{visualReady ? kv?.name : "未准备"}</dd></div>
              <div className="flex justify-between"><dt className="text-[var(--app-text-4)]">单独调整</dt><dd className="tabular-nums">{Object.values(scene.boardOverrides).filter((item) => Object.keys(item).length).length} 块</dd></div>
            </dl>
            {issueCount ? (
              <p className="mt-2 text-[9px] leading-relaxed text-[var(--warn-text)]">仍有 {issueCount} 项提示。提示不阻塞写入，但写入后需在 Figma 中人工复核。</p>
            ) : null}
          </div>

          {error ? <p className="text-[11px] leading-relaxed text-[var(--color-up)]">{error}</p> : null}
          {done ? (
            <div className="flex items-start gap-2 rounded-[5px] border border-[var(--app-line)] p-2.5">
              <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--color-down)]" />
              <div className="text-[10px]">
                <div className="font-medium">{done.ok ? "已写入 Figma" : "写入完成，但有部分画板失败"}</div>
                <div className="mt-1 text-[var(--app-text-3)]">成功 {done.nodes.length} 块，失败 {done.failures.length} 块</div>
                {done.failures.slice(0, 4).map((failure) => (
                  <div key={`${failure.key}-${failure.lang}`} className="mt-1 text-[9px] text-[var(--color-up)]">{failure.key} · {outputLabel(failure.lang)}：{failure.error}</div>
                ))}
                {done.failures.length ? (
                  <button type="button" disabled={busy} onClick={() => run(done.failures)} className={cn(GHOST, "mt-1.5 -ml-2.5")}>只重试失败的 {done.failures.length} 块</button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-3 flex shrink-0 justify-end gap-2 border-t border-[var(--app-line)] pt-3">
          <Button size="lg" disabled={busy} onClick={onBack}>上一步</Button>
          <Button variant="workflow" size="lg" icon={busy ? undefined : <WorkflowSparkle />} disabled={busy || !plans.length || (needsVisual && !visualReady)} onClick={() => run()}>
            {busy ? <><Loader2 size={14} className="animate-spin" />等待写入 {plans.length} 块…</> : needsVisual && !visualReady ? "请先准备主视觉" : `写入 Figma · ${plans.length} 块`}
          </Button>
        </div>
      </aside>
    </div>
  );
}
