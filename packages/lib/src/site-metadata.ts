export type PlatformIconMetadata = {
  icon?: Array<{ url: string; type?: string; sizes?: string }>;
  shortcut?: Array<{ url: string }>;
  apple?: Array<{ url: string; type?: string; sizes?: string }>;
};

/** Dynamic /icon route — custom upload from platform control, otherwise default paw PNG. */
export function buildPlatformIcons(): PlatformIconMetadata {
  return {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon", type: "image/png", sizes: "48x48" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
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
