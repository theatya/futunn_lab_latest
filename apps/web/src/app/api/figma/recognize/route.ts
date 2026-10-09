import { NextResponse } from "next/server";
import { parseFigmaUrl } from "@/lib/figma-link";
import type { FigmaRecognitionResult, FigmaRecognizedLayer, FigmaRecognizedNode, FigmaRenderUnit } from "@/lib/figma-recognition";
import type { LayerRole } from "@/lib/recognize";

type Bounds = { x: number; y: number; width: number; height: number };

type FigmaTextStyle = {
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  lineHeightPx?: number;
  letterSpacing?: number;
  textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
  textAlignVertical?: "TOP" | "CENTER" | "BOTTOM";
  italic?: boolean;
  fills?: FigmaNode["fills"];
};

type FigmaNode = {
  id: string;
  componentId?: string;
  name: string;
  type: string;
  characters?: string;
  style?: FigmaTextStyle;
  characterStyleOverrides?: number[];
  styleOverrideTable?: Record<string, FigmaTextStyle>;
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  counterAxisAlignItems?: "MIN" | "CENTER" | "MAX" | "BASELINE";
  primaryAxisSizingMode?: "FIXED" | "AUTO";
  counterAxisSizingMode?: "FIXED" | "AUTO";
  clipsContent?: boolean;
  visible?: boolean;
  fills?: Array<{
    type?: string;
    visible?: boolean;
    imageRef?: string;
    opacity?: number;
    color?: { r: number; g: number; b: number; a?: number };
    gradientStops?: Array<{ position: number; color: { r: number; g: number; b: number; a?: number } }>;
  }>;
  cornerRadius?: number;
  absoluteBoundingBox?: Bounds;
  children?: FigmaNode[];
};

type FlatNode = {
  node: FigmaNode;
  parent?: FigmaNode;
  path: string[];
  depth: number;
};

function flatten(root: FigmaNode): FlatNode[] {
  const result: FlatNode[] = [];
  const visit = (node: FigmaNode, parent: FigmaNode | undefined, path: string[], depth: number) => {
    result.push({ node, parent, path, depth });
    node.children?.forEach((child) => visit(child, node, [...path, child.name], depth + 1));
  };
  visit(root, undefined, [root.name], 0);
  return result;
}

