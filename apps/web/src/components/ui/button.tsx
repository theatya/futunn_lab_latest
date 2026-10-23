"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "workflow" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "border border-white/85 bg-white text-[#151517] shadow-[0_4px_12px_rgb(0_0_0/0.18),inset_0_1px_0_rgb(255_255_255/0.9)] hover:bg-[#f0f0f2] active:bg-[#dedee1]",
  workflow:
    "bg-gradient-to-r from-[#ff7a00] to-[#ff4d00] text-white shadow-[0_6px_18px_rgb(255_91_0/0.18)] hover:brightness-110 active:brightness-95",
  secondary:
    "border border-[var(--app-line-strong)] bg-[var(--app-surface-2)] text-[var(--app-text)] hover:bg-[var(--app-surface-3)]",
  ghost: "text-[var(--app-text-2)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)]",
  danger: "bg-[var(--color-up)] text-white hover:opacity-90",
};

const SIZE: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[11px] gap-1.5 rounded-[4px]",
  md: "h-8 px-3 text-[12px] gap-2 rounded-[5px]",
  lg: "h-9 px-4 text-[13px] gap-2 rounded-[6px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** 撑满父容器宽度 */
  block?: boolean;
}

export function WorkflowSparkle({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path fill="currentColor" d="M8.1 1.2c.3-.9 1.6-.9 1.9 0l1.2 3.5c.1.3.3.5.6.6l3.5 1.2c.9.3.9 1.6 0 1.9l-3.5 1.2c-.3.1-.5.3-.6.6L10 13.7c-.3.9-1.6.9-1.9 0l-1.2-3.5a1 1 0 0 0-.6-.6L2.8 8.4c-.9-.3-.9-1.6 0-1.9l3.5-1.2c.3-.1.5-.3.6-.6l1.2-3.5Z" />
      <path fill="currentColor" d="M16.2 12.3c.2-.6 1.1-.6 1.3 0l.4 1.2c.1.2.2.3.4.4l1.2.4c.6.2.6 1.1 0 1.3l-1.2.4c-.2.1-.3.2-.4.4l-.4 1.2c-.2.6-1.1.6-1.3 0l-.4-1.2a.7.7 0 0 0-.4-.4l-1.2-.4c-.6-.2-.6-1.1 0-1.3l1.2-.4c.2-.1.3-.2.4-.4l.4-1.2Z" />
    </svg>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, block, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap select-none",
        "transition-[background-color,border-color,color,opacity,transform] duration-[var(--dur-fast)]",
        "active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});
