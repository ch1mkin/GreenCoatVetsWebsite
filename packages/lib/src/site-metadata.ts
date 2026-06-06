export type PlatformIconMetadata = {
  icon?: Array<{ url: string; type?: string; sizes?: string }>;
  shortcut?: Array<{ url: string }>;
  apple?: Array<{ url: string; type?: string; sizes?: string }>;
};

/** Static favicons in /public — stable for Google Search (48×48 minimum). */
export function buildPlatformIcons(): PlatformIconMetadata {
  return {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-48x48.png", type: "image/png", sizes: "48x48" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  };
}

export function resolvePublicSiteUrl(envValue: string | undefined, fallback: string): URL {
  const raw = (envValue ?? fallback).trim().replace(/\/$/, "");
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return new URL(fallback);
  }
}