function cssColor(color: { r: number; g: number; b: number; a?: number }, opacity = 1) {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${opacity * (color.a ?? 1)})`;
}

function solidColorFromFills(fills: FigmaNode["fills"]) {
  const fill = fills?.find((item) => item.visible !== false && item.type === "SOLID" && item.color);
  return fill?.color ? cssColor(fill.color, fill.opacity ?? 1) : undefined;
}

function fillCssFromFills(fills: FigmaNode["fills"]) {
  const fill = fills?.find((item) => item.visible !== false);
  if (!fill) return undefined;
  if (fill.type === "SOLID" && fill.color) return cssColor(fill.color, fill.opacity ?? 1);
  if (fill.type === "GRADIENT_LINEAR" && fill.gradientStops?.length) {
    const stops = fill.gradientStops
      .map((stop) => `${cssColor(stop.color, fill.opacity ?? 1)} ${Math.round(stop.position * 100)}%`)
      .join(", ");
    return `linear-gradient(90deg, ${stops})`;
  }
  return undefined;
}

function solidColorOf(node: FigmaNode) {
  return solidColorFromFills(node.fills);
}

function surfaceOf(node: FigmaNode): { color?: string; cornerRadius?: number } {
  const ownColor = node.type === "TEXT" ? undefined : solidColorOf(node);
  if (ownColor) return { color: ownColor, cornerRadius: node.cornerRadius };
  const candidates = (node.children ?? [])
    .filter((child) => child.visible !== false && child.type !== "TEXT" && solidColorOf(child))
    .sort((a, b) => {
      const areaA = (a.absoluteBoundingBox?.width ?? 0) * (a.absoluteBoundingBox?.height ?? 0);
      const areaB = (b.absoluteBoundingBox?.width ?? 0) * (b.absoluteBoundingBox?.height ?? 0);
      return areaB - areaA;
    });
  const surface = candidates[0];
  return surface ? { color: solidColorOf(surface), cornerRadius: surface.cornerRadius } : {};
}

function textNodesOf(node: FigmaNode, root: FigmaNode): FigmaRecognizedLayer["textNodes"] {
  const result: FigmaRecognizedLayer["textNodes"] = [];
  let order = 0;
  const visit = (current: FigmaNode, parent?: FigmaNode) => {
    if (current.visible === false) return;
    const text = current.characters?.trim();
    if (current.type === "TEXT" && text) {
      const sourceText = current.characters ?? text;
      const visibleStart = Math.max(0, sourceText.indexOf(text));
      const visibleEnd = visibleStart + text.length;
      const overrides = current.characterStyleOverrides ?? [];
      const styleRuns: NonNullable<FigmaRecognizedLayer["textNodes"][number]["styleRuns"]> = [];
      let runStart = 0;
      for (let index = 1; index <= sourceText.length; index += 1) {
        if (index < sourceText.length && (overrides[index] ?? 0) === (overrides[runStart] ?? 0)) continue;
        const override = current.styleOverrideTable?.[String(overrides[runStart] ?? 0)] ?? {};
        const style = { ...current.style, ...override };
        const clippedStart = Math.max(runStart, visibleStart);
        const clippedEnd = Math.min(index, visibleEnd);
        if (clippedStart < clippedEnd) {
          styleRuns.push({
            start: clippedStart - visibleStart,
            end: clippedEnd - visibleStart,
            text: sourceText.slice(clippedStart, clippedEnd),
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            fontFamily: style.fontFamily,
            lineHeightPx: style.lineHeightPx,
            letterSpacing: style.letterSpacing,
            italic: style.italic,
            color: solidColorFromFills(override.fills) ?? solidColorOf(current),
            fillCss: fillCssFromFills(override.fills) ?? fillCssFromFills(current.fills),
          });
        }
        runStart = index;
      }
      result.push({
        id: current.id,
        name: current.name,
        order: order++,
        parentId: parent?.id,
        parentName: parent?.name,
        parentLayoutMode: parent?.layoutMode,
        parentItemSpacing: parent?.itemSpacing,
        text,
        fontSize: current.style?.fontSize ?? 0,
        fontWeight: current.style?.fontWeight,
        fontFamily: current.style?.fontFamily,
        lineHeightPx: current.style?.lineHeightPx,
        letterSpacing: current.style?.letterSpacing,
        textAlignHorizontal: current.style?.textAlignHorizontal,
        textAlignVertical: current.style?.textAlignVertical,
        italic: current.style?.italic,
        color: solidColorOf(current),
        fillCss: fillCssFromFills(current.fills),
        styleRuns: styleRuns.length ? styleRuns : undefined,
        bounds: normalizedBounds(current, root),
      });
    }
    current.children?.forEach((child) => visit(child, current));
  };
  visit(node);
  return result;
}

function roleFromName(name: string): { role: LayerRole; reason: string; confidence: number } {
  const normalized = name.toLowerCase().replace(/[\s_-]+/g, "");
  if (/主视觉|keyvisual|^kv$|kv组件|visualcomponent/.test(normalized)) return { role: "kv", reason: "第一层名称命中主视觉组件", confidence: 0.99 };
  if (/logo|品牌标识|品牌logo|moomoo|futu|富途|牛牛/.test(normalized)) return { role: "logo", reason: "第一层名称命中 Logo", confidence: 0.99 };
  if (/免责|免责声明|disctext|disclaimer|legal|terms/.test(normalized)) return { role: "disc", reason: "第一层名称命中免责", confidence: 0.99 };
  if (/cta|button|btn|按钮/.test(normalized)) return { role: "cta", reason: "第一层名称命中按钮", confidence: 0.99 };
  if (/二维码|qrcode|qr码|qr$/.test(normalized)) return { role: "qrcode", reason: "第一层名称命中二维码", confidence: 0.99 };
  if (/标题组|titlegroup|headlinegroup/.test(normalized)) return { role: "titleGroup", reason: "第一层名称命中标题组", confidence: 0.99 };
  if (/副标题|subtitle|subhead|eyebrow|kicker/.test(normalized)) return { role: "sub", reason: "第一层名称命中副标题", confidence: 0.99 };
  if (/补充标题|supplementtitle|additionaltitle/.test(normalized)) return { role: "supplement", reason: "第一层名称命中补充标题", confidence: 0.99 };
  if (/主标题|headline|title/.test(normalized)) return { role: "title", reason: "第一层名称命中主标题", confidence: 0.99 };
  if (/角标|标签|badge|tag|label/.test(normalized)) return { role: "badge", reason: "第一层名称命中角标", confidence: 0.96 };
  return { role: "custom", reason: "名称未命中角色，请手动确认", confidence: 0.5 };
}

function normalizedBounds(node: FigmaNode, root: FigmaNode) {
  const box = node.absoluteBoundingBox;
  const frame = root.absoluteBoundingBox;
  if (!box || !frame || !frame.width || !frame.height) return undefined;
  return {
    x: (box.x - frame.x) / frame.width,
    y: (box.y - frame.y) / frame.height,
    w: box.width / frame.width,
    h: box.height / frame.height,
  };
}

function recognizedNodeTree(node: FigmaNode, root: FigmaNode, order = 0): FigmaRecognizedNode {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    order,
    bounds: normalizedBounds(node, root),
    layoutMode: node.layoutMode,
    itemSpacing: node.itemSpacing,
    paddingTop: node.paddingTop,
    paddingRight: node.paddingRight,
    paddingBottom: node.paddingBottom,
    paddingLeft: node.paddingLeft,
    primaryAxisAlignItems: node.primaryAxisAlignItems,
    counterAxisAlignItems: node.counterAxisAlignItems,
    primaryAxisSizingMode: node.primaryAxisSizingMode,
    counterAxisSizingMode: node.counterAxisSizingMode,
    clipsContent: node.clipsContent,
    children: (node.children ?? [])
      .filter((child) => child.visible !== false)
      .map((child, index) => recognizedNodeTree(child, root, index)),
  };
}

function recognizeLayers(root: FigmaNode, images?: Record<string, string | null>): FigmaRecognizedLayer[] {
  return (root.children ?? []).filter((node) => node.visible !== false).map((node) => {
    const surface = surfaceOf(node);
    const textNodes = textNodesOf(node, root);
    const namedAsHeading = textNodes.some((text) => /主标题|main\s*heading|headline/i.test(text.name ?? ""));
    const match = namedAsHeading && roleFromName(node.name).role === "custom"
      ? { role: "titleGroup" as const, reason: "内部文字层名称命中标题", confidence: 0.97 }
      : roleFromName(node.name);
    return {
      id: node.id,
      componentId: node.componentId,
      name: node.name,
      text: textNodes.map((item) => item.text).join(" ") || node.name,
      textNodes,
      nodeType: node.type,
      role: match.role,
      suggestedRole: match.role,
      reason: match.reason,
      confidence: match.confidence,
      path: [root.name, node.name],
      previewUrl: images?.[node.id] ?? undefined,
      backgroundColor: surface.color,
      cornerRadius: surface.cornerRadius,
      bounds: normalizedBounds(node, root),
      tree: recognizedNodeTree(node, root),
    };
  });
}

const ATOMIC_RENDER_ROLES = new Set<LayerRole>(["kv", "logo", "qrcode", "cta", "disc", "badge"]);

function containsVisibleText(node: FigmaNode): boolean {
  if (node.visible === false) return false;
  if (node.type === "TEXT" && Boolean(node.characters?.trim())) return true;
  return (node.children ?? []).some(containsVisibleText);
}

function buildRenderUnits(root: FigmaNode): FigmaRenderUnit[] {
  const units: FigmaRenderUnit[] = [];
  let order = 0;

  const pushImageUnit = (node: FigmaNode, ownerLayerId: string) => {
    const textNodes = textNodesOf(node, root);
    units.push({
      id: node.id,
      ownerLayerId,
      name: node.name,
      nodeType: node.type,
      order: order++,
      bounds: normalizedBounds(node, root),
      textNodeIds: textNodes.map((item) => item.id).filter((id): id is string => Boolean(id)),
      text: textNodes.map((item) => item.text).join(" "),
    });
  };

  const visit = (node: FigmaNode, ownerLayerId: string) => {
    if (node.visible === false) return;
    const children = (node.children ?? []).filter((child) => child.visible !== false);
    const containsText = containsVisibleText(node);
    const namedRole = roleFromName(node.name).role;
    const mustStayAtomic = ATOMIC_RENDER_ROLES.has(namedRole);

    if (node.type === "TEXT" || !containsText || !children.length || mustStayAtomic) {
      pushImageUnit(node, ownerLayerId);
      return;
    }

    const ownBackground = fillCssFromFills(node.fills);
    if (ownBackground) {
      units.push({
        id: `${node.id}::surface`,
        ownerLayerId,
        name: `${node.name} 背景`,
        nodeType: "SURFACE",
        order: order++,
        bounds: normalizedBounds(node, root),
        textNodeIds: [],
        text: "",
        background: ownBackground,
        cornerRadius: node.cornerRadius,
      });
    }
    children.forEach((child) => visit(child, ownerLayerId));
  };

  (root.children ?? [])
    .filter((node) => node.visible !== false)
    .forEach((node) => visit(node, node.id));
  return units;
}

async function figmaFetch<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "X-Figma-Token": token },
    cache: "no-store",
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(response.status === 403 ? "Figma Token 无权访问这个文件" : `Figma API ${response.status}: ${detail}`);
  }
  return response.json() as Promise<T>;
}

async function fetchNodeImages(fileKey: string, ids: string[], token: string) {
  const images: Record<string, string | null> = {};
  const uniqueIds = [...new Set(ids)];
  for (let index = 0; index < uniqueIds.length; index += 60) {
    const chunk = uniqueIds.slice(index, index + 60);
    const data = await figmaFetch<{ images?: Record<string, string | null> }>(
      `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(chunk.join(","))}&format=png&scale=2`,
      token,
    );
    Object.assign(images, data.images ?? {});
  }
  return images;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string; token?: string; target?: "frame" | "visual-component" };
    const parsed = parseFigmaUrl(body.url ?? "");
    if (!parsed.ok) return NextResponse.json({ error: parsed.reason }, { status: 400 });
    if (!parsed.nodeId) return NextResponse.json({ error: "请粘贴具体画板的链接，需要包含 node-id" }, { status: 400 });

    const token = body.token?.trim() || process.env.FIGMA_ACCESS_TOKEN;
    if (!token) return NextResponse.json({ error: "请先在右上角 API 配置中填写 Figma Access Token" }, { status: 401 });

    const nodeId = parsed.nodeId;
    const nodeData = await figmaFetch<{
      name: string;
      nodes: Record<string, { document?: FigmaNode }>;
    }>(
      `https://api.figma.com/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`,
      token,
    );
    const root = nodeData.nodes[nodeId]?.document;
    if (!root) {
      const targetName = body.target === "visual-component" ? "主视觉组件" : "画板";
      return NextResponse.json({ error: `没有找到这个${targetName}，请确认链接和 node-id` }, { status: 404 });
    }
    if (body.target === "visual-component" && root.type !== "COMPONENT" && root.type !== "INSTANCE") {
      return NextResponse.json(
        { error: "主视觉链接必须指向 Figma Component 或 Instance；普通 Frame、Group 和图片不能用于延展" },
        { status: 400 },
      );
    }
    if (body.target === "visual-component") {
      const images = await fetchNodeImages(parsed.fileKey, [nodeId], token);
      const box = root.absoluteBoundingBox;
      const result: FigmaRecognitionResult = {
        schemaVersion: 2,
        fileKey: parsed.fileKey,
        fileName: nodeData.name,
        frame: {
          id: root.id,
          componentId: root.type === "COMPONENT" ? root.id : root.componentId,
          name: root.name,
          nodeType: root.type,
          width: Math.round(box?.width ?? 0),
          height: Math.round(box?.height ?? 0),
          layerCount: root.children?.length ?? 0,
          backgroundColor: solidColorOf(root),
        },
        previewUrl: images[nodeId] ?? undefined,
        layers: [],
        renderUnits: [],
        tree: [{ id: root.id, name: root.name, type: root.type, depth: 0 }],
      };
      return NextResponse.json(result);
    }

    const flat = flatten(root);
    const renderUnits = buildRenderUnits(root);
    const renderIds = [
      nodeId,
      ...(root.children ?? []).filter((node) => node.visible !== false).map((node) => node.id),
      ...renderUnits.filter((unit) => !unit.background).map((unit) => unit.id),
    ];
    const images = await fetchNodeImages(parsed.fileKey, renderIds, token);
    const box = root.absoluteBoundingBox;
    const result: FigmaRecognitionResult = {
      schemaVersion: 2,
      fileKey: parsed.fileKey,
      fileName: nodeData.name,
      frame: {
        id: root.id,
        componentId: root.componentId,
        name: root.name,
        nodeType: root.type,
        width: Math.round(box?.width ?? 0),
        height: Math.round(box?.height ?? 0),
        layerCount: root.children?.length ?? 0,
        backgroundColor: solidColorOf(root),
      },
      previewUrl: images[nodeId] ?? undefined,
      layers: recognizeLayers(root, images),
      renderUnits: renderUnits.map((unit) => ({
        ...unit,
        previewUrl: unit.background ? undefined : images[unit.id] ?? undefined,
      })),
      tree: flat.slice(0, 80).map((item) => ({
        id: item.node.id,
        name: item.node.name,
        type: item.node.type,
        depth: item.depth,
      })),
    };
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "识别失败，请稍后重试" },
      { status: 500 },
    );
  }
}
