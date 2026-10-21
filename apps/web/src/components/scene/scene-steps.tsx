"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { toBlob } from "html-to-image";
import JSZip from "jszip";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Copy, CopyPlus, Download, Eye, EyeOff, ImageUp, Layers3, Link2, Loader2, Lock, LockOpen, MousePointerClick, RotateCcw, X } from "lucide-react";
import {
  LANGS,
  NATIVE_SKINS,
  SCENE_FAMILY_LABEL,
  buildNativeBoard,
  buildSceneBoard,
  linkedPlacement,
  presetLogo,
  sceneBoardLocked,
  sceneBucketLocked,
  sceneBoardFamily,
  sceneFamilyAlign,
  sceneLanguageBoardView,
  splashLogoOf,
  sceneSolution,
  sceneVersionView,
  type Lang,
  type NativeBoard,
  type SceneBoard,
  type SceneBoardRef,
  type SceneBucket,
  type SceneFamily,
  type SceneState,
  type SceneVersion,
  type TargetBoard,
} from "@futu/domain";
import type { BoardPlan, FigmaWriteResult } from "@futu/ports";
import { SIZE_GROUPS, isOfflineSlot, linkedOf, nativeOf, slotBoardRef, slotBucket, specOf } from "@futu/specs";
import { createWebPorts } from "@futu/adapters-web";
import { colorToHex } from "@/components/color-control";
import { Button, WorkflowSparkle } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { parseFigmaUrl } from "@/lib/figma-link";
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
const INPUT = "h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] pl-8 pr-2.5 text-[10px] outline-none hover:border-[var(--app-line-strong)] focus:border-[var(--app-line-strong)]";
const GHOST = "h-7 rounded-[4px] px-2.5 text-[10px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]";
const PILL_TABS = "flex rounded-full bg-[var(--app-surface-2)] p-1 text-[10px]";
const FEATHER_LABELS = ["关", "弱", "中", "强"] as const;
const FAMILY_ORDER: SceneFamily[] = ["strip", "landscape", "square", "portrait"];
const FAMILY_IDEAL: Record<SceneFamily, number> = { strip: 1080 / 225, landscape: 1.91, square: 1, portrait: 810 / 1110 };
const BATCH_ASIDE_STORE = "futu:scene-batch-aside-width";
const BATCH_ASIDE_LIMITS = [360, 640] as const;
/** 至少容纳两张 200px 卡片和间距；卡片内部再按实际宽度缩放预览。 */
const BATCH_BOARD_MIN_WIDTH = 440;
const FIGMA_ARRANGE_OPTIONS = [
  { id: "group" as const, label: "按尺寸" },
  { id: "lang" as const, label: "按语言" },
  { id: "flat" as const, label: "平铺" },
] as const;

function InstallGuideVisual({ step }: { step: 3 | 4 }) {
  if (step === 3) {
    return (
      <div role="img" aria-label="在 Figma 开发菜单中选择从清单导入插件" className="relative mt-2 aspect-[2.2/1] w-full max-w-[260px] select-none overflow-hidden rounded-[4px] border border-[#3d3d3d] bg-[#858585] text-[6px] leading-none text-[#e8e8e8]">
        <div className="flex h-[18%] items-center bg-[#2c2c2c] px-2">
          <span className="relative block h-3.5 w-2.5" aria-hidden="true">
            <span className="absolute left-0 top-0 size-[5px] rounded-full bg-[#f24e1e]" />
            <span className="absolute right-0 top-0 size-[5px] rounded-full bg-[#ff7262]" />
            <span className="absolute left-0 top-[4px] size-[5px] rounded-full bg-[#a259ff]" />
            <span className="absolute right-0 top-[4px] size-[5px] rounded-full bg-[#1abcfe]" />
            <span className="absolute left-0 top-[8px] size-[5px] rounded-full bg-[#0acf83]" />
          </span>
          <span className="ml-auto flex size-3 items-center justify-center rounded-[2px] border border-[#8a8a8a]">
            <span className="h-2 w-px bg-[#8a8a8a]" />
          </span>
        </div>
        <div className="absolute inset-y-[18%] left-0 w-[19%] border-r border-[#454545] bg-[#2b2b2b]" />
        <div className="absolute left-[3%] top-[24%] w-[37%] rounded-[3px] border border-[#3a3a3a] bg-[#202020] p-1 shadow-lg">
          {["文件", "编辑", "查看", "对象", "文本"].map((item) => (
            <div key={item} className="px-1.5 py-px text-[#d8d8d8]">{item}<span className="float-right text-[#8c8c8c]">›</span></div>
          ))}
          <div className="rounded-[2px] border border-[#696969] bg-[#3b3b3b] px-1.5 py-px">插件<span className="float-right">›</span></div>
        </div>
        <div className="absolute left-[38%] top-[43%] w-[35%] rounded-[3px] border border-[#3a3a3a] bg-[#202020] p-1.5 shadow-lg">
          <div className="px-1.5 py-[2px] text-[#a8a8a8]">已保存的插件</div>
          <div className="my-1 h-px bg-[#3a3a3a]" />
          <div className="rounded-[2px] border border-[#696969] bg-[#3b3b3b] px-1.5 py-[2px]">开发<span className="float-right">›</span></div>
          <div className="px-1.5 py-[2px] text-[#d8d8d8]">管理插件…</div>
        </div>
        <div className="absolute left-[71%] top-[58%] w-[27%] rounded-[3px] border border-[#3a3a3a] bg-[#202020] p-1.5 shadow-lg">
          <div className="px-1.5 py-[2px] text-[#d8d8d8]">新建插件…</div>
          <div className="rounded-[2px] border border-[#696969] bg-[#3b3b3b] px-1.5 py-[2px] leading-tight">
            从清单导入插件…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div role="img" aria-label="在文件选择窗口中选择 manifest.json" className="mt-2 aspect-[2.2/1] w-full max-w-[260px] select-none overflow-hidden rounded-[4px] border border-[#3d3d3d] bg-[#242424] text-[6px] text-[#dedede]">
      <div className="flex h-[18%] items-center justify-between border-b border-[#424242] px-2">
        <span className="font-medium">选择插件清单</span>
        <span className="text-[#898989]">×</span>
      </div>
      <div className="flex h-[62%]">
        <div className="w-[27%] border-r border-[#3a3a3a] bg-[#202020] p-2 text-[#8f8f8f]">
          <div className="mb-1.5 text-[#d6d6d6]">最近使用</div>
          <div className="mb-1">桌面</div>
          <div>下载</div>
        </div>
        <div className="flex-1 p-2">
          <div className="mb-2 text-[#888]">延展连接器 〉</div>
          <div className="flex items-center gap-2 rounded-[3px] border border-[#696969] bg-[#343434] px-2 py-1.5">
            <span className="grid size-4 place-items-center rounded-[2px] bg-[#575757] font-mono text-[6px] text-white">{`{ }`}</span>
            <span className="font-mono text-[#f1f1f1]">manifest.json</span>
          </div>
        </div>
      </div>
      <div className="flex h-[20%] items-center justify-end gap-1.5 border-t border-[#424242] px-2">
        <span className="rounded-[2px] px-2 py-1 text-[#aaa]">取消</span>
        <span className="rounded-[2px] bg-[#0d66d0] px-2 py-1 font-medium text-white">打开</span>
      </div>
    </div>
  );
}

export const sceneRef = slotBoardRef;

function safeFileName(value: string) {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim() || "未命名";
}

function uniqueArchivePath(path: string, used: Set<string>) {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const dot = path.lastIndexOf(".");
  const base = dot > path.lastIndexOf("/") ? path.slice(0, dot) : path;
  const extension = dot > path.lastIndexOf("/") ? path.slice(dot) : "";
  let index = 2;
  let next = `${base}-${index}${extension}`;
  while (used.has(next)) {
    index += 1;
    next = `${base}-${index}${extension}`;
  }
  used.add(next);
  return next;
}

const boardSizeLabel = (board: Pick<TargetBoard, "w" | "h">) => `${board.w} × ${board.h}`;
const SLOT_ITEM_BY_ID = new Map(SIZE_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item] as const)));
const EXTERNAL_SLOT_IDS = new Set(SIZE_GROUPS.find((group) => group.id === "external")?.items.map((item) => item.id) ?? []);
const isExternalTarget = (target: Pick<TargetBoard, "sizeId">) => Boolean(target.sizeId && EXTERNAL_SLOT_IDS.has(target.sizeId));
const boardUseLabel = (target: Pick<TargetBoard, "sizeId" | "use">) => {
  const item = target.sizeId ? SLOT_ITEM_BY_ID.get(target.sizeId) : undefined;
  return item ? `${item.use}${item.variant ? ` ${item.variant}` : ""}` : target.use;
};
const boardDisplayLabel = (target: Pick<TargetBoard, "w" | "h" | "sizeId" | "use">) => (
  isExternalTarget(target) || !boardUseLabel(target)
    ? boardSizeLabel(target)
    : `${boardSizeLabel(target)} ${boardUseLabel(target)}`
);
const boardFileStem = (target: Pick<TargetBoard, "w" | "h" | "sizeId" | "use">) => (
  isExternalTarget(target) || !boardUseLabel(target)
    ? boardSizeLabel(target)
    : `${boardSizeLabel(target)}_${boardUseLabel(target)}`
);
const figmaBoardName = (target: Pick<TargetBoard, "w" | "h" | "sizeId" | "use">) => (
  boardUseLabel(target)?.trim() || "未命名画板"
);
const figmaFrameName = (target: Pick<TargetBoard, "w" | "h" | "sizeId" | "use">, language: string) => (
  `${figmaBoardName(target)}｜${boardSizeLabel(target)}｜${language}`
);

async function imageDataUrl(src?: string) {
  if (!src || src.startsWith("data:")) return src;
  const response = await fetch(src);
  if (!response.ok) throw new Error("主视觉图片读取失败，无法导出图片");
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("主视觉图片读取失败，无法导出图片"));
    reader.readAsDataURL(blob);
  });
}

