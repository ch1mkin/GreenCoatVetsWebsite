import type { SupabaseClient } from "@supabase/supabase-js";
import { isAbsoluteHttpUrl, resolveSignedImageUrl } from "@/lib/storage/resolve-signed-image-url";

/** Load clinic branding image bytes for PDF embedding (public URL or storage path in clinic-assets). */
export async function fetchClinicLogoBytesForPdf(
  supabase: SupabaseClient,
  imageUrl: string | null | undefined
): Promise<Uint8Array | null> {
  if (!imageUrl?.trim()) return null;
  let url = imageUrl.trim();
  if (!isAbsoluteHttpUrl(url)) {
    const signed = await resolveSignedImageUrl(supabase, url, { bucket: "clinic-assets", expiresIn: 3600 });
    if (!signed) return null;
    url = signed;
  }
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
