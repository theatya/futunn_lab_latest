"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Search, X } from "lucide-react";
import { sizeKey, type SizeItem } from "@futu/domain";
import { ALL_SIZES, SIZE_GROUPS, slotKey } from "@futu/specs";
import { arrowStep } from "@/components/ui/field";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

type View = "all" | "selected" | "inapp" | "web" | "external" | "offline" | "native" | "custom";
type Section = { id: string; name: string; items: SizeItem[] };

const CATALOG = SIZE_GROUPS.filter((group) => group.id !== "custom");
const OFFLINE_IDS = new Set(SIZE_GROUPS.find((group) => group.id === "offline")?.items.map((item) => item.id) ?? []);
const EXTERNAL_IDS = new Set(SIZE_GROUPS.find((group) => group.id === "external")?.items.map((item) => item.id) ?? []);
/** 按名称或尺寸搜：「1080」「1080x225」「1080*225」「弹窗」都能命中。 */
function matches(item: SizeItem, query: string) {
  const q = query.trim().toLowerCase();
  const size = q.replace(/\s+/g, "").replace(/[x*×]/g, "×");
  if (/\d/.test(size) && `${item.w}×${item.h}`.includes(size)) return true;
  return `${item.use} ${item.variant ?? ""} ${item.sub ?? ""}`.toLowerCase().includes(q);
}

/** 每个分组按 Figma 目录拆成右侧的若干小节，没有目录的整组一节。 */
function sectionsOf(groupId: string): Section[] {
  const group = SIZE_GROUPS.find((item) => item.id === groupId);
  if (!group) return [];
  if (!group.subs?.length) return [{ id: group.id, name: group.name, items: group.items }];
  return group.subs
    .map((sub) => ({ id: `${group.id}:${sub.id}`, name: sub.name, items: group.items.filter((item) => item.sub === sub.id) }))
    .filter((section) => section.items.length);
}

