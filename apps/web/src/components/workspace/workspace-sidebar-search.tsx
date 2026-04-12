"use client";

import type { PrimaryTabId } from "@/lib/workspace/primary-tabs";
import { sidebarSearchFormAction } from "@/lib/workspace/primary-tabs";

const PLACEHOLDER: Record<PrimaryTabId, string> = {
  dashboard: "Quick find…",
  contacts: "Search contacts…",
  patients: "Search patients…",
  clinical: "Search patients…",
  financial: "Search commerce…",
  reporting: "Search reports…",
  admin: "Search notifications…",
  help: "Search help…",
};

export function WorkspaceSidebarSearch({ activeTab }: { activeTab: PrimaryTabId }) {
  const action = sidebarSearchFormAction(activeTab);
  const ph = PLACEHOLDER[activeTab];

  return (
    <form method="get" action={action} className="border-b border-slate-300/50 px-1.5 py-1.5">
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 opacity-80">
          <span className="material-symbols-outlined text-[16px]">filter_alt</span>
        </span>
        <input
          name="q"
          className="workspace-search-input rounded border-slate-300/80 pr-2"
          placeholder={ph}
          aria-label="Sidebar record search"
        />
      </div>
    </form>
  );
}
