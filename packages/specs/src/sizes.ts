/**
 * 资源位清单，按《广告设计规范 - 纯净版（AI语料）》2026-10-12 校准。
 * 这是**数据**不是逻辑：加资源位、改命名、补安全区都只动这里，求解器一行不用改。
 * 标注区坐标为真实 px，相对画板左上角。
 */

import type { SizeBox, SizeGroup, SizeHideRole, SizeItem, SizeLayout, SizeLinked, SizeZone } from "@futu/domain";
import { sizeKey } from "@futu/domain";

const R = (x: number, y: number, w: number, h: number, label?: string): SizeZone => ({ x, y, w, h, kind: "reserved", ...(label ? { label } : {}) });
const S = (x: number, y: number, w: number, h: number, label?: string): SizeZone => ({ x, y, w, h, kind: "safe", ...(label ? { label } : {}) });
const B = (x: number, y: number, w: number, h: number): SizeBox => ({ x, y, w, h });

/** 1080×225 有 CTA：CTA 200×80 固定在右侧，距右 24、距顶 72。 */
const STRIP_CTA: SizeZone[] = [R(1056, 0, 24, 225, "右侧 24"), R(856, 0, 224, 72, "CTA 上方 72")];
const left = (px: number, h: number) => R(0, 0, px, h, `左侧 ${px}`);

/**
 * 版式锚点取自纯净版各资源位示例稿（source 为节点 id），px 相对画板。
 * 1080×225 / 1080×288 带 CTA 的标准条不写：标题组走训练集，规范只约束 CTA 区。
 * 通栏族默认把主视觉放左侧，文案贴左边距的通栏要把主视觉移到右侧；横版族默认已在右侧。
 */
const textLeft = (x: number, y: number, w: number, h: number, source: string, extra: Omit<SizeLayout, "source" | "group"> = {}): SizeLayout => ({
  group: { x, y, align: "left" },
  ...(w / h >= 2.6 ? { visual: { x: w * 0.78, y: h * 0.687 } } : {}),
  source,
  ...extra,
});
/** 1080×225 无 CTA：文案左对齐，左侧留 70。 */
const STRIP_LEFT = textLeft(70, 112, 1080, 225, "37153:33347");
/** 纯背景图：文案由系统输出，素材只出主视觉。 */
const BG_ONLY: SizeHideRole[] = ["cta", "logo", "badge", "kicker", "title", "subtitle", "custom", "disclaimer"];
/** 示例稿只有「视觉」：不放文字，主视觉铺满画板。 */
const visualOnly = (source: string): Pick<SizeItem, "hide" | "layout"> => ({ hide: BG_ONLY, layout: { visualFill: true, source } });

const SPLASH_MASTER = "a-splash";
const splash = (id: string, use: string, w: number, h: number, linked: Omit<SizeLinked, "master">, safe: SizeBox): SizeItem => ({
  id,
  w,
  h,
  use,
  linked: { master: SPLASH_MASTER, ...linked },
  zones: [S(safe.x, safe.y, safe.w, safe.h, "安全区域")],
  notes: ["由闪屏母版 2000×2400 自动适配，随母版一起输出"],
});

