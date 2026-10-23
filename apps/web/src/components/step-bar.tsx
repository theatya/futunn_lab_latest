"use client";

import { Check } from "lucide-react";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { useReducedMotion } from "motion/react";
import { STEPS, type StepIndex } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

export function StepBar({
  step,
  onChange,
  compact = false,
}: {
  step: StepIndex;
  onChange: (s: StepIndex) => void;
  compact?: boolean;
}) {
  const fill = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!fill.current) return;
    const pct = (step / (STEPS.length - 1)) * 100;
    if (reduced) {
      gsap.set(fill.current, compact ? { width: `${pct}%` } : { height: `${pct}%` });
      return;
    }
    gsap.to(fill.current, {
      ...(compact ? { width: `${pct}%` } : { height: `${pct}%` }),
      duration: 0.32,
      ease: "power2.out",
    });
  }, [step, reduced, compact]);

  if (compact) {
    return (
      <nav aria-label="流程步骤" className="relative w-full">
        <div className="absolute left-6 right-6 top-[15px] h-px bg-[var(--app-line)]" />
        <div ref={fill} className="absolute left-6 top-[15px] h-px w-0 bg-white" />
        <ol className="relative grid grid-cols-3">
          {STEPS.map((name, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={name} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => onChange(i as StepIndex)}
                  className="flex items-center gap-1.5 px-1"
                >
                  <StepIndexBadge i={i} done={done} current={current} size="sm" />
                  <span
                    className={cn(
                      "text-[12px] font-medium",
                      current ? "text-[var(--app-text)]" : "text-[var(--app-text-3)]",
                    )}
                  >
                    {name}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label="流程步骤" className="relative">
      <div className="absolute left-[17px] top-4 bottom-4 w-px bg-[var(--app-line)]" />
      <div ref={fill} className="absolute left-[17px] top-4 w-px h-0 bg-white" />
      <ol className="relative space-y-1">
        {STEPS.map((name, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={name}>
              <button
                type="button"
                onClick={() => onChange(i as StepIndex)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-[var(--radius-sm)] px-2 py-2.5 text-left",
                  current && "bg-[var(--app-rail-2)]",
                  !current && "text-[var(--app-rail-muted)] hover:bg-[var(--app-rail-2)]",
                )}
              >
                <StepIndexBadge i={i} done={done} current={current} />
                <span
                  className={cn(
                    "text-[14px] font-semibold leading-none",
                    current ? "text-[var(--app-rail-text)]" : "text-[var(--app-rail-muted)]",
                  )}
                >
                  {name}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepIndexBadge({
  i,
  done,
  current,
  size = "md",
}: {
  i: number;
  done: boolean;
  current: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "grid place-items-center shrink-0 font-semibold rounded-full",
        size === "md" ? "size-7 text-[12px]" : "size-6 text-[11px]",
        current && "bg-white text-[#151517]",
        done && !current && "bg-white/10 text-white/70",
        !current && !done && (size === "md" ? "bg-[var(--app-surface-3)] text-[var(--app-rail-muted)]" : "bg-[var(--app-surface-2)] text-[var(--app-text-3)]"),
      )}
    >
      {done && !current ? <Check size={size === "md" ? 14 : 12} strokeWidth={2.5} /> : i + 1}
    </span>
  );
}
