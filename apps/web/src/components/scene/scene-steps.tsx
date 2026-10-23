"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { toBlob } from "html-to-image";
import JSZip from "jszip";
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Copy, CopyPlus, Download, Eye, EyeOff, ImageUp, Info, Layers3, Link2, Loader2, Lock, LockOpen, MousePointerClick, RotateCcw, X } from "lucide-react";
import {
  LANGS,
  NATIVE_SKINS,
  SCENE_FAMILY_LABEL,
  buildNativeBoard,
  buildSceneBoard,
  isSceneHex,
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
import { BackgroundColorControl, colorToHex } from "@/components/color-control";
import { Button, WorkflowSparkle } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { parseFigmaUrl } from "@/lib/figma-link";
import type { FigmaRecognitionResult } from "@/lib/figma-recognition";
import { buildLogoSvg, logoComponentRef, splashLogoComponentRef } from "@/lib/logo-svg";
import { useFitBoard } from "@/lib/use-fit-board";
import { UPLOAD_COMPONENT_ASPECT, UPLOAD_COMPONENT_HEIGHT, UPLOAD_COMPONENT_WIDTH, UPLOAD_FEATHER_HOLDS, UPLOAD_FEATHER_RATIOS, UPLOAD_FOCUS_REGION, uploadCropLayout } from "@/lib/upload-visual";
import { CAMPAIGN_PACK, CAMPAIGN_VISUAL_ASPECT, CAMPAIGN_VISUAL_HEIGHT, CAMPAIGN_VISUAL_WIDTH, campaignScenarioOf, campaignSlotOfTargetKey } from "@/lib/campaigns";
import { useScene, useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";
import { Dropdown } from "./font-picker";
import { SceneArtboard, SceneLinkedPreview } from "./scene-artboard";
import { SceneEditor } from "./scene-editor";
import { NativeBanner, NativeEditor, useNative, useNativeMeasure } from "./native-editor";
import { CROP_CORNERS } from "./visual-crop";

const ports = createWebPorts();
const INPUT = "h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] pl-8 pr-2.5 text-[10px] outline-none hover:border-[var(--app-line-strong)] focus:border-[var(--app-line-strong)]";
const GHOST = "h-7 rounded-[4px] px-2.5 text-[10px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]";
const PILL_TABS = "inline-flex rounded-full bg-[var(--app-surface-2)] p-1 text-[10px]";
const FEATHER_LABELS = ["关", "弱", "中", "强"] as const;
const FAMILY_ORDER: SceneFamily[] = ["strip", "landscape", "square", "portrait"];
const FAMILY_IDEAL: Record<SceneFamily, number> = { strip: 1080 / 225, landscape: 1.91, square: 1, portrait: 810 / 1110 };
const BATCH_ASIDE_STORE = "futu:scene-batch-aside-width";
const BATCH_ASIDE_LIMITS = [360, 640] as const;
/** 至少容纳两张 200px 卡片和间距；卡片内部再按实际宽度缩放预览。 */
const BATCH_BOARD_MIN_WIDTH = 440;

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
          <div className="mb-2 text-[#888]">FUTU 延展平台连接器 〉</div>
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

export function sceneRef(target: TargetBoard) {
  const ref = slotBoardRef(target);
  return target.key.startsWith(`campaign:${CAMPAIGN_PACK.id}:`) && ref.ctaSpec
    ? { ...ref, ctaSpec: { ...ref.ctaSpec, soft: true } }
    : ref;
}

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
const SLOT_CHANNEL_BY_ID = new Map(SIZE_GROUPS.flatMap((group) => group.items.map((item) => [item.id, group.name] as const)));
const EXTERNAL_GROUP = SIZE_GROUPS.find((group) => group.id === "external");
const EXTERNAL_SLOT_IDS = new Set(EXTERNAL_GROUP?.items.map((item) => item.id) ?? []);
const EXTERNAL_SUB_NAME_BY_ID = new Map(EXTERNAL_GROUP?.subs?.map((sub) => [sub.id, sub.name] as const) ?? []);
const isExternalTarget = (target: Pick<TargetBoard, "sizeId">) => Boolean(target.sizeId && EXTERNAL_SLOT_IDS.has(target.sizeId));
const boardChannelLabel = (target: Pick<TargetBoard, "sizeId">) => target.sizeId ? SLOT_CHANNEL_BY_ID.get(target.sizeId) ?? "自定义" : "自定义";
type FigmaLayoutGroup = "landscape" | "square" | "portrait" | "splash";
const LINKED_MASTER_IDS = new Set(
  SIZE_GROUPS.flatMap((group) => group.items.flatMap((item) => (item.linked ? [item.linked.master] : []))),
);
const boardLayoutGroup = (target: TargetBoard): FigmaLayoutGroup => {
  if ((target.sizeId && LINKED_MASTER_IDS.has(target.sizeId)) || linkedOf(target)) return "splash";
  const family = sceneBoardFamily(slotBoardRef(target));
  if (family === "square") return "square";
  if (family === "portrait") return "portrait";
  return "landscape";
};
const boardUseLabel = (target: Pick<TargetBoard, "key" | "sizeId" | "use">) => {
  if (target.key.startsWith("campaign:")) return target.use;
  const item = target.sizeId ? SLOT_ITEM_BY_ID.get(target.sizeId) : undefined;
  return item ? `${item.use}${item.variant ? ` ${item.variant}` : ""}` : target.use;
};
const externalCategoryLabel = (target: Pick<TargetBoard, "sizeId" | "use">) => {
  if (!isExternalTarget(target)) return null;
  const item = target.sizeId ? SLOT_ITEM_BY_ID.get(target.sizeId) : undefined;
  return (item?.sub ? EXTERNAL_SUB_NAME_BY_ID.get(item.sub) : undefined)
    || item?.use?.trim()
    || target.use?.trim()
    || "站外";
};
const externalBoardName = (target: Pick<TargetBoard, "w" | "h" | "sizeId" | "use">) => {
  const category = externalCategoryLabel(target);
  return category ? `${category}｜${target.w}*${target.h}` : null;
};
const boardDisplayLabel = (target: Pick<TargetBoard, "key" | "w" | "h" | "sizeId" | "use">) => (
  (externalCategoryLabel(target) ? `${boardSizeLabel(target)} ${externalCategoryLabel(target)}` : null)
    ?? (!boardUseLabel(target) ? boardSizeLabel(target) : `${boardSizeLabel(target)} ${boardUseLabel(target)}`)
);
const boardFileStem = (target: Pick<TargetBoard, "key" | "w" | "h" | "sizeId" | "use">) => (
  isExternalTarget(target) || !boardUseLabel(target)
    ? boardSizeLabel(target)
    : `${boardSizeLabel(target)}_${boardUseLabel(target)}`
);
const figmaBoardName = (target: Pick<TargetBoard, "key" | "w" | "h" | "sizeId" | "use">) => (
  externalBoardName(target) ?? (boardUseLabel(target)?.trim() || "自定义画幅")
);
const figmaFrameName = (target: Pick<TargetBoard, "key" | "w" | "h" | "sizeId" | "use">, language: string) => (
  externalBoardName(target) ?? `${figmaBoardName(target)}｜${boardSizeLabel(target)}｜${language}`
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
    "h-7 min-w-[116px] rounded-full px-5 text-center transition-colors",
    active ? "bg-[var(--app-page)] text-[var(--app-text)] shadow-sm" : "text-[var(--app-text-3)] hover:text-[var(--app-text)]",
  );
}

/** 优先取图片四边的平均色；透明图片四边无有效像素时回退到主体平均色。 */
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
    if (!count) {
      for (let offset = 0; offset < data.length; offset += 4) {
        if (data[offset + 3]! < 64) continue;
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
  const campaignLanguages = project.mode === "campaign"
    ? campaignScenarioOf(project.campaign?.scenarioId)?.languages ?? null
    : null;
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
        boardStyles: structuredClone(original?.boardStyles ?? current.languageBoardStyles?.[sourceLang] ?? {}),
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
              {!campaignLanguages && langs.length > 1 && !scene.lockedLanguages?.includes(id)
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
        {LANGS.filter((item) => !langs.includes(item.id) && (!campaignLanguages || campaignLanguages.includes(item.id))).map((item) => (
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

function SubjectEditor({ src, contentAspect, componentAspect = UPLOAD_COMPONENT_ASPECT, backgroundVisible = true }: { src?: string; contentAspect: number; componentAspect?: number; backgroundVisible?: boolean }) {
  const { scene, updateScene } = useScene();
  const ref = useRef<HTMLDivElement>(null);
  const cropDrag = useRef<{
    kind: "move" | "scale";
    sign: number;
    corner?: (typeof CROP_CORNERS)[number]["id"];
    x: number;
    y: number;
    crop: { zoom: number; x: number; y: number; frame: { x: number; y: number; w: number; h: number } };
    imageW: number;
    imageH: number;
  } | null>(null);
  const upload = scene.visualMode === "upload";
  const previewAspect = upload ? componentAspect : contentAspect;
  const componentHeight = UPLOAD_COMPONENT_HEIGHT;
  const componentWidth = componentHeight * componentAspect;
  const cropLayout = uploadCropLayout(contentAspect, scene.uploadCrop, componentAspect);
  const imageBox = cropLayout.image;
  const cropFrame = cropLayout.frame;
  const feather = UPLOAD_FEATHER_RATIOS[scene.feather] ?? 0;
  const featherHold = (UPLOAD_FEATHER_HOLDS[scene.feather] ?? 0) * 100;
  const focusWidth = cropFrame.w * componentWidth;
  const focusHeight = cropFrame.h * componentHeight;
  const featherSize = Math.min(focusWidth, focusHeight) * feather;
  const featherX = focusWidth > 0 ? (featherSize / focusWidth) * 100 : 0;
  const featherY = focusHeight > 0 ? (featherSize / focusHeight) * 100 : 0;

  const beginCrop = (
    event: ReactPointerEvent<HTMLElement>,
    kind: "move" | "scale" = "move",
    sign = 1,
    corner?: (typeof CROP_CORNERS)[number]["id"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    cropDrag.current = {
      kind,
      sign,
      corner,
      x: event.clientX,
      y: event.clientY,
      crop: cropLayout.crop,
      imageW: imageBox.w * componentWidth,
      imageH: imageBox.h * componentHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveCrop = (event: ReactPointerEvent<HTMLElement>) => {
    const state = cropDrag.current;
    const rect = ref.current?.getBoundingClientRect();
    if (!state || !rect) return;
    const dx = ((event.clientX - state.x) / rect.width) * componentWidth;
    const dy = ((event.clientY - state.y) / rect.height) * componentHeight;
    if (state.kind === "scale") {
      const minW = 120 / componentWidth;
      const minH = 90 / componentHeight;
      const dxUnit = dx / componentWidth;
      const dyUnit = dy / componentHeight;
      let left = state.crop.frame.x;
      let right = left + state.crop.frame.w;
      let top = state.crop.frame.y;
      let bottom = top + state.crop.frame.h;
      if (state.corner?.includes("w")) left = Math.max(0, Math.min(right - minW, left + dxUnit));
      if (state.corner?.includes("e")) right = Math.min(1, Math.max(left + minW, right + dxUnit));
      if (state.corner?.includes("n")) top = Math.max(0, Math.min(bottom - minH, top + dyUnit));
      if (state.corner?.includes("s")) bottom = Math.min(1, Math.max(top + minH, bottom + dyUnit));
      const frame = { x: left, y: top, w: right - left, h: bottom - top };
      updateScene((current) => ({ ...current, uploadCrop: uploadCropLayout(contentAspect, { ...state.crop, frame }, componentAspect).crop }));
      return;
    }
    const next = uploadCropLayout(contentAspect, {
      ...state.crop,
      x: state.crop.x - dx / Math.max(1, state.imageW),
      y: state.crop.y - dy / Math.max(1, state.imageH),
    }, componentAspect).crop;
    updateScene((current) => ({ ...current, uploadCrop: next }));
  };
  const endCrop = (event: ReactPointerEvent<HTMLElement>) => {
    cropDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const wheelCrop = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault();
    const zoom = cropLayout.crop.zoom * Math.exp(-event.deltaY * 0.001);
    updateScene((current) => ({ ...current, uploadCrop: uploadCropLayout(contentAspect, { ...cropLayout.crop, zoom }, componentAspect).crop }));
  };
  const keyCrop = (event: ReactKeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    const delta = {
      ArrowLeft: { x: step, y: 0 },
      ArrowRight: { x: -step, y: 0 },
      ArrowUp: { x: 0, y: step },
      ArrowDown: { x: 0, y: -step },
    }[event.key];
    if (!delta) return;
    event.preventDefault();
    updateScene((current) => ({
      ...current,
      uploadCrop: uploadCropLayout(contentAspect, {
        ...cropLayout.crop,
        x: cropLayout.crop.x + delta.x,
        y: cropLayout.crop.y + delta.y,
      }, componentAspect).crop,
    }));
  };

  return (
    <div ref={ref} className="relative max-h-full max-w-full select-none overflow-hidden" style={{ aspectRatio: `${previewAspect}`, width: "100%", background: upload && backgroundVisible ? scene.background : undefined }}>
      {src && upload ? (
        <div
            role="group"
            tabIndex={0}
            aria-label="图片裁切区域；拖动或方向键调整位置，滚轮调整缩放"
            title="拖动图片调整裁切；滚轮或上方缩放控件调整大小"
            onPointerDown={beginCrop}
            onPointerMove={moveCrop}
            onPointerUp={endCrop}
            onPointerCancel={endCrop}
            onWheel={wheelCrop}
            onKeyDown={keyCrop}
            className="touch-none absolute cursor-move border border-white/85"
            style={{
              left: `${cropFrame.x * 100}%`,
              top: `${cropFrame.y * 100}%`,
              width: `${cropFrame.w * 100}%`,
              height: `${cropFrame.h * 100}%`,
            }}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <img
                src={src}
                alt=""
                draggable={false}
                className="absolute select-none"
                style={{
                  left: `${((imageBox.x - cropFrame.x) / cropFrame.w) * 100}%`,
                  top: `${((imageBox.y - cropFrame.y) / cropFrame.h) * 100}%`,
                  width: `${(imageBox.w / cropFrame.w) * 100}%`,
                  height: `${(imageBox.h / cropFrame.h) * 100}%`,
                  maxWidth: "none",
                  maxHeight: "none",
                }}
              />
              {backgroundVisible && feather > 0 ? (
                <div className="absolute inset-0">
                  <span className="absolute inset-y-0 left-0" style={{ width: `${featherX}%`, backgroundImage: `linear-gradient(to right, ${scene.background} 0%, ${scene.background} ${featherHold}%, transparent 100%)` }} />
                  <span className="absolute inset-y-0 right-0" style={{ width: `${featherX}%`, backgroundImage: `linear-gradient(to left, ${scene.background} 0%, ${scene.background} ${featherHold}%, transparent 100%)` }} />
                  <span className="absolute inset-x-0 top-0" style={{ height: `${featherY}%`, backgroundImage: `linear-gradient(to bottom, ${scene.background} 0%, ${scene.background} ${featherHold}%, transparent 100%)` }} />
                  <span className="absolute inset-x-0 bottom-0" style={{ height: `${featherY}%`, backgroundImage: `linear-gradient(to top, ${scene.background} 0%, ${scene.background} ${featherHold}%, transparent 100%)` }} />
                </div>
              ) : null}
            </div>
            {CROP_CORNERS.map((corner) => (
              <span
                key={corner.id}
                role="presentation"
                onPointerDown={(event) => beginCrop(event, "scale", corner.sign, corner.id)}
                onPointerMove={moveCrop}
                onPointerUp={endCrop}
                onPointerCancel={endCrop}
                className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-white bg-white"
                style={{ left: `${corner.x * 100}%`, top: `${corner.y * 100}%`, cursor: corner.cursor }}
              />
            ))}
          </div>
      ) : src ? <img src={src} alt="" draggable={false} className="absolute inset-0 size-full object-contain" /> : null}
    </div>
  );
}

export function ScenePrepareStep({ onNext }: { onNext: () => void }) {
  const { project, updateContent } = useStudio();
  const { scene, updateScene, undoScene, redoScene } = useScene();
  const campaignMode = project.mode === "campaign";
  const componentAspect = campaignMode ? CAMPAIGN_VISUAL_ASPECT : UPLOAD_COMPONENT_ASPECT;
  const kv = project.content.kv;
  const [url, setUrl] = useState(kv?.source === "figma" ? kv.figmaUrl ?? "" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recognitionStartedAt, setRecognitionStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showUploadBackground, setShowUploadBackground] = useState(true);
  const urlRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const abortReasonRef = useRef<"cancel" | "timeout" | null>(null);
  const mountedRef = useRef(true);
  const mode = scene.visualMode;
  const figmaReady = kv?.source === "figma" && Boolean(kv.figmaUrl);
  const uploadReady = kv?.source === "upload" && Boolean(kv.previewUrl?.startsWith("data:"));
  const ready = mode === "figma" ? figmaReady : uploadReady;
  const previewSrc = ready ? kv?.previewUrl : undefined;
  const uploadAspect = scene.upload && scene.upload.height > 0 ? scene.upload.width / scene.upload.height : 1;
  const uploadCrop = uploadCropLayout(uploadAspect, scene.uploadCrop, componentAspect).crop;
  const previewAspect = mode === "upload" ? componentAspect : scene.visualAspect;
  const fit = useFitBoard(previewAspect * 1000, 1000, 48);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortReasonRef.current = "cancel";
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!busy || mode !== "figma" || recognitionStartedAt === null) return;
    const refresh = () => setElapsedSeconds(Math.floor((Date.now() - recognitionStartedAt) / 1000));
    refresh();
    const timer = window.setInterval(refresh, 250);
    return () => window.clearInterval(timer);
  }, [busy, mode, recognitionStartedAt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const textInput = target instanceof HTMLInputElement && !["range", "color", "checkbox", "radio", "button", "file"].includes(target.type);
      if (target && (textInput || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (!(event.ctrlKey || event.metaKey)) return;
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
  }, [redoScene, undoScene]);

  const adoptBackground = async (src: string | undefined) => {
    if (!src) return;
    const edge = await sampleEdgeColor(src);
    if (edge && mountedRef.current) updateScene((current) => ({ ...current, background: edge }));
  };

  const recognize = async () => {
    if (busy) {
      abortReasonRef.current = "cancel";
      abortRef.current?.abort();
      return;
    }
    if (!url.trim()) return;
    const controller = new AbortController();
    abortRef.current = controller;
    abortReasonRef.current = null;
    const timeout = window.setTimeout(() => {
      abortReasonRef.current = "timeout";
      controller.abort();
    }, 90_000);
    setRecognitionStartedAt(Date.now());
    setElapsedSeconds(0);
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
      if (!mountedRef.current) return;
      if (campaignMode && (Math.round(data.frame.width) !== CAMPAIGN_VISUAL_WIDTH || Math.round(data.frame.height) !== CAMPAIGN_VISUAL_HEIGHT)) {
        throw new Error(`专项主视觉组件需为 ${CAMPAIGN_VISUAL_WIDTH} × ${CAMPAIGN_VISUAL_HEIGHT}，当前为 ${Math.round(data.frame.width)} × ${Math.round(data.frame.height)}`);
      }
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
      updateScene((current) => ({
        ...current,
        visualMode: "figma",
        feather: 0,
        visualAspect: campaignMode ? CAMPAIGN_VISUAL_ASPECT : data.frame.width / Math.max(1, data.frame.height),
        focal: { x: 0.5, y: 0.5 },
        safeBox: campaignMode ? { x: 0, y: 0, w: 1, h: 1 } : { ...UPLOAD_FOCUS_REGION },
      }));
      void adoptBackground(data.previewUrl);
      requestAnimationFrame(() => {
        urlRef.current?.blur();
        if (urlRef.current) urlRef.current.scrollLeft = 0;
      });
    } catch (cause) {
      if (mountedRef.current) {
        setError(controller.signal.aborted
          ? abortReasonRef.current === "timeout" ? "识别超时，请重试" : "已取消识别"
          : cause instanceof Error ? cause.message : "识别失败");
      }
    } finally {
      window.clearTimeout(timeout);
      if (mountedRef.current) {
        setBusy(false);
        setRecognitionStartedAt(null);
      }
      abortRef.current = null;
      abortReasonRef.current = null;
    }
  };

  const clearFigma = () => {
    abortReasonRef.current = "cancel";
    abortRef.current?.abort();
    setBusy(false);
    setRecognitionStartedAt(null);
    setElapsedSeconds(0);
    setError(null);
    setUrl("");
    updateContent({ kv: undefined });
    updateScene((current) => ({ ...current, focal: { x: 0.5, y: 0.5 }, safeBox: campaignMode ? { x: 0, y: 0, w: 1, h: 1 } : { ...UPLOAD_FOCUS_REGION } }));
    requestAnimationFrame(() => urlRef.current?.focus());
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
      if (!mountedRef.current) return;
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
        uploadCrop: campaignMode
          ? { zoom: 1, x: 0.5, y: 0.5, frame: { x: 0, y: 0, w: 1, h: 1 } }
          : { zoom: 1, x: 0.5, y: 0.5 },
        visualAspect: componentAspect,
        feather: image.transparent ? 0 : Math.max(current.feather, 2),
        focal: { x: 0.5, y: 0.5 },
        safeBox: campaignMode ? { x: 0, y: 0, w: 1, h: 1 } : { ...UPLOAD_FOCUS_REGION },
      }));
      void adoptBackground(image.dataUrl);
    } catch (cause) {
      if (mountedRef.current) setError(cause instanceof Error ? cause.message : "图片读取失败");
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 overflow-x-auto">
        <div className={PILL_TABS}>
          <button type="button" disabled={busy} className={cn(pillTab(mode === "figma"), "disabled:cursor-wait disabled:opacity-50")} onClick={() => updateScene((current) => ({ ...current, visualMode: "figma" }))}>识别 Figma 主视觉组件</button>
          <button type="button" disabled={busy} className={cn(pillTab(mode === "upload"), "disabled:cursor-wait disabled:opacity-50")} onClick={() => updateScene((current) => ({ ...current, visualMode: "upload" }))}>上传图片并转换为组件</button>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-1 gap-3 rounded-[5px] bg-[var(--app-surface-2)] p-3">
        {mode === "figma" ? (
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="shrink-0 text-[10px] font-medium">主视觉组件链接</h2>
            <label className="relative block min-w-0 flex-1">
              <Link2 size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--app-text-3)]" />
              <input
                ref={urlRef}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && !busy && recognize()}
                onBlur={(event) => {
                  event.currentTarget.scrollLeft = 0;
                }}
                placeholder="粘贴主视觉 Component / Instance 链接"
                title={url ? "点击后可编辑或复制完整链接" : undefined}
                className={cn(INPUT, "truncate border-transparent hover:border-transparent focus:border-transparent focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/45")}
              />
            </label>
            {busy ? (
              <button type="button" aria-label="取消识别" title="取消识别" onClick={recognize} className={cn(GHOST, "grid size-7 shrink-0 place-items-center px-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/45")}>
                <X size={12} />
              </button>
            ) : figmaReady ? (
              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" aria-label="重新识别主视觉组件" title="重新识别" onClick={recognize} className={cn(GHOST, "grid size-7 place-items-center px-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/45")}>
                  <RotateCcw size={12} />
                </button>
                <button type="button" aria-label="删除主视觉组件链接" title="删除链接" onClick={clearFigma} className={cn(GHOST, "grid size-7 place-items-center px-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/45")}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <Button size="sm" disabled={!url.trim()} onClick={recognize}>识别</Button>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="shrink-0 text-[10px] font-medium">主视觉图片</h2>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }} />
            <Button size="sm" icon={busy ? <Loader2 size={12} className="animate-spin" /> : <ImageUp size={12} />} disabled={busy} onClick={() => fileRef.current?.click()}>
              {uploadReady ? "更换图片" : "选择 PNG / JPG"}
            </Button>
            <span className="min-w-0 flex-1 truncate text-[10px] text-[var(--app-text-3)]">
              {uploadReady && scene.upload ? `${scene.upload.name} · ${scene.upload.width} × ${scene.upload.height}` : "PNG 保留透明通道作为主体；JPG 通过四边过渡融入底色"}
            </span>
            {uploadReady ? (
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[9px] text-[var(--app-text-4)]">裁切缩放</span>
                <input
                  type="range"
                  min={100}
                  max={400}
                  step={1}
                  value={Math.round(uploadCrop.zoom * 100)}
                  aria-label="裁切图片缩放"
                  aria-valuetext={`${uploadCrop.zoom.toFixed(1)} 倍`}
                  className="h-1 w-20 cursor-pointer accent-white"
                  onChange={(event) => updateScene((current) => ({
                    ...current,
                    uploadCrop: uploadCropLayout(uploadAspect, { ...uploadCrop, zoom: Number(event.target.value) / 100 }, componentAspect).crop,
                  }))}
                />
                <span className="w-8 text-right text-[9px] tabular-nums text-[var(--app-text-3)]">{uploadCrop.zoom.toFixed(1)}×</span>
                <button
                  type="button"
                  title="恢复默认裁切"
                  aria-label="恢复默认裁切"
                  className="text-[var(--app-text-4)] hover:text-[var(--app-text)]"
                  onClick={() => updateScene((current) => ({
                    ...current,
                    uploadCrop: campaignMode
                      ? { zoom: 1, x: 0.5, y: 0.5, frame: { x: 0, y: 0, w: 1, h: 1 } }
                      : { zoom: 1, x: 0.5, y: 0.5 },
                  }))}
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            ) : null}
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[9px] text-[var(--app-text-4)]">四边过渡</span>
              <Segmented
                size="sm"
                value={String(scene.feather)}
                onChange={(value) => updateScene((current) => ({ ...current, feather: Number(value) }))}
                options={FEATHER_LABELS.map((label, index) => ({ id: String(index), label }))}
              />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-[9px] text-[var(--app-text-4)]">画板底色</span>
              <BackgroundColorControl
                label="画板底色"
                value={scene.background}
                onChange={(value) => isSceneHex(value) && updateScene((current) => ({ ...current, background: value }))}
              />
              <button
                type="button"
                title={showUploadBackground ? "隐藏底色预览" : "显示底色预览"}
                aria-label={showUploadBackground ? "隐藏画板底色预览" : "显示画板底色预览"}
                aria-pressed={showUploadBackground}
                onClick={() => setShowUploadBackground((value) => !value)}
                className="grid size-6 place-items-center text-[var(--app-text-3)] hover:text-[var(--app-text)]"
              >
                {showUploadBackground ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
            </div>
          </div>
        )}
        {campaignMode ? (
          <p className="flex min-w-0 items-center gap-1.5 text-[9px] leading-4 text-[var(--app-text-3)]">
            <Info size={10} className="shrink-0 text-[var(--color-brand)]" />
            <span className="truncate">专项主视觉统一为 {CAMPAIGN_VISUAL_WIDTH} × {CAMPAIGN_VISUAL_HEIGHT}；平台将按财报季语料自动适配各资源位。</span>
          </p>
        ) : null}
      </div>
      {error ? <div className="mt-1.5 px-1 text-[9px] text-[var(--color-up)]">{error}</div> : null}

      <div className="mt-4 min-h-0 flex-1">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[5px] border border-[var(--app-line)] bg-[#111317]">
          <div className="flex items-center justify-between border-b border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-2 text-[9px]">
            <span className="text-[var(--app-text-3)]">主视觉组件</span>
            <span className={busy ? "text-[var(--color-brand)]" : ready ? "text-[var(--color-down)]" : "text-[var(--color-warn)]"}>
              {busy ? (mode === "figma" ? `已等待 ${String(elapsedSeconds).padStart(2, "0")} 秒` : "读取中") : ready ? (mode === "figma" ? "已识别" : "已转换") : "待准备"}
            </span>
          </div>
          <div ref={fit.ref} className="grid min-h-0 flex-1 place-items-center overflow-hidden p-6">
            {busy ? (
              mode === "figma" ? (
                <div role="status" aria-live="polite" className="text-center">
                  <div aria-hidden="true" className="mx-auto grid size-11 place-items-center rounded-full border-2 border-[var(--app-line-strong)] border-t-[var(--app-text-2)] text-[9px] tabular-nums text-[var(--app-text-2)]">
                    {String(elapsedSeconds).padStart(2, "0")}s
                  </div>
                  <div className="mt-3 text-[11px] text-[var(--app-text-2)]">正在识别主视觉组件</div>
                  <div className="mt-1 text-[9px] text-[var(--app-text-4)]">识别时间会因节点复杂度不同</div>
                  <button type="button" onClick={recognize} className={cn(GHOST, "mt-3 border border-[var(--app-line)] bg-[var(--app-surface-2)]")}>取消识别</button>
                </div>
              ) : <Loader2 size={20} className="animate-spin text-[var(--app-text-4)]" />
            ) : ready ? (
              <div style={{ width: fit.width, background: mode !== "upload" || showUploadBackground ? scene.background : "transparent" }}>
                <SubjectEditor
                  src={previewSrc}
                  contentAspect={mode === "upload" ? uploadAspect : scene.visualAspect}
                  componentAspect={componentAspect}
                  backgroundVisible={mode !== "upload" || showUploadBackground}
                />
              </div>
            ) : (
              <div className="text-center">
                {mode === "figma" ? <Layers3 size={21} className="mx-auto text-[var(--app-text-4)]" /> : <ImageUp size={21} className="mx-auto text-[var(--app-text-4)]" />}
                <div className="mt-2 text-[10px] text-[var(--app-text-4)]">{mode === "figma" ? "识别后预览主视觉组件" : "上传后直接在这里转换，不跳转页面"}</div>
              </div>
            )}
          </div>
          {ready ? (
            <div className="px-3 py-2 text-[9px] leading-4 text-[var(--app-text-2)]">
              {mode === "upload"
                ? "写入 Figma 时将同步创建主视觉组件，所有生成画板均使用该组件实例，后续可统一替换或调整。"
                : "所有生成画板均使用已识别的主视觉组件实例，后续可在 Figma 中统一替换或调整。"}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-end gap-2">
        <Button size="lg" disabled>上一步</Button>
        <Button variant="workflow" size="lg" className="min-w-[96px]" disabled={!ready || busy} onClick={onNext}>下一步</Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 第三步：配置内容与版式                                               */
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
  const required = project.mode === "campaign" ? [] : groups.filter((item) => !item.locked);
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
          <div className="text-[13px] font-semibold">{project.mode === "campaign" ? "还没有选择专项资源位" : "还没有选择资源位"}</div>
          <Button className="mt-4" variant="primary" size="lg" onClick={onBack}>{project.mode === "campaign" ? "返回选择专项" : "返回选择资源位"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {kinds.length + (hasNative ? 1 : 0) > 1 || activeKind === "offline" ? (
        <div className="mb-2 shrink-0 overflow-x-auto">
          <div className="flex w-max items-center">
            <div className={PILL_TABS}>
            {kinds.map(({ kind, list }) => (
              <button key={kind} type="button" onClick={() => openKind(kind)} className={pillTab(activeKind === kind)}>
                {kindLabel(kind, list)}{kind === "splash" ? "" : ` · ${list.length}`}
              </button>
            ))}
            {hasNative ? <button type="button" onClick={() => setGroupId("native")} className={pillTab(nativeOpen)}>仿原生</button> : null}
            </div>
          </div>
        </div>
      ) : null}
      {siblings.length > 1 || (siblings.length === 1 && activeKind !== "splash") ? (
        <div className="mb-3 shrink-0 overflow-x-auto">
        <div className={cn("flex w-max items-center gap-2", siblingRows.length > 1 && "flex-wrap gap-y-1")}>
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
                className={cn("flex h-7 min-w-[112px] max-w-[260px] shrink-0 items-center justify-center gap-1.5 rounded-[4px] px-3 text-[10px]", active?.id === group.id ? "bg-[var(--color-brand-soft)] text-[var(--app-text)]" : "text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)]")}
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
          {project.mode !== "campaign" ? (
            !active ? (
              nextUnsaved ? <Button size="lg" onClick={() => setGroupId(nextUnsaved.id)}>下一个：{nextUnsaved.label}</Button> : null
            ) : (
              <Button size="lg" title={nextUnsaved ? `保存后进入下一个：${nextUnsaved.label}` : undefined} onClick={savePreset}>保存预设</Button>
            )
          ) : null}
          <Button variant="workflow" size="lg" disabled={unsaved.length > 0} onClick={onNext}>批量生成</Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 第四步：批量生成与输出                                               */
/* ------------------------------------------------------------------ */

function Thumb({ scene, version, target, lang, selected, compact = false, onOpen }: { scene: SceneState; version?: SceneVersion | null; target: TargetBoard; lang: Lang; selected?: boolean; compact?: boolean; onOpen: () => void }) {
  const { project } = useStudio();
  const ref = sceneRef(target);
  const resolved = sceneVersionView(sceneLanguageBoardView(scene, lang, ref, undefined, !version), version, ref);
  const fit = useFitBoard(target.w, target.h, compact ? 8 : 16, compact ? 1 : 80);
  const width = Math.min(compact ? 100 : 220, fit.width);
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
        <span className="truncate text-[var(--app-text-3)]">
          {external ? externalCategoryLabel(target) : boardUseLabel(target)}
        </span>
      </div>
    </button>
  );
}

function LinkedThumb({
  scene,
  version,
  target,
  master,
  lang,
  kvUrl,
  logoUrl,
  onOpen,
}: {
  scene: SceneState;
  version?: SceneVersion | null;
  target: TargetBoard;
  master: TargetBoard;
  lang: Lang;
  kvUrl?: string;
  logoUrl: string;
  onOpen: () => void;
}) {
  const link = linkedOf(target);
  const fit = useFitBoard(target.w, target.h, 8, 1);
  if (!link) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`细化 ${boardDisplayLabel(target)}，跟随闪屏母版`}
      title={`${boardDisplayLabel(target)} · 跟随闪屏母版`}
      className="flex min-w-0 flex-col items-center overflow-hidden rounded-[5px] border border-transparent bg-[var(--app-surface-2)] p-2 outline-none transition-colors hover:bg-[var(--app-surface-3)] focus-visible:bg-[var(--app-surface-3)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--app-text-2)]"
    >
      <div ref={fit.ref} aria-hidden="true" className="grid h-[136px] w-full min-w-0 place-items-center overflow-hidden rounded-[4px] bg-[#111317]">
        <SceneLinkedPreview
          scene={sceneVersionView(sceneLanguageBoardView(scene, lang, sceneRef(master), undefined, !version), version, sceneRef(master))}
          master={sceneRef(master)}
          board={sceneRef(target)}
          linked={link.linked}
          lang={lang}
          kvUrl={kvUrl}
          logoUrl={logoUrl}
          width={Math.min(100, fit.width)}
        />
      </div>
      <span className="mt-1.5 flex w-full min-w-0 items-baseline justify-center gap-1 truncate text-[10px]">
        <span className="shrink-0 font-medium tabular-nums text-[var(--app-text-2)]">{boardSizeLabel(target)}</span>
        <span className="truncate text-[var(--app-text-3)]">{boardUseLabel(target)}</span>
      </span>
      <span className="mt-0.5 w-full truncate text-center text-[9px] text-[var(--app-text-4)]">跟随闪屏母版</span>
    </button>
  );
}

function NativeThumb({ board, target, skin, onOpen }: { board: NativeBoard; target: TargetBoard; skin: string; onOpen: () => void }) {
  const fit = useFitBoard(board.w, board.h, 16);
  return (
    <button
      type="button"
      aria-label={`返回配置 ${boardDisplayLabel(target)} ${skin}`}
      title="回第三步修改仿原生"
      onClick={onOpen}
      className="min-w-0 overflow-hidden rounded-[5px] border border-transparent bg-[var(--app-surface-2)] p-2 text-left outline-none transition-colors hover:bg-[var(--app-surface-3)] focus-visible:bg-[var(--app-surface-3)] focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--app-text-2)]"
    >
      <div ref={fit.ref} aria-hidden="true" className="grid h-[136px] w-full min-w-0 place-items-center overflow-hidden rounded-[4px] bg-[#111317]">
        <NativeBanner board={board} width={Math.min(220, fit.width)} />
      </div>
      <div className="mt-2 flex min-w-0 items-baseline gap-1.5 truncate text-[10px]">
        <span className="shrink-0 font-medium tabular-nums text-[var(--app-text-2)]">{boardSizeLabel(target)}</span>
        <span className="truncate text-[var(--app-text-3)]">{boardUseLabel(target) ?? "仿原生"}</span>
      </div>
      <div className="mt-0.5 truncate text-[9px] text-[var(--app-text-4)]">{skin}</div>
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
  const [pluginConnection, setPluginConnection] = useState<{ connected: boolean; compatible: boolean | null; fileKey?: string }>({
    connected: false,
    compatible: null,
  });
  const [furthestConnectionStage, setFurthestConnectionStage] = useState<1 | 2 | 3>(1);
  const [viewedConnectionStage, setViewedConnectionStage] = useState<1 | 2 | 3>(1);
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
    for (const target of project.targets) {
      if (nativeOf(target)) continue;
      const targetRef = sceneRef(target);
      const activeScene = sceneVersionView(sceneLanguageBoardView(scene, lang, targetRef, undefined, !version), version, targetRef);
      for (const element of activeScene.elements) {
        if (element.visible && element.role === "module" && element.module?.fileKey) keys.add(element.module.fileKey);
      }
    }
    return keys;
  }, [kv?.figmaUrl, lang, project.targets, scene, version]);
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
  const targetFileValidated = pluginConnection.connected
    && pluginConnection.compatible !== false
    && targetLinkRecognized
    && targetLink.ok
    && Boolean(targetLink.nodeId)
    && pluginConnection.fileKey === targetLink.fileKey;
  const connectionStage = !pluginConnection.connected ? 1 : targetFileValidated ? (done ? 4 : 3) : 2;
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
          plugin?: { fileKey?: string } | null;
        };
        if (!active) return;
        setPluginConnection({
          connected: response.ok && Boolean(payload.connected),
          compatible: response.ok ? payload.compatible ?? null : null,
          ...(payload.plugin?.fileKey ? { fileKey: payload.plugin.fileKey } : {}),
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

  useEffect(() => {
    const visibleStage = Math.min(connectionStage, 3) as 1 | 2 | 3;
    if (visibleStage > furthestConnectionStage) {
      setFurthestConnectionStage(visibleStage);
      setViewedConnectionStage(visibleStage);
    } else if (furthestConnectionStage < 3) {
      setViewedConnectionStage(visibleStage);
    }
  }, [connectionStage, furthestConnectionStage]);

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
    setFurthestConnectionStage(1);
    setViewedConnectionStage(1);
    setInstallGuideOpen(false);
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

  const activeOutputLabel = version?.name ?? langName(lang);
  const activeOutputHidden = version ? Boolean(version.hidden) : Boolean(scene.hiddenLanguages?.includes(lang));
  const writeActionLabel = version ? `写入${activeOutputLabel}` : `写入${activeOutputLabel}版`;
  /** 批量页只输出左侧当前选中的基础语言或自定义版本，预览、图片导出和 Figma 写入共用同一范围。 */
  const outputs = useMemo<Array<{ id: string; lang: Lang; label: string; version?: SceneVersion }>>(
    () => activeOutputHidden ? [] : [{
      id: version?.id ?? lang,
      lang,
      label: activeOutputLabel,
      ...(version ? { version } : {}),
    }],
    [activeOutputHidden, activeOutputLabel, lang, version],
  );
  const batchCampaign = project.mode === "campaign" ? campaignScenarioOf(project.campaign?.scenarioId) : undefined;
  const boardTargets = useMemo(
    () => project.targets.filter((target) => {
      if (nativeOf(target)) return false;
      if (!batchCampaign) return true;
      const slot = campaignSlotOfTargetKey(batchCampaign, target.key);
      return Boolean(slot && (slot.languages ?? batchCampaign.languages).includes(lang));
    }),
    [batchCampaign, lang, project.targets],
  );
  const nativeTargets = useMemo(
    () => project.targets.filter((target) => {
      if (!nativeOf(target)) return false;
      if (!batchCampaign) return true;
      const slot = campaignSlotOfTargetKey(batchCampaign, target.key);
      return Boolean(slot && (slot.languages ?? batchCampaign.languages).includes(lang));
    }),
    [batchCampaign, lang, project.targets],
  );
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
        channel: boardChannelLabel(target),
        layoutGroup: boardLayoutGroup(target),
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
    const languageScene = sceneLanguageBoardView(scene, output.lang, ref, undefined, !output.version);
    const resolvedScene = sceneVersionView(languageScene, output.version, ref);
    const board = buildSceneBoard(resolvedScene, ref, output.lang);
    const hasLogo = board.layers.some((layer) => layer.role === "logo");
    const logoComponent = hasLogo ? logoComponentRef(board.logoPreset) : undefined;
    const name = figmaFrameName(target, output.label);
    const figmaLayout = {
      boardName: figmaBoardName(target),
      size: boardSizeLabel(target),
      language: output.label,
      languageGroup: output.id,
      languageSection: output.label,
      channel: boardChannelLabel(target),
      layoutGroup: boardLayoutGroup(target),
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
        linked: {
          masterKey: masterTarget.key,
          scale: place.scale,
          x: place.x,
          bar: link.linked.bar,
          logo: link.linked.logo,
          logoComponent: splashLogoComponentRef(board.logoPreset),
        },
      };
    }
    return {
      key: target.key,
      lang: output.id,
      name,
      figmaLayout,
      solution: sceneSolution(ref),
      backgroundColor: board.background,
      scene: board,
      ...(resolvedScene.visualMode === "upload" ? {
        uploadFeather: {
          level: resolvedScene.feather,
          color: resolvedScene.background,
          crop: uploadCropLayout(
            resolvedScene.upload && resolvedScene.upload.height > 0 ? resolvedScene.upload.width / resolvedScene.upload.height : 1,
            resolvedScene.uploadCrop,
            resolvedScene.visualAspect,
          ).crop,
        },
      } : {}),
      ...(hasLogo ? { logo: presetLogo(board.logoPreset), ...(logoComponent ? { logoComponent } : {}) } : {}),
    };
  })), [boardTargets, linkedTargets, outputs, project.name, project.targets, scene]);
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
      const splash = sorted.filter((target) => boardLayoutGroup(target) === "splash");
      const items = sorted.filter((target) => !linkedOf(target) && boardLayoutGroup(target) !== "splash");
      /** 站外 / 自定义按画幅族分小段，和第三步的分组对应。 */
      const parts = group.id === "external" || group.id === "custom"
        ? OUTSIDE_SEGMENTS.flatMap(({ id, label }) => {
          const list = items.filter((target) => outsideSegmentOf(target) === id);
          return list.length ? [{ id, label, items: list }] : [];
        })
        : [{ id: group.id, label: "", items }];
      return [{ id: group.id, name: group.name, count: all.length, parts, splash }];
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

  const resetConnectionReview = () => {
    const availableStage = pluginConnection.connected ? 2 : 1;
    setFurthestConnectionStage(availableStage);
    setViewedConnectionStage(availableStage);
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
    resetConnectionReview();
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
    if (!pluginConnection.connected) {
      setError("请先连接 FUTU 延展平台连接器");
      return;
    }
    if (pluginConnection.compatible === false) {
      setError("插件版本不匹配，请更新 FUTU 延展平台连接器");
      return;
    }
    if (!targetFileValidated) {
      setError("请在 Figma 中打开目标文件，完成文件校验后再写入");
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
        ...(kv && regular.length ? { visualComponent: kv } : {}),
        ...(scene.visualMode === "upload" ? {
          uploadFeather: {
            level: scene.feather,
            color: scene.background,
            crop: uploadCropLayout(scene.upload && scene.upload.height > 0 ? scene.upload.width / scene.upload.height : 1, scene.uploadCrop, scene.visualAspect).crop,
          },
        } : {}),
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
          const resolved = sceneVersionView(sceneLanguageBoardView(scene, output.lang, ref, undefined, !output.version), output.version, ref);
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
        for (const [outputIndex, output] of outputs.entries()) {
          const folder = `${String(outputIndex + 1).padStart(2, "0")}-${safeFileName(output.label)}`;
          for (const skin of NATIVE_SKINS) {
            const board = buildNativeBoard(native, skin.id, output.lang, measure);
            await capture(
              <NativeBanner board={board} width={target.w} />,
              target.w,
              target.h,
              `${folder}/${safeFileName(boardFileStem(target))}_${skin.name}.png`,
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
        aria-label={`导出${activeOutputLabel}版本图片`}
        icon={exportBusy ? undefined : <Download size={14} />}
        disabled={busy || exportBusy || !plans.length || (needsVisual && !visualReady)}
        onClick={() => void exportImages()}
      >
        {exportBusy ? <><Loader2 size={14} className="animate-spin" />{exportProgress || "正在导出…"}</> : activeOutputHidden ? "当前版本已隐藏" : needsVisual && !visualReady ? "请先准备主视觉" : "导出图片"}
      </Button>
      <Button
        variant={busy ? "secondary" : "workflow"}
        size="lg"
        icon={busy ? <X size={14} /> : <WorkflowSparkle />}
        className="min-w-[124px]"
        disabled={!busy && (exportBusy || !plans.length || !writeSettingsReady || !targetFileValidated || pluginConnection.compatible === false || (needsVisual && !visualReady))}
        onClick={busy ? cancelWrite : () => void run()}
      >
        {busy ? "取消写入" : activeOutputHidden ? "当前版本已隐藏" : needsVisual && !visualReady ? "请先准备主视觉" : !pluginConnection.connected ? "请先连接插件" : pluginConnection.compatible === false ? "请更新插件" : !targetFileValidated ? "请打开目标文件" : writeActionLabel}
      </Button>
    </div>
  );
  if (openTarget) {
    const openGroup = families.find((item) => item.items.some((target) => target.key === openTarget.key));
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
              <div className="grid gap-1.5">
                {(["landscape", "square", "portrait"] as const).map((layoutGroup) => {
                  const targets = channel.parts
                    .flatMap((part) => part.items)
                    .filter((target) => boardLayoutGroup(target) === layoutGroup);
                  return targets.length ? (
                    <div key={layoutGroup} className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5">
                      {targets.map((target) => (
                        <Thumb key={target.key} scene={scene} version={version} target={target} lang={lang} onOpen={() => setOpenKey(target.key)} />
                      ))}
                    </div>
                  ) : null;
                })}
              </div>
              {channel.splash.length ? (
              <div className={cn("grid grid-cols-9 gap-1.5", channel.parts.some((part) => part.items.length) && "mt-1.5")}>
                {channel.splash.map((target) => {
                  const link = linkedOf(target);
                  if (!link) {
                    return (
                      <Thumb
                        key={target.key}
                        scene={scene}
                        version={version}
                        target={target}
                        lang={lang}
                        compact
                        onOpen={() => setOpenKey(target.key)}
                      />
                    );
                  }
                  const master = masterOf(target);
                  if (!master) return null;
                  return (
                    <LinkedThumb
                      key={target.key}
                      scene={scene}
                      version={version}
                      target={target}
                      master={master}
                      lang={lang}
                      kvUrl={kv?.previewUrl}
                      logoUrl={splashLogoOf(scene.logoPreset).url}
                      onOpen={() => setOpenKey(master.key)}
                    />
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
                {nativePlans.map((plan) => {
                  const target = nativeTargets.find((item) => plan.key.startsWith(`${item.key}·`)) ?? nativeTargets[0]!;
                  const skin = NATIVE_SKINS.find((item) => plan.key.endsWith(item.id))?.name ?? "默认";
                  return <NativeThumb key={plan.key} board={plan.native!} target={target} skin={skin} onOpen={onBack} />;
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
                        resetConnectionReview();
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
                <div className="shrink-0 text-[10px] text-[var(--app-text-3)]">输出版本</div>
                <div className="rounded-[4px] bg-[var(--app-surface-2)] px-2.5 py-1 text-[10px] font-medium text-[var(--app-text-2)]">
                  {activeOutputLabel}{activeOutputHidden ? " · 已隐藏" : ""}
                </div>
              </div>
              <div className="rounded-[5px] border border-[var(--app-line)] p-2.5">
                <div className="grid grid-cols-3 gap-1">
                  {([
                    { id: 1, label: "检测插件" },
                    { id: 2, label: "连接插件" },
                    { id: 3, label: "校验文件" },
                  ] as const).map((step) => {
                    const available = step.id <= furthestConnectionStage;
                    const completed = step.id === 3
                      ? furthestConnectionStage >= 3
                      : furthestConnectionStage > step.id;
                    const selected = viewedConnectionStage === step.id;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        disabled={!available}
                        aria-current={selected ? "step" : undefined}
                        aria-label={`${available ? "查看" : "尚未进入"}第 ${step.id} 步：${step.label}`}
                        onClick={() => setViewedConnectionStage(step.id)}
                        className={cn(
                          "border-t-2 pt-1.5 text-left disabled:cursor-default",
                          completed ? "border-[var(--color-down)]" : selected ? "border-[var(--color-warn)]" : "border-[var(--app-line)]",
                        )}
                      >
                        <div className={cn("flex items-center gap-1 text-[10px]", selected ? "text-[var(--app-text)]" : "text-[var(--app-text-3)]")}>
                          {completed ? (
                            <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-down)]" />
                          ) : selected ? (
                            <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-warn)]" />
                          ) : (
                            <span className="size-1.5 shrink-0 rounded-full border border-[var(--app-text-4)]" />
                          )}
                          <span>{step.id}. {step.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 rounded-[4px] bg-[var(--app-surface-2)] p-2.5">
                  {viewedConnectionStage === 1 ? (
                    <>
                      <div className="text-[10px] text-[var(--app-text-2)]">在「FUTU 延展平台连接器」中输入下方连接码</div>
                      {pairingCode ? (
                        <>
                          <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2.5 py-2">
                            <code className="min-w-0 select-all truncate font-mono text-[16px] font-semibold tracking-[0.2em] text-[var(--app-text)]">{pairingCode}</code>
                            <button
                              type="button"
                              aria-label={pairingCopied ? "Figma 插件连接码已复制" : "复制 Figma 插件连接码"}
                              title={pairingCopied ? "已复制" : "复制连接码"}
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
                      ) : null}
                    </>
                  ) : viewedConnectionStage === 2 ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--app-text)]">
                        <CheckCircle2 size={20} className="text-[var(--color-down)]" />
                        插件已连接
                      </div>
                      {pluginConnection.compatible === false ? (
                        <div className="text-[9px] text-[var(--color-up)]">插件版本不匹配，请安装最新版</div>
                      ) : furthestConnectionStage === 2 && !targetFileValidated ? (
                        <div className="text-[9px] text-[var(--app-text-3)]">
                          {targetLinkRecognized ? "请在 Figma 中打开目标文件" : "请先识别上方目标文件链接"}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--app-text)]">
                      <CheckCircle2 size={20} className="text-[var(--color-down)]" />
                      目标文件已校验
                    </div>
                  )}
                </div>

                {viewedConnectionStage === 1 && installGuideOpen ? (
                  <div className="mt-2 space-y-1.5 border-t border-[var(--app-line-soft)] pt-2 text-[9px] text-[var(--app-text-3)]">
                    {[
                      "安装并打开 Figma 桌面版（已安装可跳过）",
                      "下载「FUTU 延展平台连接器」插件包并解压",
                      "Figma 桌面版：插件 → 开发 → 从清单导入插件",
                      "选择插件包中的 manifest.json",
                      "打开「FUTU 延展平台连接器」并输入上方 5 位连接码",
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

          <div role="status" aria-live="polite">
            <div className="text-[11px] font-semibold">任务进度</div>

            <div className="mt-2.5">
              {busy ? (
                <>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-2)]">
                    <Loader2 size={11} className="animate-spin text-[var(--app-text-4)]" />
                    {writeProgress?.completed
                      ? `正在写入 ${writeProgress.completed} / ${writeProgress.total} 块画板`
                      : `已提交${activeOutputLabel}版本 ${plans.length} 块画板，等待插件处理`}
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--app-surface-3)]">
                    <div
                      className={cn("h-full rounded-full bg-[var(--app-text-4)] opacity-70", writeProgress?.completed ? "transition-[width] duration-200" : "w-full animate-pulse")}
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
                  <p className="min-w-0 flex-1 text-[9px] leading-4 text-[var(--color-up)]">{writeError}</p>
                  <button type="button" disabled={busy} onClick={() => void run(undefined, true)} className={cn(GHOST, "shrink-0")}>重试</button>
                </div>
              ) : writeCancelled ? (
                <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-3)]">
                  <X size={11} />
                  已取消本次写入
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[10px] text-[var(--app-text-3)]">
                  <span className={cn("size-1.5 rounded-full", pluginConnection.compatible === false ? "bg-[var(--color-up)]" : pluginConnection.connected ? "bg-[var(--color-down)]" : "bg-[var(--color-warn)]")} />
                  {activeOutputHidden
                    ? "当前版本已隐藏，不参与输出"
                    : pluginConnection.compatible === false
                      ? "插件版本不匹配，请更新插件"
                      : pluginConnection.connected ? `等待写入${activeOutputLabel}版本` : "等待连接插件"}
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
