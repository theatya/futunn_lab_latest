"use client";

import { presetLogo, type AssetRef, type LibraryLogoPreset, type LogoPreset } from "@futu/domain";
import { cn } from "@/lib/utils";

export const LOGO_PRESET_OPTIONS: ReadonlyArray<{ id: LibraryLogoPreset; label: string }> = [
  { id: "futu", label: "富途 · 深色背景" },
  { id: "moomoo", label: "moomoo · 深色背景" },
  { id: "futuLight", label: "富途 · 浅色背景" },
  { id: "moomooLight", label: "moomoo · 浅色背景" },
  { id: "futuWhite", label: "富途 · 纯白" },
  { id: "moomooWhite", label: "moomoo · 纯白" },
  { id: "futuNasdaq", label: "富途 × Nasdaq · 深色背景" },
  { id: "moomooNasdaq", label: "moomoo × Nasdaq · 深色背景" },
  { id: "futuNasdaqLight", label: "富途 × Nasdaq · 浅色背景" },
  { id: "moomooNasdaqLight", label: "moomoo × Nasdaq · 浅色背景" },
];

/** 组合 Logo 直接用训练版组件（7:7841）导出的整张 SVG，不再拼部件，避免比例被拉扁。 */
export function comboLogoUrl(preset: LibraryLogoPreset) {
  const brand = preset.startsWith("moomoo") ? "moomoo" : "futu";
  return `/brand/presets/combo-${brand}Nasdaq-${preset.endsWith("Light") ? "light" : "dark"}.svg`;
}

export function LogoPresetPreview({
  preset,
  asset,
  className,
}: {
  preset?: LogoPreset;
  asset?: AssetRef;
  className?: string;
}) {
  const resolvedPreset = preset ?? LOGO_PRESET_OPTIONS.find((option) => presetLogo(option.id).id === asset?.id)?.id;
  const libraryAsset = resolvedPreset && resolvedPreset !== "custom" ? presetLogo(resolvedPreset) : undefined;
  const combo = resolvedPreset && resolvedPreset !== "custom" && resolvedPreset.includes("Nasdaq") ? comboLogoUrl(resolvedPreset) : undefined;
  const preview = combo ?? asset?.previewUrl ?? libraryAsset?.previewUrl;
  const label = asset?.name ?? libraryAsset?.name ?? "Logo";

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("flex min-h-8 w-full items-center justify-center overflow-hidden", className)}
    >
      {preview ? (
        <img src={preview} alt="" draggable={false} className="block max-h-full max-w-full object-contain" />
      ) : null}
      {(!resolvedPreset || resolvedPreset === "custom") && !preview ? (
        <span className="truncate text-[9px] text-[var(--app-text-3)]">{label}</span>
      ) : null}
    </span>
  );
}
