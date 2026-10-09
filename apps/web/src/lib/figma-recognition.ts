import type { LayerRole } from "./recognize";

export type FigmaRecognizedNode = {
  id: string;
  name: string;
  type: string;
  order: number;
  bounds?: { x: number; y: number; w: number; h: number };
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
  children: FigmaRecognizedNode[];
};

export type FigmaRecognizedLayer = {
  id: string;
  /** Instance 指向的主组件 ID，用于关联独立识别的主视觉组件。 */
  componentId?: string;
  name: string;
  text: string;
  textNodes: Array<{
    id?: string;
    name?: string;
    order?: number;
    parentId?: string;
    parentName?: string;
    parentLayoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL";
    parentItemSpacing?: number;
    text: string;
    fontSize: number;
    fontWeight?: number;
    fontFamily?: string;
    lineHeightPx?: number;
    letterSpacing?: number;
    textAlignHorizontal?: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
    textAlignVertical?: "TOP" | "CENTER" | "BOTTOM";
    italic?: boolean;
    color?: string;
    fillCss?: string;
    styleRuns?: Array<{
      start: number;
      end: number;
      text: string;
      fontSize?: number;
      fontWeight?: number;
      fontFamily?: string;
      lineHeightPx?: number;
      letterSpacing?: number;
      italic?: boolean;
      color?: string;
      fillCss?: string;
    }>;
    bounds?: { x: number; y: number; w: number; h: number };
  }>;
  nodeType: string;
  role: LayerRole;
  suggestedRole: LayerRole;
  customRoleName?: string;
  reason: string;
  confidence: number;
  path: string[];
  previewUrl?: string;
  backgroundColor?: string;
  cornerRadius?: number;
  bounds?: { x: number; y: number; w: number; h: number };
  tree?: FigmaRecognizedNode;
};

export type FigmaRenderUnit = {
  id: string;
  ownerLayerId: string;
  name: string;
  nodeType: string;
  order: number;
  bounds?: { x: number; y: number; w: number; h: number };
  previewUrl?: string;
  textNodeIds: string[];
  text: string;
  background?: string;
  cornerRadius?: number;
};

export type FigmaRecognitionResult = {
  schemaVersion?: number;
  fileKey?: string;
  fileName: string;
  frame: {
    id: string;
    /** Component 使用自身 ID，Instance 使用其主组件 ID。 */
    componentId?: string;
    name: string;
    nodeType: string;
    width: number;
    height: number;
    layerCount: number;
    backgroundColor?: string;
  };
  previewUrl?: string;
  layers: FigmaRecognizedLayer[];
  /** 不重叠的嵌套渲染单元；自定义预览只替换命中的真实文字节点。 */
  renderUnits?: FigmaRenderUnit[];
  tree: Array<{ id: string; name: string; type: string; depth: number }>;
};
