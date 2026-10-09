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

async function write(job) {
  const component = await sourceComponent(job.options.visualComponent.id);
  const page = job.options.page === "new" ? figma.createPage() : figma.currentPage;
  if (job.options.page === "new") page.name = job.options.pageName;
  const nodes = [];
  const createdFrames = [];
  const failures = [];
  const columns = job.options.arrange === "flat" ? 5 : 3;

  for (let index = 0; index < job.boards.length; index += 1) {
    const plan = job.boards[index];
    try {
      const frame = figma.createFrame();
      frame.name = plan.name;
      frame.resize(plan.solution.board.w, plan.solution.board.h);
      frame.x = (index % columns) * (frame.width + 160);
      frame.y = Math.floor(index / columns) * (frame.height + 160);
      frame.fills = [solidPaint(plan.backgroundColor)];
      page.appendChild(frame);

      const usedRecipe = await writeResolvedRecipe(frame, plan, component);
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
      validateResolvedFrame(frame, plan);
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
