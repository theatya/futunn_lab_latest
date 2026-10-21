/**
 * 设计师从 Figma 右键 Copy link 贴进来。
 * 现在只校验长得像官方链接，真正读节点要等 Figma 链路接通。
 */

export function parseFigmaUrl(raw: string):
  | { ok: true; url: string; name: string; fileKey: string; nodeId?: string }
  | { ok: false; reason: string } {
  const url = raw.trim();
  if (!url) return { ok: false, reason: "先贴一条 Figma 链接" };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "这不是一条完整链接" };
  }

  if (!/figma\.com$/i.test(parsed.hostname) && !/\.figma\.com$/i.test(parsed.hostname)) {
    return { ok: false, reason: "要贴 figma.com 的链接" };
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  const branch = parts[0] === "design" && parts[2] === "branch" ? parts[3] : undefined;
  const fileKey = branch ?? (parts[0] === "design" || parts[0] === "file" ? parts[1] : undefined);
  if (!fileKey) return { ok: false, reason: "链接里缺少 Figma 文件 ID" };
  const fileName = decodeURIComponent(branch ? parts[4] ?? branch : parts[2] ?? parts[1] ?? "Figma");
  const node = parsed.searchParams.get("node-id")?.replace("-", ":") ?? undefined;

  return {
    ok: true,
    url,
    name: fileName.replace(/-/g, " "),
    fileKey,
    nodeId: node ?? undefined,
  };
}