/** 站内按 Figma 页面目录分类（闪屏设备尺寸未列出，归入闪屏），官网按「官网广告位（合并版）」里的小节分类。 */
const INAPP_PAGES = ["账户tab", "资讯tab", "理财tab", "牛牛圈", "闪屏", "搜索tab", "弹窗", "会员页", "课堂", "发现tab", "新股页", "我的tab", "自选tab", "任务宝箱", "消息推送", "桌面端", "模拟交易"];
const INAPP_PAGE_OF: Record<string, string> = {
  "a-acct": "账户tab",
  "a-wm-new": "理财tab", "a-wm-new-s": "理财tab", "a-fund": "理财tab", "a-fund-s": "理财tab",
  "a-news": "资讯tab", "a-news-ad": "资讯tab", "a-news-foot": "资讯tab",
  "a-feed": "牛牛圈", "a-live": "牛牛圈", "a-replay": "牛牛圈", "a-topic": "牛牛圈", "a-topic-b": "牛牛圈", "a-topic-bg": "牛牛圈",
  "a-search": "搜索tab", "a-search-b": "搜索tab",
  "a-popup": "弹窗",
  "a-vip": "会员页", "a-vip-b": "会员页",
  "a-class": "课堂",
  "a-disc-ad": "发现tab",
  "a-center": "我的tab", "a-mine": "我的tab",
  "a-ipo": "新股页", "a-ipo-stock": "新股页", "a-ipo-done": "新股页", "a-ipo-done-b": "新股页",
  "a-watch": "自选tab",
  "a-box": "任务宝箱", "a-box-icon": "任务宝箱",
  "a-push": "消息推送", "a-edm": "消息推送", "a-fb": "消息推送",
  "a-desk": "桌面端",
  "a-sim": "模拟交易", "a-sim-live": "模拟交易", "a-sim-past": "模拟交易",
};
const WEB_SECTIONS = ["全市场首页", "吸底CTA组件", "悬浮球", "弹窗", "iframe", "平台侧边栏", "平台顶部Banner", "榜单配图", "首页二屏轮播位", "页中运营广告位", "首页固定中缝位", "其他"];
const WEB_SECTION_OF: Record<string, string> = {
  "w-pc-hero": "全市场首页", "w-h5-hero": "全市场首页",
  "w-sticky": "吸底CTA组件", "w-sticky-h5": "吸底CTA组件",
  "w-ball": "悬浮球",
  "w-iframe": "弹窗", "w-iframe-r": "弹窗",
  "w-iframe-h5": "iframe",
  "w-popup": "平台侧边栏", "w-side": "平台侧边栏",
  "w-top": "平台顶部Banner", "w-top-h5": "平台顶部Banner",
  "w-rank": "榜单配图",
  "w-second": "首页二屏轮播位", "w-whatnew": "首页二屏轮播位",
  "w-ops": "页中运营广告位", "w-ops-h5": "页中运营广告位",
  "w-mid": "首页固定中缝位", "w-mid-h5": "首页固定中缝位", "w-mid-ipad": "首页固定中缝位",};
const subsOf = (names: string[]) => names.map((name) => ({ id: name, name }));
const withSub = (map: Record<string, string>, fallback: string) => (item: SizeItem): SizeItem => ({ ...item, sub: map[item.id] ?? fallback });

