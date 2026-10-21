"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import {
  SCENE_GROUP_ID,
  SCENE_OCCLUSION,
  SCENE_TEXT_ROLES,
  buildSceneBoard,
  isSceneGroupRole,
  layoutScene,
  linkedPlacement,
  resolveSceneGroup,
  resolveSceneOwn,
  resolveScenePlacement,
  scenePaintsCss,
  sceneWidthToUnit,
  type Lang,
  type SceneBadgeOut,
  type SceneBoardRef,
  type SceneBox,
  type SceneLayerOut,
  type ScenePlacementPatch,
  type SceneState,
  type SizeBox,
  type SizeLinked,
} from "@futu/domain";
import { LogoPresetPreview } from "@/components/logo-preset-preview";
import { cn } from "@/lib/utils";

const FEATHER_RATIO = [0, 0.08, 0.14, 0.2];

type DragState = {
  /** 写入的目标：标题组成员拖动时写到标题组。 */
  target: string;
  kind: "move" | "scale" | "width" | "height";
  startX: number;
  startY: number;
  boardW: number;
  boardH: number;
  layerW: number;
  layerH: number;
  /** 跟随标题组对齐时 x 由标题组决定，只能上下拖。 */
  lockX: boolean;
  widthSign?: number;
  /** 角点缩放时同步改变可拉伸元素的宽度，保持当前比例。 */
  scaleWidth?: boolean;
  origin: { x: number; y: number; scale: number; w: number };
  /** 多选拖动时一起挪的其它对象。 */
  followers: Array<{ target: string; origin: { x: number; y: number }; lockX: boolean }>;
  /** 被拖对象合起来的外框（画板像素），用于吸附。 */
  box?: SceneBox;
  snap?: { xs: number[]; ys: number[] };
};

type DragUnit = { target: string; origin: { x: number; y: number }; lockX: boolean; box: SceneBox };

const SNAP_PX = 5;

/** 移动后的外框三条边（左/中/右或上/中/下）里离参考线最近的一条，在阈值内返回需要补的位移。 */
function snapAxis(edges: number[], lines: number[], threshold: number) {
  let best: { delta: number; at: number } | null = null;
  for (const edge of edges) {
    for (const line of lines) {
      const delta = line - edge;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { delta, at: line };
    }
  }
  return best;
}

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function BadgeView({ layer, badge, k, fontFamily, fontWeight }: { layer: SceneLayerOut; badge: SceneBadgeOut; k: number; fontFamily: string; fontWeight: number }) {
  const bg = badge.bgSvg ? svgDataUrl(badge.bgSvg) : badge.bgUrl;
  const translate = badge.textAlign === "center" ? "-50%" : badge.textAlign === "right" ? "-100%" : "0";
  const overlay = badge.textOverlay;
  const paint = overlay
    ? {
      backgroundImage: `linear-gradient(90deg, ${overlay.color}${Math.round(overlay.alpha * 255).toString(16).padStart(2, "0")} 0%, transparent 100%), linear-gradient(${badge.textColor}, ${badge.textColor})`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    }
    : { color: badge.textColor };
  return (
    <>
      {bg ? (
        <img
          src={bg}
          alt=""
          draggable={false}
          className="pointer-events-none absolute block max-w-none"
          style={{ left: badge.bgBox.x * k, top: badge.bgBox.y * k, width: badge.bgBox.w * k, height: badge.bgBox.h * k }}
        />
      ) : null}
      {badge.markUrl && badge.markBox ? (
        <img
          src={badge.markUrl}
          alt=""
          draggable={false}
          className="pointer-events-none absolute block max-w-none"
          style={{ left: badge.markBox.x * k, top: badge.markBox.y * k, width: badge.markBox.w * k, height: badge.markBox.h * k }}
        />
      ) : null}
      <span
        className="pointer-events-none absolute whitespace-pre"
        style={{
          left: badge.textX * k,
          top: badge.textCy * k,
          transform: `translate(${translate}, -50%)${badge.skew ? ` skewX(${badge.skew}deg)` : ""}`,
          fontFamily,
          fontWeight,
          fontSize: (layer.fontPx ?? 0) * k,
          lineHeight: layer.lineHeight ?? 1.2,
          letterSpacing: layer.letterSpacing ? layer.letterSpacing * k : undefined,
          ...paint,
        }}
      >
        {layer.text}
      </span>
    </>
  );
}

/**
 * 读编辑区的纯文本；给了 stop 时同时算出该 DOM 位置对应的字符序号。
 * 行容器 div 之间算一个换行，空行占位的零宽字符和行尾占位 <br> 不计。
 */
