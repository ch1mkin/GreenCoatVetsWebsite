/** Ensures image URLs from admin settings work in the browser (absolute https). */
export function resolveMarketingImageUrl(url: string | null | undefined): string {
  const trimmed = (url ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) return trimmed;
  if (trimmed.startsWith("/storage/")) return `${base}${trimmed}`;
  if (trimmed.startsWith("storage/")) return `${base}/${trimmed}`;
  return trimmed;
}
