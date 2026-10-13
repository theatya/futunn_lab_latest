"use client";

import { useEffect, useRef, useState, type InputHTMLAttributes, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { cn, clamp } from "@/lib/utils";

const BASE =
  "w-full border border-[var(--app-line)] bg-[var(--app-field)] rounded-[var(--radius-sm)] " +
  "px-3 text-[13px] text-[var(--app-text)] placeholder:text-[var(--app-text-4)] " +
  "transition-[border-color,box-shadow] duration-[var(--dur-fast)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-2 focus:ring-[var(--color-brand-line)]";

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 mb-1.5">
      <span className="text-[11px] font-semibold text-[var(--app-text-2)]">{children}</span>
      {hint ? <span className="text-[10px] text-[var(--app-text-4)]">{hint}</span> : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode }) {
  return (
    <label className="block">
      {label ? <Label hint={hint}>{label}</Label> : null}
      <input className={cn(BASE, "h-10", className)} {...rest} />
    </label>
  );
}

export function TextArea({
  label,
  hint,
  rows = 3,
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode }) {
  return (
    <label className="block">
      {label ? <Label hint={hint}>{label}</Label> : null}
      <textarea rows={rows} className={cn(BASE, "py-2 leading-relaxed resize-y", className)} {...rest} />
    </label>
  );
}

/**
 * 可直接编辑的数值框。
 *
 * 关键在于**输入期间不回写**：如果每敲一个字符就 clamp 再回填，
 * 用户想把 300 改成 1200 时，刚删到 "3" 就会被夹回下限，根本没法打字。
 * 所以这里维持一份本地草稿，只在失焦或回车时提交。
 */
export function NumberField({
  value,
  onCommit,
  min,
  max,
  step = 1,
  suffix,
  className,
  ariaLabel,
  decimals,
}: {
  value: number;
  onCommit: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
  decimals?: number;
}) {
  const format = (n: number) => decimals === undefined ? String(n) : n.toFixed(decimals);
  const [draft, setDraft] = useState(format(value));
  const [editing, setEditing] = useState(false);
  const scrub = useScrub({ value, onChange: onCommit, min, max, step, decimals });

  useEffect(() => {
    if (!editing) setDraft(decimals === undefined ? String(value) : value.toFixed(decimals));
  }, [value, editing, decimals]);

  const commit = () => {
    setEditing(false);
    const n = Number(draft);
    if (Number.isFinite(n)) onCommit(clamp(n, min, max));
    else setDraft(format(value));
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] border border-transparent",
        "hover:border-[var(--app-line)] focus-within:border-[var(--color-brand)]",
        "bg-[var(--app-surface-2)] transition-colors duration-[var(--dur-fast)]",
        className,
      )}
    >
      <input
        aria-label={ariaLabel}
        inputMode="decimal"
        step={step}
        value={draft}
        onFocus={(e) => {
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(format(value));
            setEditing(false);
            e.currentTarget.blur();
          }
        }}
        className="w-full bg-transparent text-right tabular-nums text-[12px] text-[var(--app-text)] px-1.5 py-1 focus:outline-none"
      />
      {suffix ? (
        <span {...scrub} title="按住左右拖动调整" className="cursor-ew-resize pr-1.5 text-[11px] text-[var(--app-text-3)] select-none">{suffix}</span>
      ) : null}
    </span>
  );
}

type ScrubOptions = { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; decimals?: number };

/**
 * 按住左右拖动改数值（同 Figma 的标签拖拽）：每像素一个步长，按住 Shift 十倍。
 * 拖动中连续提交，撤销历史按时间窗合并成一步。
 */
export function useScrub({ value, onChange, min, max, step = 1, decimals }: ScrubOptions) {
  const drag = useRef<{ x: number; value: number; last: number } | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  const round = (n: number) => decimals === undefined ? Math.round(n / step) * step : Number(n.toFixed(decimals));

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag.current = { x: event.clientX, value, last: value };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = "ew-resize";
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = drag.current;
    if (!state) return;
    const delta = (event.clientX - state.x) * step * (event.shiftKey ? 10 : 1);
    const next = clamp(round(state.value + delta), min, max);
    if (next === state.last) return;
    state.last = next;
    latest.current(next);
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    drag.current = null;
    document.body.style.cursor = "";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}

/** 带可拖动标签的数值框：标签按住左右拖即可改值，也可直接输入。 */
export function ScrubField({
  label,
  value,
  onCommit,
  min,
  max,
  step = 1,
  suffix,
  decimals,
  ariaLabel,
  disabled,
  className,
}: {
  label: ReactNode;
  value: number;
  onCommit: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  decimals?: number;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const scrub = useScrub({ value, onChange: onCommit, min, max, step, decimals });
  return (
    <div className={cn("text-[9px] text-[var(--app-text-4)]", disabled && "pointer-events-none opacity-45", className)}>
      <span
        {...(disabled ? {} : scrub)}
        title="按住左右拖动调整，按住 Shift 加速"
        className="inline-block cursor-ew-resize select-none pr-2 hover:text-[var(--app-text-2)]"
      >
        {label}
      </span>
      <NumberField ariaLabel={ariaLabel} value={value} decimals={decimals} min={min} max={max} step={step} suffix={suffix} onCommit={onCommit} className="mt-1 w-full" />
    </div>
  );
}
