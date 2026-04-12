/**
 * Extract invite token from QR payload (raw token, URL with ?token= / ?invite=, or last path segment).
 */
export function extractInviteTokenFromPayload(raw: string): string {
  const t = raw.trim();
  if (!t) return "";

  try {
    const u = new URL(t);
    const q =
      u.searchParams.get("token") ??
      u.searchParams.get("invite") ??
      u.searchParams.get("t") ??
      u.searchParams.get("code");
    if (q) return q.trim();

    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last && /^[a-zA-Z0-9_-]+$/.test(last) && last.length >= 8) {
      return last;
    }
  } catch {
    /* not a URL */
  }

  return t;
}
