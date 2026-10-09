import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const corpusDir = join(root, "data", "corpus");
const manifest = JSON.parse(await readFile(join(corpusDir, "manifest.json"), "utf8"));
const validateOnly = process.argv.includes("--validate") || !process.env.FIGMA_ACCESS_TOKEN;
const token = process.env.FIGMA_ACCESS_TOKEN;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const snapshotDir = join(corpusDir, "snapshots", stamp);
const report = {
  schemaVersion: 1,
  corpusVersion: manifest.corpusVersion,
  startedAt: new Date().toISOString(),
  mode: validateOnly ? "validate" : "import",
  sources: [],
  errors: [],
};
const normalizedRecipes = [];

const checksum = (value) => createHash("sha256").update(value).digest("hex");

async function figma(path) {
  const response = await fetch(`https://api.figma.com/v1${path}`, {
    headers: { "X-Figma-Token": token },
  });
  if (!response.ok) throw new Error(`Figma ${response.status}: ${await response.text()}`);
  return response.json();
}

function directFrames(document) {
  return (document?.children ?? [])
    .filter((node) => node.type === "FRAME")
    .map((node) => ({
      id: node.id,
      name: node.name,
      width: Math.round(node.absoluteBoundingBox?.width ?? 0),
      height: Math.round(node.absoluteBoundingBox?.height ?? 0),
    }));
}

function walkNodes(root) {
  const result = [];
  const queue = [{ node: root, parentId: null, order: 0, effectiveVisible: root?.visible !== false }];
  while (queue.length) {
    const current = queue.shift();
    result.push(current);
    (current.node?.children ?? []).forEach((child, order) => {
      queue.push({
        node: child,
        parentId: current.node.id,
        order,
        effectiveVisible: current.effectiveVisible && child.visible !== false,
      });
    });
  }
  return result;
}

function normalizedBounds(node, root) {
  const box = node?.absoluteBoundingBox;
  const board = root?.absoluteBoundingBox;
  if (!box || !board?.width || !board?.height) return null;
  return {
    x: (box.x - board.x) / board.width,
    y: (box.y - board.y) / board.height,
    w: box.width / board.width,
    h: box.height / board.height,
  };
}

function recipeRole(name, type) {
  const value = String(name ?? "").toLowerCase().replace(/[\s_-]+/g, "");
  if (/主视觉|kv|visual/.test(value) && type === "INSTANCE") return "kv";
  if (/标题组|titlegroup|headlinegroup/.test(value)) return "titleGroup";
  if (/小标题|kicker|eyebrow/.test(value)) return "kicker";
  if (/副标题|subtitle|subhead/.test(value)) return "sub";
  if (/主标题|headline|title/.test(value)) return "title";
  if (/cta|button|按钮/.test(value)) return "cta";
  if (/角标|标签|badge|tag/.test(value)) return "badge";
  if (/免责|disclaimer|legal/.test(value)) return "disc";
  if (/logo|nasdaq|moomoo|futu|富途/.test(value)) return "logo";
  return null;
}

function paintCss(paints) {
  const paint = Array.isArray(paints) ? paints.find((item) => item.visible !== false) : null;
  if (!paint || paint.type !== "SOLID" || !paint.color) return undefined;
  const channel = (value) => Math.max(0, Math.min(255, Math.round((value ?? 0) * 255)))
    .toString(16).padStart(2, "0");
  const alpha = Math.max(0, Math.min(255, Math.round((paint.opacity ?? 1) * 255)));
  return `#${channel(paint.color.r)}${channel(paint.color.g)}${channel(paint.color.b)}${alpha < 255 ? channel(alpha / 255) : ""}`;
}

function textRuns(node) {
  const characters = node.characters ?? "";
  const overrides = node.characterStyleOverrides ?? [];
  const table = node.styleOverrideTable ?? {};
  if (!characters || !overrides.length) return [];
  const baseSize = node.style?.fontSize || 1;
  const runs = [];
  let start = 0;
  while (start < characters.length) {
    const styleId = String(overrides[start] ?? 0);
    let end = start + 1;
    while (end < characters.length && String(overrides[end] ?? 0) === styleId) end += 1;
    const style = { ...(node.style ?? {}), ...(table[styleId] ?? {}) };
    const postScript = style.fontPostScriptName ?? "";
    runs.push({
      start,
      end,
      fontFamily: style.fontFamily,
      fontStyle: postScript.split("-").at(-1),
      fontWeight: style.fontWeight,
      fontSizeRatio: style.fontSize ? style.fontSize / baseSize : 1,
      color: paintCss(style.fills ?? node.fills),
      italic: /italic|oblique/i.test(postScript),
    });
    start = end;
  }
  return runs;
}

