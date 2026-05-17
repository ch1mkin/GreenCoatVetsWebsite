export function normalizeHandwrittenOcrText(input: string) {
  return input
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function pickBestHandwrittenOcrText(candidates: string[]): string {
  const scores = new Map<string, number>();
  for (const raw of candidates) {
    const text = normalizeHandwrittenOcrText(raw);
    if (!text || text.length < 1) continue;
    const key = text.toLowerCase();
    const weight = text.length >= 2 ? 2 : 1;
    scores.set(key, (scores.get(key) ?? 0) + weight + Math.min(text.length, 40) * 0.05);
  }
  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return "";
  const bestKey = ranked[0]![0];
  return candidates.map((c) => normalizeHandwrittenOcrText(c)).find((c) => c.toLowerCase() === bestKey) ?? ranked[0]![0];
}