function readEditable(root: HTMLElement, stop?: { node: Node; offset: number }) {
  let text = "";
  let index: number | null = null;
  const mark = () => {
    if (index === null) index = Array.from(text).length;
  };
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const data = node.textContent ?? "";
      if (stop && node === stop.node) {
        text += data.slice(0, stop.offset).replace(/\u200b/g, "");
        mark();
        text += data.slice(stop.offset).replace(/\u200b/g, "");
      } else {
        text += data.replace(/\u200b/g, "");
      }
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      if (node.parentNode?.lastChild !== node) text += "\n";
      return;
    }
    if (node !== root && node.tagName === "DIV" && node.previousSibling) text += "\n";
    node.childNodes.forEach((child, i) => {
      if (stop && node === stop.node && i === stop.offset) mark();
      visit(child);
    });
    if (stop && node === stop.node && stop.offset >= node.childNodes.length) mark();
  };
  visit(root);
  return { text, index };
}

type EditableApi = { input: (text: string) => void; range: (start: number, end: number) => void; exit: () => void };

/**
 * 画布内编辑：首帧按渲染结果（高亮、局部字体、逐行字号）铺好，之后交给浏览器编辑，
 * React 不再重绘这块 DOM，避免和输入冲突；退出编辑后由正常渲染接管。
 */
const FrozenEditable = memo(function FrozenEditable({ label, api, children }: { label: string; api: RefObject<EditableApi | null>; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.focus();
    const all = document.createRange();
    all.selectNodeContents(root);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(all);
    const report = () => {
      const current = window.getSelection();
      if (!current || !current.rangeCount || !current.anchorNode || !current.focusNode) return;
      if (!root.contains(current.anchorNode) || !root.contains(current.focusNode)) return;
      const a = readEditable(root, { node: current.anchorNode, offset: current.anchorOffset }).index;
      const b = readEditable(root, { node: current.focusNode, offset: current.focusOffset }).index;
      if (a === null || b === null) return;
      api.current?.range(Math.min(a, b), Math.max(a, b));
    };
    report();
    document.addEventListener("selectionchange", report);
    return () => document.removeEventListener("selectionchange", report);
  }, [api]);
  return (
    <div
      ref={ref}
      role="textbox"
      aria-label={label}
      aria-multiline
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(event) => api.current?.input(readEditable(event.currentTarget).text)}
      onKeyDown={(event) => {
        if (event.key === "Escape") api.current?.exit();
      }}
      onBlur={() => api.current?.exit()}
      className="cursor-text select-text whitespace-pre outline-none"
      style={{ lineHeight: "inherit" }}
    >
      {children}
    </div>
  );
}, () => true);

