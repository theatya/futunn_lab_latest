import { sceneFamilyAlign, sceneFamilyOf, type SceneBoardRef, type SizeItem, type SpecLookup, type TargetBoard } from "@futu/domain";
import { ALL_SIZES, INAPP_IDS, SIZE_GROUPS, slotKey } from "./sizes";
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

const SPLASH_MASTER = ALL_SIZES.find((item) => ALL_SIZES.some((other) => other.linked?.master === item.id));

/** 版式相关的规范内容；相同的资源位归为同一个规范模板。 */
function templateSignature(item: SizeItem) {
  const { source: _source, version: _version, todo: _todo, ...spec } = SPECS[item.id] ?? {};
  const { source: _layoutSource, ...layout } = item.layout ?? {};
  return JSON.stringify([item.w, item.h, spec, layout, [...(item.hide ?? [])].sort(), item.edgeFade ?? 0]);
}

const TEMPLATE_OF: ReadonlyMap<string, string> = (() => {
  const first = new Map<string, string>();
  const out = new Map<string, string>();
  for (const item of ALL_SIZES) {
    if (!INAPP_IDS.has(item.id) || item.native || item.linked || item.layout?.soft || !(SPECS[item.id] || item.layout)) continue;
    const signature = templateSignature(item);
    if (!first.has(signature)) first.set(signature, item.id);
    out.set(item.id, first.get(signature)!);
  }
  return out;
})();

/**
 * 特殊规范：和别的资源位合不到一起，各自一组，排版不锁（参数与版式组一样可调），规范要求的元素与标注线照常显示。
 * PC 首页轮播（内容区距左 580）、H5 首页轮播 375×600、活动中心（底部信息条、不要 Logo）、
 * 消息推送 edm / FB 分享图（要带市场 Logo）、桌面端底部广告位、官网顶部 banner 1000×160、官网中缝位 1400×160。
 */
const SPECIAL_IDS = new Set(["w-pc-hero", "w-h5-hero", "a-center", "a-box", "a-edm", "a-fb", "a-desk", "w-top", "w-mid"]);
/** 站外超扁幅（Partnership 300×50 / 320×50 / 728×90）在站外版式里合成「超扁幅」一族（`strip@ultra`），代表画幅 728×90。 */
const ULTRA_IDS = new Set(["e-partner-300x50", "e-partner-320x50", "e-partner-728x90"]);
/** 线下物料按每个资源位独立编辑，不能和站外画幅族共用版式。 */
const OFFLINE_IDS = new Set(SIZE_GROUPS.find((group) => group.id === "offline")?.items.map((item) => item.id) ?? []);

export function isOfflineSlot(target: { w: number; h: number; sizeId?: string | null }) {
  return Boolean(target.sizeId && OFFLINE_IDS.has(target.sizeId));
}

/** 资源位的版式族：资源位指定的优先，否则按宽高比。 */
const familyOfItem = (item: SizeItem) => item.family ?? sceneFamilyOf(item.w, item.h);

/**
 * 第三步的编辑分组：
 *  - 闪屏母版单独一组（`族@splash`）；
 *  - 纯背景按规范模板各自一组（`族@spec:模板`，只调裁切）；特殊规范各自一组（`族@own:资源位`，不锁）；
 *  - 其余站内/官网资源位按「画幅族 × 对齐」合成一组（`族@align:left`），规范未注明的按画幅族默认对齐并入，
 *    站内、官网一起做不重复出版式；每块画板仍按自己规范的锚点落位，文案、颜色、字体、裁切一次改完；
 *  - 站外、自定义不给，按画幅归族。
 */
export function slotBucket(target: { w: number; h: number; sizeId?: string | null }): string | undefined {
  const id = target.sizeId;
  const item = id ? ALL_SIZES.find((s) => s.id === id && s.w === target.w && s.h === target.h) : undefined;
  if (item && ULTRA_IDS.has(item.id)) return "strip@ultra";
  if (item && OFFLINE_IDS.has(item.id)) return `${familyOfItem(item)}@offline:${item.id}`;
  if (!item || !INAPP_IDS.has(item.id) || item.native || item.linked) return undefined;
  const family = familyOfItem(item);
  if (item.id === SPLASH_MASTER?.id) return `${family}@splash`;
  if (SPECIAL_IDS.has(item.id)) return `${family}@own:${item.id}`;
  const template = TEMPLATE_OF.get(item.id);
  if (template && item.layout?.visualFill) return `${family}@spec:${template}`;
  return `${family}@align:${item.layout?.group?.align ?? sceneFamilyAlign(family)}`;
}

/** 同一规范模板下的全部资源位（含自己）。 */
export function templateMembers(sizeId: string) {
  const template = TEMPLATE_OF.get(sizeId);
  return template ? ALL_SIZES.filter((item) => TEMPLATE_OF.get(item.id) === template) : [];
}

/** 画板引用带上资源位规范：CTA 锁定、安全范围标注、版式锚点与不出现的元素。 */
export function slotBoardRef(target: { key: string; w: number; h: number; sizeId?: string | null }): SceneBoardRef {
  const lookup = specOf(target.w, target.h, target.sizeId);
  const cta = lookup?.spec?.cta;
  const slot = lookup?.item;
  const bucket = slotBucket(target);
  return {
    ...(bucket ? { bucket } : {}),
    key: target.key,
    w: target.w,
    h: target.h,
    ...(cta ? { ctaSpec: { height: cta.height, fontPx: cta.fontPx, paddingX: cta.paddingX, minWidth: cta.minWidth, maxWidth: cta.maxWidth, ...(cta.lengths ? { lengths: cta.lengths } : {}), ...(cta.soft ? { soft: true } : {}) } } : {}),
    ...(slot?.zones?.length ? { zones: slot.zones } : {}),
    ...(slot?.hide?.length ? { hide: slot.hide } : {}),
    ...(slot?.show?.length ? { show: slot.show } : {}),
    ...(slot?.layout ? { layout: bucket?.includes("@own:") ? { ...slot.layout, soft: true } : slot.layout } : {}),
    ...(slot?.edgeFade ? { edgeFade: slot.edgeFade } : {}),
    ...(slot?.family ? { family: slot.family } : {}),
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
