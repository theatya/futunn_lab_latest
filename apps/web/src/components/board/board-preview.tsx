"use client";

import type { AssetRef, BadgeStyle, RecipeTypography, Rect, Solution } from "@futu/domain";
import { EXTRA_KIND_META, type ExtraKind } from "@futu/domain";
import type { SolveContent } from "@futu/solver";
import { LogoPresetPreview } from "@/components/logo-preset-preview";
import { cn } from "@/lib/utils";

/**
 * 画板预览。
 *
 * 求解器输出的是**归一化矩形 + 真实像素字号**，这里只做一件事：乘以缩放比。
 * 所以预览框放大缩小，版式一模一样 —— 交互稿里做不到这点，那版字号是拿预览宽度算的。
 *
 * 这块区域**不加任何玻璃 / 滤镜 / 主题色**。它代表最终交付的广告成品，
 * 必须是像素诚实的：设计师在这儿看到什么，Figma 里就该长什么样。
 */

function box(r: Rect | null): React.CSSProperties | null {
  if (!r) return null;
  return {
    position: "absolute",
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
  };
}

function StyledText({
  text,
  typography,
  sourceOffset = 0,
}: {
  text: string;
  typography?: RecipeTypography;
  sourceOffset?: number;
}) {
  const runs = typography?.runs ?? [];
  const boundaries = new Set([0, text.length]);
  runs.forEach((run) => {
    boundaries.add(Math.max(0, Math.min(text.length, run.start - sourceOffset)));
    boundaries.add(Math.max(0, Math.min(text.length, run.end - sourceOffset)));
  });
  const points = [...boundaries].sort((a, b) => a - b);
  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1]!;
    const run = runs.find((candidate) =>
      candidate.start <= start + sourceOffset && candidate.end >= end + sourceOffset,
    );
    const gradient = run?.fillCss?.includes("gradient") ? run.fillCss : undefined;
    return (
      <span
        key={`${start}-${end}`}
        style={{
          fontFamily: run?.fontFamily,
          fontStyle: run?.italic ? "italic" : run?.fontStyle,
          fontWeight: run?.fontWeight,
          fontSize: run?.fontSizeRatio ? `${run.fontSizeRatio}em` : undefined,
          color: gradient ? "transparent" : run?.color,
          backgroundImage: gradient,
          backgroundClip: gradient ? "text" : undefined,
          WebkitBackgroundClip: gradient ? "text" : undefined,
        }}
      >
        {text.slice(start, end)}
      </span>
    );
  });
}

