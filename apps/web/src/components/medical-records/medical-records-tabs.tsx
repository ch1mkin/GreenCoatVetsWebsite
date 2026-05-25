"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Tab = "records" | "diagnostics" | "history";

export function MedicalRecordsTabs({ active }: { active: Tab }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pet = searchParams.get("pet") ?? "";

  function href(tab: Tab) {
    const sp = new URLSearchParams();
    if (pet) sp.set("pet", pet);
    if (tab !== "records") sp.set("tab", tab);
    const q = sp.toString();
    return q ? `${pathname}?${q}` : pathname;
  }

  const tabClass = (tab: Tab) =>
    tab === active
      ? "border-b-2 border-primary pb-4 text-primary"
      : "pb-4 opacity-60 transition-opacity hover:opacity-100";

  return (
    <div className="flex gap-8 border-b border-surface-container text-sm font-bold text-on-surface-variant">
      <Link href={href("records")} className={tabClass("records")}>
        Records
      </Link>
      <Link href={href("diagnostics")} className={tabClass("diagnostics")}>
        Diagnostics
      </Link>
      <Link href={href("history")} className={tabClass("history")}>
        History
      </Link>
    </div>
  );
}