function textAlign(value, fallback) {
  const normalized = String(value ?? "").toLowerCase();
  return ["left", "center", "top", "bottom"].includes(normalized) ? normalized : fallback;
}

function textAutoResize(value) {
  if (value === "WIDTH_AND_HEIGHT") return "width-and-height";
  if (value === "TRUNCATE") return "none";
  return String(value ?? "HEIGHT").toLowerCase();
}

function extractRecipes(document, source, capturedAt) {
  if (!document) return [];
  const candidates = walkNodes(document)
    .filter(({ node, effectiveVisible }) =>
      effectiveVisible
      && node.type === "FRAME"
      && Math.round(node.absoluteBoundingBox?.width ?? 0) === 1080
      && Math.round(node.absoluteBoundingBox?.height ?? 0) === 225
      && /^(单标题|标题组|复杂模块|繁体校验)/.test(node.name ?? ""),
    )
    .map(({ node }) => node);

  return candidates.map((frame) => {
    const nodes = walkNodes(frame);
    const layers = nodes.flatMap(({ node, parentId, order, effectiveVisible }) => {
      if (!effectiveVisible) return [];
      const role = recipeRole(node.name, node.type);
      const bounds = normalizedBounds(node, frame);
      if (!role || !bounds) return [];
      const style = node.style ?? {};
      return [{
        sourceNodeId: node.id,
        parentNodeId: parentId,
        order,
        role,
        name: node.name,
        type: node.type,
        visible: true,
        bounds,
        boundsPx: {
          x: bounds.x * 1080,
          y: bounds.y * 225,
          w: bounds.w * 1080,
          h: bounds.h * 225,
        },
        componentId: node.componentId,
        autoLayout: "layoutMode" in node ? {
          mode: node.layoutMode ?? "NONE",
          gapPx: node.itemSpacing ?? 0,
          paddingPx: {
            top: node.paddingTop ?? 0,
            right: node.paddingRight ?? 0,
            bottom: node.paddingBottom ?? 0,
            left: node.paddingLeft ?? 0,
          },
          primaryAlign: node.primaryAxisAlignItems ?? "MIN",
          counterAlign: node.counterAxisAlignItems ?? "MIN",
        } : undefined,
        typography: node.type === "TEXT" ? {
          characters: node.characters ?? "",
          fontFamily: style.fontFamily,
          fontStyle: String(style.fontPostScriptName ?? "").split("-").at(-1) || "Regular",
          fontWeight: style.fontWeight,
          fontSizePx: style.fontSize,
          fontSizeToBoardHeight: style.fontSize ? style.fontSize / 225 : undefined,
          lineHeightPx: style.lineHeightPx,
          lineHeightToFontSize: style.lineHeightPx && style.fontSize ? style.lineHeightPx / style.fontSize : undefined,
          letterSpacing: style.letterSpacing,
          alignHorizontal: textAlign(style.textAlignHorizontal, "left"),
          alignVertical: textAlign(style.textAlignVertical, "top"),
          autoResize: textAutoResize(node.style?.textAutoResize ?? node.textAutoResize),
          color: paintCss(node.fills),
          runs: textRuns(node),
        } : undefined,
      }];
    });
    return {
      schemaVersion: 1,
      corpusVersion: manifest.corpusVersion,
      id: frame.id,
      name: frame.name,
      source: {
        fileKey: source.fileKey,
        sectionNodeId: source.nodeId,
        frameNodeId: frame.id,
        capturedAt,
      },
      board: { width: 1080, height: 225, clipContent: frame.clipsContent !== false },
      layers,
    };
  });
}

await mkdir(join(corpusDir, "reports"), { recursive: true });

