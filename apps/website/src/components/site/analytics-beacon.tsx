"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Records a lightweight page view (path only) for super-admin traffic stats.
 * Skips /admin and duplicate fires per path per mount.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    if (last.current === pathname) return;
    last.current = pathname;

    const t = window.setTimeout(() => {
      fetch("/api/analytics/pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => {});
    }, 0);

    return () => window.clearTimeout(t);
  }, [pathname]);

  return null;
}
