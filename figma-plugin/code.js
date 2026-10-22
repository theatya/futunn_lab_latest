const PLUGIN_VERSION = "1.1.2";
const PAIRING_CODE_STORAGE_KEY = "futu-extend-platform-pairing-code";
const LEGACY_PAIRING_CODE_STORAGE_KEY = ["extend", "link-pairing-code"].join("");
const cancelledClaims = new Set();
let activeClaim = null;
let activeRun = null;

class WriteCancelledError extends Error {
  constructor() {
    super("写入已取消");
    this.name = "WriteCancelledError";
  }
}

function jobMarker(jobId, claimToken) {
  return claimToken ? `${jobId}:${claimToken}` : jobId;
}

function assertJobActive(job) {
  if (cancelledClaims.has(jobMarker(job.id, job.claimToken))) throw new WriteCancelledError();
}

function protectCreatedNode(node) {
  if (activeClaim && node && typeof node.setPluginData === "function") {
    node.setPluginData("futuWriteJob", activeClaim);
    if (activeRun) node.setPluginData("futuWriteRun", activeRun);
  }
  return node;
}

async function cleanupJobArtifacts(jobId, claimToken) {
  const exactMarker = claimToken ? jobMarker(jobId, claimToken) : null;
  const belongsToClaim = (node) => {
    const marker = node.getPluginData("futuWriteJob");
    return exactMarker ? marker === exactMarker : marker === jobId || marker.startsWith(`${jobId}:`);
  };
  const pages = [...figma.root.children];
  for (const page of pages) {
    await page.loadAsync();
    if (belongsToClaim(page)) {
      if (figma.currentPage === page) {
        const fallback = pages.find((candidate) => candidate !== page && candidate.parent);
        if (fallback) await figma.setCurrentPageAsync(fallback);
      }
      if (page.parent && figma.currentPage !== page) page.remove();
      continue;
    }
    for (const child of [...page.children]) {
      if (belongsToClaim(child) && child.parent) child.remove();
    }
  }
}