export const SIZE_GROUPS: SizeGroup[] = [
  {
    id: "inapp",
    name: "站内",
    note: "按 Figma 各页面资源位录入",
    subs: subsOf(INAPP_PAGES),
    items: ([
      { id: "a-acct", w: 1080, h: 225, use: "账户tab_交易tab banner", zones: STRIP_CTA, notes: ["CTA 200×80 位置固定，字号 30"] },
      { id: "a-wm-new", ...visualOnly("理财tab-1080*1374"), w: 1080, h: 1374, use: "理财tab_理财首页顶部新客banner" },
      { id: "a-wm-new-s", w: 1080, h: 225, use: "理财tab_理财首页顶部新客banner", zones: STRIP_CTA, notes: ["规范同账户tab_banner 1080×225"] },
      { id: "a-fund", layout: textLeft(70, 143, 1080, 432, "768:15717", { titlePx: 72, cta: { x: 70, y: 317, align: "left" } }), w: 1080, h: 432, use: "理财tab_基金组合页banner", zones: [left(70, 432)], notes: ["CTA 220×80 宽高固定，字号 32"] },
      { id: "a-fund-s", w: 1080, h: 225, use: "理财tab_基金组合页banner", zones: STRIP_CTA },
      { id: "a-news", hide: ["cta"], layout: textLeft(40, 132, 1080, 270, "1705:14838"), w: 1080, h: 270, use: "资讯tab_资讯要闻头图", zones: [left(40, 270)] },
      { id: "a-news-ad", ...visualOnly("资讯tab_广告小图-400*300"), w: 400, h: 300, use: "资讯tab_广告小图", zones: [S(0, 25, 400, 250, "安全区域，上下会裁切")] },
      { id: "a-news-foot", w: 1080, h: 225, use: "资讯tab_资讯详情底部", zones: [left(70, 225), ...STRIP_CTA] },
      { id: "a-feed", layout: textLeft(70, 196, 1080, 540, "230:4246", { cta: { x: 70, y: 385, align: "left" } }), w: 1080, h: 540, use: "牛牛圈tab_牛牛圈feed", zones: [left(70, 540)], notes: ["CTA 270×90 宽高固定，字号 38"] },
      { id: "a-live", hide: ["cta"], layout: textLeft(44, 261, 1080, 608, "794:15766", { titlePx: 68 }), w: 1080, h: 608, use: "牛牛圈tab_直播顶部轮播banner", zones: [left(44, 608), R(1040, 0, 40, 608, "右侧 40")], notes: ["文字左对齐，人物放右侧，期数与栏目名右上角，无按钮"] },
      { id: "a-replay", hide: ["cta"], layout: textLeft(44, 362, 1280, 720, "796:15896", { titlePx: 73 }), w: 1280, h: 720, use: "牛牛圈tab_直播回放banner", zones: [left(44, 720), R(1240, 0, 40, 720, "右侧 40")], notes: ["文字左对齐，人物放右侧，期数与栏目名右上角，无按钮"] },
      { id: "a-topic", w: 1080, h: 225, use: "牛牛圈tab_热点话题详情banner", variant: "有 CTA", zones: STRIP_CTA },
      { id: "a-topic-b", hide: ["cta"], layout: STRIP_LEFT, w: 1080, h: 225, use: "牛牛圈tab_热点话题详情banner", variant: "无 CTA", zones: [left(70, 225)] },
      { id: "a-topic-bg", ...visualOnly("牛牛圈社区话题背景"), w: 2048, h: 1040, use: "牛牛圈社区话题背景", notes: ["纯背景图"] },
      { id: "a-popup", layout: { group: { x: 405, y: 212, align: "center" }, cta: { x: 405, y: 990, align: "center" }, source: "37169:53677" }, w: 810, h: 1110, use: "全局_弹窗", zones: [left(24, 1110), R(786, 0, 24, 1110, "右侧 24")], notes: ["按钮高 120 固定，长度 480–680，距底 60"] },
      { id: "a-search", w: 1080, h: 288, use: "全局_搜索tab", variant: "有 CTA", zones: [R(1056, 0, 24, 288, "右侧 24"), R(856, 0, 224, 104, "CTA 上方 104")], notes: ["CTA 200×80 位置固定，字号 33（最小 30）"] },
      { id: "a-search-b", hide: ["cta"], layout: textLeft(70, 142, 1080, 288, "1689:14301"), w: 1080, h: 288, use: "全局_搜索tab", variant: "无 CTA", zones: [left(70, 288)], notes: ["特殊运营banner，文案左侧留 70"] },
      { id: SPLASH_MASTER, hide: ["cta"], w: 2000, h: 2400, use: "闪屏 2000*2400", hint: "仅需要输出这一张", zones: [S(480, 200, 1040, 1806, "绝对安全区域"), R(480, 2006, 1040, 394, "系统按钮区")], notes: ["系统自带行动按钮，素材不要按钮", "不输出底部富途牛牛 logo"] },
      splash("a-splash-1242", "手机端闪屏 1242x2688", 1242, 2688, { bar: 389, logo: B(389, 2365, 463, 180), skip: B(1003, 197, 205, 86), control: B(231, 1971, 780, 194) }, B(123, 192, 996, 1730)),
      splash("a-splash-2160", "手机端闪屏 1080x2160", 1080, 2160, { bar: 314, logo: B(337, 1923, 386, 150), skip: B(877, 158, 162, 68), control: B(212, 1565, 656, 162) }, B(140, 154, 800, 1389)),
      splash("a-splash-1920", "手机端闪屏 1080x1920", 1080, 1920, { bar: 275, logo: B(347, 1701, 386, 150), skip: B(877, 128, 162, 68), control: B(212, 1396, 656, 162) }, B(183, 137, 713, 1238)),
      splash("a-splash-640", "手机端闪屏 640x1136", 640, 1136, { bar: 165, logo: B(210, 1010, 219, 85), skip: B(507, 72, 100, 42), control: B(120, 813, 400, 100) }, B(109, 81, 421, 731)),
      splash("a-splash-744", "平板端闪屏 iPad mini 8.3 744*1133", 744, 1133, { bar: 130, logo: B(297, 1036, 150, 58), control: B(192, 862, 360, 84) }, B(155, 84, 435, 755)),
      splash("a-splash-834", "平板端闪屏 iPad Pro 11\" 834*1194", 834, 1194, { bar: 130, logo: B(342, 1096, 150, 58), control: B(237, 920, 360, 84) }, B(187, 89, 461, 801)),
      splash("a-splash-1024", "平板端闪屏 iPad Pro 12.9\" 1024*1366", 1024, 1366, { bar: 130, logo: B(437, 1268, 150, 58), control: B(354, 1085, 360, 84) }, B(244, 103, 536, 930)),
      splash("a-splash-960", "平板端闪屏 Surface Pro 8 960*1440", 960, 1440, { bar: 130, logo: B(405, 1342, 150, 58), control: B(312, 1154, 360, 84) }, B(196, 108, 568, 987)),
      { id: "a-vip", w: 1080, h: 225, use: "会员页_会员打新专区banner", variant: "有 CTA", zones: STRIP_CTA },
      { id: "a-vip-b", hide: ["cta"], layout: STRIP_LEFT, w: 1080, h: 225, use: "会员页_会员打新专区banner", variant: "无 CTA", zones: [left(70, 225)] },
      { id: "a-class", layout: textLeft(40, 132, 1080, 270, "1705:14982", { cta: { afterSubtitle: 18 } }), w: 1080, h: 270, use: "课堂banner", zones: [left(40, 270)], notes: ["CTA 150×50，字号 26 / 24，跟随文案"] },
      { id: "a-disc-ad", ...visualOnly("发现tab_广告小图-400*300"), w: 400, h: 300, use: "发现tab_广告小图" },
      { id: "a-center", hide: ["cta", "logo"], layout: textLeft(50, 190, 1080, 432, "407:6208", { titlePx: 70 }), w: 1080, h: 432, use: "我的tab_活动中心", zones: [left(48, 432), R(1050, 0, 30, 432, "右侧 30"), R(0, 350, 1080, 82, "底部信息条")], notes: ["不要按钮，不要 logo"] },
      { id: "a-mine", w: 1080, h: 225, use: "我的tab_banner", zones: STRIP_CTA, notes: ["CTA 200×80 位置固定，字号 30"] },
      { id: "a-ipo", w: 1080, h: 432, use: "新股页_新股中心banner", zones: [left(70, 432)], notes: ["CTA 220×70 宽高固定，字号 32"] },
      { id: "a-ipo-stock", w: 1080, h: 225, use: "新股页_新股个股banner", zones: STRIP_CTA },
      { id: "a-ipo-done", w: 1080, h: 225, use: "新股页_新股申购完成页", variant: "有 CTA", zones: STRIP_CTA },
      { id: "a-ipo-done-b", hide: ["cta"], layout: STRIP_LEFT, w: 1080, h: 225, use: "新股页_新股申购完成页", variant: "无 CTA", zones: [left(70, 225)] },
      { id: "a-watch", w: 1080, h: 225, use: "自选页_个股banner", zones: STRIP_CTA },
      { id: "a-box", w: 1080, h: 675, use: "宝箱详情页banner", zones: [left(60, 675), R(1020, 0, 60, 675, "右侧 60"), R(0, 0, 1080, 128, "顶部 128")], notes: ["需要适配黑白肤"] },
      { id: "a-box-icon", ...visualOnly("宝箱详情页icon-252*252"), w: 252, h: 252, use: "宝箱详情页icon", notes: ["满版出图"] },
      { id: "a-push", ...visualOnly("消息推送_push-200*200"), w: 200, h: 200, use: "消息推送_push" },
      { id: "a-edm", hide: ["cta"], layout: textLeft(70, 232, 1200, 500, "37112:35592", { titlePx: 78 }), w: 1200, h: 500, use: "消息推送_edm", zones: [left(70, 500)], notes: ["不需要按钮"] },
      { id: "a-fb", w: 1200, h: 630, use: "消息推送_活动FB分享图", zones: [left(40, 630), R(0, 0, 231, 60, "市场 Logo")], notes: ["CTA 280×88，字号 42 / 38；需附带 logo 与按钮"] },
      {
        id: "a-desk",
        layout: textLeft(69, 132, 1080, 360, "18674:179742", { titlePx: 60, cta: { x: 72, y: 260, align: "left" } }),
        w: 1080,
        h: 360,
        use: "新桌面端底部广告位",
        zones: [R(972, 36, 72, 72, "关闭按钮"), R(0, 42, 39, 273, "左翻页"), R(1041, 42, 39, 273, "右翻页"), R(486, 324, 108, 12, "指示器")],
        notes: ["示例稿按 1/3 绘制（360×120），CTA 约 220×70，字号 32"],
      },
      { id: "a-sim", w: 1080, h: 360, use: "模拟交易首页" },
      { id: "a-sim-live", w: 1080, h: 225, use: "模拟交易比赛进行中" },
      { id: "a-sim-past", w: 1080, h: 225, use: "模拟交易历史比赛" },
    ] as SizeItem[]).map(withSub(INAPP_PAGE_OF, "闪屏")),
  },
  {
    id: "web",
    name: "官网",
    note: "官网运营位",
    subs: subsOf(WEB_SECTIONS),
    items: ([
      { id: "w-pc-hero", layout: { group: { x: 580, y: 173, align: "left" }, titlePx: 49, cta: { x: 580, y: 330, align: "left" }, visual: { x: 1500, y: 230, scale: 0.55 }, source: "30255:3413" }, w: 2560, h: 540, use: "PC首页轮播banner", zones: [S(580, 0, 1400, 540, "主要内容区 1400"), R(320, 440, 1920, 100, "底部轮播文案 100")], notes: ["按钮 280×60 对齐内容区左边", "iPad 由此等比缩放至 1583×334，无需单独输出"] },
      { id: "w-h5-hero", w: 375, h: 600, use: "H5首页轮播banner", zones: [S(24, 0, 327, 600, "内容区 327"), R(0, 0, 375, 30, "顶部 30"), S(24, 60, 326, 140, "标题区"), R(0, 500, 375, 60, "合规文"), R(0, 560, 375, 40, "轮播器")], notes: ["按钮 280×45 位置固定"] },
      { id: "w-kv", w: 420, h: 170, use: "官网活动页主KVbanner" },
      { id: "w-cover", w: 800, h: 400, use: "官网活动页封面banner" },
      { id: "w-top", edgeFade: 48, w: 1000, h: 160, use: "官网顶部banner-Web", zones: [S(16, 16, 968, 128, "安全范围 16")], notes: ["两侧展示不全时需提供背景单色色值"] },
      { id: "w-top-h5", w: 375, h: 78, use: "官网顶部banner-H5" },
      { id: "w-popup", w: 810, h: 1110, use: "官网弹窗" },
      { id: "w-side", w: 810, h: 1110, use: "官网侧边栏" },
      { id: "w-whatnew", w: 440, h: 440, use: "PC首页What New模块" },
      { id: "w-nav", w: 580, h: 326, use: "官网导航栏" },
      { id: "w-iframe", hide: ["cta"], w: 492, h: 560, use: "iframe", notes: ["不要 CTA"] },
      { id: "w-iframe-h5", w: 342, h: 71, use: "H5轮播图" },
      { id: "w-ops", w: 1180, h: 295, use: "官网通用运营广告位-Web" },
      { id: "w-ops-h5", w: 654, h: 327, use: "官网通用运营广告位-H5" },
      { id: "w-mid", w: 1400, h: 160, use: "官网首页固定中缝位-Web", notes: ["png 透明，按钮位置固定"] },
      { id: "w-mid-h5", w: 327, h: 164, use: "官网首页固定中缝位-H5", notes: ["png 透明，按钮位置固定"] },
      { id: "w-mid-ipad", w: 864, h: 216, use: "官网首页固定中缝位-iPad", notes: ["按钮直接做在图里"] },
      { id: "w-second", hide: ["cta"], w: 440, h: 440, use: "首页二屏轮播位", notes: ["不需要按钮"] },
      { id: "w-iframe-r", w: 888, h: 760, use: "iframe右侧" },
      { id: "w-rank", w: 500, h: 250, use: "榜单配图banner" },
      { id: "w-ball", w: 120, h: 90, use: "官网悬浮球" },
      { id: "w-sticky", w: 600, h: 120, use: "吸底CTA-PC", zones: [left(20, 120), R(580, 0, 20, 120, "右侧 20")], notes: ["png 无底色，文案 ≤ 24 字符"] },
      { id: "w-sticky-h5", w: 375, h: 80, use: "吸底CTA-H5", zones: [left(20, 80), R(355, 0, 20, 80, "右侧 20")], notes: ["png 无底色，文案 ≤ 24 字符"] },
    ] as SizeItem[]).map(withSub(WEB_SECTION_OF, "其他")),
  },
  {
    id: "external",
    name: "站外",
    note: "站外广告位",
    subs: [
      { id: "paid", name: "Paid Ads" },
      { id: "kol", name: "KOL/社媒" },
      { id: "partner", name: "Partnership" },
      { id: "ads", name: "广告投放" },
      { id: "standee", name: "实体店线下立牌" },
      { id: "led", name: "实体店LED轮播图" },
    ],
    items: [
      ...([[1200, 628], [1200, 1500], [1080, 1080], [1242, 2688], [1024, 500], [1080, 1920]] as const).map(([w, h]) => ({ id: `e-paid-${w}x${h}`, w, h, use: "Paid Ads", sub: "paid" })),
      ...([[1920, 1005], [1920, 1080], [1600, 900], [1200, 1500], [1200, 628], [1080, 1080], [1080, 1920], [800, 450]] as const).map(([w, h]) => ({ id: `e-kol-${w}x${h}`, w, h, use: "", sub: "kol" })),
      { id: "e-kol-ig-post", w: 1080, h: 1350, use: "Instagram post (4:5)", sub: "kol" },
      { id: "e-kol-ig-story", w: 1080, h: 1920, use: "Instagram story (9:16)", sub: "kol" },
      { id: "e-kol-yt-li", w: 1200, h: 626, use: "Youtube & LinkedIn", sub: "kol" },
      ...([[600, 400], [250, 250], [300, 50], [300, 250], [300, 300], [300, 600], [320, 50], [320, 480], [336, 280], [480, 320], [640, 480], [728, 90], [768, 1024], [970, 250], [1080, 1920], [1200, 627], [1920, 1080], [600, 160]] as const).map(([w, h]) => ({ id: `e-partner-${w}x${h}`, w, h, use: "Partnership", sub: "partner" })),
      ...([[1200, 628], [1080, 1080], [1200, 1500], [1080, 1920]] as const).map(([w, h]) => ({ id: `e-ads-${w}x${h}`, w, h, use: "广告投放banner", sub: "ads" })),
      { id: "e-standee-1920x1080", w: 1920, h: 1080, use: "线下立牌banner", sub: "standee" },
      { id: "e-standee-1080x1920", w: 1080, h: 1920, use: "线下立牌banner", sub: "standee" },
      { id: "e-standee-a1", w: 1740, h: 2441, use: "线下立牌banner-A1", sub: "standee", zones: [S(89, 90, 1563, 2261, "安全范围 22mm"), S(20, 20, 1701, 2401, "出血 3mm")], notes: ["注意安全范围，预留出血 Bleed 3mm"] },
      { id: "e-led-tv", w: 1920, h: 1080, use: "电视轮播图", sub: "led" },
      { id: "e-led-in-s", w: 512, h: 1536, use: "店内电视及直立屏", sub: "led" },
      { id: "e-led-out", w: 336, h: 1176, use: "店外LED屏轮播图", sub: "led" },
      { id: "e-led-in", w: 1080, h: 1920, use: "店内电视及直立屏", sub: "led" },
    ],
  },
  {
    id: "native",
    name: "仿原生",
    note: "固定模板，不走主视觉延展",
    items: [
      { id: "a-native", w: 1080, h: 225, use: "仿原生_账户tab banner", native: true, notes: ["固定模板：样式 1 / 样式 2，深浅两版同时输出"] },
    ],
  },
  {
    id: "custom",
    name: "自定义",
    note: "输入任意画幅尺寸",
    items: [],
  },
];

