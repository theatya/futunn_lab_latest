"use client";

import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  id: string;
  label: string;
  /** 分组名，同组连续排列，组之间用分割线隔开。 */
  group?: string;
  style?: CSSProperties;
}

/** 下拉选择，视觉参照 Figma 字体面板：深色浮层 + 勾选当前项；可选搜索与分组。 */
export function Dropdown({ label, value, options, onChange, searchable = false, size = "md", display, className }: {
  label: string;
  value: string;
  options: readonly DropdownOption[];
  onChange: (id: string) => void;
  searchable?: boolean;
  size?: "md" | "sm" | "xs";
  /** 触发按钮上显示的文字，默认用当前项的 label。 */
  display?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [upward, setUpward] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    const frame = requestAnimationFrame(() => listRef.current?.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "nearest" }));
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = options.find((item) => item.id === value);
  const keyword = query.trim().toLowerCase();
  const list = keyword ? options.filter((item) => `${item.group ?? ""} ${item.label}`.toLowerCase().includes(keyword)) : options;
  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
  };
  const trigger = size === "md" ? "h-8 px-2.5 text-[11px]" : size === "sm" ? "h-7 px-2 text-[10px]" : "h-6 px-1.5 text-[10px]";

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setUpward(window.innerHeight - rect.bottom < 300 && rect.top > 300);
          setOpen(!open);
          setQuery("");
        }}
        className={cn("flex w-full items-center gap-2 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] text-left text-[var(--app-text)] hover:border-[var(--app-line-strong)]", trigger)}
      >
        <span className="min-w-0 flex-1 truncate" style={current?.style}>{display ?? current?.label ?? "请选择"}</span>
        <ChevronDown size={12} className={cn("shrink-0 text-[var(--app-text-4)] transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className={cn("absolute left-0 z-30 min-w-full rounded-[8px] border border-white/10 bg-[#2b2b2d] p-1.5 shadow-[0_12px_32px_rgb(0_0_0/0.5)]", upward ? "bottom-full mb-1" : "top-full mt-1")}>
          {searchable ? (
            <label className="relative mb-1.5 block">
              <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-white/45" />
              <input
                autoFocus
                aria-label={`搜索${label}`}
                value={query}
                placeholder="搜索"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && list[0]) pick(list[0].id);
                }}
                className="h-7 w-full rounded-[5px] border border-white/10 bg-black/25 pl-7 pr-2 text-[11px] text-white outline-none focus:border-white/25"
              />
            </label>
          ) : null}
          <div ref={listRef} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto">
            {list.map((item, index) => {
              const chosen = item.id === value;
              const groupStart = item.group !== undefined && item.group !== list[index - 1]?.group;
              return (
                <Fragment key={item.id}>
                  {groupStart ? (
                    <div className={cn("px-1.5 pb-1 pt-1.5 text-[9px] font-medium tracking-wide text-white/40", index > 0 && "mt-1 border-t border-white/10")}>
                      {item.group}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={chosen}
                    onClick={() => pick(item.id)}
                    className={cn("flex w-full items-center gap-2 whitespace-nowrap rounded-[4px] px-1.5 text-left text-white/90 hover:bg-white/10", size === "md" ? "h-7 text-[12px]" : "h-7 text-[11px]")}
                  >
                    <span className="grid w-3.5 shrink-0 place-items-center">{chosen ? <Check size={12} /> : null}</span>
                    <span className="min-w-0 truncate" style={item.style}>{item.label}</span>
                  </button>
                </Fragment>
              );
            })}
            {list.length ? null : <div className="px-2 py-2 text-[10px] text-white/45">没有匹配项</div>}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export interface FontOption {
  id: string;
  group: string;
  label: string;
  face: string;
  family: string;
  weight: number;
  italic?: boolean;
}

export const fontPreviewStyle = (font: Pick<FontOption, "face" | "family" | "weight" | "italic">): CSSProperties => ({
  fontFamily: `"${font.face}", "${font.family}", sans-serif`,
  fontWeight: font.weight,
  fontStyle: font.italic ? "italic" : undefined,
});

/** 字体选择：按字体名分组，每项用自身字重预览，支持搜索。 */
export function FontPicker({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: readonly FontOption[];
  onChange: (id: string) => void;
}) {
  const current = options.find((item) => item.id === value);
  return (
    <Dropdown
      label={label}
      value={value}
      searchable
      display={current ? `${current.group} ${current.label}` : "选择字体"}
      options={options.map((font) => ({ id: font.id, label: font.label, group: font.group, style: fontPreviewStyle(font) }))}
      onChange={onChange}
    />
  );
}
