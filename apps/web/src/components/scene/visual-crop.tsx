"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { SceneBox, SceneUploadCrop } from "@futu/domain";
import { UPLOAD_COMPONENT_HEIGHT, UPLOAD_COMPONENT_WIDTH, UPLOAD_FEATHER_HOLDS, UPLOAD_FEATHER_RATIOS, uploadCropLayout } from "@/lib/upload-visual";

const MAX_W = 264;
const MAX_H = 180;
export const CROP_CORNERS = [
  { id: "nw", x: 0, y: 0, sign: -1, cursor: "nwse-resize" },
  { id: "ne", x: 1, y: 0, sign: 1, cursor: "nesw-resize" },
  { id: "sw", x: 0, y: 1, sign: -1, cursor: "nesw-resize" },
  { id: "se", x: 1, y: 1, sign: 1, cursor: "nwse-resize" },
] as const;

/** 拖动期间舞台会随主视觉重排，换算比例固定用按下时的 k。 */
type Drag = { kind: "move" | "scale"; sign: number; startX: number; startY: number; box: SceneBox; k: number };

/**
 * 主视觉取景预览：整张主视觉组件 + 当前画板的可见范围框。
 * 拖框移动画面；拖四角按画板中心缩放，框越小画面越大。
 */
export function VisualCrop({
  kvUrl,
  box,
  board,
  upload,
  onChange,
}: {
  kvUrl?: string;
  /** 主视觉在画板上的外框（画板像素）。 */
  box: SceneBox;
  board: { w: number; h: number };
  /** 上传图片在第一步形成的完整主视觉组件样式。 */
  upload?: {
    imageAspect: number;
    componentAspect: number;
    crop?: SceneUploadCrop;
    background: string;
    feather: number;
  };
  /** 新的主视觉外框；由调用方换算成位置与比例。 */
  onChange: (next: SceneBox) => void;
}) {
  const drag = useRef<Drag | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  /** 舞台同时容纳整张主视觉和取景框（画板比主视觉宽时框会伸出图外），单位为画板像素。 */
  const live = (() => {
    const minX = Math.min(box.x, 0);
    const minY = Math.min(box.y, 0);
    const spanW = Math.max(box.x + box.w, board.w) - minX;
    const spanH = Math.max(box.y + box.h, board.h) - minY;
    return { minX, minY, spanW, spanH, k: Math.min(MAX_W / spanW, MAX_H / spanH) };
  })();
  /** 拖框移动期间舞台钉在主视觉上不重排，图不动、取景框跟住指针。 */
  const [frozen, setFrozen] = useState<{ offX: number; offY: number; spanW: number; spanH: number; k: number } | null>(null);
  const { minX, minY, spanW, spanH, k } = frozen
    ? { minX: box.x + frozen.offX, minY: box.y + frozen.offY, spanW: frozen.spanW, spanH: frozen.spanH, k: frozen.k }
    : live;
  const width = box.w * k;
  const height = box.h * k;
  const image = { left: (box.x - minX) * k, top: (box.y - minY) * k, width, height };
  const crop = { left: -minX * k, top: -minY * k, width: board.w * k, height: board.h * k };
  const uploadLayout = upload ? uploadCropLayout(upload.imageAspect, upload.crop, upload.componentAspect) : null;
  const cropFrame = uploadLayout?.frame;
  const imageBox = uploadLayout?.image;
  const feather = upload ? UPLOAD_FEATHER_RATIOS[upload.feather] ?? 0 : 0;
  const featherHold = upload ? (UPLOAD_FEATHER_HOLDS[upload.feather] ?? 0) * 100 : 0;
  const componentHeight = UPLOAD_COMPONENT_HEIGHT;
  const componentWidth = componentHeight * (upload?.componentAspect ?? (UPLOAD_COMPONENT_WIDTH / UPLOAD_COMPONENT_HEIGHT));
  const focusWidth = cropFrame ? cropFrame.w * componentWidth : 0;
  const focusHeight = cropFrame ? cropFrame.h * componentHeight : 0;
  const featherSize = Math.min(focusWidth, focusHeight) * feather;
  const featherX = focusWidth > 0 ? (featherSize / focusWidth) * 100 : 0;
  const featherY = focusHeight > 0 ? (featherSize / focusHeight) * 100 : 0;

  const begin = (event: ReactPointerEvent<HTMLElement>, kind: Drag["kind"], sign = 1) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    /** 页面整体可能被缩放，指针位移按舞台在屏幕上的实际宽度换算。 */
    const shown = stage.current?.getBoundingClientRect().width;
    drag.current = { kind, sign, startX: event.clientX, startY: event.clientY, box, k: shown ? shown / spanW : k };
    if (kind === "move") setFrozen({ offX: minX - box.x, offY: minY - box.y, spanW, spanH, k });
  };
  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const origin = state.box;
    const dx = (event.clientX - state.startX) / state.k;
    const dy = (event.clientY - state.startY) / state.k;
    if (state.kind === "move") {
      onChange({ ...origin, x: origin.x - dx, y: origin.y - dy });
      return;
    }
    const cropW = board.w;
    const nextCropW = Math.max(board.w * 0.1, cropW + state.sign * dx * 2);
    const factor = cropW / nextCropW;
    const w = origin.w * factor;
    const h = origin.h * factor;
    const cu = (board.w / 2 - origin.x) / origin.w;
    const cv = (board.h / 2 - origin.y) / origin.h;
    onChange({ x: board.w / 2 - cu * w, y: board.h / 2 - cv * h, w, h });
  };
  const end = (event: ReactPointerEvent<HTMLElement>) => {
    drag.current = null;
    setFrozen(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="grid place-items-center rounded-[4px] bg-[#0b0c0e] p-2">
      <div ref={stage} className="relative overflow-hidden" style={{ width: spanW * k, height: spanH * k }}>
        <div className="pointer-events-none absolute overflow-hidden" style={{ ...image, background: upload?.background }}>
          {kvUrl && upload && cropFrame && imageBox ? (
            <div
              className="absolute overflow-hidden"
              style={{ left: `${cropFrame.x * 100}%`, top: `${cropFrame.y * 100}%`, width: `${cropFrame.w * 100}%`, height: `${cropFrame.h * 100}%` }}
            >
              <img
                src={kvUrl}
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
              {feather > 0 ? (
                <div className="absolute inset-0">
                  <span className="absolute inset-y-0 left-0" style={{ width: `${featherX}%`, backgroundImage: `linear-gradient(to right, ${upload.background} 0%, ${upload.background} ${featherHold}%, transparent 100%)` }} />
                  <span className="absolute inset-y-0 right-0" style={{ width: `${featherX}%`, backgroundImage: `linear-gradient(to left, ${upload.background} 0%, ${upload.background} ${featherHold}%, transparent 100%)` }} />
                  <span className="absolute inset-x-0 top-0" style={{ height: `${featherY}%`, backgroundImage: `linear-gradient(to bottom, ${upload.background} 0%, ${upload.background} ${featherHold}%, transparent 100%)` }} />
                  <span className="absolute inset-x-0 bottom-0" style={{ height: `${featherY}%`, backgroundImage: `linear-gradient(to top, ${upload.background} 0%, ${upload.background} ${featherHold}%, transparent 100%)` }} />
                </div>
              ) : null}
            </div>
          ) : kvUrl ? (
            <img src={kvUrl} alt="" draggable={false} className="block size-full select-none" />
          ) : (
            <div className="grid size-full place-items-center border border-dashed border-white/25 text-[9px] text-white/45">主视觉组件</div>
          )}
        </div>
        <div
          role="presentation"
          aria-label="画板可见范围"
          onPointerDown={(event) => begin(event, "move")}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="absolute cursor-move border border-white/85 shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"
          style={crop}
        >
          {CROP_CORNERS.map((corner) => (
            <span
              key={corner.id}
              role="presentation"
              onPointerDown={(event) => begin(event, "scale", corner.sign)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-white bg-white"
              style={{ left: `${corner.x * 100}%`, top: `${corner.y * 100}%`, cursor: corner.cursor }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
