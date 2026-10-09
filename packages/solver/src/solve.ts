/**
 * 版面求解器
 * ==========
 * 输入：画板真实尺寸 + 内容 + 一套版式意愿 + 站内规范
 * 输出：每个元素的归一化矩形 + 真实像素字号 + 一串「为什么这么排」的决策记录
 *
 * 三条铁律：
 *  1. **纯函数**。同样的输入必得同样的输出，不碰 DOM、不碰时间、不碰随机数。
 *  2. **与显示尺寸无关**。交互稿里字号是拿预览框宽度算的，预览框一变结果就变；
 *     这里全部用画板真实尺寸，输出归一化坐标，渲染层自己乘。
 *  3. **规范是边界，共用设置只是意愿**。够得着用你的，够不着卡在规范线上并说明。
 */

import {
  ELEMENT_LABEL,
  ELEMENT_ORDER,
  EXTRA_KIND_META,
  joinTokens,
  type ElementKey,
  type ExtraConfig,
  type LayoutKind,
  type LayoutRecipe,
  type MarginConfig,
  type Rect,
  type ShowConfig,
  type SizeSpec,
  type SolveNote,
  type Solution,
  type RecipeTrace,
  type RecipeRole,
  type RecipeTypography,
  type TitleStack,
} from "@futu/domain";

import { anchorRect, biasNote, normExtra, normMargin, normShow, nudgeNote, overlaps, shift } from "./geometry";
import { ApproxMeasurer, type TextMeasurer } from "./measure";
import { ctaWidth, disclaimerLineCount, pickCta, wrapTitle, type SolveContent } from "./text";
import { solveRecipe } from "./solve-recipe";

export type { SolveContent };

/** 低于这个真实字号基本没法读，给出警告而不是默默排上去 */
const MIN_LEGIBLE_PX = 9;

export interface SolveInput {
  /** 画板真实尺寸，px */
  board: { w: number; h: number };
  content: SolveContent;
  show?: Partial<ShowConfig> | null;
  margin?: number | Partial<MarginConfig> | null;
  extra?: Partial<ExtraConfig> | null;
  /** 站内规范；没有就是站外位，排版自由 */
  spec?: SizeSpec | null;
  /** 1080×225 等已训练画幅优先消费完整配方，不再进入比例启发式。 */
  recipe?: LayoutRecipe;
  recipeTrace?: RecipeTrace;
  typographyOverrides?: Partial<Record<RecipeRole, RecipeTypography>>;
  /** 不传则用估算实现。浏览器里应传 CanvasMeasurer。 */
  measurer?: TextMeasurer;
}

const defaultMeasurer = new ApproxMeasurer();

function titleStackOf(content: SolveContent): TitleStack {
  return content.titleStack ?? "title-first";
}

function pushHeadline(
  seq: Array<{ k: ElementKey; h: number }>,
  show: ShowConfig,
  stack: TitleStack,
  heights: { title?: number; sub?: number },
) {
  const title = show.title && heights.title != null ? { k: "title" as const, h: heights.title } : null;
  const sub = show.sub && heights.sub != null ? { k: "sub" as const, h: heights.sub } : null;
  if (stack === "sub-first") {
    if (sub) seq.push(sub);
    if (title) seq.push(title);
    return;
  }
  if (title) seq.push(title);
  if (sub) seq.push(sub);
}

function isHeadlinePair(a: ElementKey, b: ElementKey) {
  return (a === "sub" && b === "title") || (a === "title" && b === "sub");
}

/* ================================================================== */
/* 居中版式：一条垂直流，元素关掉之后剩下的自己重新分空间               */
/* ================================================================== */

interface CenterParams {
  layout: LayoutKind;
  titlePx: number;
  subPx: number;
  ctaPx: number;
  discPx: number;
  padX: number;
  padTop: number;
  padBot: number;
  logoH: number;
  badgeH: number;
  ctaFull: boolean;
  /** 剩余空间往哪边堆：0 全给下面（内容贴顶），0.5 平分，1 全给上面（贴底） */
  slackF: number;
}

