"use client";

import { motion } from "motion/react";
import { ChevronDown, RotateCcw, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { STEPS, StudioProvider, useStudio } from "@/lib/studio-store";
import { useStepTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { Button } from "./ui/button";
import { StepBar } from "./step-bar";
import { ThemeToggle } from "./theme-toggle";
import { StepContent } from "./steps/step-content";
import { StepFrames } from "./steps/step-frames";
import { StepGenerate } from "./steps/step-generate";

function SettingsMenu({ onReset }: { onReset: () => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="h-8 px-2.5 inline-flex items-center gap-1 rounded-full text-[13px] text-[var(--app-text-2)] hover:bg-[var(--app-bg)]"
      >
        <Settings size={14} />
        设置
        <ChevronDown size={12} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+6px)] z-30 w-44 rounded-[16px] bg-[var(--app-surface)] p-1.5 shadow-[var(--glass-shadow)]"
        >
          <ThemeToggle />
          <Button variant="ghost" size="sm" block icon={<RotateCcw size={13} />} onClick={onReset}>
            重置
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StudioInner() {
  const { step, setStep, resetProject, project } = useStudio();
  const enter = useStepTransition(1);
  const stepName = STEPS[step];

  return (
    <div className="h-dvh w-full overflow-hidden bg-[var(--app-page)] flex flex-col">
      <div className="mx-auto w-full max-w-[1480px] px-3 py-3 sm:px-5 sm:py-5 lg:px-8 lg:py-6 flex flex-col flex-1 min-h-0">
        <header className="shrink-0 h-11 flex items-center gap-2 px-1 mb-3">
          <BrandMark />
          <SettingsMenu onReset={resetProject} />
          <div className="flex-1" />
          <div className="hidden sm:flex items-center gap-2 text-[12px] text-[var(--app-text-3)] truncate">
            <span className="size-1.5 rounded-full bg-[var(--color-brand)]" />
            <span className="truncate">{project.name}</span>
          </div>
        </header>

        <div
          className={cn(
            "flex-1 min-h-0 flex overflow-hidden",
            "rounded-[20px] sm:rounded-[24px] bg-[var(--app-surface)] border border-[var(--app-line)]",
          )}
        >
          <aside className="hidden lg:flex w-[220px] shrink-0 flex-col px-4 py-5 bg-[var(--app-rail)] border-r border-[var(--app-line-soft)]">
            <div className="px-2 mb-7">
              <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--app-rail-muted)]">制作流程</div>
              <div className="mt-1 text-[15px] font-semibold text-[var(--app-rail-text)]">{stepName}</div>
            </div>
            <StepBar step={step} onChange={setStep} />
            <div className="flex-1" />
            <div className="flex flex-col gap-2 pt-5 border-t border-[var(--app-line-soft)]">
              <Button
                variant="ghost"
                size="md"
                block
                disabled={step === 0}
                onClick={() => setStep((step - 1) as 0 | 1 | 2)}
                className="text-[var(--app-rail-muted)] hover:bg-[var(--app-rail-2)] hover:text-[var(--app-rail-text)]"
              >
                上一步
              </Button>
              <Button
                variant="primary"
                size="lg"
                block
                disabled={step === 2}
                onClick={() => setStep((step + 1) as 0 | 1 | 2)}
              >
                下一步
              </Button>
            </div>
          </aside>

          <main className="flex-1 min-h-0 min-w-0 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 flex flex-col">
            <div className="lg:hidden shrink-0 mb-4">
              <StepBar step={step} onChange={setStep} compact />
              <div className="mt-3 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="md"
                  disabled={step === 0}
                  onClick={() => setStep((step - 1) as 0 | 1 | 2)}
                >
                  上一步
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  disabled={step === 2}
                  onClick={() => setStep((step + 1) as 0 | 1 | 2)}
                >
                  下一步
                </Button>
              </div>
            </div>

            <div className="hidden lg:flex items-center justify-between pb-5 shrink-0">
              <div>
                <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--app-text-3)]">第 {step + 1} 步 / 03</div>
                <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.045em] text-[var(--app-text)]">{stepName}</h1>
              </div>
              <div className="text-[12px] text-[var(--app-text-3)]">素材编排</div>
            </div>
            <motion.div key={step} className="min-h-0 flex-1 lg:overflow-hidden" {...enter}>
              {step === 0 ? <StepContent /> : null}
              {step === 1 ? <StepFrames /> : null}
              {step === 2 ? <StepGenerate /> : null}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

export function Studio() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="h-dvh bg-[var(--app-page)]" />;
  }
  return (
    <StudioProvider>
      <StudioInner />
    </StudioProvider>
  );
}
