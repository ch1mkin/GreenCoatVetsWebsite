/** Square paw mark used when no dedicated favicon is configured. */
export const DEFAULT_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="GreenCoatVets">
  <defs>
    <linearGradient id="a" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#008f6b"/>
      <stop offset="100%" stop-color="#006c50"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#a)"/>
  <g fill="#ffffff">
    <ellipse cx="32" cy="40" rx="10" ry="9"/>
    <circle cx="18" cy="22" r="6"/>
    <circle cx="32" cy="16" r="6"/>
    <circle cx="46" cy="22" r="6"/>
  </g>
</svg>`;

function pngDimensions(bytes: ArrayBuffer): { width: number; height: number } | null {
  if (bytes.byteLength < 24) return null;
  const view = new DataView(bytes);
  if (view.getUint8(0) !== 0x89 || view.getUint8(1) !== 0x50 || view.getUint8(2) !== 0x4e || view.getUint8(3) !== 0x47) {
    return null;
  }
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Wide logos are unreadable in browser tabs — require a roughly square image. */
export function isSquareFavicon(bytes: ArrayBuffer): boolean {
  const dim = pngDimensions(bytes);
  if (!dim || dim.width <= 0 || dim.height <= 0) return true;
  const ratio = dim.width / dim.height;
  return ratio >= 0.85 && ratio <= 1.15;
}

export async function fetchTabIconResponse(faviconUrl: string | null): Promise<Response> {
  const trimmed = faviconUrl?.trim();
  if (trimmed) {
    try {
      const res = await fetch(trimmed, { cache: "no-store" });
      if (res.ok) {
        const bytes = await res.arrayBuffer();
        if (isSquareFavicon(bytes)) {
          const type = res.headers.get("content-type")?.trim() || "image/png";
          return new Response(bytes, { headers: { "Content-Type": type } });
        }
      }
    } catch {
      // Fall through to bundled SVG.
    }
  }

  return new Response(DEFAULT_FAVICON_SVG, {
    headers: { "Content-Type": "image/svg+xml" },
  });
}
