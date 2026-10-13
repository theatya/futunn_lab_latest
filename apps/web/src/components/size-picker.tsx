"use client";

import { useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { sizeKey, type SizeItem } from "@futu/domain";
import { ALL_SIZES, SIZE_GROUPS, slotKey } from "@futu/specs";
import { useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";

type View = "all" | "selected" | "inapp" | "web" | "external" | "native" | "custom";
type Section = { id: string; name: string; items: SizeItem[] };

const CATALOG = SIZE_GROUPS.filter((group) => group.id !== "custom");
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

/** 第二步画幅选择：左侧分类（全部 / 已选 / 站内 / 官网 / 站外 / 仿原生 / 自定义），右侧按目录分节的卡片。 */
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
      ? CATALOG.flatMap((group) => sectionsOf(group.id))
      : view === "selected"
        ? CATALOG.flatMap((group) => sectionsOf(group.id)).map((section) => ({ ...section, items: section.items.filter((item) => selected.has(slotKey(item))) })).filter((section) => section.items.length)
        : view === "custom" ? [] : sectionsOf(view);
  const resultCount = sections.reduce((sum, section) => sum + section.items.length, 0);

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

  const navItem = (id: View, label: string, meta: string | number) => {
    const active = view === id && !searching;
    return (
      <button
        key={id}
        type="button"
        onClick={() => open(id)}
        className={cn(
          "flex w-full items-center justify-between rounded-[4px] px-2 py-2 text-left text-[10px] hover:bg-[var(--app-surface-2)]",
          active ? "bg-[var(--app-surface-2)] text-[var(--app-text)]" : "text-[var(--app-text-3)]",
        )}
      >
        <span className="truncate">{label}</span>
        <span className="tabular-nums">{meta}</span>
      </button>
    );
  };

  const card = (item: SizeItem) => {
    const on = selected.has(slotKey(item));
    return (
      <div key={item.id} className={cn("flex min-h-[68px] items-center rounded-[6px] border px-3 py-2", on ? "border-[var(--app-line-strong)] bg-[var(--app-surface-2)]" : "border-[var(--app-line)] hover:border-[var(--app-line-strong)]")}>
        <button type="button" onClick={() => toggle(item)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="grid h-9 w-11 shrink-0 place-items-center">
            <span className="max-h-9 max-w-11 border border-[var(--app-line-strong)] bg-[var(--app-surface-3)]" style={{ aspectRatio: `${item.w}/${item.h}`, width: item.w >= item.h ? 42 : undefined, height: item.h > item.w ? 36 : undefined }} />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="whitespace-nowrap text-[11px] font-medium tabular-nums">{item.w} × {item.h}</span>
              {item.variant ? <span className="shrink-0 rounded-[3px] bg-[var(--app-surface-3)] px-1 py-px text-[8px] text-[var(--app-text-3)]">{item.variant}</span> : null}
            </span>
            <span className="mt-1 block truncate text-[9px] text-[var(--app-text-4)]" title={item.hint ? `${item.use}，${item.hint}` : item.use}>{item.hint ? `${item.use}，${item.hint}` : item.use}</span>
          </span>
        </button>
        <button
          type="button"
          aria-label={on ? `取消选择 ${item.use}` : `选择 ${item.use}`}
          onClick={() => toggle(item)}
          className={cn("ml-2 grid size-4 shrink-0 place-items-center rounded-[3px] border", on ? "border-[var(--app-text)] bg-[var(--app-text)] text-[var(--app-page)]" : "border-[var(--app-line-strong)]")}
        >
          {on ? <Check size={10} /> : null}
        </button>
      </div>
    );
  };

  const groupName = (sectionId: string) => SIZE_GROUPS.find((group) => sectionId.startsWith(`${group.id}:`))?.name;

  return (
    <div className="flex min-h-0 min-w-0">
      <aside className="flex min-h-0 w-[196px] shrink-0 flex-col border-r border-[var(--app-line)] py-1 pr-4">
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
          {navItem("all", "全部", `${count(ALL_SIZES)}/${ALL_SIZES.length}`)}
          {navItem("selected", "已选", project.targets.length)}
          <div className="my-2 h-px bg-[var(--app-line-soft)]" />
          {CATALOG.map((group) => navItem(group.id as View, group.name, `${count(group.items)}/${group.items.length}`))}
          {navItem("custom", "自定义", customSizes.length)}
        </div>
      </aside>

      <section ref={scrollRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto pl-5">
        {searching ? (
          <div className="mb-2 text-[9px] text-[var(--app-text-4)]">「{query.trim()}」{resultCount} 个结果</div>
        ) : null}
        {view === "custom" && !searching ? (
          <>
            <div className="mb-3 text-[12px] font-semibold">自定义</div>
            <div className="grid grid-cols-3 items-start gap-2">
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
                  }} aria-label="宽度" inputMode="numeric" placeholder="宽度" className="h-7 min-w-0 flex-1 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-page)] px-2 text-[9px] text-[var(--app-text)] outline-none focus:border-[var(--app-line-strong)]" />
                  <span className="text-[9px] text-[var(--app-text-4)]">×</span>
                  <input value={customHeight} onChange={(event) => {
                    setCustomHeight(event.target.value.replace(/\D/g, ""));
                    setCustomError("");
                  }} aria-label="高度" inputMode="numeric" placeholder="高度" className="h-7 min-w-0 flex-1 rounded-[4px] border border-[var(--app-line)] bg-[var(--app-page)] px-2 text-[9px] text-[var(--app-text)] outline-none focus:border-[var(--app-line-strong)]" />
                  <button type="button" onClick={addCustomSize} className="h-7 shrink-0 rounded-[4px] bg-[var(--app-text)] px-2 text-[9px] font-medium text-[var(--app-page)] disabled:opacity-40" disabled={!customName.trim() || !customWidth || !customHeight}>添加</button>
                </div>
                {customError ? <div className="mt-1 truncate px-1 text-[8px] text-[var(--warn-text)]" title={customError}>{customError}</div> : null}
              </div>
              {customSizes.map((item) => (
                <div key={item.key} className="flex min-h-[68px] items-center rounded-[6px] border border-[var(--app-line-strong)] bg-[var(--app-surface-2)] px-3 py-2">
                  <span className="grid h-9 w-11 shrink-0 place-items-center">
                    <span className="max-h-9 max-w-11 border border-[var(--app-line-strong)] bg-[var(--app-surface-3)]" style={{ aspectRatio: `${item.w}/${item.h}`, width: item.w >= item.h ? 42 : undefined, height: item.h > item.w ? 36 : undefined }} />
                  </span>
                  <span className="ml-3 min-w-0 flex-1">
                    <span className="block text-[11px] font-medium tabular-nums">{item.w} × {item.h}</span>
                    <span className="mt-1 block truncate text-[9px] text-[var(--app-text-4)]">{item.use}</span>
                  </span>
                  <button type="button" aria-label={`删除 ${item.use}`} title="删除自定义画幅" onClick={() => setTargets([...selected].filter((key) => key !== item.key))} className="ml-2 grid size-6 place-items-center rounded-[4px] text-[var(--app-text-4)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)]">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : sections.length ? sections.map((section) => (
          <div key={section.id} data-section={section.id} className="mb-5">
            <div className="sticky top-0 z-10 mb-2 flex items-center justify-between bg-[var(--app-page)] py-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-[12px] font-semibold">{(searching || view === "all" || view === "selected") && groupName(section.id) ? `${groupName(section.id)} · ${section.name}` : section.name}</span>
                <span className="text-[9px] tabular-nums text-[var(--app-text-4)]">{count(section.items)}/{section.items.length}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <button type="button" onClick={() => selectAll(section.items)} className="text-[var(--app-text-3)] hover:text-[var(--app-text)]">全选</button>
                <button type="button" onClick={() => clearAll(section.items)} className="text-[var(--app-text-3)] hover:text-[var(--app-text)]">清空</button>
              </div>
            </div>
            <div className="grid grid-cols-3 items-start gap-2">{section.items.map(card)}</div>
          </div>
        )) : (
          <div className="grid h-40 place-items-center text-[10px] text-[var(--app-text-4)]">{searching ? "没有匹配的资源位" : "还没有选择画幅"}</div>
        )}
      </section>
    </div>
  );
}