function buildCentered(
  w: number,
  h: number,
  show: ShowConfig,
  notes: SolveNote[],
  p: CenterParams,
  ex: ExtraConfig,
  content: SolveContent,
  measurer: TextMeasurer,
  cap?: number,
): Solution {
  const contentW = w - p.padX * 2;

  const titleLines = show.title
    ? wrapTitle(contentW, p.titlePx, content, measurer, notes, cap)
    : [];
  const ctaLabel = pickCta(contentW * 0.62, p.ctaPx, p.ctaFull, content, measurer, notes);

  const badge: Rect | null = show.badge ? { x: 0, y: 0, w: 0.32, h: p.badgeH / h } : null;
  const top = show.badge ? p.padTop : p.padTop * 0.5;
  notes.push(
    show.badge
      ? { level: "info", text: "角标不吃边距（钉角元素边距恒为 0）" }
      : { level: "info", text: "角标关掉 → 顶部留白收窄，整条流上移" },
  );

  let bottom = h - p.padBot;
  let disc: Rect | null = null;
  let discLineCount = 0;
  if (show.disc) {
    discLineCount = disclaimerLineCount(contentW, p.discPx, content.disclaimer, measurer);
    const boxH = discLineCount * p.discPx * 1.4;
    disc = { x: p.padX / w, y: (bottom - boxH) / h, w: contentW / w, h: boxH / h };
    bottom = bottom - boxH - h * 0.03;
    notes.push({
      level: "info",
      text: `免责：框宽 ${Math.round(contentW)}px → 自动折成 ${discLineCount} 行`,
    });
    if (p.discPx < MIN_LEGIBLE_PX) {
      notes.push({
        level: "warn",
        text: `免责字号只有 ${p.discPx.toFixed(1)}px，低于可读下限 ${MIN_LEGIBLE_PX}px —— 这块板要么放大，要么别放免责`,
      });
    }
  }

  const seq: Array<{ k: ElementKey; h: number }> = [];
  if (show.logo) seq.push({ k: "logo", h: p.logoH });
  pushHeadline(seq, show, titleStackOf(content), {
    title: p.titlePx * 1.18 * titleLines.length,
    sub: p.subPx * 1.4,
  });
  if (show.kv) seq.push({ k: "kv", h: 0 });
  if (show.cta) seq.push({ k: "cta", h: p.ctaPx * 2.5 });

  const exAspect = EXTRA_KIND_META[ex.kind].aspect;
  const exH = Math.max(h * 0.03, Math.min(w, h) * (ex.size / 100));
  if (show.extra && ex.place === "flow") {
    const idx = seq.findIndex((s) => s.k === ex.after);
    const node = { k: "extra" as ElementKey, h: exH };
    if (idx >= 0) {
      seq.splice(idx + 1, 0, node);
      notes.push({
        level: "info",
        text: `新增元素：进流，排在${ELEMENT_LABEL[ex.after]}之后，跟其他元素一起分空间`,
      });
    } else {
      seq.push(node);
      notes.push({
        level: "info",
        text: `新增元素：进流，但${ELEMENT_LABEL[ex.after]}没开 → 顺延到队尾`,
      });
    }
  }

  const gapOf = (a: ElementKey, b: ElementKey) =>
    isHeadlinePair(a, b) ? (content.titleGapPx ?? h * 0.006) : h * 0.032;

  let fixedH = 0;
  for (const s of seq) fixedH += s.h;
  let gapH = 0;
  for (let i = 0; i < seq.length - 1; i++) gapH += gapOf(seq[i]!.k, seq[i + 1]!.k);

  const avail = bottom - top;
  let slack = avail - fixedH - gapH;

  // 主视觉是弹性的：把剩下的竖向空间吃掉，但不超过一个最大高宽比
  let kvH = 0;
  let kvW = contentW;
  if (show.kv) {
    kvH = Math.max(h * 0.05, slack);
    const maxKvH = contentW * 1.15;
    if (kvH > maxKvH) {
      slack = kvH - maxKvH;
      kvH = maxKvH;
    } else {
      slack = 0;
    }
    kvW = Math.min(contentW, Math.max(contentW * 0.55, kvH * 1.35));
  } else {
    notes.push({ level: "info", text: "主视觉关掉 → 文案块在整块板上重新居中" });
  }

  const ctaW = p.ctaFull
    ? contentW
    : Math.min(contentW, ctaWidth(ctaLabel, p.ctaPx, measurer));

  let y = top + Math.max(0, slack) * p.slackF;
  const out: Partial<Record<ElementKey, Rect>> = {};

  seq.forEach((s, i) => {
    const bh = s.k === "kv" ? kvH : s.h;
    const bw =
      s.k === "kv"
        ? kvW
        : s.k === "cta"
          ? ctaW
          : s.k === "extra"
            ? Math.min(contentW, bh * exAspect)
            : contentW;
    const bx =
      s.k === "extra"
        ? ex.align === "start"
          ? p.padX
          : ex.align === "end"
            ? w - p.padX - bw
            : (w - bw) / 2
        : (w - bw) / 2;
    const bxr = s.k === "extra" ? shift(bx / w, bw / w, ex.dx) : bx / w;
    out[s.k] = { x: bxr, y: y / h, w: bw / w, h: bh / h };
    y += bh;
    const next = seq[i + 1];
    if (next) y += gapOf(s.k, next.k);
  });

  let extra: Rect | null = out.extra ?? null;

  if (show.extra && ex.place === "pin") {
    // 居中版式里角标钉左上、免责占满底部，右上角是默认空着的那个
    const ew = Math.min(contentW, exH * exAspect);
    const a = ex.anchor === "auto" ? "tr" : ex.anchor;
    extra = anchorRect(a, ew, exH, w, h, p.padX, ex);
    notes.push({
      level: "info",
      text:
        (ex.anchor === "auto"
          ? "新增元素：独立浮层 · 自动 → 左上角被角标占了、底部被免责占了，钉右上角"
          : `新增元素：独立浮层 · 手动锚在${anchorLabel(a)}`) + nudgeNote(ex),
    });
    if (overlaps(extra, badge)) {
      notes.push({ level: "warn", text: "浮层压在角标上了 —— 换个锚点，或把角标关掉" });
    }
    if (overlaps(extra, disc)) {
      notes.push({ level: "warn", text: "浮层压在免责上了 —— 免责不能被遮，请换锚点" });
    }
  }

  return {
    layout: p.layout,
    board: { w, h },
    kv: out.kv ?? null,
    logo: out.logo ?? null,
    badge,
    badgeSide: "left",
    sub: out.sub ?? null,
    subPx: p.subPx,
    title: out.title ?? null,
    titleLines,
    titlePx: p.titlePx,
    align: "center",
    cta: out.cta ?? null,
    ctaLabel,
    ctaPx: p.ctaPx,
    disc,
    discPx: p.discPx,
    discLineCount,
    extra,
    notes,
  };
}