if (!validateOnly) {
  await mkdir(snapshotDir, { recursive: true });
  for (const source of manifest.sources) {
    try {
      if (source.scope === "all-pages") {
        const outline = await figma(`/files/${source.fileKey}?depth=1`);
        const pages = (outline.document?.children ?? []).filter((page) =>
          !(source.excludePageNameIncludes ?? []).some((marker) => page.name.includes(marker)),
        );
        const pageSummaries = [];
        for (const page of pages) {
          const payload = await figma(
            `/files/${source.fileKey}/nodes?ids=${encodeURIComponent(page.id)}&depth=6`,
          );
          const raw = JSON.stringify(payload, null, 2);
          await writeFile(join(snapshotDir, `${source.id}-${page.id.replace(":", "-")}.json`), raw);
          const document = payload.nodes?.[page.id]?.document;
          pageSummaries.push({
            id: page.id,
            name: page.name,
            frameCount: directFrames(document).length,
            checksum: checksum(raw),
          });
        }
        report.sources.push({ id: source.id, status: "saved", pages: pageSummaries });
        continue;
      }

      const payload = await figma(
        `/files/${source.fileKey}/nodes?ids=${encodeURIComponent(source.nodeId)}&depth=8`,
      );
      const raw = JSON.stringify(payload, null, 2);
      await writeFile(join(snapshotDir, `${source.id}.json`), raw);
      const document = payload.nodes?.[source.nodeId]?.document;
      if (source.id.startsWith("layout-")) {
        normalizedRecipes.push(...extractRecipes(document, source, report.startedAt));
      }
      report.sources.push({
        id: source.id,
        status: "saved",
        checksum: checksum(raw),
        directFrames: directFrames(document),
      });
    } catch (error) {
      report.errors.push({
        sourceId: source.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const normalizedPayload = {
    schemaVersion: 1,
    corpusVersion: manifest.corpusVersion,
    capturedAt: report.startedAt,
    recipeCount: normalizedRecipes.length,
    recipes: normalizedRecipes,
  };
  const normalizedRaw = `${JSON.stringify(normalizedPayload, null, 2)}\n`;
  await writeFile(join(snapshotDir, "normalized-recipes.json"), normalizedRaw);
  await writeFile(join(corpusDir, "normalized", "layout-recipes.latest.json"), normalizedRaw);
  await writeFile(
    join(root, "packages", "corpus", "src", "imported-recipes.ts"),
    `/* Generated by scripts/import-corpus.mjs. Do not edit. */\nexport const IMPORTED_RECIPES = ${JSON.stringify(normalizedRecipes, null, 2)} as const;\n`,
  );
} else {
  const runtime = await readFile(join(root, "packages", "corpus", "src", "generated.ts"), "utf8");
  const catalog = JSON.parse(await readFile(join(corpusDir, "normalized", "catalog.json"), "utf8"));
  const sourceIds = [...runtime.matchAll(/sourceNodeId:\s*"([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = sourceIds.filter((id, index) => sourceIds.indexOf(id) !== index);
  const recordCount = (exportName, nextExportName) => {
    const start = runtime.indexOf(`export const ${exportName}`);
    const end = nextExportName ? runtime.indexOf(`export const ${nextExportName}`, start) : runtime.length;
    if (start < 0 || end < 0) return -1;
    const section = runtime.slice(start, end);
    if (exportName === "BADGE_STYLE_PRESETS") {
      return [...section.matchAll(/\bbadge\("[^"]+"/g)].length;
    }
    return [...section.matchAll(/\{\s*id:\s*"[^"]+"/g)].length;
  };
  const actualCounts = {
    layoutPresets: recordCount("LAYOUT_PRESETS", "RESOURCE_SLOT_RULES"),
    ctaStyles: recordCount("CTA_STYLE_PRESETS", "BADGE_STYLE_PRESETS"),
    badgePresets: recordCount("BADGE_STYLE_PRESETS"),
  };
  const runtimeVersion = runtime.match(/CORPUS_VERSION\s*=\s*"([^"]+)"/)?.[1];
  report.sources = manifest.sources.map((source) => ({
    id: source.id,
    status: runtime.includes(source.nodeId ?? source.fileKey) ? "referenced" : "manifest-only",
  }));
  if (duplicateIds.length) {
    report.errors.push({ sourceId: "runtime", message: `重复 sourceNodeId: ${[...new Set(duplicateIds)].join(", ")}` });
  }
  for (const [key, actual] of Object.entries(actualCounts)) {
    if (catalog.counts[key] !== actual) {
      report.errors.push({
        sourceId: "catalog",
        message: `${key} 目录计数 ${catalog.counts[key]} 与运行时 ${actual} 不一致`,
      });
    }
  }
  if (runtimeVersion !== manifest.corpusVersion || catalog.corpusVersion !== manifest.corpusVersion) {
    report.errors.push({
      sourceId: "version",
      message: `语料版本不一致: manifest=${manifest.corpusVersion}, runtime=${runtimeVersion}, catalog=${catalog.corpusVersion}`,
    });
  }
}

report.finishedAt = new Date().toISOString();
report.ok = report.errors.length === 0;
const reportPath = join(corpusDir, "reports", `${stamp}-${report.mode}.json`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${report.ok ? "OK" : "FAILED"} ${reportPath}`);
if (!report.ok) process.exitCode = 1;
