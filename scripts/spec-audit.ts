/**
 * 全量规范体检：所有资源位 × 三语，用默认示例文案（含 Logo）排一遍，只列出有问题的资源位。
 * pnpm spec:audit            只看问题
 * pnpm spec:audit --all      连通过的也列
 * pnpm spec:audit --scene x.json   用项目里导出的 scene（文案、角标、字体、族调整）代替默认示例
 */
import { readFileSync } from "node:fs";
import { checkSceneBoard, createDefaultScene, type Lang, type SceneState } from "../packages/domain/src";
import { ALL_SIZES, slotBoardRef, slotKey, slotName } from "../packages/specs/src";

const LANGS: Lang[] = ["sc", "tc", "en"];
const LANG_NAME: Record<string, string> = { sc: "简", tc: "繁", en: "英" };
const showAll = process.argv.includes("--all");
const sceneFile = process.argv[process.argv.indexOf("--scene") + 1];

let scene: SceneState;
if (process.argv.includes("--scene") && sceneFile) {
  scene = JSON.parse(readFileSync(sceneFile, "utf8")) as SceneState;
} else {
  scene = createDefaultScene({});
  scene.elements = scene.elements.map((el) => (el.role === "logo" ? { ...el, visible: true } : el));
}

let failed = 0;
let passed = 0;
for (const item of ALL_SIZES) {
  if (item.native || item.linked) continue;
  const board = slotBoardRef({ key: slotKey(item), w: item.w, h: item.h, sizeId: item.id });
  const found = new Map<string, string[]>();
  for (const lang of LANGS) {
    for (const issue of checkSceneBoard(scene, board, lang)) {
      found.set(issue.text, [...(found.get(issue.text) ?? []), LANG_NAME[lang] ?? lang]);
    }
  }
  const head = `${item.w}×${item.h}  ${slotName(item)}  [${item.id}]${item.layout ? "" : "  · 规范未注明版式"}`;
  if (!found.size) {
    passed += 1;
    if (showAll) console.log(`✓ ${head}`);
    continue;
  }
  failed += 1;
  console.log(`✗ ${head}`);
  for (const [text, langs] of found) console.log(`    ${text}（${langs.join("/")}）`);
}
console.log(`\n共 ${passed + failed} 个资源位：通过 ${passed}，有问题 ${failed}`);
process.exitCode = failed ? 1 : 0;
