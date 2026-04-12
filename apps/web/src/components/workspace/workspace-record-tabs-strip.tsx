"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  NAV_HISTORY_KEY,
  RECORD_TABS_CHANGED,
  RECORD_TABS_KEY,
  readNavHistory,
  readRecordTabs,
  writeRecordTabs,
} from "@/lib/workspace/record-tabs-client";
import type { NavHistoryEntry, RecordTabEntry } from "@/lib/workspace/record-tabs-types";

type Tab = RecordTabEntry;

function normalizeTab(t: { id: string; label: string; href: string; kind?: "patient" | "contact" }): Tab {
  if (t.kind === "patient" || t.kind === "contact") return t as Tab;
  if (t.href.includes("/owners/")) return { ...t, kind: "contact" };
  return { ...t, kind: "patient" };
}

function mergeInitial(open: Tab[], initial?: { id: string; label: string; href: string; kind?: "patient" | "contact" }[]): Tab[] {
  if (!initial?.length) return open;
  const norm = initial.map(normalizeTab);
  let next = [...open];
  for (const t of norm) {
    next = [t, ...next.filter((x) => x.id !== t.id)];
  }
  return next.slice(0, 12);
}

export function WorkspaceRecordTabsStrip({ initialTabs }: { initialTabs?: Tab[] }) {
  const pathname = usePathname();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<NavHistoryEntry[]>([]);

  const refresh = useCallback(() => {
    setTabs(mergeInitial(readRecordTabs(), initialTabs));
    setHistory(readNavHistory());
  }, [initialTabs]);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    function onCustom() {
      refresh();
    }
    function onStorage(e: StorageEvent) {
      if (e.key === RECORD_TABS_KEY || e.key === NAV_HISTORY_KEY) refresh();
    }
    window.addEventListener(RECORD_TABS_CHANGED, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(RECORD_TABS_CHANGED, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const activeHref = pathname ?? "";

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = tabs.filter((t) => t.id !== id);
    writeRecordTabs(next);
    setTabs(next);
  };

  const displayTabs = useMemo(() => tabs, [tabs]);

  const homeActive = activeHref === "/dashboard" || activeHref.startsWith("/dashboard?");

  return (
    <div className="relative flex h-10 shrink-0 items-center gap-1 border-b border-slate-300/80 bg-gradient-to-b from-slate-100 to-slate-50 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-0.5">
        <Link
          href="/dashboard"
          className={`flex shrink-0 items-center gap-1 rounded-t border border-b-0 px-2.5 py-1.5 text-[11px] font-bold ${
            homeActive
              ? "border-slate-300 bg-white text-slate-900 shadow-sm"
              : "border-transparent bg-slate-200/60 text-slate-600 hover:bg-slate-200"
          }`}
          title="Home"
        >
          <span className="material-symbols-outlined text-[15px]">home</span>
          <span className="hidden sm:inline">Home</span>
        </Link>
        <span className="text-[10px] font-bold text-slate-400" aria-hidden>
          —
        </span>
        {displayTabs.length === 0 ? (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[10px] text-slate-600">
            <span className="material-symbols-outlined shrink-0 text-sm text-slate-400">tab</span>
            <span className="text-slate-500">Go to</span>
            <Link
              href="/pets"
              className="font-bold text-primary underline decoration-primary/40 underline-offset-2 hover:text-primary/90"
            >
              Patients
            </Link>
            <span className="text-slate-400">or</span>
            <Link
              href="/owners"
              className="font-bold text-primary underline decoration-primary/40 underline-offset-2 hover:text-primary/90"
            >
              Contacts
            </Link>
            <span className="hidden text-slate-500 lg:inline">
              — open a patient or owner record; it pins here.
            </span>
          </div>
        ) : (
          displayTabs.map((t) => {
            const active = activeHref === t.href || activeHref.startsWith(`${t.href}?`);
            return (
              <div
                key={`${t.kind}-${t.id}`}
                className={`flex max-w-[220px] shrink-0 items-center rounded-t border border-b-0 text-[11px] font-semibold shadow-sm ${
                  active
                    ? "border-slate-300 bg-white text-slate-900"
                    : "border-transparent bg-slate-200/70 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <Link href={t.href} className="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5" title={t.label}>
                  <span className="shrink-0 rounded px-0.5 text-[9px] font-bold uppercase text-white bg-slate-500">
                    {t.kind === "patient" ? "P" : "C"}
                  </span>
                  <span className="truncate">{t.label}</span>
                </Link>
                <button
                  type="button"
                  className="shrink-0 rounded-tr-md px-1.5 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label={`Close tab ${t.label}`}
                  onClick={(e) => closeTab(t.id, e)}
                >
                  <span className="material-symbols-outlined text-[15px] leading-none">close</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="relative shrink-0 pr-1">
        <button
          type="button"
          onClick={() => {
            setHistory(readNavHistory());
            setHistoryOpen((o) => !o);
          }}
          className="flex h-7 items-center gap-0.5 rounded-md border border-outline-variant/30 bg-surface-container-lowest px-2 text-[11px] font-semibold text-on-surface-variant hover:bg-surface-container-low"
          title="Navigation history"
        >
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span className="hidden sm:inline">Recent</span>
        </button>
        {historyOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[45] cursor-default bg-transparent"
              aria-label="Close history"
              onClick={() => setHistoryOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-1 max-h-72 w-72 overflow-y-auto rounded-xl border border-outline-variant/25 bg-surface-container-lowest py-1 shadow-xl">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
                Navigation history
              </p>
              {history.length === 0 ? (
                <p className="px-3 py-2 text-sm text-on-surface-variant">No recent records yet.</p>
              ) : (
                history.map((h) => (
                  <Link
                    key={`${h.href}-${h.at}`}
                    href={h.href}
                    className="block px-3 py-2 text-sm hover:bg-surface-container-low"
                    onClick={() => setHistoryOpen(false)}
                  >
                    <span className="font-medium text-on-background">{h.label}</span>
                    <span className="ml-2 text-[10px] uppercase text-on-surface-variant">
                      {h.kind === "patient" ? "Patient" : "Contact"}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
