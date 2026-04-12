"use client";

import { useCallback } from "react";

const SECTIONS = [
  { id: "section-intake", label: "Intake" },
  { id: "section-summary", label: "Summary" },
  { id: "section-clinical", label: "Clinical" },
  { id: "section-soap", label: "SOAP" },
  { id: "section-rx", label: "Rx" },
  { id: "section-files", label: "Files" },
] as const;

export function VisitAnchorNav({ showIntake }: { showIntake: boolean }) {
  const go = useCallback((id: string) => {
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const items = showIntake ? SECTIONS : SECTIONS.filter((s) => s.id !== "section-intake");

  return (
    <nav
      className="no-scrollbar sticky top-[52px] z-10 -mx-1 mb-3 flex gap-1 overflow-x-auto rounded-lg border border-outline-variant/20 bg-surface-container-low/95 px-1 py-1 backdrop-blur-sm md:top-[56px]"
      aria-label="Visit sections"
    >
      {items.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => go(s.id)}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
