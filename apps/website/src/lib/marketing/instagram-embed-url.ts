/**
 * Normalize user-pasted Instagram URLs to a canonical permalink for embed.js.
 * Accepts posts, reels, and IGTV-style /tv/ paths.
 */
export function normalizeInstagramEmbedUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "instagram.com") return null;

  const m = url.pathname.match(/^\/(p|reel|tv)\/([^/?#]+)\/?/);
  if (!m) return null;
  return `https://www.instagram.com/${m[1]}/${m[2]}/`;
}

export function parseInstagramEmbedUrlsBlock(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    const n = normalizeInstagramEmbedUrl(line);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}
