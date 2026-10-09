import { tokenizeTitle, type Lang, type MasterLayoutFingerprint, type RecipeRole, type RecipeTextStructure } from "@futu/domain";
import type { FigmaRecognitionResult } from "./figma-recognition";
import type { LayerRole } from "./recognize";

function stableHash(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fp-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildMasterLayoutFingerprint(
  result: FigmaRecognitionResult,
  lang: Lang,
): MasterLayoutFingerprint {
  const layer = (role: LayerRole) => result.layers.find((item) => item.role === role);
  const titleGroup = layer("titleGroup");
  const sub = layer("sub");
  const groupNames = titleGroup?.textNodes.map((node) => node.name ?? "").join(" ") ?? "";
  const hasKicker = /小标题|kicker|eyebrow|前缀/i.test(groupNames);
  const hasNamedSub = /副标题|subtitle|subhead/i.test(groupNames);
  const namedTitleNodes = titleGroup?.textNodes.filter((node) =>
    /主标题|headline|main\s*(title|heading)|(^|[\s_-])(title|heading)($|[\s_-])/i.test(node.name ?? "")) ?? [];
  const namedSecondaryNodes = titleGroup?.textNodes.filter((node) =>
    /小标题|kicker|eyebrow|副标题|subtitle|subhead/i.test(node.name ?? "")) ?? [];
  const maxGroupFont = Math.max(0, ...(titleGroup?.textNodes.map((node) => node.fontSize) ?? []));
  const directTitleNodes = layer("title")?.textNodes ?? [];
  const directSubNodes = layer("sub")?.textNodes ?? [];
  const titleTextNodes = directTitleNodes.length
    ? directTitleNodes
    : namedTitleNodes.length
      ? namedTitleNodes
      : titleGroup?.textNodes.filter((node) => node.fontSize >= maxGroupFont * 0.9) ?? [];
  const secondaryTextNodes = directSubNodes.length
    ? directSubNodes
    : namedSecondaryNodes.length
      ? namedSecondaryNodes
      : titleGroup?.textNodes.filter((node) => !titleTextNodes.includes(node)) ?? [];
  const lineCountOf = (nodes: typeof titleTextNodes) => Math.max(0,
    nodes.flatMap((node) => node.text.split(/\r?\n/).filter(Boolean)).length);
  const structure: RecipeTextStructure = hasKicker
    ? (hasNamedSub ? "kicker-title-sub" : "kicker-title")
    : (sub || secondaryTextNodes.length > 0) ? "title-sub" : "single";
  const logo = layer("logo");
  const roles: Array<[LayerRole, RecipeRole]> = [
    ["titleGroup", "titleGroup"], ["title", "title"], ["sub", "sub"], ["cta", "cta"],
    ["badge", "badge"], ["disc", "disc"], ["logo", "logo"],
  ];
  const geometry = Object.fromEntries(
    roles.flatMap(([sourceRole, recipeRole]) => {
      const bounds = layer(sourceRole)?.bounds;
      return bounds ? [[recipeRole, bounds]] : [];
    }),
  );
  const firstText = (role: LayerRole) => layer(role)?.textNodes[0];
  const typeScale = Object.fromEntries(
    ([
      ["title", firstText("title") ?? titleGroup?.textNodes[0]],
      ["sub", firstText("sub") ?? titleGroup?.textNodes[1]],
      ["cta", firstText("cta")],
      ["disc", firstText("disc")],
    ] as const).flatMap(([role, node]) => node?.fontSize ? [[role, node.fontSize / result.frame.height]] : []),
  );
  const titleText = titleTextNodes.map((node) => node.text).join(" ");
  const subText = secondaryTextNodes.map((node) => node.text).join(" ");
  const signature = {
    schemaVersion: 1 as const,
    board: {
      width: result.frame.width,
      height: result.frame.height,
      aspect: result.frame.width / result.frame.height,
    },
    language: lang,
    structure,
    modules: {
      cta: Boolean(layer("cta")),
      badge: Boolean(layer("badge")),
      disclaimer: Boolean(layer("disc")),
      combinedLogo: Boolean(logo && /组合|combined|nasdaq|×|\bx\b/i.test(logo.name)),
    },
    mainTitleLines: Math.max(1, lineCountOf(titleTextNodes)),
    subTitleLines: hasKicker && !hasNamedSub ? 0 : lineCountOf(secondaryTextNodes),
    alignment: ((titleTextNodes[0]?.textAlignHorizontal ?? "LEFT") === "CENTER" ? "center" : "left") as "left" | "center",
    roleTopology: result.layers
      .filter((item) => item.role !== "skip" && item.role !== "custom")
      .map((item) => `board>${item.role}`),
    normalizedGeometry: geometry,
    relativeTypeScale: typeScale,
    autoLayoutSignature: result.layers.flatMap((item) =>
      item.tree?.layoutMode && item.tree.layoutMode !== "NONE" ? [`${item.role}:${item.tree.layoutMode}`] : []),
    componentIds: result.layers.flatMap((item) => item.componentId ? [item.componentId] : []),
    textDensity: {
      titleTokens: tokenizeTitle(titleText, lang).length,
      titleCharacters: titleText.length,
      subCharacters: subText.length,
      richTextRuns: titleTextNodes.reduce((sum, node) => sum + (node.styleRuns?.length ?? 0), 0),
    },
  };
  return { ...signature, hash: stableHash(signature) };
}
