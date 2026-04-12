"use client";

import { useClinicalWindows, MAX_CLINICAL_WINDOWS } from "./clinical-windows-context";

export function OpenClinicalWindowButton({
  visitId,
  petName,
}: {
  visitId: string;
  petName: string;
}) {
  const { openWindow, windows } = useClinicalWindows();
  const atCap = windows.length >= MAX_CLINICAL_WINDOWS;
  const already = windows.some((w) => w.visitId === visitId);

  return (
    <button
      type="button"
      className="btn-secondary text-xs"
      disabled={atCap && !already}
      title={
        atCap && !already
          ? `Close a window first (max ${MAX_CLINICAL_WINDOWS})`
          : "Open this visit in a draggable side panel"
      }
      onClick={() => openWindow(visitId, petName || "Patient")}
    >
      <span className="inline-flex items-center gap-1">
        <span className="material-symbols-outlined text-[16px]">window</span>
        {already ? "Focus panel" : "Side panel"}
      </span>
    </button>
  );
}
