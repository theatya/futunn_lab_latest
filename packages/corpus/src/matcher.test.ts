import { breaksForLineCount, recommendLayoutPresets } from "./matcher";

function equal(actual: unknown, expected: unknown): void {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
}

function deepEqual(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function ok(value: unknown): void {
  if (!value) throw new Error("Expected a truthy value");
}

const modules = {
  cta: true,
  badge: false,
  disclaimer: false,
  combinedLogo: false,
};

const english = recommendLayoutPresets({
  language: "en",
  board: { width: 1080, height: 225 },
  structure: "title-sub",
  mainTitleLines: 2,
  subTitleLines: 1,
  alignment: "left",
  modules,
});
equal(english[0]?.preset.id, "en-title-sub-left");
ok(english.length <= 3);

const traditional = recommendLayoutPresets({
  language: "tc",
  board: { width: 1080, height: 225 },
  structure: "title-sub",
  mainTitleLines: 2,
  subTitleLines: 1,
  alignment: "left",
  modules,
});
equal(traditional[0]?.preset.id, "zh-title-sub-left");

const badge = recommendLayoutPresets({
  language: "en",
  board: { width: 1080, height: 225 },
  structure: "title-sub",
  mainTitleLines: 1,
  subTitleLines: 1,
  alignment: "center",
  modules: { ...modules, badge: true },
});
equal(badge[0]?.preset.id, "en-badge");

deepEqual(
  recommendLayoutPresets({
    language: "ja",
    board: { width: 1080, height: 225 },
    structure: "single",
    mainTitleLines: 2,
    subTitleLines: 0,
    alignment: "center",
    modules,
  }),
  [],
);

deepEqual(breaksForLineCount(9, 3, []), [3, 6]);
deepEqual(breaksForLineCount(9, 3, [2, 5]), [2, 5]);

console.log("Corpus matcher tests passed.");