async function safelyCleanupJobArtifacts(jobId, claimToken) {
  try {
    await cleanupJobArtifacts(jobId, claimToken);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function cleanupRunArtifacts(runId) {
  if (!runId) return;
  const belongsToRun = (node) => node.getPluginData("futuWriteRun") === runId;
  const pages = [...figma.root.children];
  for (const page of pages) {
    await page.loadAsync();
    if (belongsToRun(page)) {
      if (figma.currentPage === page) {
        const fallback = pages.find((candidate) => candidate !== page && candidate.parent);
        if (fallback) await figma.setCurrentPageAsync(fallback);
      }
      if (page.parent && figma.currentPage !== page) page.remove();
      continue;
    }
    for (const child of [...page.children]) {
      if (belongsToRun(child) && child.parent) child.remove();
    }
  }
}

figma.showUI(__html__, { width: 390, height: 560, title: "FUTU 延展平台连接器" });
async function sendPluginContext() {
  let savedCode = "";
  try {
    let stored = await figma.clientStorage.getAsync(PAIRING_CODE_STORAGE_KEY);
    if (typeof stored !== "string" || !/^\d{5}$/.test(stored)) {
      stored = await figma.clientStorage.getAsync(LEGACY_PAIRING_CODE_STORAGE_KEY);
      if (typeof stored === "string" && /^\d{5}$/.test(stored)) {
        await figma.clientStorage.setAsync(PAIRING_CODE_STORAGE_KEY, stored);
        await figma.clientStorage.deleteAsync(LEGACY_PAIRING_CODE_STORAGE_KEY);
      }
    }
    if (typeof stored === "string" && /^\d{5}$/.test(stored)) savedCode = stored;
  } catch {
    // 存储读取失败不应阻止用户手动连接。
  }
  figma.ui.postMessage({
    type: "context",
    version: PLUGIN_VERSION,
    fileKey: figma.fileKey || "",
    fileName: figma.root.name,
    savedCode,
  });
}
void sendPluginContext();

function at(rect, board) {
  return {
    x: Math.round(rect.x * board.w),
    y: Math.round(rect.y * board.h),
    w: Math.max(1, Math.round(rect.w * board.w)),
    h: Math.max(1, Math.round(rect.h * board.h)),
  };
}

function solidPaint(value) {
  const hex = typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "0f1112";
  return {
    type: "SOLID",
    color: {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
    },
  };
}

function gradientPaint(value) {
  const colors = typeof value === "string" ? value.match(/#[0-9a-f]{6}/gi) : null;
  if (!colors || colors.length < 2) return null;
  return {
    type: "GRADIENT_LINEAR",
    gradientStops: colors.map((color, index) => ({
      position: index / (colors.length - 1),
      color: { ...solidPaint(color).color, a: 1 },
    })),
    gradientTransform: [[1, 0, 0], [0, 1, 0]],
  };
}

async function loadRecipeFont(typography, fallbackWeight) {
  const requested = typography
    ? { family: typography.fontFamily, style: typography.fontStyle || (typography.fontWeight >= 600 ? "Medium" : "Regular") }
    : { family: "Inter", style: fallbackWeight === "bold" ? "Bold" : "Regular" };
  try {
    await figma.loadFontAsync(requested);
    return requested;
  } catch {
    throw new Error(`缺少训练配方字体：${requested.family} ${requested.style}。请安装字体后重试。`);
  }
}

function applyTextPaint(node, color) {
  if (color) node.fills = [solidPaint(color)];
}

async function addStructuredText(parent, text, layer, board, offset) {
  if (!layer || !text) return null;
  const typography = layer.typography || {};
  const fontName = await loadRecipeFont(typography, typography.fontWeight >= 600 ? "bold" : "regular");
  const node = protectCreatedNode(figma.createText());
  node.name = layer.name || layer.role;
  node.fontName = fontName;
  node.fontSize = Math.max(8, typography.fontSizePx || 16);
  if (typography.lineHeightPx) node.lineHeight = { unit: "PIXELS", value: typography.lineHeightPx };
  if (typeof typography.letterSpacing === "number") node.letterSpacing = { unit: "PIXELS", value: typography.letterSpacing };
  node.textAlignHorizontal = typography.alignHorizontal === "center" ? "CENTER" : "LEFT";
  node.textAlignVertical = typography.alignVertical === "top" ? "TOP" : typography.alignVertical === "bottom" ? "BOTTOM" : "CENTER";
  node.characters = text;
  applyTextPaint(node, typography.color || "#ffffff");
  const box = at(layer.bounds, board);
  const insideAutoLayout = "layoutMode" in parent && parent.layoutMode !== "NONE";
  if (insideAutoLayout && (layer.role === "cta" || layer.role === "badge")) {
    node.textAutoResize = "WIDTH_AND_HEIGHT";
  } else {
    node.textAutoResize = typography.autoResize === "width-and-height" || typography.autoResize === "width"
      ? "WIDTH_AND_HEIGHT"
      : typography.autoResize === "none" ? "TRUNCATE" : "HEIGHT";
    node.resize(Math.max(1, box.w), Math.max(1, box.h));
    node.x = box.x - (offset?.x || 0);
    node.y = box.y - (offset?.y || 0);
  }
  if (Array.isArray(typography.lineFontSizeRatios)) {
    let offsetStart = 0;
    node.characters.split("\n").forEach((line, index) => {
      const ratio = typography.lineFontSizeRatios[index] || 1;
      const offsetEnd = offsetStart + line.length;
      if (offsetEnd > offsetStart && ratio !== 1) {
        node.setRangeFontSize(offsetStart, offsetEnd, node.fontSize * ratio);
      }
      offsetStart = offsetEnd + 1;
    });
  }
  for (const run of typography.runs || []) {
    const start = Math.max(0, Math.min(run.start, node.characters.length));
    const end = Math.max(start, Math.min(run.end, node.characters.length));
    if (start === end) continue;
    const runFont = await loadRecipeFont({
      fontFamily: run.fontFamily || typography.fontFamily,
      fontStyle: run.fontStyle || typography.fontStyle,
      fontWeight: run.fontWeight || typography.fontWeight,
    }, run.fontWeight >= 600 ? "bold" : "regular");
    node.setRangeFontName(start, end, runFont);
    if (run.fontSizeRatio) node.setRangeFontSize(start, end, node.fontSize * run.fontSizeRatio);
    if (run.color) node.setRangeFills(start, end, [solidPaint(run.color)]);
  }
  parent.appendChild(node);
  return node;
}

function configureAutoLayout(node, autoLayout) {
  if (!autoLayout || autoLayout.mode === "NONE") return;
  node.layoutMode = autoLayout.mode;
  node.itemSpacing = autoLayout.gapPx || 0;
  node.paddingTop = autoLayout.paddingPx?.top || 0;
  node.paddingRight = autoLayout.paddingPx?.right || 0;
  node.paddingBottom = autoLayout.paddingPx?.bottom || 0;
  node.paddingLeft = autoLayout.paddingPx?.left || 0;
  node.primaryAxisAlignItems = autoLayout.primaryAlign || "CENTER";
  node.counterAxisAlignItems = autoLayout.counterAlign === "BASELINE" ? "BASELINE" : autoLayout.counterAlign || "CENTER";
  try {
    if (autoLayout.sizingHorizontal && autoLayout.sizingHorizontal !== "FILL") {
      node.layoutSizingHorizontal = autoLayout.sizingHorizontal;
    }
    if (autoLayout.sizingVertical && autoLayout.sizingVertical !== "FILL") {
      node.layoutSizingVertical = autoLayout.sizingVertical;
    }
  } catch {
    // Top-level frames are not auto-layout children; their exact pixel size remains authoritative.
  }
}

async function addText(frame, text, rect, size, weight, color) {
  if (!rect || !text) return;
  const fontStyle = weight === "bold" ? "Bold" : "Regular";
  await figma.loadFontAsync({ family: "Inter", style: fontStyle });
  const node = protectCreatedNode(figma.createText());
  node.fontName = { family: "Inter", style: fontStyle };
  node.fontSize = Math.max(8, Math.round(size));
  node.characters = text;
  if (color) node.fills = [solidPaint(color)];
  const box = at(rect, { w: frame.width, h: frame.height });
  node.x = box.x;
  node.y = box.y;
  node.resize(box.w, Math.max(box.h, node.height));
  frame.appendChild(node);
}

async function appendAsset(frame, asset, rect, fallbackLabel, allowTextFallback = true) {
  if (!rect || !asset) return;
  const box = at(rect, { w: frame.width, h: frame.height });
  try {
    const component = await sourceComponent(asset.id);
    const instance = protectCreatedNode(component.createInstance());
    const scale = Math.min(box.w / instance.width, box.h / instance.height);
    instance.rescale(scale);
    instance.x = box.x + (box.w - instance.width) / 2;
    instance.y = box.y + (box.h - instance.height) / 2;
    frame.appendChild(instance);
  } catch {
    if (!allowTextFallback) {
      throw new Error(`Logo「${fallbackLabel || asset.name}」无法读取，请回平台重新选择。`);
    }
    await addText(frame, fallbackLabel || asset.name, rect, Math.max(10, box.h * 0.45), "bold", "#ffffff");
  }
}

async function sourceComponent(componentId) {
  const node = await figma.getNodeByIdAsync(componentId);
  if (!node) throw new Error("当前文件中找不到主视觉组件。请在包含该组件的 Figma 文件中运行插件。");
  if (node.type === "COMPONENT") return node;
  if (node.type === "INSTANCE") {
    const mainComponent = await node.getMainComponentAsync();
    if (mainComponent) return mainComponent;
  }
  throw new Error("主视觉链接不再指向 Component 或 Instance，请回平台重新识别。");
}

async function resolveLogoComponent(ref, asset) {
  if (ref?.fileKey === figma.fileKey && ref.nodeId) {
    try {
      return await sourceComponent(ref.nodeId);
    } catch {
      // 源文件内组件被删除或改型时，继续尝试组件 Key / SVG。
    }
  }
  if (ref?.key) {
    try {
      return await figma.importComponentByKeyAsync(ref.key);
    } catch {
      // 未发布或当前账号没有库权限时，稳定回退到 SVG。
    }
  }
  if (asset?.source === "figma" && asset.id) {
    try {
      return await sourceComponent(asset.id);
    } catch {
      // 用户识别的 Logo 组件失效时，仍可使用随任务传入的 SVG。
    }
  }
  return null;
}

function cleanSvgNode(svg, name) {
  const raw = protectCreatedNode(figma.createNodeFromSvg(svg));
  raw.name = name;
  if (!raw.children.length || !raw.parent) return raw;
  try {
    const parent = raw.parent;
    const index = parent.children.indexOf(raw);
    const vector = protectCreatedNode(figma.flatten([...raw.children], parent, index));
    vector.name = name;
    raw.remove();
    return vector;
  } catch {
    let index = 1;
    const pending = [...raw.children];
    while (pending.length) {
      const node = pending.shift();
      node.name = node.type === "VECTOR" ? `矢量 ${index}` : `Logo 图形 ${index}`;
      index += 1;
      if ("children" in node) pending.push(...node.children);
    }
    return raw;
  }
}

async function createLogoNode({ componentRef, svg, asset, name, box }) {
  const component = await resolveLogoComponent(componentRef, asset);
  const node = component
    ? protectCreatedNode(component.createInstance())
    : svg
      ? cleanSvgNode(svg, name)
      : null;
  if (!node) throw new Error(`Logo「${name}」缺少可用的组件或 SVG，请回平台重新选择。`);
  node.name = name;
  const scale = Math.min(box.w / node.width, box.h / node.height);
  node.rescale(scale);
  node.x = Math.round(box.x + (box.w - node.width) / 2);
  node.y = Math.round(box.y + (box.h - node.height) / 2);
  return node;
}

async function cloneCustomElement(source) {
  const node = await figma.getNodeByIdAsync(source.nodeId);
  if (!node) throw new Error(`当前文件中找不到自定义元素「${source.nodeId}」，请刷新源元素后重试。`);
  if (node.type === "COMPONENT") return protectCreatedNode(node.createInstance());
  if (!["RECTANGLE", "GROUP", "FRAME", "INSTANCE"].includes(node.type)) {
    throw new Error("自定义元素只支持矩形、Group、Frame、Component 或 Instance。");
  }
  return protectCreatedNode(node.clone());
}

async function createSceneModule(layer) {
  const custom = await cloneCustomElement(layer.module);
  custom.name = layer.name || "元素";
  // 用户链接到 Frame 时，以 Frame 外框作为元素边界；源文件里未裁切的越界子层不应跟着写入成品。
  if (custom.type === "FRAME") custom.clipsContent = true;
  if (layer.module.stretchable && typeof custom.resize === "function") {
    custom.resize(Math.max(1, layer.box.w), Math.max(1, layer.box.h));
  } else if (custom.width > 0) {
    custom.rescale(layer.box.w / custom.width);
  }
  return custom;
}

async function writeResolvedRecipe(frame, plan, component) {
  const layers = plan.solution.resolvedLayers;
  if (!Array.isArray(layers) || layers.length === 0) return false;
  const board = plan.solution.board;
  const layer = (role) => layers.find((item) => item.role === role);

  const kvLayer = layer("kv");
  if (kvLayer) {
    const box = at(kvLayer.bounds, board);
    const instance = protectCreatedNode(component.createInstance());
    const scale = Math.max(box.w / instance.width, box.h / instance.height);
    instance.rescale(scale);
    instance.x = box.x + (box.w - instance.width) / 2;
    instance.y = box.y + (box.h - instance.height) / 2;
    instance.name = kvLayer.name || "主视觉组件";
    frame.appendChild(instance);
  }

  const logoLayer = layer("logo");
  if (logoLayer && plan.logo) await appendAsset(frame, plan.logo, logoLayer.bounds, logoLayer.name || "Logo", false);

  const groupLayer = layer("titleGroup");
  const titleLayer = layer("title");
  const secondaryLayer = layer("kicker") || layer("sub");
  if (groupLayer && titleLayer) {
    const groupBox = at(groupLayer.bounds, board);
    const group = protectCreatedNode(figma.createFrame());
    group.name = groupLayer.name || "标题组";
    group.x = groupBox.x;
    group.y = groupBox.y;
    group.resize(groupBox.w, groupBox.h);
    group.fills = [];
    group.clipsContent = false;
    configureAutoLayout(group, groupLayer.autoLayout);
    frame.appendChild(group);
    const textLayers = [titleLayer, secondaryLayer].filter(Boolean).sort((a, b) => a.order - b.order);
    for (const textLayer of textLayers) {
      const value = textLayer.role === "title" ? plan.solution.titleLines.join("\n") : plan.subLabel || "";
      const textNode = await addStructuredText(group, value, textLayer, board, { x: groupBox.x, y: groupBox.y });
      if (textNode) textNode.layoutAlign = "STRETCH";
    }
  } else if (titleLayer) {
    await addStructuredText(frame, plan.solution.titleLines.join("\n"), titleLayer, board);
    if (secondaryLayer) await addStructuredText(frame, plan.subLabel || "", secondaryLayer, board);
  }

  const ctaLayer = layer("cta");
  if (ctaLayer && plan.solution.cta) {
    const box = at(plan.solution.cta, board);
    const button = protectCreatedNode(figma.createFrame());
    button.name = ctaLayer.name || "CTA";
    button.x = box.x;
    button.y = box.y;
    button.resize(box.w, box.h);
    button.cornerRadius = ctaLayer.cornerRadius || Math.min(box.h / 2, 20);
    button.fills = [gradientPaint(plan.ctaStyle?.backgroundImage) || solidPaint(plan.ctaStyle?.backgroundColor || ctaLayer.backgroundColor || "#ff6900")];
    configureAutoLayout(button, ctaLayer.autoLayout);
    frame.appendChild(button);
    await addStructuredText(button, plan.solution.ctaLabel, {
      ...ctaLayer,
      role: "cta",
      name: "CTA文案",
      typography: { ...ctaLayer.typography, color: plan.ctaStyle?.textColor || ctaLayer.typography?.color || "#ffffff" },
    }, board);
  }

  const badgeLayer = layer("badge");
  if (badgeLayer && plan.solution.badge) {
    const box = at(plan.solution.badge, board);
    const badge = protectCreatedNode(figma.createFrame());
    badge.name = badgeLayer.name || "角标";
    badge.x = box.x;
    badge.y = box.y;
    badge.resize(box.w, box.h);
    badge.cornerRadius = badgeLayer.cornerRadius || Math.min(box.h / 2, 18);
    badge.fills = [solidPaint(plan.badgeStyle?.backgroundColor || badgeLayer.backgroundColor || "#6f6259")];
    configureAutoLayout(badge, badgeLayer.autoLayout || {
      mode: "HORIZONTAL",
      gapPx: 0,
      paddingPx: { top: 8, right: 12, bottom: 8, left: 12 },
      primaryAlign: "CENTER",
      counterAlign: "CENTER",
    });
    frame.appendChild(badge);
    await addStructuredText(badge, plan.badgeLabel || "", {
      ...badgeLayer,
      role: "badge",
      name: "角标文案",
      typography: badgeLayer.typography || {
        fontFamily: plan.solution.resolvedLayers.find((item) => item.role === "title")?.typography?.fontFamily || "Inter",
        fontStyle: "Regular",
        fontWeight: 400,
        fontSizePx: Math.max(8, box.h * 0.34),
        alignHorizontal: "center",
        alignVertical: "center",
        color: plan.badgeStyle?.textColor || "#ffffff",
        runs: [],
      },
    }, board);
  }

  const discLayer = layer("disc");
  if (discLayer && plan.solution.disc) {
    await addStructuredText(frame, plan.disclaimerLabel || "", discLayer, board);
  }
  return true;
}

function validateResolvedFrame(frame, plan) {
  if (!plan.solution.recipeTrace) return;
  const layers = plan.solution.resolvedLayers || [];
  const required = layers
    .filter((layer) => ["titleGroup", "title", "cta", "kv"].includes(layer.role))
    .map((layer) => layer.role);
  const names = frame.children.map((node) => node.name.toLowerCase());
  if (required.includes("cta") && !names.some((name) => name.includes("cta"))) throw new Error("写回校验失败：缺少 CTA Auto Layout");
  if (required.includes("kv") && !frame.children.some((node) => node.type === "INSTANCE")) throw new Error("写回校验失败：主视觉不是组件实例");
  const group = frame.children.find((node) => node.name.includes("标题组"));
  if (required.includes("titleGroup") && (!group || !("layoutMode" in group) || group.layoutMode !== "VERTICAL")) {
    throw new Error("写回校验失败：标题组未保留垂直 Auto Layout");
  }
  const actualForRole = (role) => {
    if (role === "kv") return frame.children.find((node) => node.type === "INSTANCE" && node.name.includes("主视觉"));
    if (role === "titleGroup") return group;
    if (role === "cta") return frame.children.find((node) => node.name.includes("CTA"));
    if (role === "badge") return frame.children.find((node) => node.name.includes("角标"));
    if (role === "disc") return frame.children.find((node) => node.name.includes("免责"));
    return null;
  };
  for (const recipeLayer of layers.filter((item) => ["kv", "titleGroup", "cta", "badge", "disc"].includes(item.role))) {
    const actual = actualForRole(recipeLayer.role);
    if (!actual) continue;
    const expectedRect = recipeLayer.role === "cta" && plan.solution.cta ? plan.solution.cta : recipeLayer.bounds;
    const expected = at(expectedRect, plan.solution.board);
    const delta = Math.max(
      Math.abs(actual.x - expected.x),
      Math.abs(actual.y - expected.y),
      Math.abs(actual.width - expected.w),
      Math.abs(actual.height - expected.h),
    );
    if (delta > 2) throw new Error(`写回校验失败：${recipeLayer.name} 几何偏差 ${delta.toFixed(1)}px`);
  }
}

const FEATHER_RATIO = [0, 0.08, 0.14, 0.2];
const VERTICAL_GRADIENT = [[0, 1, 0], [-1, 0, 1]];
const HORIZONTAL_GRADIENT = [[1, 0, 0], [0, 1, 0]];

async function uploadedComponent(options, page, writeMarker) {
  const asset = options.visualComponent;
  const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(asset.previewUrl || "");
  if (!match) throw new Error("上传图片数据缺失，请回平台第一步重新上传。");
  const image = figma.createImage(figma.base64Decode(match[2]));
  const size = await image.getSizeAsync();
  const component = protectCreatedNode(figma.createComponent());
  component.setPluginData("futuWriteJob", writeMarker);
  component.name = `主视觉 / ${asset.name}`;
  component.resize(size.width, size.height);
  component.fills = [];
  component.clipsContent = true;
  const base = protectCreatedNode(figma.createRectangle());
  base.name = "底图";
  base.resize(size.width, size.height);
  base.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
  component.appendChild(base);

  const level = options.uploadFeather ? options.uploadFeather.level : 0;
  const ratio = FEATHER_RATIO[level] || 0;
  if (ratio > 0) {
    const t = Math.max(1, Math.round(Math.min(size.width, size.height) * ratio));
    const color = solidPaint(options.uploadFeather.color).color;
    const edges = [
      ["左侧过渡", 0, 0, t, size.height, HORIZONTAL_GRADIENT, true],
      ["右侧过渡", size.width - t, 0, t, size.height, HORIZONTAL_GRADIENT, false],
      ["顶部过渡", 0, 0, size.width, t, VERTICAL_GRADIENT, true],
      ["底部过渡", 0, size.height - t, size.width, t, VERTICAL_GRADIENT, false],
    ];
    for (const [name, x, y, w, h, transform, opaqueFirst] of edges) {
      const rect = protectCreatedNode(figma.createRectangle());
      rect.name = name;
      rect.x = x;
      rect.y = y;
      rect.resize(w, h);
      rect.fills = [{
        type: "GRADIENT_LINEAR",
        gradientTransform: transform,
        gradientStops: [
          { position: 0, color: { ...color, a: opaqueFirst ? 1 : 0 } },
          { position: 1, color: { ...color, a: opaqueFirst ? 0 : 1 } },
        ],
      }];
      component.appendChild(rect);
    }
  }
  page.appendChild(component);
  component.x = -size.width - 400;
  component.y = 0;
  return component;
}

let availableFonts = null;
const normalizeFontName = (value) => String(value || "").toLowerCase().replace(/[\s_-]/g, "");

async function loadSceneFont(layer) {
  const requested = { family: layer.fontFamily, style: layer.fontStyle };
  try {
    await figma.loadFontAsync(requested);
    return requested;
  } catch {
    // 本机字体名可能与规范名大小写、空格或连字符不同，按归一化名称再找一次。
  }
  if (!availableFonts) availableFonts = await figma.listAvailableFontsAsync();
  const family = normalizeFontName(requested.family);
  const style = normalizeFontName(requested.style);
  const sameFamily = availableFonts.filter((font) => normalizeFontName(font.fontName.family) === family);
  const match = sameFamily.find((font) => normalizeFontName(font.fontName.style) === style)
    || (sameFamily.length === 1 ? sameFamily[0] : null);
  if (!match) throw new Error(`缺少字体：${requested.family} ${requested.style}。请安装公司规范字体后重试。`);
  await figma.loadFontAsync(match.fontName);
  return match.fontName;
}

function placeByAnchor(node, layer) {
  const x = layer.align === "left"
    ? layer.anchor.x
    : layer.align === "center" ? layer.anchor.x - node.width / 2 : layer.anchor.x - node.width;
  node.x = Math.round(x);
  node.y = Math.round(layer.anchor.y - node.height / 2);
}

function figmaPaint(paint) {
  const opacity = typeof paint.opacity === "number" ? paint.opacity : 1;
  if (paint.type === "SOLID") return { ...solidPaint(paint.color), opacity };
  return {
    type: paint.type,
    opacity,
    gradientTransform: paint.transform,
    gradientStops: paint.stops.map((item) => ({ position: item.pos, color: { ...solidPaint(item.color).color, a: item.alpha } })),
  };
}

async function createSceneText(layer, fallbackColor, lineHeight) {
  const node = protectCreatedNode(figma.createText());
  node.name = layer.name;
  node.fontName = await loadSceneFont(layer);
  node.fontSize = Math.max(1, layer.fontPx);
  node.lineHeight = { value: lineHeight, unit: "PERCENT" };
  node.characters = layer.text;
  node.textAutoResize = "WIDTH_AND_HEIGHT";
  node.textAlignHorizontal = layer.align === "left" ? "LEFT" : layer.align === "center" ? "CENTER" : "RIGHT";
  const colors = layer.charColors || [];
  node.fills = [solidPaint(colors[0] || fallbackColor)];
  let offset = 0;
  let runStart = 0;
  let runColor = colors[0] || fallbackColor;
  Array.from(layer.text).forEach((character, index) => {
    const color = colors[index] || fallbackColor;
    if (color !== runColor) {
      if (offset > runStart) node.setRangeFills(runStart, offset, [solidPaint(runColor)]);
      runStart = offset;
      runColor = color;
    }
    offset += character.length;
  });
  if (offset > runStart) node.setRangeFills(runStart, offset, [solidPaint(runColor)]);
  const chars = Array.from(layer.text);
  const utf16 = (index) => chars.slice(0, index).join("").length;
  if (Array.isArray(layer.highlightRuns) && layer.highlightRuns.length) {
    for (const run of layer.highlightRuns) {
      const paints = (run.paints || []).map(figmaPaint);
      if (paints.length && run.end > run.start) node.setRangeFills(utf16(run.start), utf16(run.end), paints);
    }
  }
  if (Array.isArray(layer.fontRuns)) {
    for (const run of layer.fontRuns) {
      if (run.end <= run.start) continue;
      node.setRangeFontName(utf16(run.start), utf16(run.end), await loadSceneFont(run));
    }
  }
  if (layer.stroke && Array.isArray(layer.stroke.paints) && layer.stroke.paints.length) {
    node.strokes = layer.stroke.paints.map(figmaPaint);
    node.strokeWeight = Math.max(0.1, layer.stroke.weight);
    node.strokeAlign = layer.stroke.align || "OUTSIDE";
  }
  if (layer.letterSpacing) node.letterSpacing = { value: layer.letterSpacing, unit: "PIXELS" };
  if (Array.isArray(layer.lineFontPx)) {
    let start = 0;
    layer.text.split("\n").forEach((line, row) => {
      const size = layer.lineFontPx[row];
      if (line.length && size) node.setRangeFontSize(start, start + line.length, Math.max(1, size));
      const height = layer.lineHeightPx && layer.lineHeightPx[row];
      if (line.length && height) node.setRangeLineHeight(start, start + line.length, { value: height, unit: "PIXELS" });
      const spacing = layer.lineLetterSpacing && layer.lineLetterSpacing[row];
      if (line.length && typeof spacing === "number") node.setRangeLetterSpacing(start, start + line.length, { value: spacing, unit: "PIXELS" });
      start += line.length + 1;
    });
  }
  return node;
}

function overlayPaint(overlay) {
  const base = solidPaint(overlay.color).color;
  return {
    type: "GRADIENT_LINEAR",
    gradientStops: [
      { position: 0, color: { ...base, a: overlay.alpha } },
      { position: 1, color: { r: 1, g: 105 / 255, b: 0, a: 0 } },
    ],
    gradientTransform: [[1, 0, 0], [0, 1, 0]],
  };
}

function appendSvg(parent, svg, box, name) {
  if (!svg || !box) return;
  const node = protectCreatedNode(figma.createNodeFromSvg(svg));
  node.name = name;
  if (node.width > 0) node.rescale(box.w / node.width);
  node.x = box.x;
  node.y = box.y;
  parent.appendChild(node);
}

/** 角标：底图 SVG + 文字（+ 财报季 moomoo 标），坐标全部相对角标外框。 */
async function createSceneBadge(layer) {
  const badge = layer.badge;
  const frame = protectCreatedNode(figma.createFrame());
  frame.name = layer.name || "角标";
  frame.resize(Math.max(1, layer.box.w), Math.max(1, layer.box.h));
  frame.fills = [];
  frame.clipsContent = false;
  appendSvg(frame, badge.bgSvg, badge.bgBox, "底图");
  appendSvg(frame, badge.markSvg, badge.markBox, "moomoo");
  const text = await createSceneText({ ...layer, align: badge.textAlign, charColors: undefined }, badge.textColor, (layer.lineHeight || 1.2) * 100);
  if (badge.textOverlay) text.fills = [solidPaint(badge.textColor), overlayPaint(badge.textOverlay)];
  frame.appendChild(text);
  const x = badge.textAlign === "left" ? badge.textX : badge.textAlign === "center" ? badge.textX - text.width / 2 : badge.textX - text.width;
  const y = badge.textCy - text.height / 2;
  if (badge.skew) {
    const c = Math.tan((badge.skew * Math.PI) / 180);
    text.relativeTransform = [[1, c, x - (c * text.height) / 2], [0, 1, y]];
  } else {
    text.x = x;
    text.y = y;
  }
  frame.x = Math.round(layer.box.x);
  frame.y = Math.round(layer.box.y);
  return frame;
}

async function writeScene(frame, plan, component) {
  const scene = plan.scene;
  const groupedLayers = scene.group
    ? scene.group.stackIds
      .map((id) => scene.layers.find((item) => item.id === id))
      .filter((layer) => layer && (scene.group.ids.includes(layer.id) || layer.role === "module"))
    : [];
  const groupIds = new Set(groupedLayers.map((layer) => layer.id));
  const backdropIds = new Set(scene.layers
    .filter((layer) => layer.role === "module" && layer.module && layer.module.placementMode === "title-backdrop")
    .map((layer) => layer.id));
  // 标题组按图层顺序插回第一个成员所在的层级，主视觉可以在它上面。
  let groupIndex = -1;
  let backdropTopIndex = -1;
  for (const layer of scene.layers) {
    if (layer.role === "visual") {
      const instance = protectCreatedNode(component.createInstance());
      instance.name = "主视觉组件";
      instance.rescale(layer.box.w / instance.width);
      instance.x = Math.round(layer.box.x);
      instance.y = Math.round(layer.box.y);
      frame.appendChild(instance);
      if (scene.edgeFade) {
        const color = solidPaint(scene.background).color;
        const fade = Math.round(scene.edgeFade);
        const hex = String(scene.background).toUpperCase();
        for (const [name, x, opaqueFirst] of [["左侧过渡到底色", 0, true], ["右侧过渡到底色", scene.board.w - fade, false]]) {
          const rect = protectCreatedNode(figma.createRectangle());
          rect.name = `${name} ${hex}`;
          rect.x = x;
          rect.y = 0;
          rect.resize(fade, scene.board.h);
          rect.fills = [{
            type: "GRADIENT_LINEAR",
            gradientTransform: HORIZONTAL_GRADIENT,
            gradientStops: [
              { position: 0, color: { ...color, a: opaqueFirst ? 1 : 0 } },
              { position: 1, color: { ...color, a: opaqueFirst ? 0 : 1 } },
            ],
          }];
          frame.appendChild(rect);
        }
      }
      continue;
    }
    if (groupIds.has(layer.id)) {
      if (groupIndex < 0) groupIndex = frame.children.length;
      continue;
    }
    if (layer.role === "logo") {
      const logo = await createLogoNode({
        componentRef: plan.logoComponent,
        svg: plan.logoSvg,
        asset: plan.logo,
        name: plan.logo ? plan.logo.name : "Logo",
        box: layer.box,
      });
      frame.appendChild(logo);
      continue;
    }
    if (layer.role === "module" && layer.module) {
      const custom = await createSceneModule(layer);
      custom.x = Math.round(layer.box.x);
      custom.y = Math.round(layer.box.y);
      frame.appendChild(custom);
      /** 标题底层必须位于合并后的整个标题组下方，避免主/副标题被矩形覆盖。 */
      if (backdropIds.has(layer.id)) backdropTopIndex = frame.children.length;
      continue;
    }
    if (layer.role === "cta" && layer.cta) {
      const button = protectCreatedNode(figma.createFrame());
      button.name = "CTA";
      button.layoutMode = "HORIZONTAL";
      button.primaryAxisAlignItems = "CENTER";
      button.counterAxisAlignItems = "CENTER";
      button.paddingLeft = Math.round(layer.cta.paddingX);
      button.paddingRight = Math.round(layer.cta.paddingX);
      button.paddingTop = 0;
      button.paddingBottom = 0;
      button.cornerRadius = layer.box.h / 2;
      button.fills = Array.isArray(layer.cta.paints) && layer.cta.paints.length
        ? layer.cta.paints.map(figmaPaint)
        : [gradientPaint(layer.cta.backgroundImage) || solidPaint(layer.cta.backgroundColor)];
      const label = await createSceneText({ ...layer, charColors: undefined, stroke: undefined }, layer.cta.textColor, 100);
      button.appendChild(label);
      button.resize(Math.max(layer.cta.minWidth, layer.box.w), Math.round(layer.box.h));
      button.counterAxisSizingMode = "FIXED";
      if (layer.cta.fixedWidth) {
        button.primaryAxisSizingMode = "FIXED";
        button.resize(Math.round(layer.cta.fixedWidth), Math.round(layer.box.h));
      } else {
        button.primaryAxisSizingMode = "AUTO";
        try {
          button.minWidth = Math.round(layer.cta.minWidth);
          if (layer.cta.maxWidth) button.maxWidth = Math.round(layer.cta.maxWidth);
        } catch {
          // 旧版 Figma 不支持 minWidth / maxWidth 时保持 hug 宽度。
        }
      }
      frame.appendChild(button);
      placeByAnchor(button, layer);
      continue;
    }
    if (layer.role === "badge" && layer.badge) {
      frame.appendChild(await createSceneBadge(layer));
      continue;
    }
    const text = await createSceneText(layer, "#ffffff", (layer.lineHeight || 1.2) * 100);
    frame.appendChild(text);
    placeByAnchor(text, layer);
  }
  if (scene.group) {
    const counterAlign = scene.group.align === "left" ? "MIN" : scene.group.align === "center" ? "CENTER" : "MAX";
    const stackFrame = (name, spacing) => {
      const node = protectCreatedNode(figma.createFrame());
      node.name = name;
      node.layoutMode = "VERTICAL";
      node.primaryAxisSizingMode = "AUTO";
      node.counterAxisSizingMode = "AUTO";
      node.itemSpacing = Math.round(spacing);
      node.counterAxisAlignItems = counterAlign;
      node.fills = [];
      node.clipsContent = false;
      return node;
    };
    const nodes = [];
    for (const layer of groupedLayers) {
      if (layer.role === "module" && layer.module) nodes.push(await createSceneModule(layer));
      else nodes.push(await createSceneText(layer, "#ffffff", (layer.lineHeight || 1.2) * 100));
    }
    const gaps = groupedLayers.slice(1).map((layer, index) => layer.box.y - (groupedLayers[index].box.y + groupedLayers[index].box.h));
    // Auto Layout 只有统一间距；间距不同时把后面的层再包一层 Auto Layout。
    const nest = (nodes, spacings, name) => {
      const node = stackFrame(name, spacings[0] || 0);
      if (spacings.every((value) => Math.round(value) === Math.round(spacings[0] || 0))) {
        nodes.forEach((child) => node.appendChild(child));
        return node;
      }
      node.appendChild(nodes[0]);
      node.appendChild(nest(nodes.slice(1), spacings.slice(1), "标题组内层"));
      return node;
    };
    const group = nest(nodes, gaps, "标题组");
    const insertAt = Math.max(groupIndex, backdropTopIndex);
    if (insertAt >= 0) frame.insertChild(insertAt, group);
    else frame.appendChild(group);
    group.x = Math.round(Math.min(...groupedLayers.map((layer) => layer.box.x)));
    group.y = Math.round(Math.min(...groupedLayers.map((layer) => layer.box.y)));
  }
}

/** 仿原生文字：行高、字间距按 px；highlight 区间按字符下标换算成 UTF-16。 */
async function createNativeText(node) {
  const text = protectCreatedNode(figma.createText());
  text.name = node.name;
  text.fontName = await loadSceneFont({ fontFamily: node.font.family, fontStyle: node.font.style });
  text.fontSize = node.size;
  text.lineHeight = { unit: "PIXELS", value: node.lineHeight };
  if (node.tracking) text.letterSpacing = { unit: "PIXELS", value: node.tracking };
  text.characters = node.text;
  text.fills = [solidPaint(node.color)];
  const chars = Array.from(node.text);
  const utf16 = (index) => chars.slice(0, index).join("").length;
  for (const run of node.runs || []) {
    if (run.end > run.start) text.setRangeFills(utf16(run.start), utf16(run.end), [solidPaint(run.color)]);
  }
  if (node.wrap) {
    text.textAutoResize = "HEIGHT";
    text.resize(Math.max(1, node.w), text.height);
  } else {
    text.textAutoResize = "WIDTH_AND_HEIGHT";
  }
  return text;
}

function nativeSvg(assets, url, name, w) {
  const svg = assets[url];
  if (!svg) throw new Error(`缺少仿原生素材：${url}`);
  const node = protectCreatedNode(figma.createNodeFromSvg(svg));
  node.name = name;
  if (node.width > 0) node.rescale(w / node.width);
  return node;
}

async function writeNative(frame, plan) {
  const board = plan.native;
  const assets = board.assets || {};
  frame.clipsContent = true;
  for (const node of board.nodes) {
    if (node.kind === "rect") {
      const rect = protectCreatedNode(figma.createRectangle());
      rect.name = node.name;
      rect.resize(node.w, node.h);
      rect.x = node.x;
      rect.y = node.y;
      rect.fills = [solidPaint(node.fill)];
      if (node.radius) rect.cornerRadius = node.radius;
      frame.appendChild(rect);
    } else if (node.kind === "svg") {
      const svg = nativeSvg(assets, node.url, node.name, node.w);
      svg.x = node.x;
      svg.y = node.y;
      frame.appendChild(svg);
    } else if (node.kind === "image") {
      const data = assets[node.url];
      if (!data) throw new Error(`缺少仿原生配图：${node.url}`);
      const image = figma.createImage(figma.base64Decode(data));
      const rect = protectCreatedNode(figma.createRectangle());
      rect.name = node.name;
      rect.resize(node.w, node.h);
      rect.x = node.x;
      rect.y = node.y;
      rect.fills = [{ type: "IMAGE", imageHash: image.hash, scaleMode: "FILL" }];
      frame.appendChild(rect);
    } else if (node.kind === "text") {
      const text = await createNativeText(node);
      text.x = node.x;
      text.y = node.y;
      frame.appendChild(text);
    } else if (node.kind === "pill") {
      const button = protectCreatedNode(figma.createFrame());
      button.name = node.name;
      button.layoutMode = "HORIZONTAL";
      button.primaryAxisAlignItems = "CENTER";
      button.counterAxisAlignItems = "CENTER";
      button.primaryAxisSizingMode = "FIXED";
      button.counterAxisSizingMode = "FIXED";
      button.resize(node.w, node.h);
      button.cornerRadius = node.h / 2;
      button.paddingTop = Math.max(0, (node.dy || 0) * 2);
      button.fills = [solidPaint(node.fill)];
      button.appendChild(await createNativeText({ ...node, name: "按钮文案", runs: [], wrap: false }));
      button.x = node.x;
      button.y = node.y;
      frame.appendChild(button);
    } else if (node.kind === "link") {
      const link = protectCreatedNode(figma.createFrame());
      link.name = node.name;
      link.layoutMode = "HORIZONTAL";
      link.counterAxisAlignItems = "CENTER";
      link.primaryAxisSizingMode = "AUTO";
      link.counterAxisSizingMode = "AUTO";
      link.itemSpacing = 0;
      link.fills = [];
      link.clipsContent = false;
      link.appendChild(await createNativeText({ ...node, name: "按钮文案", runs: [], wrap: false }));
      link.appendChild(nativeSvg(assets, node.chevron.url, "箭头", node.chevron.size));
      link.x = node.x;
      link.y = node.y;
      frame.appendChild(link);
    }
  }
}

function uniquePageName(name) {
  const base = (name || "素材延展").trim() || "素材延展";
  const used = new Set(figma.root.children.map((page) => page.name));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base} (${index})`)) index += 1;
  return `${base} (${index})`;
}

function planSize(plan) {
  const width = plan.native ? plan.native.w : plan.solution.board.w;
  const height = plan.native ? plan.native.h : plan.solution.board.h;
  return { width, height, label: plan.figmaLayout?.size || `${width} × ${height}` };
}

const OUTPUT_CHANNEL_ORDER = ["站内", "官网", "站外", "线下", "仿原生", "自定义"];
const OUTPUT_LAYOUT_ORDER = ["landscape", "square", "portrait", "splash"];

function planLayoutGroup(plan) {
  const configured = plan.figmaLayout?.layoutGroup;
  if (OUTPUT_LAYOUT_ORDER.includes(configured)) return configured;
  if (plan.linked) return "splash";
  const size = planSize(plan);
  const ratio = size.width / size.height;
  if (ratio > 1.18) return "landscape";
  if (ratio < 0.82) return "portrait";
  return "square";
}

function planChannelCategory(plan) {
  const layout = plan.figmaLayout || {};
  const channel = OUTPUT_CHANNEL_ORDER.includes(layout.channel) ? layout.channel : "自定义";
  return {
    key: channel,
    label: channel,
  };
}

function groupedBy(items, keyOf, labelOf = keyOf) {
  const groups = new Map();
  for (const item of items) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, { label: labelOf(item), items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

async function loadCategoryLabelFont() {
  const candidates = [
    { family: "Microsoft YaHei", style: "Bold" },
    { family: "Noto Sans CJK SC", style: "Bold" },
    { family: "PingFang SC", style: "Semibold" },
    { family: "Inter", style: "Bold" },
  ];
  for (const font of candidates) {
    try {
      await figma.loadFontAsync(font);
      return font;
    } catch {
      // 尝试下一种覆盖中英日文字形的本机字体。
    }
  }
  throw new Error("缺少分类标签字体，请安装 Microsoft YaHei、Noto Sans CJK 或 Inter。");
}

async function createCategoryLabel(section, name, x, y, width) {
  const fontName = await loadCategoryLabelFont();
  const label = protectCreatedNode(figma.createFrame());
  label.name = name;
  label.layoutMode = "HORIZONTAL";
  label.primaryAxisSizingMode = "FIXED";
  label.counterAxisSizingMode = "FIXED";
  label.primaryAxisAlignItems = "CENTER";
  label.counterAxisAlignItems = "CENTER";
  label.paddingLeft = 0;
  label.paddingRight = 0;
  label.paddingTop = 0;
  label.paddingBottom = 0;
  label.fills = [solidPaint("#000000")];
  label.clipsContent = false;
  const text = protectCreatedNode(figma.createText());
  text.name = "标签文案";
  text.fontName = fontName;
  text.fontSize = 120;
  text.fills = [solidPaint("#FFFFFF")];
  text.characters = name;
  label.appendChild(text);
  label.resize(Math.max(1200, width), 295);
  section.appendChild(label);
  label.x = x;
  label.y = y;
  return label;
}

async function createOutputSection(page, name, categories, startX, writeMarker) {
  const PADDING = 160;
  const LABEL_HEIGHT = 295;
  const LABEL_TO_FRAMES = 96;
  const FRAME_GAP = 120;
  const FRAME_ROW_GAP = 140;
  const LAYOUT_GROUP_GAP = 220;
  const CATEGORY_ROW_GAP = 280;
  const DEFAULT_FRAMES_PER_ROW = 6;
  const SPLASH_FRAMES_PER_ROW = 9;
  const section = protectCreatedNode(figma.createSection());
  section.setPluginData("futuWriteJob", writeMarker);
  section.name = name;
  section.fills = [solidPaint("#4A4A4A")];
  page.appendChild(section);
  try {
    const layouts = [];
    for (const category of categories) {
      const slots = new Map();
      let y = LABEL_HEIGHT + LABEL_TO_FRAMES;
      let contentWidth = 0;
      const layoutGroups = OUTPUT_LAYOUT_ORDER
        .map((layoutGroup) => ({
          layoutGroup,
          items: category.items.filter((plan) => planLayoutGroup(plan) === layoutGroup),
        }))
        .filter((group) => group.items.length);
      for (let groupIndex = 0; groupIndex < layoutGroups.length; groupIndex += 1) {
        const group = layoutGroups[groupIndex];
        const rowLimit = group.layoutGroup === "splash" ? SPLASH_FRAMES_PER_ROW : DEFAULT_FRAMES_PER_ROW;
        for (let rowStart = 0; rowStart < group.items.length; rowStart += rowLimit) {
          const rowEnd = Math.min(group.items.length, rowStart + rowLimit);
          let x = 0;
          let rowHeight = 0;
          for (let index = rowStart; index < rowEnd; index += 1) {
            const plan = group.items[index];
            const size = planSize(plan);
            slots.set(plan, { x, y });
            x += size.width;
            if (index < rowEnd - 1) x += FRAME_GAP;
            rowHeight = Math.max(rowHeight, size.height);
          }
          contentWidth = Math.max(contentWidth, x);
          y += rowHeight;
          if (rowEnd < group.items.length) y += FRAME_ROW_GAP;
        }
        if (groupIndex < layoutGroups.length - 1) y += LAYOUT_GROUP_GAP;
      }
      contentWidth = Math.max(1200, contentWidth);
      const label = await createCategoryLabel(section, category.label, 0, 0, contentWidth);
      layouts.push({
        label,
        slots,
        width: contentWidth,
        height: y,
      });
    }

    const placements = new Map();
    let y = PADDING;
    let maxRight = PADDING;
    for (const layout of layouts) {
      const x = PADDING;
      layout.label.x = x;
      layout.label.y = y;
      for (const [plan, slot] of layout.slots) {
        placements.set(plan, { section, x: x + slot.x, y: y + slot.y });
      }
      maxRight = Math.max(maxRight, x + layout.width);
      y += layout.height + CATEGORY_ROW_GAP;
    }

    const width = Math.max(1600, maxRight + PADDING);
    const height = Math.max(600, y - CATEGORY_ROW_GAP + PADDING);
    if (typeof section.resizeWithoutConstraints === "function") section.resizeWithoutConstraints(width, height);
    else section.resize(width, height);
    section.x = startX;
    section.y = 0;
    return { section, placements };
  } catch (error) {
    section.remove();
    throw error;
  }
}

async function prepareOutputSections(page, plans, options, writeMarker, startX) {
  const projectName = options.sectionName || options.pageName || "素材延展";
  const language = plans[0]?.figmaLayout?.languageSection || plans[0]?.figmaLayout?.language || plans[0]?.lang || "当前版本";
  const categories = groupedBy(
    plans,
    (plan) => planChannelCategory(plan).key,
    (plan) => planChannelCategory(plan).label,
  ).sort((a, b) => {
    const indexOf = (label) => {
      const index = OUTPUT_CHANNEL_ORDER.indexOf(label);
      return index < 0 ? OUTPUT_CHANNEL_ORDER.length : index;
    };
    return indexOf(a.label) - indexOf(b.label);
  });
  const prepared = await createOutputSection(page, `${projectName}｜${language}`, categories, startX, writeMarker);
  return { sections: [prepared.section], placements: prepared.placements };
}

async function write(job) {
  assertJobActive(job);
  const writeMarker = jobMarker(job.id, job.claimToken);
  if (!figma.fileKey) {
    throw new Error("插件无法读取当前 Figma 文件标识，请重新导入最新版插件后重试。");
  }
  if (job.options.fileKey !== figma.fileKey) {
    throw new Error("当前插件打开的 Figma 文件与平台目标文件不一致，请切换到目标文件后重试。");
  }
  if (!job.options.targetNodeId || !(await figma.getNodeByIdAsync(job.options.targetNodeId))) {
    throw new Error("当前插件打开的 Figma 文件与平台目标链接不一致，请切换到目标文件后重试。");
  }
  if (job.options.replaceRun && job.options.runId) {
    await cleanupRunArtifacts(job.options.runId);
  }
  await cleanupJobArtifacts(job.id);
  assertJobActive(job);
  const needsVisual = job.boards.some((plan) => !plan.native);
  const uploaded = needsVisual && job.options.visualComponent.source === "upload";
  const existing = needsVisual && !uploaded ? await sourceComponent(job.options.visualComponent.id) : null;
  const page = job.options.page === "new" ? figma.createPage() : figma.currentPage;
  if (job.options.page === "new") {
    page.setPluginData("futuWriteJob", writeMarker);
    if (job.options.runId) page.setPluginData("futuWriteRun", job.options.runId);
    page.name = uniquePageName(job.options.pageName);
  }
  await page.loadAsync();
  const existingRight = page.children.reduce((right, node) => Math.max(right, node.x + node.width), 0);
  const component = needsVisual ? existing || await uploadedComponent(job.options, page, writeMarker) : null;
  assertJobActive(job);
  let sectionStartX = existingRight > 0 ? existingRight + 400 : 0;
  if (uploaded && component) {
    component.x = sectionStartX;
    component.y = 0;
    sectionStartX += component.width + 400;
  }
  const preparedOutput = await prepareOutputSections(page, job.boards, job.options, writeMarker, sectionStartX);
  const { sections, placements } = preparedOutput;
  const nodes = [];
  const createdItems = [];
  const failures = [];
  const framesByKey = new Map();
  const masters = new Map();

  // 闪屏设备尺寸：同语种母版画板转为组件，设备画板放实例按高度缩放居中裁切，底部加白条与闪屏 Logo。
  const writeLinked = async (frame, plan) => {
    const id = `${plan.linked.masterKey}|${plan.lang}`;
    let master = masters.get(id);
    if (!master) {
      const source = framesByKey.get(id);
      if (!source) throw new Error("缺少闪屏母版画板，请同时写入母版");
      const sourceId = source.id;
      master = figma.createComponentFromNode(source);
      master.setPluginData("futuWriteJob", writeMarker);
      masters.set(id, master);
      const entry = nodes.find((item) => item.nodeId === sourceId);
      if (entry) entry.nodeId = master.id;
      const at = createdItems.findIndex((item) => item.node === source);
      if (at >= 0) createdItems[at] = { ...createdItems[at], node: master };
    }
    const w = plan.solution.board.w;
    const h = plan.solution.board.h;
    frame.clipsContent = true;
    const instance = protectCreatedNode(master.createInstance());
    instance.rescale(plan.linked.scale);
    instance.x = plan.linked.x;
    instance.y = 0;
    frame.appendChild(instance);
    const bar = protectCreatedNode(figma.createRectangle());
    bar.name = "底部白条";
    bar.resize(w, plan.linked.bar);
    bar.x = 0;
    bar.y = h - plan.linked.bar;
    bar.fills = [solidPaint("#FFFFFF")];
    frame.appendChild(bar);
    if (plan.linked.logoSvg || plan.linked.logoComponent) {
      const logo = await createLogoNode({
        componentRef: plan.linked.logoComponent,
        svg: plan.linked.logoSvg,
        asset: plan.logo,
        name: "闪屏底部 Logo",
        box: plan.linked.logo,
      });
      frame.appendChild(logo);
    }
  };

  for (let index = 0; index < job.boards.length; index += 1) {
    assertJobActive(job);
    const plan = job.boards[index];
    let frame;
    try {
      const placement = placements.get(plan);
      if (!placement) throw new Error(`无法确定画板「${plan.name}」的 Section 位置`);
      frame = protectCreatedNode(figma.createFrame());
      frame.setPluginData("futuWriteJob", writeMarker);
      frame.name = plan.name;
      frame.resize(plan.native ? plan.native.w : plan.solution.board.w, plan.native ? plan.native.h : plan.solution.board.h);
      frame.fills = [solidPaint(plan.backgroundColor)];
      placement.section.appendChild(frame);
      frame.x = placement.x;
      frame.y = placement.y;

      if (plan.native) {
        await writeNative(frame, plan);
        assertJobActive(job);
        nodes.push({ key: plan.key, lang: plan.lang, nodeId: frame.id, validated: false });
        createdItems.push({ node: frame, plan });
        continue;
      }
      if (plan.linked) {
        await writeLinked(frame, plan);
        assertJobActive(job);
        nodes.push({ key: plan.key, lang: plan.lang, nodeId: frame.id, validated: false });
        createdItems.push({ node: frame, plan });
        continue;
      }
      framesByKey.set(`${plan.key}|${plan.lang}`, frame);

      const usedScene = Boolean(plan.scene);
      if (usedScene) await writeScene(frame, plan, component);
      const usedRecipe = usedScene || await writeResolvedRecipe(frame, plan, component);
      if (!usedRecipe) {
        if (plan.solution.kv) {
          const instance = protectCreatedNode(component.createInstance());
          const box = at(plan.solution.kv, plan.solution.board);
          const scale = Math.min(box.w / instance.width, box.h / instance.height);
          instance.rescale(scale);
          instance.x = box.x + (box.w - instance.width) / 2;
          instance.y = box.y + (box.h - instance.height) / 2;
          frame.appendChild(instance);
        }
        await appendAsset(frame, plan.logo, plan.solution.logo, plan.logo?.name || "Logo", false);
        await addText(frame, plan.solution.titleLines.join("\n"), plan.solution.title, plan.solution.titlePx, "bold", "#ffffff");
        await addText(frame, plan.subLabel || "", plan.solution.sub, plan.solution.subPx, "regular", "#ffffff");
        if (plan.solution.cta) {
          const box = at(plan.solution.cta, plan.solution.board);
          const button = protectCreatedNode(figma.createRectangle());
          button.name = "CTA";
          button.x = box.x;
          button.y = box.y;
          button.resize(box.w, box.h);
          button.cornerRadius = Math.min(box.h / 2, 20);
          button.fills = [solidPaint(plan.ctaStyle?.backgroundColor || "#ff6900")];
          frame.appendChild(button);
          await addText(frame, plan.solution.ctaLabel, plan.solution.cta, plan.solution.ctaPx, "bold", plan.ctaStyle?.textColor || "#ffffff");
        }
        if (plan.solution.badge) {
          const box = at(plan.solution.badge, plan.solution.board);
          const badge = protectCreatedNode(figma.createRectangle());
          badge.name = "Badge";
          badge.x = box.x;
          badge.y = box.y;
          badge.resize(box.w, box.h);
          badge.cornerRadius = Math.min(box.h / 2, 18);
          badge.fills = [solidPaint(plan.badgeStyle?.backgroundColor || "#6f6259")];
          frame.appendChild(badge);
          await addText(frame, plan.badgeLabel || "", plan.solution.badge, Math.max(8, box.h * 0.34), "regular", plan.badgeStyle?.textColor || "#ffffff");
        }
        await addText(frame, plan.disclaimerLabel || "", plan.solution.disc, plan.solution.discPx, "regular", "#8f949b");
      }
      assertJobActive(job);
      if (!usedScene) validateResolvedFrame(frame, plan);
      nodes.push({
        key: plan.key,
        lang: plan.lang,
        nodeId: frame.id,
        recipeId: plan.solution.recipeTrace?.recipeId,
        validated: Boolean(plan.solution.recipeTrace),
      });
      createdItems.push({ node: frame, plan });
    } catch (error) {
      if (frame?.parent) frame.remove();
      if (error instanceof WriteCancelledError) throw error;
      failures.push({ key: plan.key, lang: plan.lang, error: error instanceof Error ? error.message : String(error) });
    } finally {
      figma.ui.postMessage({
        type: "progress",
        jobId: job.id,
        claimToken: job.claimToken,
        completed: index + 1,
        total: job.boards.length,
      });
    }
  }
  assertJobActive(job);
  if (!createdItems.length) {
    if (uploaded && component?.parent) component.remove();
    if (job.options.page === "new" && page.parent) page.remove();
    return { ok: false, nodes: [], failures };
  }
  const createdFrames = createdItems.map((item) => item.node);
  assertJobActive(job);
  await figma.setCurrentPageAsync(page);
  page.selection = sections.length ? sections : createdFrames;
  if (sections.length) figma.viewport.scrollAndZoomIntoView(sections);
  else if (createdFrames.length) figma.viewport.scrollAndZoomIntoView(createdFrames);
  return { ok: failures.length === 0, nodes, failures };
}

figma.ui.onmessage = async (message) => {
  if (message.type === "save-pairing-code" && /^\d{5}$/.test(message.code || "")) {
    await figma.clientStorage.setAsync(PAIRING_CODE_STORAGE_KEY, message.code);
    return;
  }
  if (message.type === "clear-pairing-code") {
    await figma.clientStorage.deleteAsync(PAIRING_CODE_STORAGE_KEY);
    await figma.clientStorage.deleteAsync(LEGACY_PAIRING_CODE_STORAGE_KEY);
    return;
  }
  if (message.type === "open-platform") {
    figma.openExternal("http://localhost:3210");
    return;
  }
  if (message.type === "cancel" && message.jobId && message.claimToken) {
    const marker = jobMarker(message.jobId, message.claimToken);
    cancelledClaims.add(marker);
    if (activeClaim !== marker) {
      const cleanupError = await safelyCleanupJobArtifacts(message.jobId, message.claimToken);
      cancelledClaims.delete(marker);
      figma.ui.postMessage(cleanupError
        ? { type: "failed", jobId: message.jobId, claimToken: message.claimToken, error: `取消写入后清理失败：${cleanupError}` }
        : { type: "cancelled", jobId: message.jobId, claimToken: message.claimToken });
    }
    return;
  }
  if (message.type !== "write") return;
  if (activeClaim) {
    figma.ui.postMessage({ type: "failed", jobId: message.job.id, claimToken: message.job.claimToken, error: "连接器正在处理另一个写入任务" });
    return;
  }
  activeClaim = jobMarker(message.job.id, message.job.claimToken);
  activeRun = message.job.options?.runId || null;
  cancelledClaims.delete(activeClaim);
  try {
    figma.ui.postMessage({ type: "started", jobId: message.job.id, claimToken: message.job.claimToken, total: message.job.boards.length });
    const result = await write(message.job);
    assertJobActive(message.job);
    if (!result.nodes.length && result.failures.length) {
      throw new Error(`全部画板写入失败：${result.failures[0].error}`);
    }
    figma.ui.postMessage({ type: "completed", jobId: message.job.id, claimToken: message.job.claimToken, result });
  } catch (error) {
    const cleanupError = await safelyCleanupJobArtifacts(message.job.id, message.job.claimToken);
    if (error instanceof WriteCancelledError && !cleanupError) {
      figma.ui.postMessage({ type: "cancelled", jobId: message.job.id, claimToken: message.job.claimToken });
      return;
    }
    const primaryError = error instanceof Error ? error.message : String(error);
    figma.ui.postMessage({
      type: "failed",
      jobId: message.job.id,
      claimToken: message.job.claimToken,
      error: cleanupError ? `${primaryError}；回滚未完成：${cleanupError}` : primaryError,
    });
  } finally {
    const marker = jobMarker(message.job.id, message.job.claimToken);
    cancelledClaims.delete(marker);
    if (activeClaim === marker) {
      activeClaim = null;
      activeRun = null;
    }
  }
};
