"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function WorkspaceQuickLinks() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1 rounded-lg border border-outline-variant/25 bg-surface-container-lowest px-2.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low"
        title="Quick links"
      >
        <span className="material-symbols-outlined text-[18px]">bolt</span>
        <span className="hidden sm:inline">Quick links</span>
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-1 w-56 rounded-xl border border-outline-variant/25 bg-surface-container-lowest py-1 shadow-lg">
          <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
            Hardware & payments
          </p>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-container-low"
            disabled
          >
            Printers & labels (configure)
          </button>
          <Link
            href="/payments"
            className="block px-3 py-2 text-sm text-on-background hover:bg-surface-container-low"
            onClick={() => setOpen(false)}
          >
            Payment terminal / POS
          </Link>
          <p className="mt-1 border-t border-outline-variant/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
            Account
          </p>
          <Link
            href="/clinic-profile"
            className="block px-3 py-2 text-sm text-on-background hover:bg-surface-container-low"
            onClick={() => setOpen(false)}
          >
            User & clinic settings
          </Link>
        </div>
      ) : null}
    </div>
  );
}
