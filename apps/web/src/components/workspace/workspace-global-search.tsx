"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function WorkspaceGlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    router.push(`/pets?q=${encodeURIComponent(t)}`);
  }

  return (
    <form onSubmit={onSubmit} className="relative w-full max-w-md flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-primary/80">
        <span className="material-symbols-outlined text-[20px]">search</span>
      </span>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search patients, owners…"
        className="workspace-search-input"
        aria-label="Global search"
      />
    </form>
  );
}
