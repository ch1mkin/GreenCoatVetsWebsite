import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "medical-files";

export function isAbsoluteHttpUrl(s: string | null | undefined): boolean {
  if (!s) return false;
  return s.startsWith("http://") || s.startsWith("https://");
}

/**
 * Mobile uploads store `photo_url` as a storage path (e.g. `clinic-id/pets/...`).
 * Browsers need a signed (or public) URL — this resolves paths via Supabase Storage.
 */
export async function resolveSignedImageUrl(
  supabase: SupabaseClient,
  pathOrUrl: string | null | undefined,
  options?: { bucket?: string; expiresIn?: number }
): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (isAbsoluteHttpUrl(pathOrUrl)) return pathOrUrl;
  const bucket = options?.bucket ?? DEFAULT_BUCKET;
  const expiresIn = options?.expiresIn ?? 60 * 60;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(pathOrUrl, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Batch-sign unique storage paths (skips already-absolute URLs). */
export async function buildSignedUrlMap(
  supabase: SupabaseClient,
  paths: Array<string | null | undefined>,
  options?: { bucket?: string; expiresIn?: number }
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(paths.filter((p): p is string => !!p && !isAbsoluteHttpUrl(p))));
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (path) => {
      const url = await resolveSignedImageUrl(supabase, path, options);
      if (url) map.set(path, url);
    })
  );
  return map;
}

export function urlForDisplay(raw: string | null | undefined, signedMap: Map<string, string>): string | null {
  if (!raw) return null;
  if (isAbsoluteHttpUrl(raw)) return raw;
  return signedMap.get(raw) ?? null;
}
