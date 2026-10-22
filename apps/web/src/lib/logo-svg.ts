import type { LibraryLogoPreset } from "@futu/domain";
import { comboLogoUrl } from "@/components/logo-preset-preview";

const ROOT = "/brand/presets";
const LOGO_SOURCE_FILE_KEY = "33G7qGtDpdJXwg3UP0k47O";

export interface LogoComponentRef {
  fileKey: string;
  nodeId: string;
  key?: string;
}

const COMPONENTS: Partial<Record<LibraryLogoPreset, LogoComponentRef>> = {
  futuNasdaq: { fileKey: LOGO_SOURCE_FILE_KEY, nodeId: "7:7600", key: "d89aa74064cbfa6f19a3ac70024729fe05e52906" },
  moomooNasdaq: { fileKey: LOGO_SOURCE_FILE_KEY, nodeId: "7:7654", key: "e4f670214a50b51e141b9f2ee930d8afd4f24cbe" },
  futuNasdaqLight: { fileKey: LOGO_SOURCE_FILE_KEY, nodeId: "7:7632", key: "9b0b461e825865199a32d6707e2d3e86d3feb389" },
  moomooNasdaqLight: { fileKey: LOGO_SOURCE_FILE_KEY, nodeId: "7:7680", key: "08e6227bae1b4a4549f84ed2e402778bf2b0098d" },
};

const SPLASH_COMPONENTS = {
  futu: { fileKey: LOGO_SOURCE_FILE_KEY, nodeId: "427:266", key: "8739313d74627a99c28e997364fd6500f8d54eaa" },
  moomoo: { fileKey: LOGO_SOURCE_FILE_KEY, nodeId: "427:268", key: "0c4809fd1786ba23b3aca8dd27d452f068872ef7" },
} satisfies Record<"futu" | "moomoo", LogoComponentRef>;

function fileOf(preset: LibraryLogoPreset) {
  if (preset.includes("Nasdaq")) return comboLogoUrl(preset);
  const brand = preset.startsWith("moomoo") ? "moomoo" : "futu";
  const tone = preset.endsWith("White") ? "white" : preset.endsWith("Light") ? "light" : "dark";
  return `${ROOT}/${brand}-${tone}.svg`;
}

/** 返回可直接交给 figma.createNodeFromSvg 的 SVG 文本；失败时写入端仅尝试组件，不再退化成文字。 */
export async function buildLogoSvg(preset: LibraryLogoPreset, signal?: AbortSignal): Promise<string | undefined> {
  try {
    const response = await fetch(fileOf(preset), { signal });
    if (!response.ok) throw new Error(preset);
    return await response.text();
  } catch (cause) {
    if (signal?.aborted) throw cause;
    return undefined;
  }
}

export function logoComponentRef(preset: LibraryLogoPreset): LogoComponentRef | undefined {
  return COMPONENTS[preset];
}

export function splashLogoComponentRef(preset: LibraryLogoPreset): LogoComponentRef {
  return preset.startsWith("moomoo") ? SPLASH_COMPONENTS.moomoo : SPLASH_COMPONENTS.futu;
}
