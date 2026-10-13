"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Redo2, RotateCcw, Undo2 } from "lucide-react";
import {
  LANGS,
  NATIVE_APPS,
  NATIVE_H,
  NATIVE_ICONS,
  NATIVE_IMAGES,
  NATIVE_SKINS,
  NATIVE_STYLES,
  NATIVE_TEXT_ROLE_LABEL,
  NATIVE_W,
  buildNativeBoard,
  createNativeState,
  nativeAppUrl,
  nativeCopy1,
  nativeCopy2,
  nativeDefaultFontId,
  nativeFontId,
  nativeFontLocked,
  nativeFontOptions,
  nativeImageUrl,
  nativeScript,
  nativeTitleLimit,
  type Lang,
  type NativeAppId,
  type NativeBoard,
  type NativeCopy1,
  type NativeCopy2,
  type NativeFont,
  type NativeMeasure,
  type NativeNode,
  type NativeSkin,
  type NativeState,
  type NativeTextRole,
} from "@futu/domain";
import { Segmented } from "@/components/ui/segmented";
import { useScene, useStudio } from "@/lib/studio-store";
import { cn } from "@/lib/utils";
import { FontPicker } from "./font-picker";
import { Section } from "./scene-editor";

const INPUT = "h-8 w-full rounded-[4px] border border-[var(--app-line)] bg-[var(--app-field)] px-2.5 text-[10px] outline-none hover:border-[var(--app-line-strong)] focus:border-[var(--app-line-strong)]";
const SUB = "mb-1 flex items-center justify-between gap-2 text-[9px] text-[var(--app-text-4)]";
const TOOL = "flex h-6 items-center gap-1 rounded-[4px] px-1.5 text-[var(--app-text-3)] hover:bg-[var(--app-surface-3)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-35";
const GHOST = "h-6 rounded-[4px] px-2 text-[9px] text-[var(--app-text-3)] hover:bg-[var(--app-surface-2)] hover:text-[var(--app-text)] disabled:cursor-not-allowed disabled:opacity-35";

const cssFont = (font: NativeFont) => [font.face ? `"${font.face}"` : null, `"${font.family}"`, "sans-serif"].filter(Boolean).join(", ");

const DEFAULT_FACES = ["face-misans-regular", "face-misans-medium", "face-misans-demibold", "face-mplus1p-regular", "face-mplus1p-medium", "face-mplus1p-bold"];

