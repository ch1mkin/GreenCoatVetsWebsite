import type { PrimaryTabId } from "@/lib/workspace/primary-tabs";

/**
 * ezyVet-style color-coded primary module tabs (reference: practice management UI).
 * Active tab: solid module color; inactive: subdued on dark chrome.
 */
export function primaryModuleTabClass(tabId: PrimaryTabId, isActive: boolean): string {
  const base =
    "shrink-0 rounded-t-md border border-b-0 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors sm:px-3";

  if (!isActive) {
    return `${base} border-transparent bg-black/25 text-white/65 hover:bg-black/35 hover:text-white/95`;
  }

  /** Active tab: saturated module color + white label (readable on highlight). */
  switch (tabId) {
    case "dashboard":
      return `${base} border-amber-400/90 bg-amber-500 text-white shadow-sm`;
    case "contacts":
      return `${base} border-blue-500/90 bg-blue-600 text-white shadow-sm`;
    case "patients":
      return `${base} border-violet-500/90 bg-violet-600 text-white shadow-sm`;
    case "clinical":
      return `${base} border-emerald-600/90 bg-emerald-600 text-white shadow-sm`;
    case "financial":
      return `${base} border-orange-500/90 bg-orange-600 text-white shadow-sm`;
    case "reporting":
      return `${base} border-teal-500/90 bg-teal-600 text-white shadow-sm`;
    case "admin":
      return `${base} border-pink-500/90 bg-pink-600 text-white shadow-sm`;
    case "help":
      return `${base} border-sky-500/90 bg-sky-600 text-white shadow-sm`;
    default:
      return `${base} border-white/30 bg-white/20 text-white`;
  }
}