export const ALL_SIZES: SizeItem[] = SIZE_GROUPS.flatMap((g) => g.items);

/** 同尺寸多个资源位时，沿用旧项目里该尺寸含义的那个资源位拿裸尺寸 key，其余带上 id。 */
const PRIMARY = new Set(["a-mine", "a-center", "a-popup", "a-feed", "a-news", "a-push", "a-box-icon", "e-paid-1200x628", "e-paid-1080x1080", "e-paid-1080x1920", "e-partner-1920x1080", "e-paid-1200x1500"]);

const KEYS: ReadonlyMap<string, string> = (() => {
  const keys = new Map<string, string>();
  const taken = new Set<string>();
  const primaries = ALL_SIZES.filter((item) => PRIMARY.has(item.id));
  for (const item of [...primaries, ...ALL_SIZES.filter((item) => !PRIMARY.has(item.id))]) {
    const bare = sizeKey(item.w, item.h);
    keys.set(item.id, taken.has(bare) ? `${bare}·${item.id}` : bare);
    taken.add(bare);
  }
  return keys;
})();

/** 资源位的画板 key：一个资源位一块画板。 */
export function slotKey(item: Pick<SizeItem, "id" | "w" | "h">): string {
  return KEYS.get(item.id) ?? sizeKey(item.w, item.h);
}