function anchorLabel(a: string): string {
  const map: Record<string, string> = {
    tl: "左上",
    tc: "上中",
    tr: "右上",
    ml: "左中",
    mc: "居中",
    mr: "右中",
    bl: "左下",
    bc: "下中",
    br: "右下",
  };
  return map[a] ?? a;
}

/* ================================================================== */
/* 主入口                                                              */
/* ================================================================== */

export function solve(input: SolveInput): Solution {
  const { w, h } = input.board;
  const content = input.content;
  const measurer = input.measurer ?? defaultMeasurer;
  const spec = input.spec ?? null;

  const show = normShow(input.show);
  if (input.recipe && input.recipeTrace && w === input.recipe.board.width && h === input.recipe.board.height) {
    return solveRecipe({
      board: { w, h },
      content,
      show,
      spec,
      recipe: input.recipe,
      trace: input.recipeTrace,
      typographyOverrides: input.typographyOverrides,
      measurer,
    });
  }
  const ex = normExtra(input.extra);
  const mgWant = normMargin(input.margin);

  const r = w / h;
  const notes: SolveNote[] = [];

  const off = ELEMENT_ORDER.filter((k) => !show[k]).map((k) => ELEMENT_LABEL[k]);
  if (off.length) notes.push({ level: "info", text: `已关掉：${off.join(" / ")}` });

  const shortSide = Math.min(w, h);

  // 规范先过一道：它是硬边界，共用设置只是意愿
  let mg = mgWant;
  if (spec?.minPadX != null) {
    const floor = (spec.minPadX / shortSide) * 100;
    if (mgWant.x < floor) {
      mg = { ...mgWant, x: floor };
      notes.push({
        level: "lock",
        text: `规范卡住：左右安全边距不得小于 ${spec.minPadX}px → 实际用 ${floor.toFixed(1)}%，不是你要的 ${mgWant.x}%`,
      });
    }
  }

  const cap = spec?.maxTitleLines;
  const mUnit = (mult: number) => Math.max(1, shortSide * (mg.x / 100) * mult);

  // 上下边距的总量由 y 决定，bias 只管这一坨往上下怎么分。
  // 这样即便主视觉把剩余空间吃干净了，整条流照样能整体上移或下移。
  const vTotal = Math.max(2, shortSide * (mg.y / 100) * 1.9);
  const topShare = mg.bias <= 0 ? 0.66 + (mg.bias / 100) * 0.6 : 0.66 + (mg.bias / 100) * 0.3;
  const padYTop = () => vTotal * topShare;
  const padYBot = () => vTotal * (1 - topShare);
  const slackF = 0.5 + mg.bias / 200;

  const pct = (v: number) => (Math.round(v * 10) / 10).toString();
  notes.push({
    level: "info",
    text: `边距：左右 ${pct(mg.x)}% → ${Math.round(shortSide * (mg.x / 100))}px，上下 ${pct(
      mg.y,
    )}% → ${Math.round(shortSide * (mg.y / 100))}px（都按短边 ${Math.round(shortSide)}px 算）${biasNote(mg.bias)}`,
  });

  /* ---------- 单行条幅：主视觉在左，文案居中，按钮在右 ---------- */
  if (r >= 3.2) {
    notes.push({ level: "info", text: `画幅比 ${r.toFixed(2)} → 版式「单行条幅」` });
    const subPx = Math.max(1, h * 0.14);
    const ctaPx = Math.max(1, h * 0.15);
    const padX = mUnit(1);

    let left = padX;
    let right = w - padX;

    let kv: Rect | null = null;
    if (show.kv) {
      kv = { x: 0, y: 0, w: 0.18, h: 1 };
      left = w * 0.18 + padX;
      notes.push({ level: "info", text: "主视觉：条幅走左侧小图，只占 18% 宽" });
    }

    let cta: Rect | null = null;
    let ctaLabel = content.ctaLong;
    if (show.cta && spec?.cta) {
      const rule = spec.cta;
      const maxWidth = Math.min(rule.maxWidth, w - rule.gapX * 2);
      ctaLabel = pickCta(maxWidth - rule.paddingX * 2, rule.fontPx, false, content, measurer, notes);
      const measured = measurer.measure(ctaLabel, rule.fontPx, "bold") + rule.paddingX * 2;
      const cw = Math.max(rule.minWidth, Math.min(maxWidth, measured));
      const ch = rule.height;
      const x = rule.anchor === "left"
        ? rule.gapX
        : rule.anchor === "center"
          ? (w - cw) / 2
          : w - rule.gapX - cw;
      cta = { x: x / w, y: (h - ch) / 2 / h, w: cw / w, h: ch / h };
      if (rule.anchor === "left") left = x + cw + padX;
      if (rule.anchor === "right") right = x - padX;
      notes.push({
        level: "lock",
        text: `规范约束：CTA 高 ${ch}px、字号 ${rule.fontPx}px、左右 Padding ${rule.paddingX}px；当前文案自适应为 ${Math.round(cw)}px 宽，${rule.anchor === "left" ? "左" : rule.anchor === "center" ? "居中" : "右"}锚定`,
      });
    } else if (show.cta) {
      ctaLabel = pickCta(w * 0.24, ctaPx, false, content, measurer, notes);
      const cw = ctaWidth(ctaLabel, ctaPx, measurer);
      cta = { x: (right - cw) / w, y: 0.28, w: cw / w, h: 0.44 };
      right = right - cw - padX;
    }

    let extra: Rect | null = null;
    if (show.extra) {
      // 条幅太扁，按短边算出来的高度会小到看不见 → 给一个板高下限
      const eh = Math.max(h * 0.45, shortSide * (ex.size / 100));
      const ew = Math.min(w * 0.3, eh * EXTRA_KIND_META[ex.kind].aspect);
      extra = { x: (right - ew) / w, y: (h - eh) / 2 / h, w: ew / w, h: eh / h };
      right = right - ew - padX;
      notes.push({
        level: "info",
        text: "新增元素：条幅没有垂直流可进 → 一律转成独立浮层，占右侧一格，文案栏相应让位",
      });
    }

    const colW = right - left;
    let titlePx = Math.max(1, h * 0.24);
    const titleFlat = joinTokens(content.titleTokens, content.lang);
    while (measurer.measure(titleFlat, titlePx, "bold") > colW && titlePx > 1) titlePx -= 0.4;
    if (show.title) {
      notes.push({
        level: "info",
        text: `主标题：条幅强制一行，字号自适应到 ${titlePx.toFixed(1)}px`,
      });
    }
    if (show.disc) {
      notes.push({
        level: "warn",
        text: "免责：条幅高度放不下合规字号 → 跳过并报出，让人决定",
      });
    }

    const seq: Array<{ k: ElementKey; h: number }> = [];
    if (show.logo) seq.push({ k: "logo", h: h * 0.17 });
    pushHeadline(seq, show, titleStackOf(content), {
      title: titlePx * 1.2,
      sub: subPx * 1.35,
    });

    const gap = h * 0.05;
    const total = seq.reduce((a, s) => a + s.h, 0) + gap * Math.max(0, seq.length - 1);
    let y = Math.max(0, h - total) * slackF;
    const out: Partial<Record<ElementKey, Rect>> = {};
    seq.forEach((s, i) => {
      out[s.k] = { x: left / w, y: y / h, w: colW / w, h: s.h / h };
      y += s.h + (i < seq.length - 1 ? gap : 0);
    });

    return {
      layout: "单行条幅",
      board: { w, h },
      kv,
      logo: out.logo ?? null,
      badge: null,
      badgeSide: "right",
      sub: out.sub ?? null,
      subPx,
      title: out.title ?? null,
      titleLines: [titleFlat],
      titlePx,
      align: "left",
      cta,
      ctaLabel,
      ctaPx: spec?.cta ? spec.cta.fontPx : ctaPx,
      disc: null,
      discPx: 0,
      discLineCount: 0,
      extra,
      notes,
    };
  }

  /* ---------- 横板：左文右图，全部左对齐 ---------- */
  if (r >= 1.35) {
    notes.push({ level: "info", text: `画幅比 ${r.toFixed(2)} → 版式「左文右图」` });
    const titlePx = Math.max(1, w * 0.05);
    const subPx = Math.max(1, w * 0.021);
    const ctaPx = Math.max(1, w * 0.023);
    const discPx = Math.max(1, h * 0.024);
    const padX = mUnit(1.55);
    const padTop = padYTop();
    const padBot = padYBot();

    const kv: Rect | null = show.kv ? { x: 0.55, y: 0, w: 0.45, h: 1 } : null;
    const colRight = show.kv ? w * 0.55 - padX : w - padX;
    const colW = colRight - padX;
    if (!show.kv) notes.push({ level: "info", text: "主视觉关掉 → 文案栏放宽到整块板" });

    const titleLines = show.title ? wrapTitle(colW, titlePx, content, measurer, notes, cap) : [];
    const badge: Rect | null = show.badge ? { x: 0.76, y: 0, w: 0.24, h: 0.11 } : null;
    if (show.badge) {
      notes.push({ level: "info", text: "角标：钉右上角，不吃边距（钉角元素边距恒为 0）" });
    }

    let bottom = h - padBot;
    let disc: Rect | null = null;
    let discLineCount = 0;
    if (show.disc) {
      discLineCount = disclaimerLineCount(colW, discPx, content.disclaimer, measurer);
      const boxH = discLineCount * discPx * 1.4;
      disc = { x: padX / w, y: (bottom - boxH) / h, w: colW / w, h: boxH / h };
      bottom = bottom - boxH - h * 0.05;
      notes.push({
        level: "info",
        text: `免责：框宽 ${Math.round(colW)}px → 自动折成 ${discLineCount} 行`,
      });
      if (discPx < MIN_LEGIBLE_PX) {
        notes.push({
          level: "warn",
          text: `免责字号只有 ${discPx.toFixed(1)}px，低于可读下限 ${MIN_LEGIBLE_PX}px`,
        });
      }
    }

    let ctaLabel = content.ctaLong;
    const seq: Array<{ k: ElementKey; h: number }> = [];
    if (show.logo) seq.push({ k: "logo", h: w * 0.032 });
    pushHeadline(seq, show, titleStackOf(content), {
      title: titlePx * 1.18 * titleLines.length,
      sub: subPx * 1.35,
    });
    if (show.cta) {
      ctaLabel = pickCta(colW * 0.6, ctaPx, false, content, measurer, notes);
      seq.push({ k: "cta", h: ctaPx * 2.6 });
    }

    const exH = Math.max(h * 0.04, shortSide * (ex.size / 100));
    if (show.extra && ex.place === "flow") {
      const idx = seq.findIndex((s) => s.k === ex.after);
      const node = { k: "extra" as ElementKey, h: exH };
      if (idx >= 0) {
        seq.splice(idx + 1, 0, node);
        notes.push({
          level: "info",
          text: `新增元素：进流，排在${ELEMENT_LABEL[ex.after]}之后，跟其他元素一起分空间`,
        });
      } else {
        seq.push(node);
        notes.push({
          level: "info",
          text: `新增元素：进流，但${ELEMENT_LABEL[ex.after]}没开 → 顺延到队尾`,
        });
      }
    }

    const gapOf = (a: ElementKey, b: ElementKey) =>
      isHeadlinePair(a, b) ? (content.titleGapPx ?? h * 0.012) : a === "title" ? h * 0.075 : h * 0.055;

    const fixedH = seq.reduce((a, s) => a + s.h, 0);
    let gapH = 0;
    for (let i = 0; i < seq.length - 1; i++) gapH += gapOf(seq[i]!.k, seq[i + 1]!.k);

    let y = padTop + Math.max(0, bottom - padTop - fixedH - gapH) * slackF;
    const out: Partial<Record<ElementKey, Rect>> = {};
    seq.forEach((s, i) => {
      const bw =
        s.k === "cta"
          ? Math.min(colW, ctaWidth(ctaLabel, ctaPx, measurer))
          : s.k === "extra"
            ? Math.min(colW, s.h * EXTRA_KIND_META[ex.kind].aspect)
            : colW;
      const bx =
        s.k === "extra"
          ? ex.align === "center"
            ? padX + (colW - bw) / 2
            : ex.align === "end"
              ? padX + colW - bw
              : padX
          : padX;
      const bxr = s.k === "extra" ? shift(bx / w, bw / w, ex.dx) : bx / w;
      out[s.k] = { x: bxr, y: y / h, w: bw / w, h: s.h / h };
      const next = seq[i + 1];
      y += s.h + (next ? gapOf(s.k, next.k) : 0);
    });
    let extra: Rect | null = out.extra ?? null;

    if (show.extra && ex.place === "pin") {
      // 横板里角标钉右上、免责在左下，右下角是默认空着的那个
      const ew = Math.min(w * 0.34, exH * EXTRA_KIND_META[ex.kind].aspect);
      const a = ex.anchor === "auto" ? "br" : ex.anchor;
      extra = anchorRect(a, ew, exH, w, h, padX, ex);
      notes.push({
        level: "info",
        text:
          (ex.anchor === "auto"
            ? "新增元素：独立浮层 · 自动 → 右上角被角标占了、左下角被免责占了，钉右下角"
            : `新增元素：独立浮层 · 手动锚在${anchorLabel(a)}`) + nudgeNote(ex),
      });
      if (overlaps(extra, badge)) {
        notes.push({ level: "warn", text: "浮层压在角标上了 —— 换个锚点，或把角标关掉" });
      }
      if (overlaps(extra, disc)) {
        notes.push({ level: "warn", text: "浮层压在免责上了 —— 免责不能被遮，请换锚点" });
      }
    }

    notes.push({ level: "info", text: "左边线对齐：副标题 / 主标题 / 按钮 / 免责" });
    if (show.kv) {
      notes.push({ level: "info", text: "主视觉：按「主体框」右对齐裁切，暗角接缝留在板外" });
    }

    return {
      layout: "左文右图",
      board: { w, h },
      kv,
      logo: out.logo ?? null,
      badge,
      badgeSide: "right",
      sub: out.sub ?? null,
      subPx,
      title: out.title ?? null,
      titleLines,
      titlePx,
      align: "left",
      cta: out.cta ?? null,
      ctaLabel,
      ctaPx,
      disc,
      discPx,
      discLineCount,
      extra,
      notes,
    };
  }

  /* ---------- 极窄竖幅 ---------- */
  if (r < 0.42) {
    notes.push({ level: "info", text: `画幅比 ${r.toFixed(2)} → 版式「极窄竖幅」` });
    if (show.sub) {
      notes.push({ level: "warn", text: "副标题：板宽不足 → 求解器按优先级强制关掉" });
    }
    if (show.disc) {
      notes.push({ level: "warn", text: "免责：字号会跌破合规下限 → 跳过并报出" });
    }
    return buildCentered(
      w,
      h,
      { ...show, sub: false, disc: false, badge: false },
      notes,
      {
        layout: "极窄竖幅",
        titlePx: Math.max(1, w * 0.12),
        subPx: Math.max(1, w * 0.06),
        ctaPx: Math.max(1, w * 0.072),
        discPx: Math.max(1, h * 0.01),
        padX: mUnit(1),
        padTop: padYTop(),
        padBot: padYBot(),
        logoH: w * 0.1,
        badgeH: h * 0.03,
        ctaFull: true,
        slackF,
      },
      ex,
      content,
      measurer,
      cap,
    );
  }

  /* ---------- 竖版：全部居中 ---------- */
  if (r < 0.8) {
    notes.push({ level: "info", text: `画幅比 ${r.toFixed(2)} → 版式「居中 · 竖版」` });
    if (show.badge) notes.push({ level: "info", text: "角标：钉左上角" });
    if (show.kv) {
      notes.push({
        level: "info",
        text: "主视觉：横构图放竖版 → 触发背景外扩，只补背景不动主体",
      });
    }
    return buildCentered(
      w,
      h,
      show,
      notes,
      {
        layout: "居中 · 竖版",
        titlePx: Math.max(1, w * 0.072),
        subPx: Math.max(1, w * 0.03),
        ctaPx: Math.max(1, w * 0.034),
        discPx: Math.max(1, h * 0.011),
        padX: mUnit(1),
        padTop: padYTop(),
        padBot: padYBot(),
        logoH: w * 0.045,
        badgeH: h * 0.05,
        ctaFull: false,
        slackF,
      },
      ex,
      content,
      measurer,
      cap,
    );
  }

  /* ---------- 方版：全部居中 ---------- */
  notes.push({ level: "info", text: `画幅比 ${r.toFixed(2)} → 版式「居中 · 方版」` });
  if (show.badge) notes.push({ level: "info", text: "角标：钉左上角" });
  return buildCentered(
    w,
    h,
    show,
    notes,
    {
      layout: "居中 · 方版",
      titlePx: Math.max(1, w * 0.07),
      subPx: Math.max(1, w * 0.03),
      ctaPx: Math.max(1, w * 0.034),
      discPx: Math.max(1, h * 0.017),
      padX: mUnit(1),
      padTop: padYTop(),
      padBot: padYBot(),
      logoH: w * 0.045,
      badgeH: h * 0.075,
      ctaFull: false,
      slackF,
    },
    ex,
    content,
    measurer,
    cap,
  );
}
