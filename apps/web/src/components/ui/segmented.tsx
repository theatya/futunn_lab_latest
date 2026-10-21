"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * 分段控件。选中指示块用 layoutId 在选项之间滑动 ——
 * 这是少数几个值得做动效的地方：它让「从哪切到哪」这件事被看见。
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  disabled = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ id: T; label: string }>;
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const reduced = useReducedMotion();

  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[var(--radius-md)] p-0.5",
        "bg-[var(--app-surface-2)] border border-[var(--app-line-soft)]",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={cn(
              "relative rounded-[var(--radius-sm)] font-medium whitespace-nowrap",
              "transition-colors duration-[var(--dur-fast)]",
              "disabled:cursor-not-allowed disabled:opacity-45",
              size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-3 text-[12px]",
              active ? "text-[var(--app-text)]" : "text-[var(--app-text-3)] hover:text-[var(--app-text-2)]",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${id}`}
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--app-surface)] shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
              />
            ) : null}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