export function slotByKey(key: string): SizeItem | undefined {
  return ALL_SIZES.find((item) => KEYS.get(item.id) === key);
}

export const INAPP_IDS: ReadonlySet<string> = new Set(
  SIZE_GROUPS.filter((g) => g.id === "inapp" || g.id === "web" || g.id === "native").flatMap((g) => g.items.map((s) => s.id)),
);

/** 常用画幅比预设，用于「画幅」那一步快速切换 */
export const RATIO_PRESETS: ReadonlyArray<{ ratio: string; w: number; h: number; use: string }> = [
  { ratio: "1:1", w: 1080, h: 1080, use: "方版通投" },
  { ratio: "6:5", w: 300, h: 250, use: "小方图" },
  { ratio: "4:5", w: 1080, h: 1350, use: "行情页推荐位" },
  { ratio: "3:4", w: 750, h: 1000, use: "活动弹窗" },
  { ratio: "1.91:1", w: 1200, h: 628, use: "Meta 横版" },
  { ratio: "16:9", w: 1920, h: 1080, use: "DSP 大横板" },
  { ratio: "9:16", w: 1080, h: 1920, use: "Story 竖版" },
  { ratio: "9:19.5", w: 1125, h: 2436, use: "开屏" },
  { ratio: "4:1", w: 970, h: 250, use: "超宽横幅" },
  { ratio: "24:5", w: 1080, h: 225, use: "我的 tab banner" },
];