async function waitForRenderedAssets(node: HTMLElement) {
  await document.fonts.ready;
  await Promise.all([...node.querySelectorAll("img")].map((image) => image.complete
    ? Promise.resolve()
    : new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    })));
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function clampBatchAsideWidth(width: number, layoutMax: number = BATCH_ASIDE_LIMITS[1]) {
  const max = Math.max(BATCH_ASIDE_LIMITS[0], Math.min(BATCH_ASIDE_LIMITS[1], layoutMax));
  return Math.round(Math.max(BATCH_ASIDE_LIMITS[0], Math.min(max, width)));
}

/** 把角标用到的 SVG 文件读成文本塞进画板数据，插件端直接 createNodeFromSvg。 */
async function inlineBadgeSvgs(boards: SceneBoard[], signal?: AbortSignal) {
  const urls = new Set<string>();
  for (const board of boards) {
    for (const layer of board.layers) {
      if (layer.badge?.bgUrl) urls.add(layer.badge.bgUrl);
      if (layer.badge?.markUrl) urls.add(layer.badge.markUrl);
    }
  }
  const texts = new Map<string, string>();
  await Promise.all([...urls].map(async (url) => {
    const response = await fetch(url, { signal });
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
async function inlineNativeAssets(boards: NativeBoard[], signal?: AbortSignal) {
  const urls = new Set<string>();
  for (const board of boards) {
    for (const node of board.nodes) {
      if (node.kind === "svg" || node.kind === "image") urls.add(node.url);
      if (node.kind === "link") urls.add(node.chevron.url);
    }
  }
  const assets: Record<string, string> = {};
  await Promise.all([...urls].map(async (url) => {
    const response = await fetch(url, { signal });
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

export type SceneEditKind = "layout" | "outside" | "offline" | "splash" | "background" | "special";

export interface SceneEditGroup {
  id: SceneBucket;
  kind: SceneEditKind;
  label: string;
  items: TargetBoard[];
  representative: TargetBoard;
  /**
   * 只有特殊规范组锁版式（只改内容与样式，不用保存预设）。
   * 版式组不锁：族里的位置、对齐、字号、图层顺序照常改，规范画板按偏移叠在自己的规范锚点上。
   */
  locked: boolean;
}

export const SCENE_EDIT_KIND_LABEL: Record<SceneEditKind, string> = { layout: "站内/官网版式", outside: "站外版式", offline: "线下版式", splash: "闪屏母版", background: "纯背景", special: "特殊规范" };

const ALIGN_LABEL = { left: "左对齐", center: "居中", right: "右对齐" } as const;
const ALIGN_ORDER = ["left", "center", "right"] as const;
/** 没有规范锚点时，分组的代表画幅优先取最常用的尺寸。 */
const STANDARD_SIZE: Partial<Record<SceneFamily, readonly [number, number]>> = { strip: [1080, 225] };
const familyShort = (family: SceneFamily) => SCENE_FAMILY_LABEL[family].replace(/族$/, "");
/** 资源位指定了版式族的（如 300×250 归方版族）按指定的，否则按宽高比。 */
const targetFamily = (target: TargetBoard) => sceneBoardFamily(slotBoardRef(target));
/** 站外版式的分组顺序：各画幅族，通栏后面接超扁幅（代表画幅 728×90）。 */
const OUTSIDE_SEGMENTS: Array<{ id: string; family: SceneFamily; label: string; standard?: readonly [number, number] }> = FAMILY_ORDER.flatMap((family) => [
  { id: family, family, label: SCENE_FAMILY_LABEL[family] },
  ...(family === "strip" ? [{ id: "strip@ultra", family, label: "超扁幅", standard: [728, 90] as const }] : []),
]);
/** 站外 / 自定义画板所在的站外版式分组 id。 */
const outsideSegmentOf = (target: TargetBoard) => slotBucket(target) ?? targetFamily(target);

/**
 * 第三步的编辑分组：
 *  - 版式：站内/官网有规范或首选对齐的按「对齐 × 画幅」合组（如「左对齐 · 通栏」），其后是站外 / 自定义的画幅族；
 *  - 线下版式：每个实体店物料独立编辑，不与其它画幅共用；
 *  - 闪屏母版：只在选了闪屏时出现；
 *  - 特殊规范：只出主视觉、或版式结构合不进去的，按规范模板各自一组。
 * 闪屏设备尺寸由母版联动生成、仿原生用固定模板，都不进分组。
 */
export function sceneEditGroups(targets: TargetBoard[]): SceneEditGroup[] {
  const free = targets.filter((target) => !linkedOf(target) && !nativeOf(target));
  const fixed = new Map<string, TargetBoard[]>();
  for (const target of free) {
    const bucket = slotBucket(target);
    if (bucket) fixed.set(bucket, [...(fixed.get(bucket) ?? []), target]);
  }
  /** 特殊规范里排版不锁的资源位单独一组（`族@own:资源位`）。 */
  const isSpecialBucket = (id: string) => sceneBucketLocked(id) || id.includes("@own:");
  const sizeCount = new Map<string, number>();
  for (const [id, items] of fixed) {
    if (!isSpecialBucket(id)) continue;
    const size = `${items[0]!.w}×${items[0]!.h}`;
    sizeCount.set(size, (sizeCount.get(size) ?? 0) + 1);
  }
  const special: SceneEditGroup[] = [];
  const background: SceneEditGroup[] = [];
  const offline: SceneEditGroup[] = [];
  const splash: SceneEditGroup[] = [];
  for (const [id, items] of fixed) {
    const representative = items[0]!;
    if (id.includes("@offline:") && isOfflineSlot(representative)) {
      offline.push({
        id,
        kind: "offline",
        label: `${representative.w}×${representative.h} · ${representative.use ?? ""}`.trim(),
        items,
        representative,
        locked: false,
      });
      continue;
    }
    if (id.includes("@splash")) splash.push({ id, kind: "splash", label: SCENE_EDIT_KIND_LABEL.splash, items, representative, locked: false });
    if (!isSpecialBucket(id)) continue;
    const size = `${representative.w}×${representative.h}`;
    const variant = specOf(representative.w, representative.h, representative.sizeId)?.item.variant;
    const label = (sizeCount.get(size) ?? 0) > 1 ? `${size} · ${representative.use ?? ""}${variant ? `（${variant}）` : ""}`.trim() : size;
    const kind = slotBoardRef(representative).layout?.visualFill ? "background" : "special";
    (kind === "background" ? background : special).push({ id, kind, label, items, representative, locked: sceneBucketLocked(id) });
  }
  const aligned = ALIGN_ORDER.flatMap((align) => FAMILY_ORDER.flatMap((family): SceneEditGroup[] => {
    const id = `${family}@align:${align}`;
    const items = fixed.get(id);
    if (!items?.length) return [];
    /** 代表画板优先取有规范锚点的：族里的位置改动记成相对锚点的偏移，组里每块画板都跟着挪。 */
    const anchored = items.find((target) => {
      const layout = slotBoardRef(target).layout;
      return layout?.group && !layout.soft;
    });
    const standard = STANDARD_SIZE[family];
    const typical = standard ? items.find((target) => target.w === standard[0] && target.h === standard[1]) : undefined;
    return [{ id, kind: "layout", label: `${ALIGN_LABEL[align]} · ${familyShort(family)}`, items, representative: anchored ?? typical ?? items[0]!, locked: false }];
  }));
  /** 站外 / 自定义按画幅族；超扁幅另成一族排在通栏族后面。 */
  const families = OUTSIDE_SEGMENTS.flatMap(({ id, family, label, standard }): SceneEditGroup[] => {
    const items = id.includes("@") ? fixed.get(id) ?? [] : free.filter((target) => !slotBucket(target) && targetFamily(target) === family);
    const typical = standard ? items.find((target) => target.w === standard[0] && target.h === standard[1]) : undefined;
    const representative = typical ?? [...items].sort((a, b) => {
      const specA = specOf(a.w, a.h, a.sizeId)?.spec ? 0 : 1;
      const specB = specOf(b.w, b.h, b.sizeId)?.spec ? 0 : 1;
      if (specA !== specB) return specA - specB;
      return Math.abs(Math.log(a.w / a.h / FAMILY_IDEAL[family])) - Math.abs(Math.log(b.w / b.h / FAMILY_IDEAL[family]));
    })[0];
    return representative ? [{ id, kind: "outside", label, items, representative, locked: false }] : [];
  });
  return [...aligned, ...families, ...offline, ...splash, ...background, ...special];
}

/** 画幅族里混进的站内/官网资源位都是规范未注明的。 */
export function unspecifiedInApp(group: SceneEditGroup) {
  return group.kind === "outside" ? group.items.filter((target) => !slotBucket(target) && specOf(target.w, target.h, target.sizeId)?.isInApp && target.sizeId) : [];
}

const langName = (id: string) => LANGS.find((item) => item.id === id)?.name ?? id;

/** 当前语种或自定义版本对应的场景视图。 */
function useActiveVersion() {
  const { lang, versionId } = useStudio();
  const { scene } = useScene();
  const version = scene.versions?.find((item) => item.id === versionId && item.lang === lang) ?? null;
  const view = useMemo(() => sceneVersionView(scene, version), [scene, version]);
  return { version, view };
}

/** 左侧版本栏：语种与基于语种的自定义版本（如「英文版2」「英文无 Logo 版」）。仿原生按语种出图，只列语种。 */
function VersionRail({ langsOnly = false }: { langsOnly?: boolean }) {
  const { project, lang, versionId, setLang, setVersion, toggleLang } = useStudio();
  const { scene, updateScene } = useScene();
  const langs = project.content.langs;
  const versions = langsOnly ? [] : (scene.versions ?? []);
  const activeVersion = versions.find((item) => item.id === versionId && item.lang === lang) ?? null;
  const activeLang = activeVersion?.lang ?? (langs.includes(lang) ? lang : langs[0]!);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [base, setBase] = useState<Lang>(activeLang);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [settings, setSettings] = useState<{ id: string; name: string } | null>(null);
  const [railWidth, setRailWidth] = useState(132);
  const resize = useRef<{ x: number; width: number } | null>(null);
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
    if (trimmed) updateScene((current) => {
      const item = current.versions?.find((entry) => entry.id === id);
      if (!item || (current.lockedLanguages?.includes(item.lang) && !item.independent)) return current;
      return { ...current, versions: (current.versions ?? []).map((entry) => entry.id === id ? { ...entry, name: trimmed } : entry) };
    });
    setRenaming(null);
  };
  /** 复制的是当下看到的内容快照；后续文字、局部高亮和显隐都只写进新版本。 */
  const copyVersion = (source: SceneVersion | null, sourceLang: Lang) => {
    const id = `v-${Date.now().toString(36)}`;
    updateScene((current) => {
      const original = source ? current.versions?.find((item) => item.id === source.id) ?? source : null;
      const languageModules = current.languageModules?.[sourceLang];
      const languageView = {
        ...current,
        elements: languageModules
          ? current.elements.map((item) => languageModules[item.id] ? { ...item, module: languageModules[item.id] } : item)
          : current.elements,
        familyEdits: { ...current.familyEdits, ...current.languageFamilyEdits?.[sourceLang] } as SceneState["familyEdits"],
        boardOverrides: { ...current.boardOverrides, ...current.languageBoardOverrides?.[sourceLang] } as SceneState["boardOverrides"],
      };
      const view = sceneVersionView(languageView, original);
      const elements = view.elements;
      const texts = Object.fromEntries(elements.map((item) => [item.id, item.texts[sourceLang] ?? ""]));
      const highlights = Object.fromEntries(elements.map((item) => [item.id, structuredClone(view.highlights[item.id]?.[sourceLang] ?? [])]));
      const fontRuns = Object.fromEntries(elements.map((item) => [item.id, structuredClone(view.fontRuns?.[item.id]?.[sourceLang] ?? [])]));
      const modules = Object.fromEntries(elements.flatMap((item) => item.module ? [[item.id, structuredClone(item.module)]] : []));
      const globalVisibility = current.languageVisibility?.[sourceLang]?.["*"] ?? {};
      const visibility = Object.fromEntries(elements.map((item) => [item.id, globalVisibility[item.id] ?? item.visible]));
      const version = {
        id,
        name: `${source?.name ?? langName(sourceLang)} 副本`,
        lang: sourceLang,
        independent: true,
        texts,
        highlights,
        fontRuns,
        visibility,
        modules,
        removed: structuredClone(original?.removed ?? []),
        badgeStyles: structuredClone(view.badgeStyles ?? {}),
        familyEdits: structuredClone(view.familyEdits),
        boardOverrides: structuredClone(view.boardOverrides),
      };
      const versions = [...(current.versions ?? [])];
      const sourceIndex = source
        ? versions.findIndex((item) => item.id === source.id)
        : versions.findIndex((item) => item.lang === sourceLang);
      versions.splice(sourceIndex < 0 ? versions.length : source ? sourceIndex + 1 : sourceIndex, 0, version);
      return {
        ...current,
        versions,
      };
    });
    setVersion(id, sourceLang);
    setSettings({ id, name: `${source?.name ?? langName(sourceLang)} 副本` });
  };
  const applySettings = () => {
    if (!settings || !settings.name.trim()) return;
    updateScene((current) => ({
      ...current,
      versions: (current.versions ?? []).map((item) => {
        if (item.id !== settings.id) return item;
        return { ...item, name: settings.name.trim() };
      }),
    }));
    setSettings(null);
  };
  const remove = (id: string, lang: Lang) => {
    const item = scene.versions?.find((entry) => entry.id === id);
    if (scene.lockedLanguages?.includes(lang) && !item?.independent) return;
    updateScene((current) => ({ ...current, versions: (current.versions ?? []).filter((item) => item.id !== id) }));
    if (versionId === id) setLang(lang);
  };
  const toggleLanguageLock = (id: Lang) => updateScene((current) => {
    const locked = new Set(current.lockedLanguages ?? []);
    if (locked.has(id)) locked.delete(id);
    else locked.add(id);
    return { ...current, lockedLanguages: [...locked] };
  });
  const toggleLanguageOutput = (id: Lang) => updateScene((current) => {
    const hidden = new Set(current.hiddenLanguages ?? []);
    if (hidden.has(id)) hidden.delete(id);
    else hidden.add(id);
    return { ...current, hiddenLanguages: [...hidden] };
  });
  const toggleVersionLock = (id: string) => updateScene((current) => ({
    ...current,
    versions: (current.versions ?? []).map((item) => item.id === id ? { ...item, locked: !item.locked } : item),
  }));
  const toggleVersionOutput = (id: string) => updateScene((current) => ({
    ...current,
    versions: (current.versions ?? []).map((item) => item.id === id ? { ...item, hidden: !item.hidden } : item),
  }));
  const row = (active: boolean, indent: boolean) => cn(
    "group flex h-8 cursor-pointer items-center gap-0.5 rounded-[4px] px-2 text-[10px]",
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
      className="grid size-4 shrink-0 place-items-center rounded-[3px] text-[var(--app-text-4)] opacity-0 hover:text-[var(--app-text)] group-hover:opacity-100"
    >
      <X size={10} />
    </button>
  );

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    resize.current = { x: event.clientX, width: railWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!resize.current) return;
    setRailWidth(Math.max(118, Math.min(260, resize.current.width + event.clientX - resize.current.x)));
  };
  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    resize.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <aside style={{ width: railWidth }} className="relative flex shrink-0 flex-col overflow-x-hidden overflow-y-auto border-r border-[var(--app-line)] py-3 pr-2">
      <div className="mb-2 text-[11px] font-semibold">版本</div>
      <div className="space-y-0.5">
        {langs.map((id) => (
          <Fragment key={id}>
            <div role="button" tabIndex={0} onClick={() => setLang(id)} onKeyDown={(event) => event.key === "Enter" && setLang(id)} className={row(!activeVersion && activeLang === id, false)}>
              <span className="min-w-0 flex-1 truncate">{langName(id)}</span>
              <button
                type="button"
                aria-label={`${scene.lockedLanguages?.includes(id) ? "解锁" : "锁定"}${langName(id)}`}
                title={scene.lockedLanguages?.includes(id) ? "解锁后可编辑该语言" : "锁定该语言，防止任何改动"}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLanguageLock(id);
                }}
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-[3px] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]",
                  scene.lockedLanguages?.includes(id) ? "bg-[var(--app-surface-3)] text-[var(--app-text)]" : "text-[var(--app-text-4)]",
                )}
              >
                {scene.lockedLanguages?.includes(id) ? <Lock size={10} /> : <LockOpen size={10} />}
              </button>
              <button
                type="button"
                aria-label={`${scene.hiddenLanguages?.includes(id) ? "加入" : "排除"}${langName(id)}批量生成`}
                title={scene.hiddenLanguages?.includes(id) ? "当前不生成；点击恢复批量生成" : "隐藏后批量生成将跳过该语言"}
                onClick={(event) => {
                  event.stopPropagation();
                  toggleLanguageOutput(id);
                }}
                className={cn(
                  "grid size-4 shrink-0 place-items-center rounded-[3px] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]",
                  scene.hiddenLanguages?.includes(id) ? "text-[var(--app-text-4)]" : "text-[var(--app-text-2)]",
                )}
              >
                {scene.hiddenLanguages?.includes(id) ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>
              {!langsOnly ? (
                <button
                  type="button"
                  aria-label={`复制${langName(id)}版本`}
                  title="在下方复制新版本"
                  onClick={(event) => {
                    event.stopPropagation();
                    copyVersion(null, id);
                  }}
                  className="grid size-4 shrink-0 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]"
                >
                  <CopyPlus size={10} />
                </button>
              ) : null}
              {langs.length > 1 && !scene.lockedLanguages?.includes(id)
                ? removeButton(`移除${langName(id)}`, () => toggleLang(id))
                : <span aria-hidden className="size-4 shrink-0" />}
            </div>
            {versions.filter((item) => item.lang === id || (id === langs[langs.length - 1] && !langs.includes(item.lang))).map((item) => (
              <Fragment key={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  title="双击重命名"
                  onClick={() => setVersion(item.id, item.lang)}
                  onDoubleClick={() => !item.locked && setRenaming(item.id)}
                  onKeyDown={(event) => event.key === "Enter" && setVersion(item.id, item.lang)}
                  className={row(activeVersion?.id === item.id, false)}
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
                  {renaming === item.id ? null : (
                    <>
                      <button
                        type="button"
                        aria-label={`${item.locked ? "解锁" : "锁定"}${item.name}`}
                        title={item.locked ? "解锁后可编辑该版本" : "锁定该版本，防止任何改动"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleVersionLock(item.id);
                        }}
                        className={cn("grid size-4 shrink-0 place-items-center rounded-[3px] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]", item.locked ? "bg-[var(--app-surface-3)] text-[var(--app-text)]" : "text-[var(--app-text-4)]")}
                      >
                        {item.locked ? <Lock size={10} /> : <LockOpen size={10} />}
                      </button>
                      <button
                        type="button"
                        aria-label={`${item.hidden ? "加入" : "排除"}${item.name}批量生成`}
                        title={item.hidden ? "当前不生成；点击恢复批量生成" : "隐藏后批量生成将跳过该版本"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleVersionOutput(item.id);
                        }}
                        className={cn("grid size-4 shrink-0 place-items-center rounded-[3px] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]", item.hidden ? "text-[var(--app-text-4)]" : "text-[var(--app-text-2)]")}
                      >
                        {item.hidden ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                      <button
                        type="button"
                        aria-label={`复制${item.name}`}
                        title="在下方复制新版本"
                        onClick={(event) => {
                          event.stopPropagation();
                          copyVersion(item, item.lang);
                        }}
                        className="grid size-4 shrink-0 place-items-center rounded-[3px] text-[var(--app-text-4)] opacity-0 hover:text-[var(--app-text)] group-hover:opacity-100"
                      >
                        <CopyPlus size={10} />
                      </button>
                      {removeButton(`删除${item.name}`, () => remove(item.id, item.lang))}
                    </>
                  )}
                </div>
                {settings?.id === item.id ? (
                  <div className="mb-1 space-y-1 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-surface-1)] p-1.5">
                    <input
                      autoFocus
                      aria-label="版本名称"
                      value={settings.name}
                      onChange={(event) => setSettings({ ...settings, name: event.target.value })}
                      className="h-7 w-full rounded-[3px] border border-[var(--app-line)] bg-[var(--app-field)] px-1.5 text-[10px] outline-none focus:border-[var(--app-line-strong)]"
                    />
                    <div className="flex gap-1">
                      <button type="button" disabled={!settings.name.trim()} onClick={applySettings} className={cn(GHOST, "h-6 flex-1 bg-[var(--app-surface-2)] px-0 disabled:opacity-40")}>应用</button>
                      <button type="button" onClick={() => setSettings(null)} className={cn(GHOST, "h-6 flex-1 px-0")}>取消</button>
                    </div>
                  </div>
                ) : null}
              </Fragment>
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
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="调整版本栏宽度"
        onPointerDown={beginResize}
        onPointerMove={moveResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        className="absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize"
      />
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
  const groups = useMemo(() => sceneEditGroups(project.targets), [project.targets]);
  const hasNative = project.targets.some((target) => nativeOf(target));
  const saved = scene.savedFamiliesByLanguage
    ? (scene.savedFamiliesByLanguage[lang] ?? [])
    : (scene.savedFamilies ?? []);
  /** 锁版式的规范组按规范生成，不用保存预设；其余分组要逐个保存。 */
  const required = groups.filter((item) => !item.locked);
  const [groupId, setGroupId] = useState<SceneBucket | "native" | null>(() => required.find((item) => !saved.includes(item.id))?.id ?? groups[0]?.id ?? (hasNative ? "native" : null));
  const nativeOpen = hasNative && (groupId === "native" || !groups.length);
  const active = nativeOpen ? undefined : groups.find((item) => item.id === groupId) ?? groups[0];
  const unsaved = required.filter((item) => !saved.includes(item.id));
  /** 站外画幅族第一次打开、还没动过时，先套用站内同画幅已保存的预设作为起点；之后各改各的。 */
  useEffect(() => {
    const id = active?.id;
    if (!id || active.kind !== "outside" || id.includes("@") || saved.includes(id)) return;
    if (Object.keys(scene.familyEdits[id] ?? {}).length || scene.familyContent?.[id]) return;
    const family = id as SceneFamily;
    const sources = [`${family}@align:${sceneFamilyAlign(family)}`, ...ALIGN_ORDER.map((align) => `${family}@align:${align}`)];
    const source = sources.find((bucket) => saved.includes(bucket));
    if (!source || (!Object.keys(scene.familyEdits[source] ?? {}).length && !scene.familyContent?.[source])) return;
    updateScene((current) => ({
      ...current,
      familyEdits: { ...current.familyEdits, [id]: structuredClone(current.familyEdits[source] ?? {}) },
      ...(current.familyContent?.[source] ? { familyContent: { ...current.familyContent, [id]: structuredClone(current.familyContent[source]) } } : {}),
    }));
  }, [active, saved, scene.familyContent, scene.familyEdits, updateScene]);
  const nextUnsaved = unsaved.find((item) => item.id !== active?.id);
  const kinds = (["layout", "outside", "offline", "splash", "background", "special"] as const).flatMap((kind) => {
    const list = groups.filter((item) => item.kind === kind);
    return list.length ? [{ kind, list }] : [];
  });
  const activeKind = nativeOpen ? "native" : active?.kind;
  const siblings = kinds.find((item) => item.kind === activeKind)?.list ?? [];
  const siblingRows = [{ label: activeKind === "layout" || activeKind === "outside" || activeKind === "offline" ? "版式" : "规范模板", list: siblings }];
  /** 只有自定义尺寸时 tab 叫「自定义版式」，站外和自定义都有时叫「站外 / 自定义版式」。 */
  const kindLabel = (kind: SceneEditKind, list: SceneEditGroup[]) => {
    if (kind !== "outside") return SCENE_EDIT_KIND_LABEL[kind];
    const custom = (target: TargetBoard) => !target.sizeId || target.sizeId.startsWith("custom-");
    const hasCustom = list.some((group) => group.items.some(custom));
    const hasExternal = list.some((group) => group.items.some((target) => !custom(target)));
    return hasCustom ? (hasExternal ? "站外 / 自定义版式" : "自定义版式") : SCENE_EDIT_KIND_LABEL.outside;
  };
  const openKind = (kind: SceneEditKind) => {
    const list = groups.filter((item) => item.kind === kind);
    setGroupId((list.find((item) => !item.locked && !saved.includes(item.id)) ?? list[0])?.id ?? null);
  };

  const savePreset = () => {
    if (!active) return;
    updateScene((current) => ({
      ...current,
      savedFamiliesByLanguage: {
        ...current.savedFamiliesByLanguage,
        [lang]: [...new Set([
          ...(current.savedFamiliesByLanguage
            ? (current.savedFamiliesByLanguage[lang] ?? [])
            : (current.savedFamilies ?? [])),
          active.id,
        ])],
      },
    }));
    if (nextUnsaved) setGroupId(nextUnsaved.id);
  };
  const unspecified = active ? unspecifiedInApp(active) : [];

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
      {kinds.length + (hasNative ? 1 : 0) > 1 || activeKind === "offline" ? (
        <div className="mb-2 flex shrink-0 items-center gap-2">
          <div className={PILL_TABS}>
            {kinds.map(({ kind, list }) => (
              <button key={kind} type="button" onClick={() => openKind(kind)} className={pillTab(activeKind === kind)}>
                {kindLabel(kind, list)}{kind === "splash" ? "" : ` · ${list.length}`}
              </button>
            ))}
            {hasNative ? <button type="button" onClick={() => setGroupId("native")} className={pillTab(nativeOpen)}>仿原生</button> : null}
          </div>
        </div>
      ) : null}
      {siblings.length > 1 || (siblings.length === 1 && activeKind !== "splash") ? (
        <div className={cn("mb-3 flex shrink-0 items-center gap-2", siblingRows.length > 1 ? "flex-wrap gap-y-1" : "overflow-x-auto")}>
        {siblingRows.map((row, index) => (
        <Fragment key={row.label}>
          {index > 0 ? <span className="mx-1 h-4 w-px shrink-0 bg-[var(--app-line)]" /> : null}
          <span className="shrink-0 text-[9px] text-[var(--app-text-4)]">{row.label}</span>
          {row.list.map((group) => {
            const done = group.locked || saved.includes(group.id);
            return (
              <button
                key={group.id}
                type="button"
                title={group.items.map((item) => `${item.w}×${item.h} ${item.use ?? ""}`.trim()).join("\n")}
                onClick={() => setGroupId(group.id)}
                className={cn("flex h-7 max-w-[260px] shrink-0 items-center gap-1.5 rounded-[4px] px-3 text-[10px]", active?.id === group.id ? "bg-[var(--color-brand-soft)] text-[var(--app-text)]" : "text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)]")}
              >
                {group.locked ? <Lock size={10} className="shrink-0 text-[var(--app-text-4)]" /> : done ? <CheckCircle2 size={11} className="shrink-0 text-[var(--color-down)]" /> : <span className="size-1.5 shrink-0 rounded-full border border-[var(--app-text-4)]" />}
                <span className="truncate">{group.label}</span>
                <span className="shrink-0">· {group.items.length}</span>
              </button>
            );
          })}
        </Fragment>
        ))}
        </div>
      ) : <div className="mb-1 shrink-0" />}
      {unspecified.length ? (
        <p className="mb-2 shrink-0 text-[9px] text-[var(--warn-text)]">
          规范未注明，按版式族处理：{unspecified.map((item) => `${item.use ?? ""} ${item.w}×${item.h}`.trim()).join("、")}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1 gap-3">
        <VersionRail langsOnly={!active} />
        <div className="min-h-0 min-w-0 flex-1">
          {active ? (
            <SceneEditor
              mode="family"
              board={{ ...sceneRef(active.representative), use: active.items.length > 1 ? `${active.representative.use ?? ""} 等 ${active.items.length} 个资源位`.trim() : active.representative.use }}
              lang={lang}
              familyBoards={active.items}
              groupLabel={active.locked ? `规范 ${active.label}` : active.label}
              locked={active.locked}
            />
          ) : (
            <NativeEditor />
          )}
        </div>
      </div>
      <div className="mt-3 flex shrink-0 items-center justify-end">
        <div className="flex gap-2">
          <Button size="lg" onClick={onBack}>上一步</Button>
          {!active ? (
            nextUnsaved ? <Button size="lg" onClick={() => setGroupId(nextUnsaved.id)}>下一个：{nextUnsaved.label}</Button> : null
          ) : (
            <Button size="lg" title={nextUnsaved ? `保存后进入下一个：${nextUnsaved.label}` : undefined} onClick={savePreset}>保存预设</Button>
          )}
          <Button variant="workflow" size="lg" disabled={unsaved.length > 0} onClick={onNext}>批量生成</Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 第四步：批量生成并细化                                               */
/* ------------------------------------------------------------------ */

function Thumb({ scene, version, target, lang, selected, onOpen }: { scene: SceneState; version?: SceneVersion | null; target: TargetBoard; lang: Lang; selected?: boolean; onOpen: () => void }) {
  const { project } = useStudio();
  const ref = sceneRef(target);
  const resolved = sceneVersionView(sceneLanguageBoardView(scene, lang, ref), version);
  const fit = useFitBoard(target.w, target.h, 16);
  const width = Math.min(220, fit.width);
  const external = isExternalTarget(target);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`细化 ${boardDisplayLabel(target)}`}
      title={boardDisplayLabel(target)}
      className={cn(
        "min-w-0 overflow-hidden rounded-[5px] border border-transparent bg-[var(--app-surface-2)] p-2 text-left outline-none transition-colors hover:bg-[var(--app-surface-3)] focus-visible:bg-[var(--app-surface-3)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--app-text-2)]",
        selected && "bg-[var(--app-surface-3)]",
      )}
    >
      <div ref={fit.ref} aria-hidden="true" className="grid h-[136px] min-w-0 place-items-center overflow-hidden rounded-[4px] bg-[#111317]">
        <SceneArtboard scene={resolved} board={ref} lang={lang} kvUrl={project.content.kv?.previewUrl} width={width} />
      </div>
      <div className="mt-2 flex min-w-0 items-baseline gap-1.5 truncate text-[10px]">
        <span className="shrink-0 font-medium tabular-nums text-[var(--app-text-2)]">{boardSizeLabel(target)}</span>
        {external ? null : <span className="truncate text-[var(--app-text-3)]">{boardUseLabel(target)}</span>}
      </div>
    </button>
  );
}

export function SceneBatchStep({ onBack }: { onBack: () => void }) {
  const { project, lang } = useStudio();
  const { scene } = useScene();
  const { version } = useActiveVersion();
  const projectTargetFigmaUrl = project.content.kv?.figmaUrl
    ?? project.content.sourceFrames?.[lang]?.figmaUrl
    ?? project.content.sourceFrame?.figmaUrl
    ?? "";
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [page, setPage] = useState<"new" | "current">("current");
  const [pageName, setPageName] = useState(project.name);
  const [targetFigmaUrl, setTargetFigmaUrl] = useState(projectTargetFigmaUrl);
  const [recognizedTargetFigmaUrl, setRecognizedTargetFigmaUrl] = useState<string | null>(() => {
    const parsed = parseFigmaUrl(projectTargetFigmaUrl);
    return parsed.ok && parsed.nodeId ? projectTargetFigmaUrl.trim() : null;
  });
  const [targetLinkAttempted, setTargetLinkAttempted] = useState(false);
  const [arrange, setArrange] = useState<"group" | "lang" | "flat">("group");
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportProgress, setExportProgress] = useState("");
  const [done, setDone] = useState<FigmaWriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeStarted, setWriteStarted] = useState(false);
  const [writeCancelled, setWriteCancelled] = useState(false);
  const [writeProgress, setWriteProgress] = useState<{ completed: number; total: number } | null>(null);
  const [bridgeLabel, setBridgeLabel] = useState("");
  const [pairingCopied, setPairingCopied] = useState(false);
  const [pluginConnection, setPluginConnection] = useState<{ connected: boolean; compatible: boolean | null; version?: string }>({
    connected: false,
    compatible: null,
  });
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [asideWidth, setAsideWidth] = useState(400);
  const asideDrag = useRef<{ x: number; width: number } | null>(null);
  const writeAbortRef = useRef<AbortController | null>(null);
  const lastWriteRunRef = useRef<string | null>(null);
  const batchRef = useRef<HTMLDivElement>(null);
  const versionRef = useRef<HTMLDivElement>(null);
  const families = useMemo(() => sceneEditGroups(project.targets), [project.targets]);
  const kv = project.content.kv;
  const targetLink = useMemo(() => parseFigmaUrl(targetFigmaUrl), [targetFigmaUrl]);
  const sourceFileKeys = useMemo(() => {
    const keys = new Set<string>();
    const visualLink = kv?.figmaUrl ? parseFigmaUrl(kv.figmaUrl) : null;
    if (visualLink?.ok) keys.add(visualLink.fileKey);
    for (const element of scene.elements) {
      if (element.role === "module" && element.module?.fileKey) keys.add(element.module.fileKey);
    }
    for (const modules of Object.values(scene.languageModules ?? {})) {
      for (const module of Object.values(modules)) if (module.fileKey) keys.add(module.fileKey);
    }
    for (const item of scene.versions ?? []) {
      for (const module of Object.values(item.modules ?? {})) if (module.fileKey) keys.add(module.fileKey);
    }
    return keys;
  }, [kv?.figmaUrl, scene.elements, scene.languageModules, scene.versions]);
  const targetMatchesSources = !targetLink.ok
    || !sourceFileKeys.size
    || (sourceFileKeys.size === 1 && sourceFileKeys.has(targetLink.fileKey));
  const targetLinkRecognized = recognizedTargetFigmaUrl === targetFigmaUrl.trim();
  const writeSettingsReady = targetLinkRecognized
    && targetLink.ok
    && Boolean(targetLink.nodeId)
    && targetMatchesSources
    && (page === "current" || Boolean(pageName.trim()));
  const targetLinkErrorMessage = !targetLink.ok
    ? targetLink.reason
    : !targetLink.nodeId
      ? "请粘贴包含 node-id 的 Figma 文件链接"
      : !targetMatchesSources
        ? "需与主视觉和自定义元素所在的 Figma 文件一致"
        : "";
  const pairingCode = bridgeLabel.includes("·") ? bridgeLabel.split("·").at(-1)?.trim() ?? "" : bridgeLabel.trim();
  const connectionStage = done ? 4 : writeStarted || pluginConnection.connected ? 3 : pairingCode ? 2 : 1;
  const visualReady = scene.visualMode === "figma"
    ? kv?.source === "figma" && Boolean(kv.figmaUrl)
    : kv?.source === "upload" && Boolean(kv.previewUrl?.startsWith("data:"));

  useEffect(() => {
    void ports.figma.identity().then((identity) => setBridgeLabel(identity.label));
    const storedValue = window.localStorage.getItem(BATCH_ASIDE_STORE);
    if (storedValue === null) return;
    const stored = Number(storedValue);
    if (Number.isFinite(stored)) setAsideWidth(clampBatchAsideWidth(stored));
  }, []);

  useEffect(() => {
    let active = true;
    let probing = false;
    if (!/^\d{5}$/.test(pairingCode)) {
      setPluginConnection({ connected: false, compatible: null });
      return;
    }
    const probe = async () => {
      if (probing) return;
      probing = true;
      try {
        const response = await fetch(`/api/figma/write?sessionId=${encodeURIComponent(pairingCode)}&probe=1`, { cache: "no-store" });
        const payload = await response.json() as {
          connected?: boolean;
          compatible?: boolean | null;
          plugin?: { version?: string } | null;
        };
        if (!active) return;
        setPluginConnection({
          connected: response.ok && Boolean(payload.connected),
          compatible: response.ok ? payload.compatible ?? null : null,
          ...(payload.plugin?.version ? { version: payload.plugin.version } : {}),
        });
      } catch {
        if (active) setPluginConnection({ connected: false, compatible: null });
      } finally {
        probing = false;
      }
    };
    void probe();
    const timer = window.setInterval(() => void probe(), 1_500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pairingCode]);

  useEffect(() => () => writeAbortRef.current?.abort(), []);

  useEffect(() => {
    const handleProgress = (event: Event) => {
      if (!writeAbortRef.current) return;
      const detail = (event as CustomEvent<{ completed?: number; total?: number }>).detail;
      const completed = Number(detail?.completed);
      const total = Number(detail?.total);
      if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return;
      setWriteProgress({
        completed: Math.max(0, Math.min(total, completed)),
        total: Math.max(1, total),
      });
    };
    window.addEventListener("futu:figma-write-progress", handleProgress);
    return () => window.removeEventListener("futu:figma-write-progress", handleProgress);
  }, []);

  useEffect(() => {
    const activeWrite = writeAbortRef.current;
    writeAbortRef.current = null;
    activeWrite?.abort();
    setBusy(false);
    setDone(null);
    setWriteStarted(false);
    setWriteCancelled(false);
    setWriteProgress(null);
    setWriteError(null);
    setError(null);
    setPageName(project.name);
    setTargetFigmaUrl(projectTargetFigmaUrl);
    const parsed = parseFigmaUrl(projectTargetFigmaUrl);
    setRecognizedTargetFigmaUrl(parsed.ok && parsed.nodeId ? projectTargetFigmaUrl.trim() : null);
    setTargetLinkAttempted(false);
  }, [project.id]);

  const asideLayoutMax = () => {
    /** 平台根节点有 1.5× transform；clientWidth 才是 flex 实际使用的 CSS 宽度。 */
    const total = batchRef.current?.clientWidth;
    const versions = versionRef.current?.clientWidth;
    if (!total || versions === undefined) return BATCH_ASIDE_LIMITS[1];
    /** 12px 内容间距 + 12px 拖拽条；到达主画板最小宽度后不再放大右栏。 */
    return total - versions - 24 - BATCH_BOARD_MIN_WIDTH;
  };

  useEffect(() => {
    const keepLayoutSafe = () => setAsideWidth((current) => clampBatchAsideWidth(current, asideLayoutMax()));
    keepLayoutSafe();
    const observer = new ResizeObserver(keepLayoutSafe);
    if (batchRef.current) observer.observe(batchRef.current);
    if (versionRef.current) observer.observe(versionRef.current);
    window.addEventListener("resize", keepLayoutSafe);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", keepLayoutSafe);
    };
  }, [openKey]);

  const outputLangs = useMemo(
    () => project.content.langs.filter((id) => !scene.hiddenLanguages?.includes(id)),
    [project.content.langs, scene.hiddenLanguages],
  );
  /** 每个语种和自定义版本各出一套；自定义版本用版本 id 作为 plan.lang，便于区分与重试。 */
  const outputs = useMemo<Array<{ id: string; lang: Lang; label: string; version?: SceneVersion }>>(() => [
    ...outputLangs.map((id) => ({ id: id as string, lang: id, label: langName(id) })),
    ...(scene.versions ?? []).filter((item) => !item.hidden).map((item) => ({ id: item.id, lang: item.lang, label: item.name, version: item })),
  ], [outputLangs, scene]);
  const boardTargets = useMemo(() => project.targets.filter((target) => !nativeOf(target)), [project.targets]);
  const nativeTargets = useMemo(() => project.targets.filter((target) => nativeOf(target)), [project.targets]);
  const linkedTargets = useMemo(() => boardTargets.filter((target) => linkedOf(target)), [boardTargets]);
  const { state: native } = useNative();
  const { measure, version: fontVersion } = useNativeMeasure();
  /** 仿原生每个语种出深浅两块；key 带上肤色，失败重试按块定位。 */
  const nativePlans = useMemo<BoardPlan[]>(() => nativeTargets.flatMap((target) => outputs.flatMap((output) => NATIVE_SKINS.map((skin) => {
    const board = buildNativeBoard(native, skin.id, output.lang, measure);
    return {
      key: `${target.key}·${skin.id}`,
      lang: output.id,
      name: figmaFrameName(target, `${output.label} · ${skin.name}`),
      figmaLayout: {
        boardName: figmaBoardName(target),
        size: boardSizeLabel(target),
        language: `${output.label} · ${skin.name}`,
        languageGroup: output.id,
        languageSection: output.label,
      },
      solution: sceneSolution(sceneRef(target)),
      backgroundColor: board.background,
      native: { ...board, assets: {} },
    };
  // fontVersion 变化代表字体加载完成，需要重新量宽度。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }))), [measure, native, nativeTargets, outputs, project.name, fontVersion]);
  /** 联动画板排在最后：插件先建母版，再用母版组件实例生成设备尺寸。 */
  const boardPlans = useMemo<BoardPlan[]>(() => outputs.flatMap((output) => [
    ...boardTargets.filter((target) => !linkedOf(target)),
    ...linkedTargets,
  ].map((target) => {
    const link = linkedOf(target);
    const masterTarget = link ? project.targets.find((item) => item.sizeId === link.master.id) : undefined;
    const ref = sceneRef(masterTarget ?? target);
    const languageScene = sceneLanguageBoardView(scene, output.lang, ref);
    const board = buildSceneBoard(sceneVersionView(languageScene, output.version), ref, output.lang);
    const name = figmaFrameName(target, output.label);
    const figmaLayout = {
      boardName: figmaBoardName(target),
      size: boardSizeLabel(target),
      language: output.label,
      languageGroup: output.id,
      languageSection: output.label,
    };
    if (link && masterTarget) {
      const place = linkedPlacement(link.linked, target, masterTarget);
      return {
        key: target.key,
        lang: output.id,
        name,
        figmaLayout,
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
      figmaLayout,
      solution: sceneSolution(ref),
      backgroundColor: scene.background,
      scene: board,
      ...(board.layers.some((layer) => layer.role === "logo") ? { logo: presetLogo(board.logoPreset) } : {}),
    };
  })), [boardTargets, linkedTargets, outputs, project.name, project.targets, scene.background]);
  const plans = useMemo(() => [...boardPlans, ...nativePlans], [boardPlans, nativePlans]);
  /** 按第二步的资源位分类分区（站内 / 官网 / 站外 / 自定义），区内按目录顺序平铺；闪屏设备尺寸排在站内末尾。 */
  const channels = useMemo(() => {
    const order = new Map<string, { group: string; index: number }>();
    SIZE_GROUPS.forEach((group) => group.items.forEach((item, index) => order.set(item.id, { group: group.id, index })));
    const groupOf = (target: TargetBoard) => (target.sizeId ? order.get(target.sizeId)?.group : undefined) ?? "custom";
    const indexOf = (target: TargetBoard) => (target.sizeId ? order.get(target.sizeId)?.index : undefined) ?? Number.MAX_SAFE_INTEGER;
    return SIZE_GROUPS.filter((group) => group.id !== "native").flatMap((group) => {
      const all = boardTargets.filter((target) => groupOf(target) === group.id);
      if (!all.length) return [];
      const sorted = group.id === "custom" ? all : [...all].sort((a, b) => indexOf(a) - indexOf(b));
      const items = sorted.filter((target) => !linkedOf(target));
      /** 站外 / 自定义按画幅族分小段，和第三步的分组对应。 */
      const parts = group.id === "external" || group.id === "custom"
        ? OUTSIDE_SEGMENTS.flatMap(({ id, label }) => {
          const list = items.filter((target) => outsideSegmentOf(target) === id);
          return list.length ? [{ id, label, items: list }] : [];
        })
        : [{ id: group.id, label: "", items }];
      return [{ id: group.id, name: group.name, count: all.length, parts, linked: sorted.filter((target) => linkedOf(target)) }];
    });
  }, [boardTargets]);
  const needsVisual = boardPlans.length > 0;

  useEffect(() => {
    setDone(null);
    setWriteStarted(false);
    setWriteError(null);
    setWriteProgress(null);
    lastWriteRunRef.current = null;
  }, [plans]);

  const resetWriteStatus = () => {
    setDone(null);
    setWriteStarted(false);
    setWriteError(null);
    setWriteProgress(null);
  };

  const recognizeTargetLink = () => {
    resetWriteStatus();
    setError(null);
    if (targetLinkErrorMessage) {
      setTargetLinkAttempted(true);
      return;
    }
    setRecognizedTargetFigmaUrl(targetFigmaUrl.trim());
    setTargetLinkAttempted(false);
  };

  const clearTargetLink = () => {
    setTargetFigmaUrl("");
    setRecognizedTargetFigmaUrl(null);
    setTargetLinkAttempted(false);
    resetWriteStatus();
    setError(null);
  };

  const copyPairingCode = async () => {
    if (!pairingCode) return;
    try {
      await navigator.clipboard.writeText(pairingCode);
      setError(null);
      setPairingCopied(true);
      window.setTimeout(() => setPairingCopied(false), 1400);
    } catch {
      setError("复制失败，请手动选择连接码");
    }
  };

  const cancelWrite = () => {
    writeAbortRef.current?.abort();
  };

  const run = async (only?: FigmaWriteResult["failures"], retryPrevious = false) => {
    /** 同一任务重试会替换未完成结果，因此必须重新生成整套画板，避免留下缺失的依赖或空位。 */
    const retryRunId = only?.length || retryPrevious ? lastWriteRunRef.current : null;
    const runId = retryRunId ?? crypto.randomUUID();
    const subset = plans;
    if (!subset.length || (subset.some((plan) => !plan.native) && !kv)) return;
    if (!targetLinkRecognized) {
      setError("请先识别目标 Figma 文件链接");
      return;
    }
    if (!targetLink.ok) {
      setError(targetLink.reason);
      return;
    }
    if (!targetLink.nodeId) {
      setError("请粘贴包含 node-id 的目标文件链接，用于校验插件当前打开的文件");
      return;
    }
    if (!targetMatchesSources) {
      setError("第一阶段仅支持写入主视觉和自定义元素所在的同一个 Figma 文件");
      return;
    }
    if (page === "new" && !pageName.trim()) {
      setError("请填写新建页面的名称");
      return;
    }
    const controller = new AbortController();
    writeAbortRef.current = controller;
    setWriteStarted(true);
    setWriteCancelled(false);
    setWriteProgress(null);
    setBusy(true);
    setDone(null);
    setWriteError(null);
    setError(null);
    lastWriteRunRef.current = runId;
    try {
      const presets = [...new Set(subset.flatMap((plan) => plan.logo && plan.scene ? [plan.scene.logoPreset] : []))];
      const logoSvgs = new Map(await Promise.all(presets.map(async (preset) => [preset, await buildLogoSvg(preset, controller.signal)] as const)));
      const splashSvg = subset.some((plan) => plan.linked) ? await fetch(splashLogoOf(scene.logoPreset).url, { signal: controller.signal }).then((res) => res.text()) : undefined;
      const regular = subset.filter((plan) => !plan.native);
      const scenes = await inlineBadgeSvgs(regular.map((plan) => plan.scene!), controller.signal);
      const nativeAssets = await inlineNativeAssets(subset.flatMap((plan) => plan.native ? [plan.native] : []), controller.signal);
      const boards = subset.map((plan) => plan.native ? { ...plan, native: { ...plan.native, assets: nativeAssets } } : {
        ...plan,
        scene: scenes[regular.indexOf(plan)],
        ...(plan.logo && plan.scene && logoSvgs.get(plan.scene.logoPreset) ? { logoSvg: logoSvgs.get(plan.scene.logoPreset) } : {}),
        ...(plan.linked ? { linked: { ...plan.linked, logoSvg: splashSvg } } : {}),
      });
      const result = await ports.figma.write(boards, {
        fileKey: targetLink.fileKey,
        targetNodeId: targetLink.nodeId,
        runId,
        ...(retryRunId ? { replaceRun: true } : {}),
        page,
        pageName: pageName.trim() || project.name,
        sectionName: project.name,
        arrange,
        ...(kv && regular.length ? { visualComponent: kv } : {}),
        ...(scene.visualMode === "upload" ? { uploadFeather: { level: scene.feather, color: scene.background } } : {}),
      }, controller.signal);
      if (writeAbortRef.current !== controller) return;
      setDone(result);
    } catch (cause) {
      if (writeAbortRef.current !== controller) return;
      if (cause instanceof DOMException && cause.name === "AbortError") {
        setWriteStarted(false);
        setWriteCancelled(true);
        setWriteError(null);
      } else {
        setWriteError(cause instanceof Error ? cause.message : "Figma 写入失败");
      }
    } finally {
      if (writeAbortRef.current === controller) {
        writeAbortRef.current = null;
        setBusy(false);
      }
    }
  };

  const masterOf = (target: TargetBoard) => {
    const link = linkedOf(target);
    return link ? project.targets.find((item) => item.sizeId === link.master.id) : undefined;
  };
  const exportImages = async () => {
    if (!plans.length || exportBusy || (needsVisual && !visualReady)) return;
    setExportBusy(true);
    setError(null);
    setExportProgress(`正在准备 0 / ${plans.length}`);
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    Object.assign(host.style, {
      position: "fixed",
      left: "-100000px",
      top: "0",
      zIndex: "-1",
      overflow: "hidden",
    });
    document.body.appendChild(host);
    const root = createRoot(host);
    const zip = new JSZip();
    const archivePaths = new Set<string>();
    let completed = 0;
    const capture = async (node: ReactNode, width: number, height: number, path: string) => {
      const archivePath = uniqueArchivePath(path, archivePaths);
      host.style.width = `${width}px`;
      host.style.height = `${height}px`;
      flushSync(() => root.render(
        <div style={{ width, height, overflow: "hidden" }}>{node}</div>,
      ));
      const stage = host.firstElementChild as HTMLElement | null;
      if (!stage) throw new Error("图片画板渲染失败");
      await waitForRenderedAssets(stage);
      const blob = await toBlob(stage, {
        width,
        height,
        canvasWidth: width,
        canvasHeight: height,
        pixelRatio: 1,
        cacheBust: false,
      });
      if (!blob) throw new Error(`图片生成失败：${archivePath}`);
      zip.file(archivePath, blob);
      completed += 1;
      setExportProgress(`正在导出 ${completed} / ${plans.length}`);
    };
    try {
      const exportKvUrl = await imageDataUrl(kv?.previewUrl);
      for (const [outputIndex, output] of outputs.entries()) {
        /** 序号保证重名版本或清洗后同名的版本不会在 ZIP 中互相覆盖。 */
        const folder = `${String(outputIndex + 1).padStart(2, "0")}-${safeFileName(output.label)}`;
        for (const target of boardTargets) {
          const link = linkedOf(target);
          const master = link ? masterOf(target) : undefined;
          const sourceTarget = master ?? target;
          const ref = sceneRef(sourceTarget);
          const resolved = sceneVersionView(sceneLanguageBoardView(scene, output.lang, ref), output.version);
          const name = `${safeFileName(boardFileStem(target))}.png`;
          await capture(
            link && master
              ? (
                <SceneLinkedPreview
                  scene={resolved}
                  master={sceneRef(master)}
                  board={sceneRef(target)}
                  linked={link.linked}
                  lang={output.lang}
                  kvUrl={exportKvUrl}
                  logoUrl={splashLogoOf(scene.logoPreset).url}
                  width={target.w}
                  guides={false}
                />
              )
              : <SceneArtboard scene={resolved} board={ref} lang={output.lang} kvUrl={exportKvUrl} width={target.w} />,
            target.w,
            target.h,
            `${folder}/${name}`,
          );
        }
      }
      for (const target of nativeTargets) {
        for (const outputLang of outputLangs) {
          for (const skin of NATIVE_SKINS) {
            const board = buildNativeBoard(native, skin.id, outputLang, measure);
            await capture(
              <NativeBanner board={board} width={target.w} />,
              target.w,
              target.h,
              `${safeFileName(langName(outputLang))}/${safeFileName(boardFileStem(target))}_${skin.name}.png`,
            );
          }
        }
      }
      setExportProgress("正在打包…");
      const archive = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${safeFileName(project.name)}-图片.zip`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportProgress("导出完成");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "图片导出失败");
      setExportProgress("");
    } finally {
      root.unmount();
      host.remove();
      setExportBusy(false);
    }
  };

  const endAsideResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!asideDrag.current) return;
    asideDrag.current = null;
    window.localStorage.setItem(BATCH_ASIDE_STORE, String(asideWidth));
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const openIndex = boardTargets.findIndex((target) => target.key === openKey);
  const openRaw = openIndex >= 0 ? boardTargets[openIndex] : undefined;
  const openTarget = openRaw ? masterOf(openRaw) ?? openRaw : undefined;
  const batchActions = (
    <div className="mt-3 flex shrink-0 justify-end gap-2">
      <Button size="lg" disabled={busy || exportBusy} onClick={onBack}>上一步</Button>
      <Button
        size="lg"
        aria-label="导出图片"
        icon={exportBusy ? undefined : <Download size={14} />}
        disabled={busy || exportBusy || !plans.length || (needsVisual && !visualReady)}
        onClick={() => void exportImages()}
      >
        {exportBusy ? <><Loader2 size={14} className="animate-spin" />{exportProgress || "正在导出…"}</> : needsVisual && !visualReady ? "请先准备主视觉" : "导出图片"}
      </Button>
      <Button
        variant={busy ? "secondary" : "workflow"}
        size="lg"
        aria-label={busy ? "取消并回滚本次写入" : "写入 Figma"}
        icon={busy ? <X size={14} /> : <WorkflowSparkle />}
        className="min-w-[124px]"
        disabled={!busy && (exportBusy || !plans.length || !writeSettingsReady || !pluginConnection.connected || pluginConnection.compatible === false || (needsVisual && !visualReady))}
        onClick={busy ? cancelWrite : () => void run()}
      >
        {busy ? "取消写入" : needsVisual && !visualReady ? "请先准备主视觉" : !pluginConnection.connected ? "请先连接插件" : pluginConnection.compatible === false ? "请更新插件" : "写入 Figma"}
      </Button>
    </div>
  );
  if (openTarget) {
    const openGroup = families.find((item) => item.items.some((target) => target.key === openTarget.key));
    const familyBoards = openGroup?.items ?? [openTarget];
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
              {...(openGroup ? { groupLabel: openGroup.locked ? `规范 ${openGroup.label}` : openGroup.label } : {})}
            />
          </div>
        </div>
        {batchActions}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={batchRef} className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div ref={versionRef} className="flex shrink-0"><VersionRail /></div>
        <section className="ml-3 flex min-h-0 min-w-[440px] flex-1 flex-col">
        <div className="mb-1 flex shrink-0 items-center gap-3 border-b border-[var(--app-line-soft)] pb-2 pt-1">
          <span className="text-[10px] text-[var(--app-text-3)]">
            全部画板
            <span className="ml-2 tabular-nums text-[var(--app-text-4)]">{plans.length} 块</span>
          </span>
          <span className="flex items-center gap-1 rounded-[4px] bg-[var(--app-surface-2)] px-2 py-0.5 text-[10px] text-[var(--app-text-2)]">
            <MousePointerClick size={11} />点击任意画板可单独细化
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {channels.map((channel) => (
            <div key={channel.id} className="mb-4">
              <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-[var(--app-page)] pb-1">
                <span className="text-[10px] font-medium text-[var(--app-text-2)]">{channel.name}</span>
                <span className="text-[9px] tabular-nums text-[var(--app-text-4)]">{channel.count}</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5">
                {channel.parts.flatMap((part) => part.items).map((target) => (
                  <Thumb key={target.key} scene={scene} version={version} target={target} lang={lang} onOpen={() => setOpenKey(target.key)} />
                ))}
              </div>
              {channel.linked.length ? (
              <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-1.5", channel.parts.some((part) => part.items.length) && "mt-1.5")}>
                {channel.linked.map((target) => {
                  const link = linkedOf(target)!;
                  const master = masterOf(target);
                  if (!master) return null;
                  return (
                    <button
                      key={target.key}
                      type="button"
                      onClick={() => setOpenKey(master.key)}
                      aria-label={`细化 ${boardDisplayLabel(target)}，跟随闪屏母版`}
                      title={`${boardDisplayLabel(target)} · 跟随闪屏母版`}
                      className="flex flex-col items-center rounded-[5px] border border-transparent bg-[var(--app-surface-2)] p-2 outline-none transition-colors hover:bg-[var(--app-surface-3)] focus-visible:bg-[var(--app-surface-3)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--app-text-2)]"
                    >
                      <div aria-hidden="true" className="grid w-full place-items-center">
                        <SceneLinkedPreview
                          scene={sceneVersionView(sceneLanguageBoardView(scene, lang, sceneRef(master)), version)}
                          master={sceneRef(master)}
                          board={sceneRef(target)}
                          linked={link.linked}
                          lang={lang}
                          kvUrl={kv?.previewUrl}
                          logoUrl={splashLogoOf(scene.logoPreset).url}
                          width={Math.min(110, Math.round((160 * target.w) / target.h))}
                        />
                      </div>
                      <span className="mt-1.5 flex w-full min-w-0 items-baseline justify-center gap-1 truncate text-[10px]">
                        <span className="shrink-0 font-medium tabular-nums text-[var(--app-text-2)]">{boardSizeLabel(target)}</span>
                        <span className="truncate text-[var(--app-text-3)]">{boardUseLabel(target)}</span>
                      </span>
                      <span className="mt-0.5 w-full truncate text-center text-[9px] text-[var(--app-text-4)]">跟随闪屏母版</span>
                    </button>
                  );
                })}
              </div>
              ) : null}
            </div>
          ))}
          {nativeTargets.length ? (
            <div className="mb-4">
              <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-[var(--app-page)] pb-1">
                <span className="text-[10px] font-medium text-[var(--app-text-2)]">仿原生</span>
                <span className="text-[9px] tabular-nums text-[var(--app-text-4)]">{nativeTargets.length}</span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5">
                {nativePlans.filter((plan) => plan.lang === lang).map((plan) => {
                  const target = nativeTargets.find((item) => plan.key.startsWith(`${item.key}·`)) ?? nativeTargets[0]!;
                  const skin = NATIVE_SKINS.find((item) => plan.key.endsWith(item.id))?.name ?? "默认";
                  return (
                    <button key={plan.key} type="button" aria-label={`返回配置 ${boardDisplayLabel(target)} ${skin}`} title="回第三步修改仿原生" onClick={onBack} className="min-w-0 rounded-[5px] border border-transparent bg-[var(--app-surface-2)] p-2 text-left outline-none transition-colors hover:bg-[var(--app-surface-3)] focus-visible:bg-[var(--app-surface-3)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--app-text-2)]">
                      <div aria-hidden="true" className="grid h-[136px] place-items-center rounded-[4px] bg-[#111317]">
                        <NativeBanner board={plan.native!} width={200} />
                      </div>
                      <div className="mt-2 flex min-w-0 items-baseline gap-1.5 truncate text-[10px]">
                        <span className="shrink-0 font-medium tabular-nums text-[var(--app-text-2)]">{boardSizeLabel(target)}</span>
                        <span className="truncate text-[var(--app-text-3)]">{boardUseLabel(target) ?? "仿原生"}</span>
                      </div>
                      <div className="mt-0.5 truncate text-[9px] text-[var(--app-text-4)]">{skin}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
        </section>

        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="调整写入 Figma 侧边栏宽度"
          aria-valuemin={BATCH_ASIDE_LIMITS[0]}
          aria-valuemax={clampBatchAsideWidth(BATCH_ASIDE_LIMITS[1], asideLayoutMax())}
          aria-valuenow={asideWidth}
          title="拖动调整侧边栏宽度；双击恢复默认"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            asideDrag.current = { x: event.clientX, width: asideWidth };
          }}
          onPointerMove={(event) => {
            const drag = asideDrag.current;
            if (!drag) return;
            setAsideWidth(clampBatchAsideWidth(drag.width - (event.clientX - drag.x), asideLayoutMax()));
          }}
          onPointerUp={endAsideResize}
          onPointerCancel={endAsideResize}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            const next = clampBatchAsideWidth(asideWidth + (event.key === "ArrowLeft" ? 10 : -10), asideLayoutMax());
            setAsideWidth(next);
            window.localStorage.setItem(BATCH_ASIDE_STORE, String(next));
          }}
          onDoubleClick={() => {
            const next = clampBatchAsideWidth(400, asideLayoutMax());
            setAsideWidth(next);
            window.localStorage.setItem(BATCH_ASIDE_STORE, String(next));
          }}
          className="w-3 shrink-0 cursor-col-resize touch-none outline-none focus:bg-[var(--app-surface-2)]"
        />
        <aside className="flex min-h-0 shrink-0 flex-col border-l border-[var(--app-line)] pl-4" style={{ width: asideWidth }}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div>
            <div className="text-[11px] font-semibold">写入 Figma</div>
            <div className="mt-3 space-y-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="relative min-w-0 flex-1">
                    <Link2 size={11} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-4)]" />
                    <input
                      aria-label="目标 Figma 文件链接"
                      aria-invalid={targetLinkAttempted && Boolean(targetLinkErrorMessage)}
                      aria-describedby={targetLinkAttempted && targetLinkErrorMessage ? "figma-target-link-error" : undefined}
                      value={targetFigmaUrl}
                      disabled={busy}
                      onChange={(event) => {
                        setTargetFigmaUrl(event.target.value);
                        setTargetLinkAttempted(false);
                        setError(null);
                        resetWriteStatus();
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" || !targetFigmaUrl.trim()) return;
                        event.preventDefault();
                        recognizeTargetLink();
                      }}
                      placeholder="粘贴figma链接"
                      className={cn(INPUT, "disabled:cursor-not-allowed disabled:opacity-50")}
                    />
                  </div>
                  {recognizedTargetFigmaUrl ? (
                    <>
                      <button
                        type="button"
                        aria-label="重新识别目标 Figma 链接"
                        title="重新识别"
                        disabled={busy || !targetFigmaUrl.trim()}
                        onClick={recognizeTargetLink}
                        className="grid size-5 shrink-0 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <RotateCcw size={12} />
                      </button>
                      <button
                        type="button"
                        aria-label="删除目标 Figma 链接"
                        title="删除链接"
                        disabled={busy}
                        onClick={clearTargetLink}
                        className="grid size-5 shrink-0 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || !targetFigmaUrl.trim()}
                      onClick={recognizeTargetLink}
                      className={cn(GHOST, "h-8 shrink-0 bg-[var(--app-surface-2)] px-3 hover:bg-[var(--app-surface-3)]")}
                    >
                      识别
                    </button>
                  )}
                </div>
                {targetLinkAttempted && targetLinkErrorMessage ? <p id="figma-target-link-error" role="alert" className="mt-1 text-[9px] text-[var(--color-up)]">{targetLinkErrorMessage}</p> : null}
              </div>
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="shrink-0 text-[10px] text-[var(--app-text-3)]">目标页</div>
                  <Segmented
                    value={page}
                    disabled={busy}
                    onChange={(value) => {
                      setPage(value);
                      setError(null);
                      resetWriteStatus();
                    }}
                    options={[{ id: "current", label: "当前页" }, { id: "new", label: "新建一页" }]}
                  />
                </div>
                {page === "new" ? (
                  <input
                    aria-label="新建 Figma 页面名称"
                    value={pageName}
                    disabled={busy}
                    onChange={(event) => {
                      setPageName(event.target.value);
                      setError(null);
                      resetWriteStatus();
                    }}
                    placeholder="输入页面名称"
                    className="mt-2 h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2.5 text-[10px] outline-none hover:border-[var(--app-line-strong)] focus:border-[var(--app-line-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="shrink-0 text-[10px] text-[var(--app-text-3)]">排列方式</div>
                <Segmented
                  value={arrange}
                  disabled={busy}
                  onChange={(value) => {
                    setArrange(value);
                    setError(null);
                    resetWriteStatus();
                  }}
                  options={FIGMA_ARRANGE_OPTIONS}
                />
              </div>
              <div className="rounded-[5px] border border-[var(--app-line)] p-2.5">
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 1, label: "检测插件" },
                    { id: 2, label: "连接插件" },
                    { id: 3, label: "校验文件" },
                  ].map((step) => {
                    const completed = connectionStage > step.id;
                    const current = connectionStage === step.id;
                    return (
                      <div key={step.id} className={cn("border-t-2 pt-1.5", completed ? "border-[var(--color-down)]" : current ? "border-[var(--color-warn)]" : "border-[var(--app-line)]")}>
                        <div className={cn("flex items-center gap-1 text-[10px]", current ? "text-[var(--app-text)]" : "text-[var(--app-text-3)]")}>
                          {completed ? (
                            <CheckCircle2 size={10} className="shrink-0 text-[var(--color-down)]" />
                          ) : current ? (
                            <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-warn)]" />
                          ) : (
                            <span className="size-1.5 shrink-0 rounded-full border border-[var(--app-text-4)]" />
                          )}
                          <span>{step.id}. {step.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 rounded-[4px] bg-[var(--app-surface-2)] p-2.5">
                  {connectionStage === 1 ? (
                    <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-2)]">
                      <Loader2 size={12} className="animate-spin text-[var(--color-warn)]" />
                      正在检测插件
                    </div>
                  ) : connectionStage === 2 ? (
                    <>
                      <div className="text-[10px] font-medium">在「延展连接器（ExtendLink）」中输入 5 位连接码</div>
                      <div className="mt-2 flex items-center justify-between gap-2 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2.5 py-2">
                        <code className="min-w-0 select-all truncate font-mono text-[16px] font-semibold tracking-[0.2em] text-[var(--app-text)]">{pairingCode}</code>
                        <button
                          type="button"
                          aria-label="复制 Figma 插件连接码"
                          title="复制连接码"
                          onClick={() => void copyPairingCode()}
                          className="grid size-6 shrink-0 place-items-center rounded-[3px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]"
                        >
                          {pairingCopied ? <CheckCircle2 size={12} className="text-[var(--color-down)]" /> : <Copy size={12} />}
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-expanded={installGuideOpen}
                        onClick={() => setInstallGuideOpen((open) => !open)}
                        className={cn(GHOST, "mt-1.5 flex items-center gap-1")}
                      >
                        安装方法
                        <ChevronDown size={11} className={cn("transition-transform", installGuideOpen && "rotate-180")} />
                      </button>
                    </>
                  ) : connectionStage === 3 ? (
                    <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-2)]">
                      {writeError ? (
                        <span className="size-1.5 rounded-full bg-[var(--color-up)]" />
                      ) : writeStarted ? (
                        <Loader2 size={12} className="animate-spin text-[var(--color-warn)]" />
                      ) : (
                        <CheckCircle2 size={12} className="text-[var(--color-down)]" />
                      )}
                      {writeError
                        ? "文件校验或写入未完成"
                        : writeStarted
                          ? writeProgress?.completed
                            ? "正在写入 Figma"
                            : "正在校验并准备写入"
                          : pluginConnection.compatible === false
                            ? "插件版本不匹配，请安装最新版"
                            : `插件已连接${pluginConnection.version ? ` · v${pluginConnection.version}` : ""}`}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-2)]">
                      <CheckCircle2 size={12} className="text-[var(--color-down)]" />
                      文件校验已完成
                    </div>
                  )}
                </div>

                {installGuideOpen ? (
                  <div className="mt-2 space-y-1.5 border-t border-[var(--app-line-soft)] pt-2 text-[9px] text-[var(--app-text-3)]">
                    {[
                      "安装并打开 Figma 桌面版（已安装可跳过）",
                      "下载「延展连接器（ExtendLink）」插件包并解压",
                      "Figma 桌面版：插件 → 开发 → 从清单导入插件",
                      "选择插件包中的 manifest.json",
                      "打开「延展连接器（ExtendLink）」并输入上方 5 位连接码",
                    ].map((item, index) => (
                      <div key={item} className="flex items-start gap-2">
                        <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[var(--app-surface-2)] text-[8px] text-[var(--app-text-2)]">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <span className="leading-4">{item}</span>
                          {index === 2 || index === 3 ? <InstallGuideVisual step={(index + 1) as 3 | 4} /> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {error ? <p role="alert" className="text-[11px] leading-relaxed text-[var(--color-up)]">{error}</p> : null}

          <div role="status" aria-live="polite" className="rounded-[5px] border border-[var(--app-line)] p-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] font-semibold">任务进度</div>
              <div className={cn("text-[10px]", done?.ok ? "text-[var(--color-down)]" : done?.failures.length || writeError ? "text-[var(--color-up)]" : busy ? "text-[var(--color-warn)]" : "text-[var(--app-text-3)]")}>
                {done
                  ? (done.ok ? "已完成" : "部分失败")
                  : writeError
                    ? "需要处理"
                    : busy
                      ? writeProgress?.completed ? `写入 ${writeProgress.completed}/${writeProgress.total}` : "等待插件"
                      : writeCancelled ? "已取消" : pluginConnection.connected ? "插件已连接" : "等待连接"}
              </div>
            </div>

            <div className="mt-2.5">
              {busy ? (
                <>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-2)]">
                    <Loader2 size={11} className="animate-spin text-[var(--color-warn)]" />
                    {writeProgress?.completed
                      ? `正在写入 ${writeProgress.completed} / ${writeProgress.total} 块画板`
                      : `已提交 ${plans.length} 块画板，等待插件处理`}
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--app-surface-3)]">
                    <div
                      className={cn("h-full rounded-full bg-[var(--color-brand)] opacity-60", writeProgress?.completed ? "transition-[width] duration-200" : "w-full animate-pulse")}
                      style={writeProgress?.completed ? { width: `${Math.max(4, (writeProgress.completed / writeProgress.total) * 100)}%` } : undefined}
                    />
                  </div>
                </>
              ) : done ? (
                <>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-2)]">
                    <CheckCircle2 size={11} className={done.ok ? "text-[var(--color-down)]" : "text-[var(--color-warn)]"} />
                    成功 {done.nodes.length} 块 · 失败 {done.failures.length} 块
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--app-surface-3)]">
                    <div className={cn("h-full w-full rounded-full", done.ok ? "bg-[var(--color-down)]" : "bg-[var(--color-warn)]")} />
                  </div>
                  {done.failures.length ? (
                    <button type="button" disabled={busy} onClick={() => run(done.failures)} className={cn(GHOST, "mt-1.5 -ml-2.5")}>
                      重新生成本次任务
                    </button>
                  ) : null}
                </>
              ) : writeError ? (
                <div className="flex items-start justify-between gap-2">
                  <p role="alert" className="min-w-0 flex-1 text-[9px] leading-4 text-[var(--color-up)]">{writeError}</p>
                  <button type="button" disabled={busy} onClick={() => void run(undefined, true)} className={cn(GHOST, "shrink-0")}>重试</button>
                </div>
              ) : writeCancelled ? (
                <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-3)]">
                  <X size={11} />
                  已取消本次写入
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-3)]">
                  <span className={cn("size-1.5 rounded-full", pluginConnection.connected ? "bg-[var(--color-down)]" : "bg-[var(--color-warn)]")} />
                  {pluginConnection.connected ? "插件已连接，可以开始写入" : "等待连接插件"}
                </div>
              )}
            </div>
          </div>
          </div>
        </aside>
      </div>
      {batchActions}
    </div>
  );
}