export function SceneArtboard({
  scene,
  board,
  lang,
  kvUrl,
  width,
  selectedId,
  selectedIds,
  issueIds,
  guides = false,
  outlines = true,
  onSelect,
  focusId,
  onFocusLayer,
  onPatch,
  onTextRange,
  onTextChange,
  fixedLayout = false,
  pinnedIds,
}: {
  scene: SceneState;
  board: SceneBoardRef;
  lang: Lang;
  kvUrl?: string;
  width: number;
  selectedId?: string | null;
  /** 多选时除主选中项外的其它图层。 */
  selectedIds?: ReadonlySet<string>;
  issueIds?: ReadonlySet<string>;
  guides?: boolean;
  /** 问题框线、悬停框线与标题组虚线框；关掉后只保留当前选中项的外框。 */
  outlines?: boolean;
  /** additive：按住 Shift / Ctrl / ⌘ 点选，加入或移出多选。 */
  onSelect?: (id: string | null, additive?: boolean) => void;
  /** 标题组选中时，组里正在单独调的那一层。 */
  focusId?: string | null;
  /** 点到标题组里的某一层：标题组保持选中，展开这一层的参数。 */
  onFocusLayer?: (id: string) => void;
  onPatch?: (id: string, patch: ScenePlacementPatch) => void;
  /** 双击文字进入编辑，选区变化时回传字符区间。 */
  onTextRange?: (id: string, start: number, end: number) => void;
  onTextChange?: (id: string, text: string) => void;
  /** 版式按规范锁定：只有主视觉能拖，其它图层点选不挪。 */
  fixedLayout?: boolean;
  /** 位置按规范锁定的图层（如未解除锁定的规范 CTA）：能选中，不能拖。 */
  pinnedIds?: ReadonlySet<string>;
}) {
  const k = width / board.w;
  const height = board.h * k;
  const output = buildSceneBoard(scene, board, lang);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editApi = useRef<EditableApi | null>(null);
  useLayoutEffect(() => {
    editApi.current = editingId ? {
      input: (text) => onTextChange?.(editingId, text),
      range: (start, end) => onTextRange?.(editingId, start, end),
      exit: () => setEditingId(null),
    } : null;
  });
  const interactive = Boolean(onPatch);
  const movable = (id: string) => interactive && !pinnedIds?.has(id) && (!fixedLayout || scene.elements.find((item) => item.id === id)?.role === "visual");
  const occlusion = SCENE_OCCLUSION[board.key];
  const groupIds = new Set(output.group?.stackIds ?? []);
  const groupActive = selectedId === SCENE_GROUP_ID || (selectedId ? groupIds.has(selectedId) : false);
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number } | null>(null);

  /** 拖动时实际挪的对象：文字层和编入组的图层都归到标题组。 */
  const unitFor = (id: string): DragUnit | null => {
    const el = scene.elements.find((item) => item.id === id);
    const placement = el ? resolveScenePlacement(scene, board, el) : null;
    const independentBackdrop = Boolean(el?.role === "module" && (placement?.customMode ?? el.module?.placementMode) === "title-backdrop");
    if (output.group && (id === SCENE_GROUP_ID || (el && (isSceneGroupRole(el.role) || (placement?.attach && !independentBackdrop))))) {
      const group = resolveSceneGroup(scene, board);
      return { target: SCENE_GROUP_ID, origin: { x: group.x, y: group.y }, lockX: false, box: output.group.frame };
    }
    const layer = output.layers.find((item) => item.id === id);
    if (!el || !layer) return null;
    const ownPlacement = placement ?? resolveScenePlacement(scene, board, el);
    return { target: id, origin: { x: ownPlacement.x, y: ownPlacement.y }, lockX: Boolean(output.group && ownPlacement.follow && ownPlacement.follow !== "none"), box: layer.box };
  };
  /** 点击标题组里的图层始终选中整个标题组，被点那一层同时高亮、带缩放手柄、展开参数；双击进入文字编辑。 */
  const pick = (id: string) => {
    if (id === SCENE_GROUP_ID || unitFor(id)?.target !== SCENE_GROUP_ID) {
      onSelect?.(id);
      return;
    }
    onSelect?.(SCENE_GROUP_ID);
    onFocusLayer?.(id);
  };
  /** 多选（两个以上对象）时的合并外框，表示这些对象暂时当成一组。 */
  const selectionBox = (() => {
    if (!selectedIds?.size) return null;
    const units = new Map<string, SceneBox>();
    for (const item of [selectedId, ...selectedIds]) {
      const unit = item ? unitFor(item) : null;
      if (unit) units.set(unit.target, unit.box);
    }
    if (units.size < 2) return null;
    const boxes = [...units.values()];
    const left = Math.min(...boxes.map((item) => item.x));
    const top = Math.min(...boxes.map((item) => item.y));
    return { x: left, y: top, w: Math.max(...boxes.map((item) => item.x + item.w)) - left, h: Math.max(...boxes.map((item) => item.y + item.h)) - top };
  })();

  const begin = (event: ReactPointerEvent<HTMLElement>, id: string, kind: DragState["kind"]) => {
    if (!interactive) return;
    event.stopPropagation();
    setEditingId(null);
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      onSelect?.(id, true);
      return;
    }
    if (!movable(id)) {
      pick(id);
      return;
    }
    /** 按在多选里的对象上拖：所有选中的对象一起挪，选择不变。 */
    const picked = new Map<string, DragUnit>();
    for (const item of [selectedId, ...(selectedIds ?? [])]) {
      const unit = item ? unitFor(item) : null;
      if (unit && !pinnedIds?.has(unit.target)) picked.set(unit.target, unit);
    }
    const pressed = unitFor(id);
    const multi = kind === "move" && picked.size > 1 && Boolean(pressed && picked.has(pressed.target));
    if (!multi) pick(id);
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const el = scene.elements.find((item) => item.id === id);
    const layerRect = (event.currentTarget.closest("[data-scene-layer]") as HTMLElement | null)?.getBoundingClientRect();
    let target = id;
    let origin: DragState["origin"];
    let lockX = false;
    const boxW = output.layers.find((layer) => layer.id === id)?.box.w ?? 0;
    /** 拖文字层或编入组的图层都是挪整个标题组；组内位置锁定，要单独挪先取消编组。 */
    const dragPlacement = el ? resolveScenePlacement(scene, board, el) : null;
    const independentBackdrop = Boolean(el?.role === "module" && (dragPlacement?.customMode ?? el.module?.placementMode) === "title-backdrop");
    const rides = Boolean(el && kind === "move" && output.group && dragPlacement?.attach && !independentBackdrop);
    if (id === SCENE_GROUP_ID || (el && isSceneGroupRole(el.role) && kind === "move") || rides) {
      const group = resolveSceneGroup(scene, board);
      target = SCENE_GROUP_ID;
      origin = { x: group.x, y: group.y, scale: group.scale, w: 0 };
    } else if (el && isSceneGroupRole(el.role)) {
      const own = resolveSceneOwn(scene, board, el);
      origin = { x: own.x, y: own.y, scale: own.scale, w: 0 };
    } else if (el) {
      const placement = resolveScenePlacement(scene, board, el);
      /** 编入标题组的图层从画面上的实际位置起拖。 */
      const start = placement.attach ? layoutScene(scene, board, lang).laid.find((item) => item.el.id === id)?.placement ?? placement : placement;
      origin = { x: start.x, y: start.y, scale: start.scale, w: boxW };
      lockX = Boolean(output.group && placement.follow && placement.follow !== "none");
    } else {
      return;
    }
    const followers = multi ? [...picked.values()].filter((unit) => unit.target !== target) : [];
    let box: SceneBox | undefined;
    let snap: DragState["snap"];
    if (kind === "move") {
      const boxes = [(target === SCENE_GROUP_ID ? output.group?.frame : output.layers.find((layer) => layer.id === id)?.box), ...followers.map((unit) => unit.box)].filter((item): item is SceneBox => Boolean(item));
      if (boxes.length) {
        const left = Math.min(...boxes.map((item) => item.x));
        const top = Math.min(...boxes.map((item) => item.y));
        box = { x: left, y: top, w: Math.max(...boxes.map((item) => item.x + item.w)) - left, h: Math.max(...boxes.map((item) => item.y + item.h)) - top };
      }
      const moving = new Set([target, ...followers.map((unit) => unit.target)]);
      const refs = output.layers.filter((layer) => layer.role !== "visual" && !moving.has(unitFor(layer.id)?.target ?? layer.id)).map((layer) => layer.box);
      if (output.group && !moving.has(SCENE_GROUP_ID)) refs.push(output.group.frame);
      snap = {
        xs: [0, board.w / 2, board.w, ...refs.flatMap((item) => [item.x, item.x + item.w / 2, item.x + item.w])],
        ys: [0, board.h / 2, board.h, ...refs.flatMap((item) => [item.y, item.y + item.h / 2, item.y + item.h])],
      };
    }
    dragRef.current = {
      target,
      kind,
      startX: event.clientX,
      startY: event.clientY,
      boardW: rect.width,
      boardH: rect.height,
      layerW: Math.max(8, layerRect?.width ?? rect.width / 4),
      layerH: Math.max(8, layerRect?.height ?? rect.height / 4),
      lockX,
      origin,
      followers: followers.map(({ target: item, origin: start, lockX: locked }) => ({ target: item, origin: start, lockX: locked })),
      box,
      snap,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || !onPatch) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.kind === "move") {
      /** 位移按画板在屏幕上的实际尺寸换成画板像素再吸附（页面可能整体缩放）；按住 Alt 拖不吸附。 */
      let mx = (dx * board.w) / drag.boardW;
      let my = (dy * board.h) / drag.boardH;
      const lines: { x?: number; y?: number } = {};
      if (drag.box && drag.snap && !event.altKey) {
        const b = drag.box;
        const threshold = (SNAP_PX * board.w) / drag.boardW;
        const hitX = drag.lockX ? null : snapAxis([b.x + mx, b.x + b.w / 2 + mx, b.x + b.w + mx], drag.snap.xs, threshold);
        const hitY = snapAxis([b.y + my, b.y + b.h / 2 + my, b.y + b.h + my], drag.snap.ys, threshold);
        if (hitX) {
          mx += hitX.delta;
          lines.x = hitX.at;
        }
        if (hitY) {
          my += hitY.delta;
          lines.y = hitY.at;
        }
      }
      setSnapLines((current) => current?.x === lines.x && current?.y === lines.y ? current : lines.x === undefined && lines.y === undefined ? null : lines);
      for (const unit of [{ target: drag.target, origin: drag.origin, lockX: drag.lockX }, ...drag.followers]) {
        const y = unit.origin.y + my / board.h;
        onPatch(unit.target, unit.lockX ? { y } : { x: unit.origin.x + mx / board.w, y });
      }
    } else if (drag.kind === "width") {
      onPatch(drag.target, {
        w: sceneWidthToUnit(board, Math.max(8, drag.origin.w + (dx * (drag.widthSign ?? 1) * board.w) / drag.boardW)),
        length: undefined,
      });
    } else if (drag.kind === "height") {
      onPatch(drag.target, { scale: drag.origin.scale * Math.max(0.2, (drag.layerH + dy) / drag.layerH) });
    } else {
      const factor = Math.max(0.2, (drag.layerW + dx) / drag.layerW);
      onPatch(drag.target, {
        scale: drag.origin.scale * factor,
        ...(drag.scaleWidth ? { w: sceneWidthToUnit(board, drag.origin.w * factor) } : {}),
      });
    }
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setSnapLines(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const padX = (24 / 1080) * board.w * k;
  const padY = 0.04 * board.h * k;
  const handleFor = (id: string, scaleWidth = false) => (
    <span
      role="presentation"
      title="拖动缩放比例"
      onPointerDown={(event) => {
        begin(event, id, "scale");
        if (dragRef.current) dragRef.current.scaleWidth = scaleWidth;
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="absolute -bottom-1 -right-1 size-2 cursor-nwse-resize rounded-[1px] border border-[var(--color-brand)] bg-white"
    />
  );
  /** 宽度手柄放在锚点对侧：右锚点的 CTA 往左拉变宽，居中的两边同时变。 */
  const widthHandleFor = (layer: SceneLayerOut) => (
    <span
      role="presentation"
      title="拖动改宽度"
      onPointerDown={(event) => {
        begin(event, layer.id, "width");
        if (dragRef.current) dragRef.current.widthSign = layer.align === "right" ? -1 : layer.align === "center" ? 2 : 1;
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn(
        "absolute top-1/2 h-3 w-1.5 -translate-y-1/2 cursor-ew-resize rounded-[1px] border border-[var(--color-brand)] bg-white",
        layer.align === "right" ? "-left-1" : "-right-1",
      )}
    />
  );
  /** 无固定 CTA 规范时，底部手柄独立调整高度；侧边手柄调整长度，角点手柄保持等比缩放。 */
  const heightHandleFor = (layer: SceneLayerOut) => (
    <span
      role="presentation"
      title="拖动改高度"
      onPointerDown={(event) => begin(event, layer.id, "height")}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="absolute bottom-[-3px] left-1/2 h-1.5 w-3 -translate-x-1/2 cursor-ns-resize rounded-[1px] border border-[var(--color-brand)] bg-white"
    />
  );

  return (
    <div
      ref={boardRef}
      className="relative shrink-0 overflow-hidden select-none"
      style={{ width, height, backgroundColor: output.background }}
      onPointerDown={() => {
        if (!interactive) return;
        setEditingId(null);
        onSelect?.(null);
      }}
    >
      {output.layers.map((layer) => {
        const selected = selectedId === layer.id || (selectedId === SCENE_GROUP_ID && focusId === layer.id);
        const flagged = outlines && issueIds?.has(layer.id);
        const editing = editingId === layer.id;
        const frame = cn(
          movable(layer.id) && !editing && "cursor-move",
          selected || selectedIds?.has(layer.id) ? "outline outline-1 outline-[var(--color-brand)]" : flagged ? "outline outline-1 outline-dashed outline-[var(--color-warn)]" : interactive && outlines && "hover:outline hover:outline-1 hover:outline-[var(--color-brand-line)]",
        );
        const handle = selected && movable(layer.id) && !editing ? handleFor(layer.id) : null;
        const pointer = {
          onPointerDown: (event: ReactPointerEvent<HTMLElement>) => begin(event, layer.id, "move"),
          onPointerMove: move,
          onPointerUp: end,
          onPointerCancel: end,
        };

        if (layer.role === "visual") {
          const feather = scene.visualMode === "upload" ? FEATHER_RATIO[scene.feather] ?? 0 : 0;
          const edge = Math.min(layer.box.w, layer.box.h) * feather * k;
          return (
            <div
              key={layer.id}
              data-scene-layer
              {...pointer}
              className={cn("absolute", frame)}
              style={{ left: layer.box.x * k, top: layer.box.y * k, width: layer.box.w * k, height: layer.box.h * k }}
            >
              {kvUrl ? (
                <img src={kvUrl} alt="" draggable={false} className="pointer-events-none block size-full" />
              ) : (
                <div className="grid size-full place-items-center border border-dashed border-white/25 text-[9px] text-white/45">主视觉组件</div>
              )}
              {output.edgeFade ? (
                <div className="pointer-events-none absolute" style={{ left: -layer.box.x * k, top: -layer.box.y * k, width: output.board.w * k, height: output.board.h * k }}>
                  <span className="absolute inset-y-0 left-0" style={{ width: output.edgeFade * k, backgroundImage: `linear-gradient(to right, ${output.background}, transparent)` }} />
                  <span className="absolute inset-y-0 right-0" style={{ width: output.edgeFade * k, backgroundImage: `linear-gradient(to left, ${output.background}, transparent)` }} />
                </div>
              ) : null}
              {edge > 0 ? (
                <div className="pointer-events-none absolute inset-0">
                  <span className="absolute inset-y-0 left-0" style={{ width: edge, backgroundImage: `linear-gradient(to right, ${output.background}, transparent)` }} />
                  <span className="absolute inset-y-0 right-0" style={{ width: edge, backgroundImage: `linear-gradient(to left, ${output.background}, transparent)` }} />
                  <span className="absolute inset-x-0 top-0" style={{ height: edge, backgroundImage: `linear-gradient(to bottom, ${output.background}, transparent)` }} />
                  <span className="absolute inset-x-0 bottom-0" style={{ height: edge, backgroundImage: `linear-gradient(to top, ${output.background}, transparent)` }} />
                </div>
              ) : null}
              {handle}
            </div>
          );
        }

        if (layer.role === "logo") {
          return (
            <div
              key={layer.id}
              data-scene-layer
              {...pointer}
              className={cn("absolute", frame)}
              style={{ left: layer.box.x * k, top: layer.box.y * k, width: layer.box.w * k, height: layer.box.h * k }}
            >
              <LogoPresetPreview preset={output.logoPreset} className="pointer-events-none size-full min-h-0" />
              {handle}
            </div>
          );
        }

        if (layer.role === "module" && layer.module) {
          return (
            <div
              key={layer.id}
              data-scene-layer
              {...pointer}
              className={cn("absolute", frame)}
              style={{ left: layer.box.x * k, top: layer.box.y * k, width: layer.box.w * k, height: layer.box.h * k }}
            >
              {layer.module.previewUrl ? (
                <img src={layer.module.previewUrl} alt="" draggable={false} className="pointer-events-none block size-full object-cover object-top" />
              ) : (
                <div className="grid size-full place-items-center border border-dashed border-white/25 text-[8px] text-white/45">{layer.name}</div>
              )}
              {selected && movable(layer.id) && layer.module.stretchable ? widthHandleFor(layer) : null}
              {selected && movable(layer.id) && layer.module.stretchable ? heightHandleFor(layer) : null}
              {selected && movable(layer.id) && !editing ? handleFor(layer.id, Boolean(layer.module.stretchable)) : null}
            </div>
          );
        }

        const translateX = layer.align === "left" ? "0" : layer.align === "center" ? "-50%" : "-100%";
        const fontPx = (layer.fontPx ?? 0) * k;
        const fontFamily = `${layer.fontFace ? `"${layer.fontFace}", ` : ""}"${layer.fontFamily}", "FZLanTingHei-R-GBK", sans-serif`;
        const textStyle = {
          fontFamily,
          fontWeight: layer.fontWeight ?? 400,
          ...(layer.italic ? { fontStyle: "italic" as const } : {}),
          fontSize: fontPx,
          ...(layer.letterSpacing ? { letterSpacing: layer.letterSpacing * k } : {}),
        };

        if (layer.role === "badge" && layer.badge) {
          const stretchable = layer.badge.style === "style1";
          return (
            <div
              key={layer.id}
              data-scene-layer
              {...pointer}
              className={cn("absolute", frame)}
              style={{ left: layer.box.x * k, top: layer.box.y * k, width: layer.box.w * k, height: layer.box.h * k }}
            >
              <BadgeView layer={layer} badge={layer.badge} k={k} fontFamily={fontFamily} fontWeight={layer.fontWeight ?? 400} />
              {handle}
              {selected && movable(layer.id) && stretchable ? widthHandleFor(layer) : null}
            </div>
          );
        }

        if (layer.role === "cta" && layer.cta) {
          const locked = Boolean(layer.cta.locked);
          return (
            <div
              key={layer.id}
              data-scene-layer
              {...pointer}
              title={locked ? board.ctaSpec?.lengths ? `高度锁定，宽度可拖动（${board.ctaSpec.minWidth}–${board.ctaSpec.maxWidth}px）` : "站内规范 CTA，尺寸已锁定" : undefined}
              className={cn("absolute flex items-center justify-center whitespace-nowrap", frame)}
              style={{
                left: layer.anchor.x * k,
                top: layer.anchor.y * k,
                transform: `translate(${translateX}, -50%)`,
                height: layer.box.h * k,
                ...(layer.cta.fixedWidth ? { width: layer.cta.fixedWidth * k } : { minWidth: layer.cta.minWidth * k }),
                ...(layer.cta.maxWidth ? { maxWidth: layer.cta.maxWidth * k } : {}),
                paddingInline: layer.cta.paddingX * k,
                borderRadius: (layer.box.h * k) / 2,
                backgroundColor: layer.cta.paints ? undefined : layer.cta.backgroundColor,
                backgroundImage: layer.cta.paints ? scenePaintsCss(layer.cta.paints, layer.box.w / Math.max(1, layer.box.h)).join(", ") : layer.cta.backgroundImage,
                color: layer.cta.textColor,
                lineHeight: 1,
                ...textStyle,
              }}
            >
              <span className="overflow-hidden text-ellipsis">{layer.text}</span>
              {locked ? null : handle}
              {selected && movable(layer.id) && (!locked || board.ctaSpec?.lengths) ? widthHandleFor(layer) : null}
              {selected && movable(layer.id) && !board.ctaSpec ? heightHandleFor(layer) : null}
            </div>
          );
        }

        const characters = Array.from(layer.text ?? "");
        const runs = layer.highlightRuns ?? [];
        const charSpan = (character: string, index: number, clipped = false) => {
          const font = layer.fontRuns?.find((item) => index >= item.start && index < item.end);
          return (
            <span
              key={index}
              data-ci={index}
              style={{
                color: clipped ? "transparent" : layer.charColors?.[index],
                lineHeight: "inherit",
                ...(font ? { fontFamily: `"${font.fontFace}", "${font.fontFamily}", ${fontFamily}`, fontWeight: font.fontWeight, fontStyle: font.italic ? "italic" : "normal" } : {}),
              }}
            >
              {character}
            </span>
          );
        };
        /** 同一高亮段内连续的字包一层，用渐变背景裁切文字；段宽按字数估算宽高比。 */
        const renderChars = (chars: string[], start: number) => {
          const nodes: ReactNode[] = [];
          let offset = 0;
          while (offset < chars.length) {
            const index = start + offset;
            const run = runs.find((item) => index >= item.start && index < item.end);
            if (!run) {
              nodes.push(charSpan(chars[offset]!, index));
              offset += 1;
              continue;
            }
            const count = Math.min(run.end - index, chars.length - offset);
            const slice = chars.slice(offset, offset + count);
            nodes.push(
              <span
                key={`run-${index}`}
                style={{
                  backgroundImage: scenePaintsCss(run.paints, Math.max(1, slice.length) / 1.2).join(", "),
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  lineHeight: "inherit",
                }}
              >
                {slice.map((character, i) => charSpan(character, index + i, true))}
              </span>,
            );
            offset += count;
          }
          return nodes;
        };
        const strokeChars = (chars: string[], start: number) => layer.fontRuns?.length
          ? chars.map((character, i) => {
            const font = layer.fontRuns!.find((item) => start + i >= item.start && start + i < item.end);
            return font
              ? <span key={i} style={{ fontFamily: `"${font.fontFace}", "${font.fontFamily}", ${fontFamily}`, fontWeight: font.fontWeight, fontStyle: font.italic ? "italic" : "normal" }}>{character}</span>
              : character;
          })
          : chars.join("");
        const rowStyle = (row: number) => ({
          fontSize: (layer.lineFontPx![row] ?? layer.fontPx ?? 0) * k,
          lineHeight: layer.lineHeightPx?.[row] !== undefined ? `${layer.lineHeightPx[row]! * k}px` : "inherit",
          ...(layer.lineLetterSpacing ? { letterSpacing: (layer.lineLetterSpacing[row] ?? 0) * k } : {}),
        });
        const lines: Array<{ start: number; chars: string[] }> = [];
        if (layer.lineFontPx) {
          let start = 0;
          for (const line of (layer.text ?? "").split("\n")) {
            const chars = Array.from(line);
            lines.push({ start, chars });
            start += chars.length + 1;
          }
        }

        const highlightable = interactive && Boolean(onTextRange) && SCENE_TEXT_ROLES.includes(layer.role);
        const position = {
          left: layer.anchor.x * k,
          top: layer.anchor.y * k,
          transform: `translate(${translateX}, -50%)`,
          lineHeight: layer.lineHeight ?? 1.2,
          textAlign: layer.align,
          ...textStyle,
        };
        /** 描边垫在文字下面：外部描边画双倍宽，被文字盖住内侧一半；居中/内部为近似。 */
        const stroke = layer.stroke ? (
          <div
            key={`${layer.id}-stroke`}
            aria-hidden
            className="pointer-events-none absolute whitespace-pre"
            style={{
              ...position,
              color: "transparent",
              WebkitTextStroke: `${layer.stroke.weight * k * (layer.stroke.align === "OUTSIDE" ? 2 : 1)}px transparent`,
              backgroundImage: scenePaintsCss(layer.stroke.paints, layer.box.w / Math.max(1, layer.box.h)).join(", "),
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            {layer.lineFontPx
              ? lines.map((line, row) => (
                <div key={row} style={rowStyle(row)}>
                  {line.chars.length ? strokeChars(line.chars, line.start) : "\u200b"}
                </div>
              ))
              : strokeChars(characters, 0)}
          </div>
        ) : null;
        const editor = editing && onTextChange ? (
          <div
            key={`${layer.id}-editor`}
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute outline outline-1 outline-dashed outline-[var(--color-brand)]"
            style={{ ...position, caretColor: "#FFFFFF" }}
          >
            <FrozenEditable label={`编辑${layer.name}`} api={editApi}>
              {layer.lineFontPx
                ? lines.map((line, row) => (
                  <div key={row} style={rowStyle(row)}>
                    {line.chars.length ? renderChars(line.chars, line.start) : "\u200b"}
                  </div>
                ))
                : renderChars(characters, 0)}
            </FrozenEditable>
          </div>
        ) : null;
        return [editor ? null : stroke, (
          <div
            key={layer.id}
            data-scene-layer
            data-scene-text={layer.id}
            {...pointer}
            onDoubleClick={highlightable ? (event) => {
              event.stopPropagation();
              onSelect?.(layer.id);
              setEditingId(layer.id);
            } : undefined}
            title={highlightable && !editing ? "双击编辑文字" : undefined}
            className={cn("absolute whitespace-pre", frame, editor && "invisible")}
            style={position}
          >
            {layer.lineFontPx
              ? lines.map((line, row) => (
                <div key={row} style={rowStyle(row)}>
                  {line.chars.length ? renderChars(line.chars, line.start) : "\u200b"}
                </div>
              ))
              : renderChars(characters, 0)}
            {handle}
          </div>
        ), editor];
      })}

      {output.group && groupActive && interactive && (outlines || selectedId === SCENE_GROUP_ID) ? (
        <div
          data-scene-layer
          className="pointer-events-none absolute outline outline-1 outline-dashed outline-[var(--color-brand-line)]"
          style={{
            left: output.group.frame.x * k - 3,
            top: output.group.frame.y * k - 3,
            width: output.group.frame.w * k + 6,
            height: output.group.frame.h * k + 6,
          }}
        >
          <span
            onPointerDown={(event) => begin(event, SCENE_GROUP_ID, "move")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            className={cn("pointer-events-auto absolute -top-4 left-0 rounded-[3px] bg-[#111317] px-1 text-[8px] leading-[14px] text-[var(--app-text-2)]", !fixedLayout && "cursor-move")}
          >
            标题组
          </span>
          {selectedId === SCENE_GROUP_ID && !fixedLayout ? <span className="pointer-events-auto">{handleFor(SCENE_GROUP_ID)}</span> : null}
        </div>
      ) : null}

      {selectionBox && interactive ? (
        <div
          className="pointer-events-none absolute outline outline-1 outline-dashed outline-[var(--app-text-3)]"
          style={{ left: selectionBox.x * k - 4, top: selectionBox.y * k - 4, width: selectionBox.w * k + 8, height: selectionBox.h * k + 8 }}
        />
      ) : null}
      {snapLines?.x !== undefined ? <div className="pointer-events-none absolute inset-y-0 w-px bg-[#ff4d94]" style={{ left: snapLines.x * k }} /> : null}
      {snapLines?.y !== undefined ? <div className="pointer-events-none absolute inset-x-0 h-px bg-[#ff4d94]" style={{ top: snapLines.y * k }} /> : null}

      {guides && board.zones?.length ? board.zones.map((zone, index) => (
        <div
          key={`zone-${index}`}
          className={cn(
            "pointer-events-none absolute flex items-start justify-start border border-dashed p-1",
            zone.kind === "reserved" ? "border-[#ff8a8a]/70 bg-[#ff5a5a]/10" : "border-white/45",
          )}
          style={{ left: zone.x * k, top: zone.y * k, width: zone.w * k, height: zone.h * k }}
        >
          {zone.label && zone.w * k > 64 && zone.h * k > 16 ? (
            <span className="rounded-[3px] bg-[#111317] px-1.5 py-0.5 text-[8px] leading-none text-[var(--app-text-2)]">{zone.label}</span>
          ) : null}
        </div>
      )) : guides ? (
        <>
          <div
            className="pointer-events-none absolute border border-dashed border-white/30"
            style={{ left: padX, top: padY, right: padX, bottom: padY }}
          />
          {occlusion ? (
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end border-t border-dashed border-[var(--color-warn)] p-1"
              style={{ height: board.h * occlusion * k }}
            >
              <span className="rounded-[3px] bg-[#111317] px-1.5 py-0.5 text-[8px] text-[var(--app-text-2)]">底部遮挡区</span>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** 联动画板预览：母版按规则缩放裁切，底部白条与 Logo 会输出；系统按钮、跳过控件只示意。 */
export function SceneLinkedPreview({
  scene,
  master,
  board,
  linked,
  lang,
  kvUrl,
  logoUrl,
  width,
  guides = true,
}: {
  scene: SceneState;
  master: SceneBoardRef;
  board: SceneBoardRef;
  linked: SizeLinked;
  lang: Lang;
  kvUrl?: string;
  logoUrl: string;
  width: number;
  guides?: boolean;
}) {
  const k = width / board.w;
  const place = linkedPlacement(linked, board, master);
  const box = (b: SizeBox) => ({ left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k });
  return (
    <div className="relative shrink-0 overflow-hidden bg-white" style={{ width, height: board.h * k }}>
      <div className="absolute top-0" style={{ left: place.x * k }}>
        <SceneArtboard scene={scene} board={master} lang={lang} kvUrl={kvUrl} width={place.w * k} />
      </div>
      <img src={logoUrl} alt="" className="absolute" style={box(linked.logo)} />
      {guides ? (
        <>
          {linked.control ? <div className="pointer-events-none absolute rounded-full border border-dashed border-white/60 bg-white/15" style={box(linked.control)} /> : null}
          {linked.skip ? <div className="pointer-events-none absolute rounded-full border border-dashed border-white/60 bg-black/25" style={box(linked.skip)} /> : null}
          {board.zones?.map((zone, index) => (
            <div key={index} className="pointer-events-none absolute border border-dashed border-white/45" style={box(zone)} />
          ))}
        </>
      ) : null}
    </div>
  );
}
