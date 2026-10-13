import type { SceneBoardRef, SizeItem, SpecLookup, TargetBoard } from "@futu/domain";
import { ALL_SIZES, INAPP_IDS, slotKey } from "./sizes";
import { SPECS } from "./specs";

export { SIZE_GROUPS, ALL_SIZES, INAPP_IDS, RATIO_PRESETS, slotKey, slotByKey } from "./sizes";
export { SPECS } from "./specs";

/** 查资源位规范：有资源位 id 时按 id 查，否则按尺寸取第一个同尺寸资源位。查不到说明是自定义画幅，排版完全自由。 */
export function specOf(w: number, h: number, sizeId?: string | null): SpecLookup | null {
  const item = (sizeId ? ALL_SIZES.find((s) => s.id === sizeId && s.w === w && s.h === h) : undefined)
    ?? ALL_SIZES.find((s) => s.w === w && s.h === h);
  if (!item) return null;
  return { item, spec: SPECS[item.id] ?? null, isInApp: INAPP_IDS.has(item.id) };
}

/** 画板引用带上资源位规范：CTA 锁定、安全范围标注、版式锚点与不出现的元素。 */
export function slotBoardRef(target: { key: string; w: number; h: number; sizeId?: string | null }): SceneBoardRef {
  const lookup = specOf(target.w, target.h, target.sizeId);
  const cta = lookup?.spec?.cta;
  const slot = lookup?.item;
  return {
    key: target.key,
    w: target.w,
    h: target.h,
    ...(cta ? { ctaSpec: { height: cta.height, fontPx: cta.fontPx, paddingX: cta.paddingX, minWidth: cta.minWidth, maxWidth: cta.maxWidth, ...(cta.lengths ? { lengths: cta.lengths } : {}) } } : {}),
    ...(slot?.zones?.length ? { zones: slot.zones } : {}),
    ...(slot?.hide?.length ? { hide: slot.hide } : {}),
    ...(slot?.layout ? { layout: slot.layout } : {}),
    ...(slot?.edgeFade ? { edgeFade: slot.edgeFade } : {}),
  };
}

export function sizeById(id: string) {
  return ALL_SIZES.find((s) => s.id === id) ?? null;
}

/** 资源位命名，带上版式：「新股页_新股申购完成页（无 CTA）」 */
export function slotName(item: Pick<SizeItem, "use" | "variant">) {
  return item.variant ? `${item.use}（${item.variant}）` : item.use;
}

/** 联动画板（闪屏设备尺寸）及其母版资源位；不是联动画板时返回 null。 */
export function linkedOf(target: Pick<TargetBoard, "sizeId">) {
  const item = target.sizeId ? ALL_SIZES.find((s) => s.id === target.sizeId) : undefined;
  const master = item?.linked ? ALL_SIZES.find((s) => s.id === item.linked!.master) : undefined;
  return item?.linked && master ? { linked: item.linked, master } : null;
}

/** 仿原生固定模板资源位。 */
export function nativeOf(target: Pick<TargetBoard, "sizeId">) {
  return Boolean(target.sizeId && ALL_SIZES.find((s) => s.id === target.sizeId)?.native);
}

export function slotTarget(item: SizeItem): TargetBoard {
  return { key: slotKey(item), w: item.w, h: item.h, sizeId: item.id, use: slotName(item) };
}
