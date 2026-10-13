import type { LibraryLogoPreset } from "@futu/domain";
import { comboLogoUrl } from "@/components/logo-preset-preview";

const ROOT = "/brand/presets";

function fileOf(preset: LibraryLogoPreset) {
  if (preset.includes("Nasdaq")) return comboLogoUrl(preset);
  const brand = preset.startsWith("moomoo") ? "moomoo" : "futu";
  const tone = preset.endsWith("White") ? "white" : preset.endsWith("Light") ? "light" : "dark";
  return `${ROOT}/${brand}-${tone}.svg`;
}

/** 返回可直接交给 figma.createNodeFromSvg 的 SVG 文本，失败返回 undefined（写入端退回组件或文字）。 */
export async function buildLogoSvg(preset: LibraryLogoPreset): Promise<string | undefined> {
  try {
    const response = await fetch(fileOf(preset));
    if (!response.ok) throw new Error(preset);
    return await response.text();
  } catch {
    return undefined;
  }
}