/** 第二步画幅选择：左侧分类（全部 / 已选 / 站内 / 官网 / 站外 / 线下 / 仿原生 / 自定义），右侧按目录分节的卡片。 */
export function SizePicker() {
  const { project, setTargets } = useStudio();
  const [view, setView] = useState<View>("all");
  const [customName, setCustomName] = useState("");
  const [customWidth, setCustomWidth] = useState("");
  const [customHeight, setCustomHeight] = useState("");
  const [customError, setCustomError] = useState("");
  const [query, setQuery] = useState("");
  const scrollRef = useRef<HTMLElement>(null);
  const selected = new Set(project.targets.map((target) => target.key));
  const customSizes = project.targets
    .filter((target) => target.sizeId?.startsWith("custom-"))
    .map((target) => ({ key: target.key, id: target.sizeId!, w: target.w, h: target.h, use: target.use ?? "" }));
  const count = (items: SizeItem[]) => items.filter((item) => selected.has(slotKey(item))).length;

  const searching = query.trim().length > 0;
  const sections: Section[] = searching
    ? CATALOG.flatMap((group) => sectionsOf(group.id)).map((section) => ({ ...section, items: section.items.filter((item) => matches(item, query)) })).filter((section) => section.items.length)
    : view === "all"
      ? CATALOG.map((group) => ({ id: group.id, name: group.name, items: group.items }))
      : view === "selected"
        ? CATALOG.map((group) => ({ id: group.id, name: group.name, items: group.items.filter((item) => selected.has(slotKey(item))) })).filter((section) => section.items.length)
        : view === "custom" ? [] : sectionsOf(view);
  /** 顶部全选 / 清空作用于当前看到的范围：全部、某一类或搜索结果。 */
  const visibleItems = sections.flatMap((section) => section.items);

  const linkedTo = (master: SizeItem) => ALL_SIZES.filter((item) => item.linked?.master === master.id);
  /** 取消母版时一并取消联动的设备尺寸，否则选中设备会把母版自动带回来。 */
  const withoutLinked = (keys: Set<string>, removed: SizeItem[]) => {
    removed.flatMap(linkedTo).forEach((item) => keys.delete(slotKey(item)));
    return keys;
  };

  /** 勾选母版时联动尺寸全部带上，需要时再逐个取消。 */
  const toggle = (item: SizeItem) => {
    const key = slotKey(item);
    const next = new Set(selected);
    if (next.has(key)) {
      next.delete(key);
      withoutLinked(next, [item]);
    } else {
      next.add(key);
      linkedTo(item).forEach((linked) => next.add(slotKey(linked)));
    }
    setTargets([...next]);
  };
  /**
   * 已选里同尺寸的重复资源位：每个尺寸保留一个（优先拿裸尺寸 key 的那个，否则按目录顺序第一个）。
   * 闪屏设备尺寸跟母版联动、仿原生用固定模板，不参与。
   */
  const duplicatesOf = (items: SizeItem[]) => {
    const kept = new Map<string, SizeItem>();
    const extra: SizeItem[] = [];
    const picked = items.filter((item) => selected.has(slotKey(item)) && !item.linked && !item.native && !OFFLINE_IDS.has(item.id));
    for (const item of [...picked.filter((item) => slotKey(item) === sizeKey(item.w, item.h)), ...picked.filter((item) => slotKey(item) !== sizeKey(item.w, item.h))]) {
      const size = sizeKey(item.w, item.h);
      if (kept.has(size)) extra.push(item);
      else kept.set(size, item);
    }
    return extra;
  };
  const duplicates = duplicatesOf(visibleItems);
  const selectAll = (items: SizeItem[]) => setTargets([...new Set([...selected, ...items.map(slotKey)])]);
  const clearAll = (items: SizeItem[]) => {
    const next = new Set(selected);
    items.forEach((item) => next.delete(slotKey(item)));
    setTargets([...withoutLinked(next, items)]);
  };

  const addCustomSize = () => {
    const width = Number(customWidth);
    const height = Number(customHeight);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return;
    const catalog = ALL_SIZES.find((item) => item.w === width && item.h === height);
    if (catalog) {
      const key = slotKey(catalog);
      const group = SIZE_GROUPS.find((item) => item.items.includes(catalog));
      if (!selected.has(key)) setTargets([...selected, key]);
      setCustomError(`该尺寸已在“${group?.name ?? ""} · ${catalog.use}”中${selected.has(key) ? "并已选中" : "，已为你选中"}`);
      return;
    }
    const key = sizeKey(width, height);
    if (selected.has(key)) {
      setCustomError("该自定义尺寸已经添加");
      return;
    }
    setTargets([...selected, key], { [key]: customName });
    setCustomName("");
    setCustomWidth("");
    setCustomHeight("");
    setCustomError("");
  };

  const open = (next: View) => {
    setView(next);
    setQuery("");
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0 }));
  };

  const navItem = (id: View, label: string) => {
    const active = view === id && !searching;
    return (
      <button
        key={id}
        type="button"
        onClick={() => open(id)}
        className={cn(
          "flex w-full items-center rounded-[4px] px-2 py-2 text-left text-[10px] hover:bg-[var(--app-surface-2)]",
          active ? "bg-[var(--app-surface-2)] text-[var(--app-text)]" : "text-[var(--app-text-3)]",
        )}
      >
        <span className="truncate">{label}</span>
      </button>
    );
  };

  /**
   * 按住拖动框选：从未选中的卡片或空白处起拖是选中，从已选中的卡片起拖是取消选中。
   * 移动超过几像素才算框选，否则仍是普通点击。
   */
  const marqueeRef = useRef<{ x: number; y: number; top: number; on: boolean; active: boolean; pointerId: number } | null>(null);
  const [marquee, setMarquee] = useState<{ box: { x: number; y: number; w: number; h: number }; keys: Set<string>; on: boolean } | null>(null);
  const suppressClick = useRef(false);
  const itemByKey = new Map(visibleItems.map((item) => [slotKey(item), item]));
  const beginMarquee = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const button = target.closest("button");
    if (event.button !== 0 || target.closest("input,[data-no-marquee]") || (button && !button.closest("[data-size-card]"))) return;
    const key = (event.target as HTMLElement).closest<HTMLElement>("[data-size-key]")?.dataset.sizeKey;
    marqueeRef.current = { x: event.clientX, y: event.clientY, top: event.currentTarget.scrollTop, on: !(key && selected.has(key)), active: false, pointerId: event.pointerId };
  };
  const moveMarquee = (event: ReactPointerEvent<HTMLElement>) => {
    const state = marqueeRef.current;
    const host = event.currentTarget;
    if (!state) return;
    if (!state.active) {
      if (Math.hypot(event.clientX - state.x, event.clientY - state.y) < 5) return;
      state.active = true;
      host.setPointerCapture(state.pointerId);
    }
    const rect = host.getBoundingClientRect();
    /** 页面可能整体缩放，框的坐标换回元素自身的像素。 */
    const sx = rect.width / host.offsetWidth || 1;
    const sy = rect.height / host.offsetHeight || 1;
    if (event.clientY > rect.bottom - 24) host.scrollTop += 12;
    else if (event.clientY < rect.top + 24) host.scrollTop -= 12;
    const startY = state.y - (host.scrollTop - state.top) * sy;
    const left = Math.min(state.x, event.clientX);
    const right = Math.max(state.x, event.clientX);
    const top = Math.min(startY, event.clientY);
    const bottom = Math.max(startY, event.clientY);
    const keys = new Set<string>();
    host.querySelectorAll<HTMLElement>("[data-size-key]").forEach((node) => {
      const r = node.getBoundingClientRect();
      if (r.right > left && r.left < right && r.bottom > top && r.top < bottom && node.dataset.sizeKey) keys.add(node.dataset.sizeKey);
    });
    setMarquee({
      box: { x: (left - rect.left) / sx + host.scrollLeft, y: (top - rect.top) / sy + host.scrollTop, w: (right - left) / sx, h: (bottom - top) / sy },
      keys,
      on: state.on,
    });
  };
  const endMarquee = (event: ReactPointerEvent<HTMLElement>) => {
    const state = marqueeRef.current;
    marqueeRef.current = null;
    if (!state?.active) return;
    if (event.currentTarget.hasPointerCapture(state.pointerId)) event.currentTarget.releasePointerCapture(state.pointerId);
    const items = [...(marquee?.keys ?? [])].flatMap((key) => itemByKey.get(key) ?? []);
    if (items.length) (state.on ? selectAll : clearAll)(items);
    setMarquee(null);
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
  };
  const clickCard = (item: SizeItem) => {
    if (!suppressClick.current) toggle(item);
  };

  const card = (item: SizeItem) => {
    const key = slotKey(item);
    const hit = marquee?.keys.has(key);
    const on = hit ? marquee!.on : selected.has(key);
    const external = EXTERNAL_IDS.has(item.id);
    const label = external ? `${item.w} × ${item.h}` : `${item.w} × ${item.h} ${item.use}${item.variant ? ` ${item.variant}` : ""}`;
    return (
      <button
        key={item.id}
        type="button"
        data-size-card
        data-size-key={key}
        aria-pressed={on}
        aria-label={on ? `取消选择 ${label}` : `选择 ${label}`}
        onClick={() => clickCard(item)}
        title={external ? label : item.hint ? `${label}，${item.hint}` : label}
        className={cn(
          "flex h-10 min-w-0 items-center rounded-[5px] border px-2.5 text-left outline-none focus-visible:border-[var(--app-text-2)]",
          on ? "border-transparent bg-white/[0.1]" : "border-[var(--app-line)] hover:border-[var(--app-line-strong)] hover:bg-[var(--app-surface-2)]",
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="grid h-5 w-7 shrink-0 place-items-center">
            <span className="max-h-5 max-w-7 border border-[var(--app-line-strong)] bg-[var(--app-surface-3)]" style={{ aspectRatio: `${item.w}/${item.h}`, width: item.w >= item.h ? 26 : undefined, height: item.h > item.w ? 20 : undefined }} />
          </span>
          <span className="flex min-w-0 items-baseline gap-1.5 truncate text-[10px]">
            <span className="shrink-0 font-medium tabular-nums text-[var(--app-text-2)]">{item.w} × {item.h}</span>
            {external ? null : <span className="truncate text-[var(--app-text-3)]">{item.use}</span>}
            {!external && item.variant ? <span className="shrink-0 text-[8px] text-[var(--app-text-4)]">{item.variant}</span> : null}
          </span>
        </span>
      </button>
    );
  };

  const groupName = (sectionId: string) => SIZE_GROUPS.find((group) => sectionId.startsWith(`${group.id}:`))?.name;

  return (
    <div className="flex min-h-0 min-w-0">
      <aside className="flex min-h-0 w-[132px] shrink-0 flex-col border-r border-[var(--app-line)] py-3 pr-2">
        <label className="mb-2 flex h-7 shrink-0 items-center gap-1.5 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-page)] px-2 focus-within:border-[var(--app-line-strong)]">
          <Search size={11} className="shrink-0 text-[var(--app-text-4)]" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              scrollRef.current?.scrollTo({ top: 0 });
            }}
            onKeyDown={(event) => event.key === "Escape" && setQuery("")}
            aria-label="搜索资源位"
            placeholder="搜索名称或尺寸"
            className="min-w-0 flex-1 bg-transparent text-[10px] text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-4)]"
          />
          {query ? (
            <button type="button" aria-label="清除搜索" onClick={() => setQuery("")} className="grid size-4 shrink-0 place-items-center text-[var(--app-text-4)] hover:text-[var(--app-text)]">
              <X size={11} />
            </button>
          ) : null}
        </label>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {navItem("all", "全部")}
          {navItem("selected", "已选")}
          <div className="my-2 h-px bg-[var(--app-line-soft)]" />
          {CATALOG.map((group) => navItem(group.id as View, group.name))}
          {navItem("custom", "自定义")}
        </div>
      </aside>

      <section
        ref={scrollRef}
        onPointerDown={beginMarquee}
        onPointerMove={moveMarquee}
        onPointerUp={endMarquee}
        onPointerCancel={endMarquee}
        className="relative min-h-0 min-w-0 flex-1 cursor-crosshair select-none overflow-y-auto px-3"
      >
        {marquee ? (
          <div
            className="pointer-events-none absolute z-20 rounded-[2px] border border-[var(--app-text-3)] bg-white/[0.06]"
            style={{ left: marquee.box.x, top: marquee.box.y, width: marquee.box.w, height: marquee.box.h }}
          />
        ) : null}
        {view !== "custom" || searching ? (
          <div className="mb-1 flex items-center justify-between border-b border-[var(--app-line-soft)] pb-2 pt-1">
            <span className="text-[10px] text-[var(--app-text-3)]">
              {searching ? `「${query.trim()}」搜索结果` : `${view === "all" ? "全部资源位" : view === "selected" ? "已选资源位" : CATALOG.find((group) => group.id === view)?.name ?? ""}`}
            </span>
            <div className="flex items-center gap-3 text-[10px]">
              {duplicates.length ? (
                <button
                  type="button"
                  title={`同尺寸只保留一个，取消 ${duplicates.length} 个重复：${duplicates.map((item) => `${item.w}×${item.h} ${item.use}${item.variant ? `（${item.variant}）` : ""}`).join("、")}`}
                  onClick={() => clearAll(duplicates)}
                  className="text-[var(--app-text-2)] hover:text-[var(--app-text)]"
                >
                  同尺寸只留一个
                </button>
              ) : null}
              {view === "selected" && !searching ? null : (
                <button type="button" disabled={!visibleItems.length || count(visibleItems) === visibleItems.length} onClick={() => selectAll(visibleItems)} className="text-[var(--app-text-2)] hover:text-[var(--app-text)] disabled:opacity-40">
                  {searching ? "全选结果" : view === "all" ? "全选全部" : "全选本类"}
                </button>
              )}
              <button type="button" disabled={!count(visibleItems)} onClick={() => clearAll(visibleItems)} className="text-[var(--app-text-2)] hover:text-[var(--app-text)] disabled:opacity-40">
                {searching ? "清空结果" : view === "all" || view === "selected" ? "清空全部" : "清空本类"}
              </button>
            </div>
          </div>
        ) : null}
        {view === "custom" && !searching ? (
          <>
            <div className="mb-3 text-[12px] font-semibold">自定义</div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] items-start gap-1.5">
              <div className="min-h-[68px] rounded-[6px] border border-[var(--app-line)] p-2">
                <input
                  value={customName}
                  onChange={(event) => {
                    setCustomName(event.target.value);
                    setCustomError("");
                  }}
                  aria-label="尺寸名称"
                  placeholder="尺寸名称，例如活动页横幅"
                  className="block h-6 w-full bg-transparent px-1 text-[10px] text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-4)]"
                />
                <div className="mt-1 flex items-center gap-1">
                  <input value={customWidth} onChange={(event) => {
                    setCustomWidth(event.target.value.replace(/\D/g, ""));
                    setCustomError("");
                  }} onKeyDown={(event) => arrowStep(event, Number(customWidth) || 0, (next) => setCustomWidth(String(next)), 1, 10000)} aria-label="宽度" inputMode="numeric" placeholder="宽度" className="h-7 min-w-0 flex-1 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-page)] px-2 text-[9px] text-[var(--app-text)] outline-none focus:border-[var(--app-line-strong)]" />
                  <span className="text-[9px] text-[var(--app-text-4)]">×</span>
                  <input value={customHeight} onChange={(event) => {
                    setCustomHeight(event.target.value.replace(/\D/g, ""));
                    setCustomError("");
                  }} onKeyDown={(event) => arrowStep(event, Number(customHeight) || 0, (next) => setCustomHeight(String(next)), 1, 10000)} aria-label="高度" inputMode="numeric" placeholder="高度" className="h-7 min-w-0 flex-1 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-page)] px-2 text-[9px] text-[var(--app-text)] outline-none focus:border-[var(--app-line-strong)]" />
                  <button type="button" onClick={addCustomSize} className="h-7 shrink-0 rounded-[4px] bg-[var(--app-text)] px-2 text-[9px] font-medium text-[var(--app-page)] disabled:opacity-40" disabled={!customName.trim() || !customWidth || !customHeight}>添加</button>
                </div>
                {customError ? <div className="mt-1 truncate px-1 text-[8px] text-[var(--warn-text)]" title={customError}>{customError}</div> : null}
              </div>
              {customSizes.map((item) => (
                <div key={item.key} className="flex h-10 min-w-0 items-center rounded-[5px] border border-[var(--app-line-strong)] bg-[var(--app-surface-2)] px-2.5">
                  <span className="grid h-5 w-7 shrink-0 place-items-center">
                    <span className="max-h-5 max-w-7 border border-[var(--app-line-strong)] bg-[var(--app-surface-3)]" style={{ aspectRatio: `${item.w}/${item.h}`, width: item.w >= item.h ? 26 : undefined, height: item.h > item.w ? 20 : undefined }} />
                  </span>
                  <span className="ml-2 flex min-w-0 flex-1 items-baseline gap-1.5 truncate text-[10px]">
                    <span className="shrink-0 font-medium tabular-nums text-[var(--app-text-2)]">{item.w} × {item.h}</span>
                    <span className="truncate text-[var(--app-text-3)]">{item.use}</span>
                  </span>
                  <button type="button" aria-label={`删除 ${item.use}`} title="删除自定义画幅" onClick={() => setTargets([...selected].filter((key) => key !== item.key))} className="ml-2 grid size-6 place-items-center rounded-[4px] text-[var(--app-text-4)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : sections.length ? sections.map((section) => (
          <div key={section.id} data-section={section.id} className="mb-4">
            <div className="sticky top-0 z-10 bg-[var(--app-page)] pb-1">
              <span className="text-[10px] font-medium text-[var(--app-text-2)]">{(searching || view === "all" || view === "selected") && groupName(section.id) ? `${groupName(section.id)} · ${section.name}` : section.name}</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] items-start gap-1.5">{section.items.map(card)}</div>
          </div>
        )) : (
          <div className="grid h-40 place-items-center text-[10px] text-[var(--app-text-4)]">{searching ? "没有匹配的资源位" : "还没有选择画幅"}</div>
        )}
      </section>
    </div>
  );
}
