export type MedicineCatalogEntry = {
  id: string;
  name: string;
  aliases: string[];
  form: string | null;
  strength: string | null;
  manufacturer: string | null;
  default_dosage: string | null;
  dosage_per_kg: string | null;
  default_frequency: string | null;
  default_duration: string | null;
  notes: string | null;
  is_active: boolean;
};

export type MedicineCatalogMatch = {
  entry: MedicineCatalogEntry;
  score: number;
  matchedText: string;
};

function squashTokens(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function sortTokens(value: string): string {
  return squashTokens(value)
    .split(" ")
    .filter(Boolean)
    .sort()
    .join(" ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i += 1) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0]![j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[a.length]![b.length]!;
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length, 1);
  return 1 - dist / maxLen;
}

export function normalizeMedicineQuery(value: string): string {
  return squashTokens(value);
}

export function medicineCatalogLabel(entry: MedicineCatalogEntry): string {
  const extras = [entry.strength, entry.form].filter(Boolean).join(" • ");
  return extras ? `${entry.name} (${extras})` : entry.name;
}

function candidateTexts(entry: MedicineCatalogEntry): string[] {
  const base = [
    entry.name,
    [entry.name, entry.strength].filter(Boolean).join(" "),
    [entry.name, entry.form].filter(Boolean).join(" "),
    [entry.name, entry.strength, entry.form].filter(Boolean).join(" "),
    ...entry.aliases,
  ];
  return Array.from(new Set(base.map(squashTokens).filter(Boolean)));
}

export function findBestMedicineCatalogMatch(
  rawValue: string,
  entries: MedicineCatalogEntry[],
): MedicineCatalogMatch | null {
  const query = squashTokens(rawValue);
  if (!query) return null;

  let best: MedicineCatalogMatch | null = null;
  const querySorted = sortTokens(query);

  for (const entry of entries) {
    if (!entry.is_active) continue;

    for (const candidate of candidateTexts(entry)) {
      let score = similarity(query, candidate);
      if (candidate === query) score = Math.max(score, 1.2);
      if (candidate.startsWith(query) || query.startsWith(candidate)) score = Math.max(score, 1.05);
      if (candidate.includes(query) || query.includes(candidate)) score = Math.max(score, 0.96);
      if (sortTokens(candidate) === querySorted) score = Math.max(score, 1.02);

      if (!best || score > best.score) {
        best = { entry, score, matchedText: candidate };
      }
    }
  }

  return best;
}

export function shouldAutoCorrectMedicine(match: MedicineCatalogMatch | null): boolean {
  if (!match) return false;
  return match.score >= 0.88;
}
