"use client";

import { useFormStatus } from "react-dom";

/** Must render inside <form> — shows when that form is submitting (including via submit buttons that use the form= attribute). */
export function VisitSavePendingBanner() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return (
    <div
      className="mb-3 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-fixed/15 px-3 py-2 text-[12px] font-semibold text-primary"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden
      />
      Saving visit…
    </div>
  );
}