export function BoardPreview({
  solution: s,
  content,
  width,
  extraKind = "empty",
  kv,
  logo,
  ctaStyle,
  badgeStyle,
  backgroundColor,
  className,
}: {
  solution: Solution;
  content: SolveContent;
  /** 预览显示宽度，px */
  width: number;
  extraKind?: ExtraKind;
  /** 第一阶段确认的主视觉组件；预览使用渲染图，写回仍保留组件引用。 */
  kv?: AssetRef;
  /** 这种语言及当前画幅实际使用的 Logo */
  logo?: AssetRef;
  ctaStyle?: { backgroundColor: string; backgroundImage?: string; textColor: string };
  badgeStyle?: BadgeStyle;
  /** 第一阶段确认的母版背景色，用于主视觉暗角向外自然延展。 */
  backgroundColor?: string;
  className?: string;
}) {
  const scale = width / s.board.w;
  const height = s.board.h * scale;
  const px = (real: number) => real * scale;
  const left = s.align === "left";
  const badgeAlignment = badgeStyle?.alignment ?? (s.badgeSide === "right" ? "right" : "left");
  const recipeLayer = (role: string) => s.resolvedLayers?.find((layer) => layer.role === role);
  const titleTypography = recipeLayer("title")?.typography;
  const subTypography = (recipeLayer("kicker") ?? recipeLayer("sub"))?.typography;
  const ctaLayer = recipeLayer("cta");
  const discTypography = recipeLayer("disc")?.typography;

  return (
    <div
      className={cn("relative overflow-hidden rounded-[var(--radius-sm)]", className)}
      style={{
        width,
        height,
        background: backgroundColor ?? "var(--art-bg)",
        color: "var(--art-fg)",
        // 预览是内容不是界面，字体锁死为通用无衬线，不跟随界面字体设置
        fontFamily: "var(--font-sans)",
      }}
      role="img"
      aria-label={`${s.board.w}×${s.board.h} 画板预览，版式 ${s.layout}`}
    >
      {/* 主视觉 */}
      {s.kv ? (
        <div
          style={{
            ...box(s.kv)!,
          }}
          className="flex items-center justify-center overflow-hidden"
        >
          {kv?.previewUrl ? (
            <img src={kv.previewUrl} alt={kv.name} className="size-full object-cover" />
          ) : (
            <span
              style={{ fontSize: Math.max(7, px(s.board.w * 0.026)) }}
              className="tracking-[0.2em] opacity-45 select-none"
            >
              KV
            </span>
          )}
        </div>
      ) : null}

      {/* 角标：钉角，不吃边距 */}
      {s.badge ? (
        <div
          style={{
            ...box(s.recipeTrace ? s.badge : {
              ...s.badge,
              x: badgeAlignment === "center"
                ? (1 - s.badge.w) / 2
                : badgeAlignment === "right"
                  ? 1 - s.badge.w
                  : 0,
            })!,
            background: badgeStyle?.backgroundColor ?? "var(--art-badge)",
            color: badgeStyle?.textColor,
            borderBottomLeftRadius: badgeAlignment === "center" || badgeAlignment === "right"
              ? Math.max(3, px(s.board.w * 0.018))
              : 0,
            borderBottomRightRadius: badgeAlignment === "center" || badgeAlignment === "left"
              ? Math.max(3, px(s.board.w * 0.018))
              : 0,
          }}
          className="flex items-center justify-center"
        >
          <span
            style={{ fontSize: Math.max(6, px(s.board.h * 0.032)) }}
            className="font-medium opacity-85 whitespace-nowrap px-1"
          >
            {content.badge}
          </span>
        </div>
      ) : null}

      {/* Logo */}
      {s.logo ? (
        <div style={box(s.logo)!} className={cn("flex items-center", left ? "justify-start" : "justify-center")}>
          <LogoPresetPreview asset={logo} className="h-full max-w-full justify-start" />
        </div>
      ) : null}

      {/* 副标题 */}
      {s.sub ? (
        <div
          style={{
            ...box(s.sub)!,
            fontSize: px(s.subPx),
            fontFamily: subTypography?.fontFamily,
            fontWeight: subTypography?.fontWeight,
            lineHeight: subTypography?.lineHeightToFontSize,
            color: subTypography?.color,
          }}
          className={cn("flex items-center whitespace-nowrap", left ? "justify-start" : "justify-center")}
        >
          <span><StyledText text={content.sub} typography={subTypography} /></span>
        </div>
      ) : null}

      {/* 主标题：逐行渲染，行由求解器决定，不交给 CSS 自动换行 */}
      {s.title ? (
        <div
          style={{
            ...box(s.title)!,
            fontSize: px(s.titlePx),
            lineHeight: titleTypography?.lineHeightToFontSize ?? 1.18,
            fontFamily: titleTypography?.fontFamily,
            fontWeight: titleTypography?.fontWeight,
            color: titleTypography?.color,
            letterSpacing: titleTypography?.letterSpacing == null
              ? undefined
              : px(titleTypography.letterSpacing),
          }}
          className={cn("flex flex-col justify-start font-bold", left ? "items-start" : "items-center")}
        >
          {s.titleLines.map((line, i) => {
            const sourceOffset = s.titleLines.slice(0, i).reduce((sum, previous) => sum + previous.length + 1, 0);
            return (
              <span
                key={i}
                className="whitespace-nowrap"
                style={{ fontSize: `${titleTypography?.lineFontSizeRatios?.[i] ?? 1}em` }}
              >
                <StyledText text={line} typography={titleTypography} sourceOffset={sourceOffset} />
              </span>
            );
          })}
        </div>
      ) : null}

      {/* 按钮 */}
      {s.cta ? (
        <div
          style={{
            ...box(s.cta)!,
            backgroundColor: ctaStyle?.backgroundColor ?? "var(--color-brand)",
            backgroundImage: ctaStyle?.backgroundImage,
            borderRadius: ctaLayer?.cornerRadius ? px(ctaLayer.cornerRadius) : Math.max(2, px(s.ctaPx * 0.42)),
            fontFamily: ctaLayer?.typography?.fontFamily,
          }}
          className="flex items-center justify-center"
        >
          <span
            style={{ fontSize: px(s.ctaPx), color: ctaStyle?.textColor ?? "#14100c" }}
            className="font-semibold whitespace-nowrap"
          >
            <StyledText text={s.ctaLabel} typography={ctaLayer?.typography} />
          </span>
        </div>
      ) : null}

      {/* 免责 */}
      {s.disc ? (
        <div
          style={{
            ...box(s.disc)!,
            fontSize: px(s.discPx),
            lineHeight: discTypography?.lineHeightToFontSize ?? 1.4,
            color: discTypography?.color ?? "var(--art-muted)",
            fontFamily: discTypography?.fontFamily,
          }}
          className={cn("overflow-hidden", left ? "text-left" : "text-center")}
        >
          <StyledText text={content.disclaimer} typography={discTypography} />
        </div>
      ) : null}

      {/* 新增元素：虚线占位，明示这是留给你自己放东西的格子 */}
      {s.extra ? (
        <div
          style={{
            ...box(s.extra)!,
            border: `${Math.max(1, px(s.board.w * 0.003))}px dashed var(--art-muted)`,
            borderRadius: Math.max(2, px(s.board.w * 0.01)),
          }}
          className="flex items-center justify-center"
        >
          <span
            style={{ fontSize: Math.max(6, px(s.board.w * 0.022)), color: "var(--art-muted)" }}
            className="select-none"
          >
            {EXTRA_KIND_META[extraKind].label}
          </span>
        </div>
      ) : null}
    </div>
  );
}
