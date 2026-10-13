"use client";

import { Pipette } from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";

export function colorToHex(value: string | undefined, fallback = "#0f1112") {
  if (!value) return fallback;
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
  const channels = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (!channels) return fallback;
  return `#${channels.slice(1, 4).map((channel) => Math.max(0, Math.min(255, Math.round(Number(channel)))).toString(16).padStart(2, "0")).join("")}`;
}

export function hexToHsv(hex: string) {
  const value = colorToHex(hex);
  const [r, g, b] = [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  return { h: (h + 360) % 360, s: max ? delta / max : 0, v: max };
}

export function hsvToHex(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function BackgroundColorControl({
  value,
  onChange,
  label = "母版背景色",
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hsv = hexToHsv(value);

  const openPicker = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setAnchor({ left: Math.min(rect.left, window.innerWidth - 280), top: Math.max(12, rect.top - 260) });
    setOpen(true);
  };

  const pickSaturation = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const v = Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height));
    onChange(hsvToHex(hsv.h, s, v));
  };

  return (
    <div className="flex items-center gap-2">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`打开${label}取色器`}
        onClick={openPicker}
        className="size-5 rounded-[3px] border border-white/20"
        style={{ backgroundColor: colorToHex(value) }}
      />
      <input
        aria-label={`${label}色值`}
        value={value.replace("#", "").toUpperCase()}
        onChange={(event) => {
          const next = event.target.value.replace(/[^\da-f]/gi, "").slice(0, 6);
          onChange(`#${next}`);
        }}
        onBlur={() => onChange(colorToHex(value))}
        className="w-[64px] bg-transparent text-[10px] uppercase text-[var(--app-text-2)] outline-none"
      />
      {open && createPortal(
        <>
          <button type="button" aria-label="关闭取色器" className="fixed inset-0 z-[99] cursor-default" onClick={() => setOpen(false)} />
          <div className="fixed z-[100] w-[268px] rounded-[8px] border border-white/15 bg-[#292929] p-3 shadow-[0_18px_55px_rgb(0_0_0/0.55)]" style={{ left: anchor.left, top: anchor.top }}>
            <div
              className="relative h-[160px] cursor-crosshair overflow-hidden rounded-[6px]"
              style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)`, backgroundImage: "linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent)" }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                pickSaturation(event);
              }}
              onPointerMove={(event) => event.currentTarget.hasPointerCapture(event.pointerId) && pickSaturation(event)}
            >
              <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/0.45)]" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={Math.round(hsv.h)}
              onChange={(event) => onChange(hsvToHex(Number(event.target.value), hsv.s, hsv.v))}
              aria-label={`${label}色相`}
              className="mt-3 h-3 w-full cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)]"
            />
            <div className="mt-3 flex items-center gap-2 rounded-[4px] bg-black/20 px-2 py-2">
              <button
                type="button"
                aria-label="吸取屏幕颜色"
                title="吸取屏幕颜色"
                onClick={async () => {
                  const EyeDropperApi = (window as Window & { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
                  if (!EyeDropperApi) return;
                  try {
                    const picked = await new EyeDropperApi().open();
                    onChange(picked.sRGBHex);
                  } catch {
                    // 用户取消取色时保持当前颜色。
                  }
                }}
                className="grid size-6 place-items-center rounded-[3px] text-white/70 hover:bg-white/10 hover:text-white"
              >
                <Pipette size={14} />
              </button>
              <span className="text-[10px] text-white/45">Hex</span>
              <span className="text-[11px] uppercase text-white/90">{colorToHex(value).slice(1)}</span>
              <span className="ml-auto text-[10px] text-white/45">100%</span>
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
