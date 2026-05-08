export function splitCompetitorSummary(full: string): { base: string; comp: string } {
  const marker = "【竞品归纳】";
  const i = full.indexOf(marker);
  if (i >= 0) {
    return { base: full.slice(0, i).trim(), comp: full.slice(i + marker.length).trim() };
  }
  return { base: full.trim(), comp: "" };
}