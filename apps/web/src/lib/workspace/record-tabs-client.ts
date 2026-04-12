/** Keys & helpers for client-only record tab / navigation history (sessionStorage). */

import type { NavHistoryEntry, RecordTabEntry } from "@/lib/workspace/record-tabs-types";

export type { NavHistoryEntry, RecordTabEntry } from "@/lib/workspace/record-tabs-types";

export const RECORD_TABS_KEY = "saasclinics_workspace_record_tabs_v2";
export const NAV_HISTORY_KEY = "saasclinics_workspace_nav_history_v1";

export const RECORD_TABS_CHANGED = "saasclinics-record-tabs-changed";

export function readRecordTabs(): RecordTabEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(RECORD_TABS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecordTabEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function writeRecordTabs(tabs: RecordTabEntry[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(RECORD_TABS_KEY, JSON.stringify(tabs.slice(0, 12)));
    window.dispatchEvent(new CustomEvent(RECORD_TABS_CHANGED));
  } catch {
    /* ignore */
  }
}

export function mergeRecordTab(open: RecordTabEntry[], entry: RecordTabEntry): RecordTabEntry[] {
  const rest = open.filter((t) => t.id !== entry.id);
  return [entry, ...rest].slice(0, 12);
}

export function readNavHistory(): NavHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(NAV_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as NavHistoryEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 25) : [];
  } catch {
    return [];
  }
}

export function pushNavHistory(entry: Omit<NavHistoryEntry, "at">) {
  if (typeof window === "undefined") return;
  try {
    const prev = readNavHistory();
    const next: NavHistoryEntry[] = [
      { ...entry, at: Date.now() },
      ...prev.filter((e) => e.href !== entry.href),
    ].slice(0, 25);
    sessionStorage.setItem(NAV_HISTORY_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(RECORD_TABS_CHANGED));
  } catch {
    /* ignore */
  }
}
