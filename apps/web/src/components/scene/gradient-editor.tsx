"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowLeftRight, Minus, Plus, RotateCw } from "lucide-react";
import {
  SCENE_GRADIENT_TYPES,
  isSceneHex,
  sampleScenePaints,
  type SceneCustomGradient,
  type SceneFillSpec,
  type SceneGradientStop,
  type SceneGradientType,
} from "@futu/domain";
import { BackgroundColorControl } from "@/components/color-control";
import { arrowStep, ScrubField } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

const SELECT = "h-7 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2 text-[10px] outline-none focus:border-[var(--color-brand)]";
const ICON = "grid size-7 place-items-center rounded-[4px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]";
const NUM = "h-7 w-full rounded-[4px] bg-[var(--app-field)] px-1.5 text-right text-[10px] tabular-nums outline-none focus:ring-1 focus:ring-[var(--color-brand)]";

function rgba(stop: SceneGradientStop) {
  const value = stop.color.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${stop.alpha})`;
}

/** 断点条：始终按从左到右展示断点，和 Figma 渐变面板一致。 */
function stopsCss(stops: readonly SceneGradientStop[]) {
  return `linear-gradient(90deg, ${[...stops].sort((a, b) => a.pos - b.pos).map((item) => `${rgba(item)} ${(item.pos * 100).toFixed(1)}%`).join(", ")})`;
}

const CHECKER = "repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 0 0 / 8px 8px";

/** 参照 Figma 渐变面板：类型、翻转、旋转、可拖动的断点条、断点列表。 */
export function GradientEditor({ value, onChange }: { value: SceneCustomGradient; onChange: (next: SceneCustomGradient) => void }) {
  const [active, setActive] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<number | null>(null);
  const stops = value.stops;
  const current = Math.min(active, stops.length - 1);

  const setStops = (next: SceneGradientStop[]) => onChange({ ...value, stops: next });
  const patchStop = (index: number, patch: Partial<SceneGradientStop>) => setStops(stops.map((item, i) => i === index ? { ...item, ...patch } : item));
  const posAt = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  const colorAt = (pos: number) => {
    const sampled = sampleScenePaints([{ type: "GRADIENT_LINEAR", transform: [[1, 0, 0], [0, 1, 0]], stops }], pos, 0.5, "#000000");
    return sampled.toUpperCase();
  };
  const addStop = (pos: number) => {
    const next = [...stops, { pos: Math.round(pos * 1000) / 1000, color: colorAt(pos), alpha: 1 }];
    setStops(next);
    setActive(next.length - 1);
  };
  const removeStop = (index: number) => {
    if (stops.length <= 2) return;
    setStops(stops.filter((_, i) => i !== index));
    setActive(0);
  };
  const onHandleDown = (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = index;
    setActive(index);
  };
  const onHandleMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragging.current === null || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    patchStop(dragging.current, { pos: Math.round(posAt(event.clientX) * 1000) / 1000 });
  };
  const ordered = stops.map((item, index) => ({ item, index })).sort((a, b) => a.item.pos - b.item.pos);
  const selected = stops[current]!;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <select
          aria-label="渐变类型"
          value={value.type}
          onChange={(event) => onChange({ ...value, type: event.target.value as SceneGradientType })}
          className={cn(SELECT, "flex-1")}
        >
          {SCENE_GRADIENT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
        </select>
        <button type="button" aria-label="翻转渐变" title="翻转断点" onClick={() => setStops(stops.map((item) => ({ ...item, pos: Math.round((1 - item.pos) * 1000) / 1000 })))} className={ICON}>
          <ArrowLeftRight size={13} />
        </button>
        <button type="button" aria-label="旋转 90°" title="顺时针旋转 90°" onClick={() => onChange({ ...value, angle: (value.angle + 90) % 360 })} className={ICON}>
          <RotateCw size={13} />
        </button>
      </div>

      <div className="relative pt-4">
        {ordered.map(({ item, index }) => (
          <button
            key={index}
            type="button"
            aria-label={`断点 ${Math.round(item.pos * 100)}%`}
            onPointerDown={(event) => onHandleDown(event, index)}
            onPointerMove={onHandleMove}
            onPointerUp={() => { dragging.current = null; }}
            className={cn(
              "absolute top-0 z-10 size-4 -translate-x-1/2 cursor-ew-resize rounded-[3px] border-2",
              index === current ? "border-[var(--color-brand)]" : "border-white/70",
            )}
            style={{ left: `${item.pos * 100}%`, background: `linear-gradient(${rgba(item)}, ${rgba(item)}), ${CHECKER}` }}
          />
        ))}
        <div
          ref={barRef}
          title="点击空白处添加断点"
          onPointerDown={(event) => addStop(posAt(event.clientX))}
          className="h-6 cursor-copy rounded-[4px] border border-white/10"
          style={{ background: `${stopsCss(stops)}, ${CHECKER}` }}
        />
      </div>

      {value.type === "GRADIENT_LINEAR" ? (
        <ScrubField label="角度" ariaLabel="渐变角度" value={Math.round(value.angle)} min={-360} max={360} suffix="°" onCommit={(angle) => onChange({ ...value, angle: ((angle % 360) + 360) % 360 })} />
      ) : null}

      <div className="flex items-center justify-between text-[9px] text-[var(--app-text-4)]">
        <span>断点</span>
        <button
          type="button"
          aria-label="添加断点"
          onClick={() => {
            const sorted = [...stops].sort((a, b) => a.pos - b.pos);
            const at = sorted.findIndex((item) => item === selected);
            const neighbour = sorted[at + 1] ?? sorted[at - 1];
            addStop(neighbour ? (selected.pos + neighbour.pos) / 2 : 0.5);
          }}
          className="grid size-5 place-items-center rounded-[3px] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]"
        >
          <Plus size={12} />
        </button>
      </div>
      <div className="space-y-1">
        {ordered.map(({ item, index }) => (
          <div
            key={index}
            onClick={() => setActive(index)}
            className={cn("grid grid-cols-[44px_minmax(0,1fr)_44px_20px] items-center gap-1 rounded-[4px] px-1 py-0.5", index === current && "bg-[var(--app-surface-2)]")}
          >
            <label className="relative">
              <input
                aria-label="断点位置"
                inputMode="numeric"
                value={Math.round(item.pos * 100)}
                onChange={(event) => {
                  const next = Number(event.target.value.replace(/[^\d.]/g, ""));
                  if (Number.isFinite(next)) patchStop(index, { pos: Math.max(0, Math.min(100, next)) / 100 });
                }}
                onKeyDown={(event) => arrowStep(event, Math.round(item.pos * 100), (next) => patchStop(index, { pos: next / 100 }), 0, 100)}
                className={cn(NUM, "pr-3.5")}
              />
              <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-[var(--app-text-4)]">%</span>
            </label>
            <div className="min-w-0 rounded-[4px] bg-[var(--app-field)] px-1.5 py-1">
              <BackgroundColorControl label="断点颜色" value={item.color} onChange={(color) => isSceneHex(color) && patchStop(index, { color: color.toUpperCase() })} />
            </div>
            <label className="relative">
              <input
                aria-label="断点不透明度"
                inputMode="numeric"
                value={Math.round(item.alpha * 100)}
                onChange={(event) => {
                  const next = Number(event.target.value.replace(/[^\d.]/g, ""));
                  if (Number.isFinite(next)) patchStop(index, { alpha: Math.max(0, Math.min(100, next)) / 100 });
                }}
                onKeyDown={(event) => arrowStep(event, Math.round(item.alpha * 100), (next) => patchStop(index, { alpha: next / 100 }), 0, 100)}
                className={cn(NUM, "pr-3.5")}
              />
              <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-[var(--app-text-4)]">%</span>
            </label>
            <button
              type="button"
              aria-label="删除断点"
              disabled={stops.length <= 2}
              onClick={(event) => {
                event.stopPropagation();
                removeStop(index);
              }}
              className="grid size-5 place-items-center rounded-[3px] text-[var(--app-text-4)] hover:text-[var(--app-text)] disabled:opacity-30"
            >
              <Minus size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 纯色 / 渐变二选一的填充编辑，切换时记住上一次的渐变。 */
export function FillEditor({ value, onChange, label }: { value: SceneFillSpec; onChange: (next: SceneFillSpec) => void; label: string }) {
  const [lastGradient, setLastGradient] = useState<SceneCustomGradient>(() => value.type === "SOLID"
    ? { type: "GRADIENT_LINEAR", angle: 0, stops: [{ pos: 0, color: value.color, alpha: 1 }, { pos: 1, color: "#FFFFFF", alpha: 1 }] }
    : value);
  const switchTo = (kind: "solid" | "gradient") => {
    if (kind === "solid" && value.type !== "SOLID") {
      setLastGradient(value);
      onChange({ type: "SOLID", color: value.stops[0]?.color ?? "#FFFFFF" });
    } else if (kind === "gradient" && value.type === "SOLID") {
      onChange(lastGradient);
    }
  };
  return (
    <div className="space-y-2">
      <Segmented<"solid" | "gradient">
        size="sm"
        value={value.type === "SOLID" ? "solid" : "gradient"}
        onChange={switchTo}
        options={[{ id: "solid", label: "纯色" }, { id: "gradient", label: "渐变" }]}
      />
      {value.type === "SOLID" ? (
        <BackgroundColorControl label={label} value={value.color} onChange={(color) => isSceneHex(color) && onChange({ type: "SOLID", color: color.toUpperCase() })} />
      ) : (
        <GradientEditor value={value} onChange={onChange} />
      )}
    </div>
  );
}
