import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformBranding = {
  product_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  website_store_enabled: boolean;
};

const DEFAULT_PRODUCT_NAME = "GreenCoatVets";

export const DEFAULT_PLATFORM_BRANDING: PlatformBranding = {
  product_name: DEFAULT_PRODUCT_NAME,
  logo_url: null,
  favicon_url: null,
  website_store_enabled: true,
};

/**
 * Single-row platform branding (id = 'default'). Safe for anon read (marketing + login).
 */
export async function fetchPlatformBranding(supabase: SupabaseClient): Promise<PlatformBranding> {
  const { data, error } = await supabase
    .from("platform_branding")
    .select("product_name, logo_url, favicon_url, website_store_enabled")
    .eq("id", "default")
    .maybeSingle();

  if (error || !data) {
    return { ...DEFAULT_PLATFORM_BRANDING };
  }

  return {
    product_name: (data.product_name as string)?.trim() || DEFAULT_PRODUCT_NAME,
    logo_url: (data.logo_url as string | null) ?? null,
    favicon_url: (data.favicon_url as string | null) ?? null,
    website_store_enabled: (data.website_store_enabled as boolean | null | undefined) ?? true,
  };
}

/** Dedicated square favicon only — logos are often wide and invisible in browser tabs. */
export function resolveFaviconUrl(branding: PlatformBranding): string | null {
  return branding.favicon_url?.trim() || null;
}
