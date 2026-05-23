export type MarketingSeoSettings = {
  /** Google Search Console HTML tag verification content value. */
  google_site_verification?: string;
  /** Canonical public site origin, e.g. https://greencoatvets.com */
  public_site_url?: string;
  last_sitemap_ping_at?: string;
};

export const EMPTY_SEO_SETTINGS: MarketingSeoSettings = {};
