export function splitCompetitorSummary(full: string): { base: string; comp: string } {
  const marker = "【竞品归纳】";
  const i = full.indexOf(marker);
  if (i >= 0) {
    return { base: full.slice(0, i).trim(), comp: full.slice(i + marker.length).trim() };
  }
  return { base: full.trim(), comp: "" };
}

/** 与后端 materialize 一致：白底图下标按张数取模，避免删图后越界。 */
export function normalizedRefWhiteIndex(ref: number, len: number): number {
  if (len <= 0) return 0;
  const n = Number(ref);
  const r = Number.isFinite(n) ? Math.trunc(n) : 0;
  return ((r % len) + len) % len;
}

/** 带鉴权头下载文件（结果图 / ZIP 等需 X-DashScope-Key 等）。 */
export async function downloadAuthenticatedFile(
  url: string,
  filename: string,
  headers: Record<string, string> = {},
): Promise<void> {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}