/** 用 canvas 量单行宽度；字体加载完后 version 变化，触发重新检查。faces 为当前用到的字体，换字体后按需加载。 */
export function useNativeMeasure(faces: readonly string[] = []) {
  const [version, setVersion] = useState(0);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const key = [...new Set([...DEFAULT_FACES, ...faces])].sort().join("|");
  useEffect(() => {
    let alive = true;
    void Promise.all(key.split("|").map((face) => document.fonts.load(`40px "${face}"`).catch(() => []))).then(() => {
      if (alive) setVersion((value) => value + 1);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  const measure = useCallback<NativeMeasure>((text, style) => {
    const context = (canvas.current ??= document.createElement("canvas")).getContext("2d");
    if (!context || !text) return 0;
    context.font = `${style.size}px ${cssFont(style.font)}`;
    const chars = Array.from(text).length;
    return context.measureText(text).width + style.tracking * Math.max(0, chars - 1);
  }, []);
  return { measure, version };
}

function textStyle(node: Extract<NativeNode, { kind: "text" | "pill" | "link" }>): CSSProperties {
  return {
    fontFamily: cssFont(node.font),
    fontSize: node.size,
    lineHeight: `${node.lineHeight}px`,
    letterSpacing: node.tracking,
    color: node.color,
  };
}

function RunText({ text, runs }: { text: string; runs: Array<{ start: number; end: number; color: string }> }) {
  if (!runs.length) return <>{text}</>;
  const chars = Array.from(text);
  const parts: Array<{ text: string; color?: string }> = [];
  chars.forEach((char, index) => {
    const color = runs.find((run) => index >= run.start && index < run.end)?.color;
    const last = parts[parts.length - 1];
    if (last && last.color === color) last.text += char;
    else parts.push({ text: char, color });
  });
  return <>{parts.map((part, index) => <span key={index} style={part.color ? { color: part.color } : undefined}>{part.text}</span>)}</>;
}

/** 1080×225 原尺寸排版后整体缩放，与写入 Figma 的图元一一对应。 */
export function NativeBanner({ board, width, className }: { board: NativeBoard; width: number; className?: string }) {
  const scale = width / board.w;
  return (
    <div className={cn("relative shrink-0 overflow-hidden", className)} style={{ width, height: board.h * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ width: board.w, height: board.h, transform: `scale(${scale})`, background: board.background }}>
        {board.nodes.map((node, index) => {
          if (node.kind === "rect") return <div key={index} className="absolute" style={{ left: node.x, top: node.y, width: node.w, height: node.h, background: node.fill, borderRadius: node.radius }} />;
          if (node.kind === "svg" || node.kind === "image") {
            return <img key={index} src={node.url} alt="" draggable={false} className="absolute object-cover" style={{ left: node.x, top: node.y, width: node.w, height: node.h }} />;
          }
          if (node.kind === "text") {
            return (
              <div key={index} className={cn("absolute", node.wrap ? "whitespace-pre-wrap break-words" : "whitespace-nowrap")} style={{ left: node.x, top: node.y, ...(node.wrap ? { width: node.w } : {}), ...textStyle(node) }}>
                <RunText text={node.text} runs={node.runs} />
              </div>
            );
          }
          if (node.kind === "pill") {
            return (
              <div key={index} className="absolute flex items-center justify-center rounded-full" style={{ left: node.x, top: node.y, width: node.w, height: node.h, background: node.fill }}>
                <span className="whitespace-nowrap" style={{ ...textStyle(node), transform: node.dy ? `translateY(${node.dy}px)` : undefined }}>{node.text}</span>
              </div>
            );
          }
          return (
            <div key={index} className="absolute flex items-center whitespace-nowrap" style={{ left: node.x, top: node.y, height: node.lineHeight, ...textStyle(node) }}>
              {node.text}
              <img src={node.chevron.url} alt="" draggable={false} style={{ width: node.chevron.size, height: node.chevron.size }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** App 上线效果：空白截图上按真实位置叠 banner，圆角 24。 */
export function NativePhone({ board, app, width }: { board: NativeBoard; app: NativeAppId; width: number }) {
  const spec = NATIVE_APPS.find((item) => item.id === app) ?? NATIVE_APPS[0]!;
  const scale = width / spec.w;
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[6px]" style={{ width, height: spec.h * scale }}>
      <img src={nativeAppUrl(spec.id, board.skin)} alt="" draggable={false} className="absolute inset-0 size-full" />
      <div className="absolute overflow-hidden" style={{ left: spec.left * scale, top: spec.top * scale, borderRadius: 24 * scale }}>
        <NativeBanner board={board} width={NATIVE_W * scale} />
      </div>
    </div>
  );
}

const langName = (id: Lang) => LANGS.find((item) => item.id === id)?.name ?? id;

/** 仿原生的项目状态与写回；未编辑过时按默认模板。 */
export function useNative() {
  const { scene, updateScene } = useScene();
  const state = scene.native ?? createNativeState();
  const update = useCallback(
    (fn: (current: NativeState) => NativeState) => updateScene((current) => ({ ...current, native: fn(current.native ?? createNativeState()) })),
    [updateScene],
  );
  return { state, update };
}

/** 面板里的文本框；label 交给外层 Section 标题。 */
function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <input aria-label={label} value={value} placeholder={placeholder ?? `填写${label}`} onChange={(event) => onChange(event.target.value)} className={INPUT} />;
}

export function NativeEditor() {
  const { project, lang } = useStudio();
  const { undoScene, redoScene, canUndoScene, canRedoScene } = useScene();
  const { state, update } = useNative();
  const [app, setApp] = useState<NativeAppId>("moomoo");
  const langs = project.content.langs;
  const activeLang = langs.includes(lang) ? lang : langs[0]!;
  const faces = useMemo(
    () => NATIVE_STYLES.flatMap((item) => buildNativeBoard({ ...state, style: item.id }, "dark", activeLang).nodes.flatMap((node) => ("font" in node && node.font.face ? [node.font.face] : []))),
    [state, activeLang],
  );
  const { measure, version } = useNativeMeasure(faces);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoScene();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redoScene();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undoScene, redoScene]);

  const boards = useMemo(
    () => NATIVE_SKINS.map((skin) => buildNativeBoard(state, skin.id, activeLang, measure)),
    // version 变化代表字体加载完成，需要重新量宽度。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, activeLang, measure, version],
  );
  const issues = [...new Set(boards.flatMap((board) => board.issues))];
  const copy1 = nativeCopy1(state, activeLang);
  const copy2 = nativeCopy2(state, activeLang);
  const limit = nativeTitleLimit(activeLang);

  const set1 = (patch: Partial<NativeCopy1>) => update((current) => ({ ...current, copy1: { ...current.copy1, [activeLang]: { ...nativeCopy1(current, activeLang), ...patch } } }));
  const set2 = (patch: Partial<NativeCopy2>) => update((current) => ({ ...current, copy2: { ...current.copy2, [activeLang]: { ...nativeCopy2(current, activeLang), ...patch } } }));

  const script = nativeScript(activeLang);
  const setFont = (role: NativeTextRole, id: string | null) => update((current) => {
    const own = { ...current.fonts?.[role] };
    if (id) own[script] = id;
    else delete own[script];
    return { ...current, fonts: { ...current.fonts, [role]: own } };
  });
  const fontField = (role: NativeTextRole) => {
    const options = nativeFontOptions(activeLang);
    const id = nativeFontId(state, role, activeLang);
    if (!id || !options.length) return <div className="mt-3 text-[9px] text-[var(--app-text-4)]">字体 · Noto Sans Thai</div>;
    if (nativeFontLocked(role)) {
      const font = options.find((item) => item.id === id);
      return <div className="mt-1.5 text-[9px] text-[var(--app-text-4)]">字体按规范固定 · {font ? `${font.group} ${font.label}` : id}</div>;
    }
    return (
      <div className="mt-3">
        <div className={SUB}>
          <span>字体</span>
          {id !== nativeDefaultFontId(role, activeLang) ? (
            <button type="button" onClick={() => setFont(role, null)} className="flex items-center gap-1 text-[var(--app-text-3)] hover:text-[var(--app-text)]"><RotateCcw size={10} />恢复默认</button>
          ) : null}
        </div>
        <FontPicker label={`${NATIVE_TEXT_ROLE_LABEL[role]}字体`} value={id} options={options} onChange={(next) => setFont(role, next)} />
      </div>
    );
  };
  const markField = (value: string, onChange: (value: string) => void) => (
    <Section title="高亮文字" aside={value ? <button type="button" className={GHOST} onClick={() => onChange("")}>清空</button> : null}>
      <TextInput label="高亮文字" value={value} placeholder={`填写${state.style === "style-1" ? "主文案" : "文案"}中要高亮的文字`} onChange={onChange} />
      <div className="mt-1.5 flex items-center gap-1.5 text-[9px] leading-relaxed text-[var(--app-text-4)]">
        <span className="size-2 shrink-0 rounded-[2px] bg-[#FF6900]" />
        按规范，高亮文字统一使用品牌橙 #FF6900
      </div>
    </Section>
  );
  const titleLength = Array.from(copy2.title).length;

  return (
    <div className="flex h-full min-h-0">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[5px] border border-[var(--app-line)] bg-[#111317]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--app-line)] bg-[var(--app-surface-2)] px-3 py-2 text-[9px]">
          <span className="min-w-0 truncate text-[var(--app-text-3)]">
            仿原生 · <span className="tabular-nums text-[var(--app-text)]">{NATIVE_W}×{NATIVE_H}</span> · {NATIVE_STYLES.find((item) => item.id === state.style)?.name} · {langName(activeLang)}
          </span>
          <div className="flex shrink-0 items-center gap-0.5 whitespace-nowrap">
            <button type="button" aria-label="撤销" title="撤销（Ctrl+Z）" disabled={!canUndoScene} onClick={undoScene} className={TOOL}><Undo2 size={11} />撤销</button>
            <button type="button" aria-label="重做" title="重做（Ctrl+Shift+Z）" disabled={!canRedoScene} onClick={redoScene} className={TOOL}><Redo2 size={11} />重做</button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {boards.map((board) => (
              <div key={board.skin}>
                <div className="mb-1.5 text-[9px] text-[var(--app-text-4)]">{NATIVE_SKINS.find((item) => item.id === board.skin)?.name}</div>
                <FitBanner board={board} />
              </div>
            ))}
          </div>
          <div className="mb-2 mt-5 flex items-center justify-between">
            <span className="text-[10px] font-semibold">上线效果</span>
            <Segmented size="sm" value={app} onChange={setApp} options={NATIVE_APPS.map((item) => ({ id: item.id, label: item.name }))} />
          </div>
          <div className="flex flex-wrap justify-center gap-6 rounded-[5px] bg-[var(--app-surface-2)] p-5">
            {(["light", "dark"] as NativeSkin[]).map((skin) => (
              <NativePhone key={skin} board={boards.find((board) => board.skin === skin)!} app={app} width={240} />
            ))}
          </div>
        </div>
        <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--app-line)] px-3 py-2 text-[9px]">
          {issues.length
            ? issues.map((issue) => <span key={issue} className="text-[var(--warn-text)]">{issue}</span>)
            : <span className="text-[var(--app-text-4)]">检查通过</span>}
        </div>
      </section>

      <div className="w-3 shrink-0" />
      <aside className="flex min-h-0 w-[320px] shrink-0 flex-col overflow-y-auto border-l border-[var(--app-line)] pl-4 pr-1">
        <Section title="样式">
          <div className="space-y-2">
            {NATIVE_STYLES.map((item) => {
              const active = state.style === item.id;
              const preview = buildNativeBoard({ ...state, style: item.id }, "dark", activeLang);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => update((current) => ({ ...current, style: item.id }))}
                  className={cn("block w-full rounded-[5px] border p-2 text-left", active ? "border-[var(--app-line-strong)] bg-[var(--app-surface-2)]" : "border-[var(--app-line)] hover:border-[var(--app-line-strong)]")}
                >
                  <div className="mb-1.5 flex items-center justify-between text-[10px]">
                    <span className={active ? "text-[var(--app-text)]" : "text-[var(--app-text-3)]"}>{item.name}</span>
                    {active ? <span className="text-[9px] text-[var(--app-text-4)]">已选</span> : null}
                  </div>
                  <NativeBanner board={preview} width={278} className="rounded-[3px]" />
                </button>
              );
            })}
          </div>
        </Section>

        {state.style === "style-1" ? (
          <>
            <Section title="ICON">
              <div className="grid grid-cols-5 gap-1">
                {NATIVE_ICONS.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    title={icon.name}
                    onClick={() => update((current) => ({ ...current, icon: icon.id }))}
                    className={cn("flex flex-col items-center gap-1 rounded-[4px] border py-1.5 text-[9px]", state.icon === icon.id ? "border-[var(--app-line-strong)] bg-[var(--app-surface-2)] text-[var(--app-text)]" : "border-transparent text-[var(--app-text-4)] hover:bg-[var(--app-surface-2)]")}
                  >
                    <img src={icon.url} alt="" className="size-4" />
                    {icon.name}
                  </button>
                ))}
              </div>
            </Section>
            <Section title="主文案">
              <TextInput label="主文案" value={copy1.title} onChange={(value) => set1({ title: value })} />
              {fontField("s1-title")}
            </Section>
            <Section title="副文案">
              <TextInput label="副文案" value={copy1.subtitle} onChange={(value) => set1({ subtitle: value })} />
              {fontField("s1-subtitle")}
            </Section>
            {markField(copy1.mark, (mark) => set1({ mark }))}
            <Section title="按钮文案">
              <TextInput label="按钮文案" value={copy1.cta} onChange={(value) => set1({ cta: value })} />
              {fontField("s1-cta")}
            </Section>
          </>
        ) : (
          <>
            <Section
              title="文案"
              aside={activeLang === "en"
                ? <span className="text-[9px] text-[var(--app-text-4)]">最多两行</span>
                : limit ? <span className={cn("text-[9px] tabular-nums", titleLength > limit ? "text-[var(--warn-text)]" : "text-[var(--app-text-4)]")}>{titleLength}/{limit}</span> : null}
            >
              {activeLang === "en" ? (
                <textarea aria-label="文案" value={copy2.title} rows={2} placeholder="填写文案" onChange={(event) => set2({ title: event.target.value })} className={cn(INPUT, "h-auto resize-none py-2 leading-relaxed")} />
              ) : (
                <TextInput label="文案" value={copy2.title} onChange={(value) => set2({ title: value })} />
              )}
              {fontField("s2-title")}
            </Section>
            {markField(copy2.mark, (mark) => set2({ mark }))}
            <Section title="文字按钮">
              <TextInput label="文字按钮" value={copy2.cta} onChange={(value) => set2({ cta: value })} />
              {fontField("s2-cta")}
            </Section>
            <Section title="右侧配图">
              <div className="grid grid-cols-4 gap-1.5">
                {NATIVE_IMAGES.map((image) => (
                  <button
                    key={image.id}
                    type="button"
                    title={image.name}
                    onClick={() => update((current) => ({ ...current, image: image.id }))}
                    className={cn("overflow-hidden rounded-[4px] border bg-white", state.image === image.id ? "border-[var(--app-text)] ring-1 ring-[var(--app-text)]" : "border-[var(--app-line)] hover:border-[var(--app-line-strong)]")}
                  >
                    <img src={nativeImageUrl(image.id, "light")} alt={image.name} className="block aspect-[300/225] w-full" />
                  </button>
                ))}
              </div>
            </Section>
          </>
        )}
      </aside>
    </div>
  );
}

/** 按容器宽度铺满。 */
function FitBanner({ board }: { board: NativeBoard }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry!.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="w-full overflow-hidden rounded-[4px] border border-[var(--app-line-soft)]" style={{ aspectRatio: `${NATIVE_W} / ${NATIVE_H}` }}>
      {width ? <NativeBanner board={board} width={width} /> : null}
    </div>
  );
}
