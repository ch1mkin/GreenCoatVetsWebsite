/**
 * Fetches recent Instagram post/reel permalinks via Meta Instagram Graph API.
 * Requires a Professional (Business or Creator) Instagram account linked to a Facebook Page,
 * plus a long-lived access token with instagram_basic (and related) permissions.
 *
 * @see https://developers.facebook.com/docs/instagram-api/reference/ig-user/media
 */

import { normalizeInstagramEmbedUrl } from "./instagram-embed-url";

export type InstagramGraphFetchResult =
  | { ok: true; permalinks: string[] }
  | { ok: false; message: string };

function clampLimit(n: number): number {
  if (!Number.isFinite(n)) return 12;
  return Math.min(Math.max(Math.floor(n), 1), 25);
}

/**
 * `userId` is the Instagram Business Account id (numeric string), not the @username.
 * Token: typically a long-lived Page access token that can access that IG user.
 */
export async function fetchInstagramMediaPermalinks(options: {
  userId: string;
  accessToken: string;
  limit?: number;
}): Promise<InstagramGraphFetchResult> {
  const version = process.env.INSTAGRAM_GRAPH_API_VERSION?.trim() || "v21.0";
  const base =
    process.env.INSTAGRAM_GRAPH_BASE_URL?.replace(/\/$/, "") ||
    `https://graph.facebook.com/${version}`;

  const limit = clampLimit(
    options.limit ?? (Number(process.env.INSTAGRAM_EMBED_FETCH_LIMIT) || 12),
  );
  const url = new URL(`${base}/${encodeURIComponent(options.userId)}/media`);
  url.searchParams.set("fields", "permalink");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", options.accessToken);

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, message: `Instagram Graph request failed: ${msg}` };
  }

  const json = (await res.json()) as {
    data?: Array<{ permalink?: string }>;
    error?: { message?: string; type?: string };
  };

  if (!res.ok || json.error) {
    const detail = json.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, message: detail };
  }

  const seen = new Set<string>();
  const permalinks: string[] = [];
  for (const row of json.data ?? []) {
    const p = typeof row.permalink === "string" ? row.permalink.trim() : "";
    const canonical = p ? normalizeInstagramEmbedUrl(p) : null;
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      permalinks.push(canonical);
    }
  }

  return { ok: true, permalinks };
}

export function getInstagramGraphEnv(): { userId: string; accessToken: string } | null {
  const userId = process.env.INSTAGRAM_USER_ID?.trim();
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!userId || !accessToken) return null;
  return { userId, accessToken };
}
