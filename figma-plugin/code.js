figma.showUI(__html__, { width: 390, height: 440, title: "Futu Banner Bridge" });

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
  const node = figma.createText();
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
  const node = figma.createText();
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

async function appendAsset(frame, asset, rect, fallbackLabel) {
  if (!rect || !asset) return;
  const box = at(rect, { w: frame.width, h: frame.height });
  try {
    const component = await sourceComponent(asset.id);
    const instance = component.createInstance();
    const scale = Math.min(box.w / instance.width, box.h / instance.height);
    instance.rescale(scale);
    instance.x = box.x + (box.w - instance.width) / 2;
    instance.y = box.y + (box.h - instance.height) / 2;
    frame.appendChild(instance);
  } catch {
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

async function writeResolvedRecipe(frame, plan, component) {
  const layers = plan.solution.resolvedLayers;
  if (!Array.isArray(layers) || layers.length === 0) return false;
  const board = plan.solution.board;
  const layer = (role) => layers.find((item) => item.role === role);

  const kvLayer = layer("kv");
  if (kvLayer) {
    const box = at(kvLayer.bounds, board);
    const instance = component.createInstance();
    const scale = Math.max(box.w / instance.width, box.h / instance.height);
    instance.rescale(scale);
    instance.x = box.x + (box.w - instance.width) / 2;
    instance.y = box.y + (box.h - instance.height) / 2;
    instance.name = kvLayer.name || "主视觉组件";
    frame.appendChild(instance);
  }

  const logoLayer = layer("logo");
  if (logoLayer && plan.logo) await appendAsset(frame, plan.logo, logoLayer.bounds, logoLayer.name || "Logo");

  const groupLayer = layer("titleGroup");
  const titleLayer = layer("title");
  const secondaryLayer = layer("kicker") || layer("sub");
  if (groupLayer && titleLayer) {
    const groupBox = at(groupLayer.bounds, board);
    const group = figma.createFrame();
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
    const button = figma.createFrame();
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
    const badge = figma.createFrame();
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

async function uploadedComponent(options, page) {
  const asset = options.visualComponent;
  const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(asset.previewUrl || "");
  if (!match) throw new Error("上传图片数据缺失，请回平台第一步重新上传。");
  const image = figma.createImage(figma.base64Decode(match[2]));
  const size = await image.getSizeAsync();
  const component = figma.createComponent();
  component.name = `主视觉 / ${asset.name}`;
  component.resize(size.width, size.height);
  component.fills = [];
  component.clipsContent = true;
  const base = figma.createRectangle();
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
      const rect = figma.createRectangle();
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
  const node = figma.createText();
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
  const node = figma.createNodeFromSvg(svg);
  node.name = name;
  if (node.width > 0) node.rescale(box.w / node.width);
  node.x = box.x;
  node.y = box.y;
  parent.appendChild(node);
}

/** 角标：底图 SVG + 文字（+ 财报季 moomoo 标），坐标全部相对角标外框。 */
async function createSceneBadge(layer) {
  const badge = layer.badge;
  const frame = figma.createFrame();
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
  const groupIds = new Set(scene.group ? scene.group.ids : []);
  // 标题组按图层顺序插回第一个成员所在的层级，主视觉可以在它上面。
  let groupIndex = -1;
  for (const layer of scene.layers) {
    if (layer.role === "visual") {
      const instance = component.createInstance();
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
          const rect = figma.createRectangle();
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
    if (layer.role === "logo") {
      if (plan.logoSvg) {
        const logo = figma.createNodeFromSvg(plan.logoSvg);
        logo.name = plan.logo ? plan.logo.name : "Logo";
        logo.rescale(layer.box.h / logo.height);
        logo.x = Math.round(layer.box.x);
        logo.y = Math.round(layer.box.y);
        frame.appendChild(logo);
      } else {
        const rect = { x: layer.box.x / scene.board.w, y: layer.box.y / scene.board.h, w: layer.box.w / scene.board.w, h: layer.box.h / scene.board.h };
        await appendAsset(frame, plan.logo, rect, "Logo");
      }
      continue;
    }
    if (layer.role === "cta" && layer.cta) {
      const button = figma.createFrame();
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
    if (groupIds.has(layer.id)) {
      if (groupIndex < 0) groupIndex = frame.children.length;
      continue;
    }
    const text = await createSceneText(layer, "#ffffff", (layer.lineHeight || 1.2) * 100);
    frame.appendChild(text);
    placeByAnchor(text, layer);
  }
  if (scene.group) {
    const counterAlign = scene.group.align === "left" ? "MIN" : scene.group.align === "center" ? "CENTER" : "MAX";
    const stackFrame = (name, spacing) => {
      const node = figma.createFrame();
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
    const texts = [];
    for (const id of scene.group.ids) {
      const layer = scene.layers.find((item) => item.id === id);
      if (layer) texts.push(await createSceneText(layer, "#ffffff", (layer.lineHeight || 1.2) * 100));
    }
    const gaps = scene.group.gaps && scene.group.gaps.length === texts.length - 1 ? scene.group.gaps : texts.slice(1).map(() => scene.group.gap);
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
    const group = nest(texts, gaps, "标题组");
    if (groupIndex >= 0) frame.insertChild(groupIndex, group);
    else frame.appendChild(group);
    placeByAnchor(group, { anchor: scene.group.anchor, align: scene.group.align });
  }
}

/** 仿原生文字：行高、字间距按 px；highlight 区间按字符下标换算成 UTF-16。 */
async function createNativeText(node) {
  const text = figma.createText();
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
  const node = figma.createNodeFromSvg(svg);
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
      const rect = figma.createRectangle();
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
      const rect = figma.createRectangle();
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
      const button = figma.createFrame();
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
      const link = figma.createFrame();
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

async function write(job) {
  const needsVisual = job.boards.some((plan) => !plan.native);
  const uploaded = needsVisual && job.options.visualComponent.source === "upload";
  const existing = needsVisual && !uploaded ? await sourceComponent(job.options.visualComponent.id) : null;
  const page = job.options.page === "new" ? figma.createPage() : figma.currentPage;
  if (job.options.page === "new") page.name = job.options.pageName;
  const component = needsVisual ? existing || await uploadedComponent(job.options, page) : null;
  const nodes = [];
  const createdFrames = [];
  const failures = [];
  const columns = job.options.arrange === "flat" ? 5 : 3;
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
      masters.set(id, master);
      const entry = nodes.find((item) => item.nodeId === sourceId);
      if (entry) entry.nodeId = master.id;
      const at = createdFrames.indexOf(source);
      if (at >= 0) createdFrames[at] = master;
    }
    const w = plan.solution.board.w;
    const h = plan.solution.board.h;
    frame.clipsContent = true;
    const instance = master.createInstance();
    instance.rescale(plan.linked.scale);
    instance.x = plan.linked.x;
    instance.y = 0;
    frame.appendChild(instance);
    const bar = figma.createRectangle();
    bar.name = "底部白条";
    bar.resize(w, plan.linked.bar);
    bar.x = 0;
    bar.y = h - plan.linked.bar;
    bar.fills = [solidPaint("#FFFFFF")];
    frame.appendChild(bar);
    if (plan.linked.logoSvg) {
      const logo = figma.createNodeFromSvg(plan.linked.logoSvg);
      logo.name = "闪屏底部logo";
      logo.rescale(plan.linked.logo.w / logo.width);
      logo.x = plan.linked.logo.x;
      logo.y = plan.linked.logo.y;
      frame.appendChild(logo);
    }
  };

  for (let index = 0; index < job.boards.length; index += 1) {
    const plan = job.boards[index];
    try {
      const frame = figma.createFrame();
      frame.name = plan.name;
      frame.resize(plan.native ? plan.native.w : plan.solution.board.w, plan.native ? plan.native.h : plan.solution.board.h);
      frame.x = (index % columns) * (frame.width + 160);
      frame.y = Math.floor(index / columns) * (frame.height + 160);
      frame.fills = [solidPaint(plan.backgroundColor)];
      page.appendChild(frame);

      if (plan.native) {
        await writeNative(frame, plan);
        nodes.push({ key: plan.key, lang: plan.lang, nodeId: frame.id, validated: false });
        createdFrames.push(frame);
        continue;
      }
      if (plan.linked) {
        await writeLinked(frame, plan);
        nodes.push({ key: plan.key, lang: plan.lang, nodeId: frame.id, validated: false });
        createdFrames.push(frame);
        continue;
      }
      framesByKey.set(`${plan.key}|${plan.lang}`, frame);

      const usedScene = Boolean(plan.scene);
      if (usedScene) await writeScene(frame, plan, component);
      const usedRecipe = usedScene || await writeResolvedRecipe(frame, plan, component);
      if (!usedRecipe) {
        if (plan.solution.kv) {
          const instance = component.createInstance();
          const box = at(plan.solution.kv, plan.solution.board);
          const scale = Math.min(box.w / instance.width, box.h / instance.height);
          instance.rescale(scale);
          instance.x = box.x + (box.w - instance.width) / 2;
          instance.y = box.y + (box.h - instance.height) / 2;
          frame.appendChild(instance);
        }
        await appendAsset(frame, plan.logo, plan.solution.logo, plan.logo?.name || "Logo");
        await addText(frame, plan.solution.titleLines.join("\n"), plan.solution.title, plan.solution.titlePx, "bold", "#ffffff");
        await addText(frame, plan.subLabel || "", plan.solution.sub, plan.solution.subPx, "regular", "#ffffff");
        if (plan.solution.cta) {
          const box = at(plan.solution.cta, plan.solution.board);
          const button = figma.createRectangle();
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
          const badge = figma.createRectangle();
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
      if (!usedScene) validateResolvedFrame(frame, plan);
      nodes.push({
        key: plan.key,
        lang: plan.lang,
        nodeId: frame.id,
        recipeId: plan.solution.recipeTrace?.recipeId,
        validated: Boolean(plan.solution.recipeTrace),
      });
      createdFrames.push(frame);
    } catch (error) {
      failures.push({ key: plan.key, lang: plan.lang, error: error instanceof Error ? error.message : String(error) });
    }
  }
  await figma.setCurrentPageAsync(page);
  page.selection = createdFrames;
  if (createdFrames.length) figma.viewport.scrollAndZoomIntoView(createdFrames);
  return { ok: failures.length === 0, nodes, failures };
}

figma.ui.onmessage = async (message) => {
  if (message.type !== "write") return;
  try {
    const result = await write(message.job);
    figma.ui.postMessage({ type: "completed", jobId: message.job.id, result });
  } catch (error) {
    figma.ui.postMessage({
      type: "failed",
      jobId: message.job.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
