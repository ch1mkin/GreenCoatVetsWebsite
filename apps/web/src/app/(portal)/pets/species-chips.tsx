"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const OPTIONS = [
  { key: "all", label: "All", icon: "grid_view" },
  { key: "canine", label: "Canine", icon: "pets" },
  { key: "feline", label: "Feline", icon: "auto_awesome" },
  { key: "avian", label: "Avian", icon: "flutter_dash" },
  { key: "equine", label: "Equine", icon: "agriculture" },
  { key: "exotic", label: "Exotic", icon: "bug_report" },
] as const;

export function SpeciesChips() {
  const sp = useSearchParams();
  const raw = (sp.get("species") ?? "all").toLowerCase();
  const current = raw === "dog" ? "canine" : raw === "cat" ? "feline" : raw;
  const q = sp.get("q")?.trim();

  return (
    <div className="sidebar-scroll flex gap-1.5 overflow-x-auto pb-1">
      {OPTIONS.map((opt) => {
        const active = current === opt.key;
        const params = new URLSearchParams();
        if (opt.key !== "all") params.set("species", opt.key);
        if (q) params.set("q", q);
        const href = `/pets${params.toString() ? `?${params.toString()}` : ""}`;
        return (
          <Link
            key={opt.key}
            href={href}
            scroll={false}
            className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded border px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-[0.99] ${
              active
                ? "border-primary/40 bg-primary text-on-primary shadow-sm"
                : "border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="material-symbols-outlined text-[16px] leading-none">{opt.icon}</span>
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
