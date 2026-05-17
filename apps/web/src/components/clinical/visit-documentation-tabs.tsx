"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, type ReactNode } from "react";

export type VisitDocumentationTab = "form" | "photo" | "digital";

const TABS: Array<{ id: VisitDocumentationTab; label: string; hint: string }> = [
  {
    id: "form",
    label: "Structured record",
    hint: "Voice dictation, clinical form, and prescription",
  },
  {
    id: "photo",
    label: "Photo sheet",
    hint: "Write on paper, photograph, save as PDF report",
  },
  {
    id: "digital",
    label: "Digital sheet",
    hint: "Draw on the clinic template on screen",
  },
];

function isVisitDocTab(value: string | null): value is VisitDocumentationTab {
  return value === "form" || value === "photo" || value === "digital";
}

export function VisitDocumentationTabs({
  visitId,
  defaultTab = "form",
  formPanel,
  photoPanel,
  digitalPanel,
}: {
  visitId: string;
  defaultTab?: VisitDocumentationTab;
  formPanel: ReactNode;
  photoPanel: ReactNode;
  digitalPanel: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("doc");
  const activeTab = isVisitDocTab(tabParam) ? tabParam : defaultTab;

  const setTab = useCallback(
    (tab: VisitDocumentationTab) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("doc", tab);
      router.replace(`/visits/${visitId}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, visitId],
  );

  const activeHint = useMemo(() => TABS.find((tab) => tab.id === activeTab)?.hint ?? "", [activeTab]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-2 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`flex-1 rounded-xl px-4 py-3 text-left transition-colors ${
                activeTab === tab.id
                  ? "border border-primary bg-primary text-white shadow-sm shadow-primary/20"
                  : "border border-transparent bg-white text-slate-800 hover:border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="block text-sm font-bold">{tab.label}</span>
              <span
                className={`mt-0.5 block text-[11px] leading-snug ${
                  activeTab === tab.id ? "text-white/90" : "text-slate-500"
                }`}
              >
                {tab.hint}
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 px-2 text-[11px] text-on-surface-variant">{activeHint}</p>
      </div>

      {activeTab === "form" ? formPanel : null}
      {activeTab === "photo" ? photoPanel : null}
      {activeTab === "digital" ? digitalPanel : null}
    </div>
  );
}
