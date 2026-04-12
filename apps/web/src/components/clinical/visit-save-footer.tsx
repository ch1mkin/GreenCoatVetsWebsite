"use client";

import { useEffect, useState } from "react";

const FORM_ID = "form-visit-record";

export function VisitSaveFooter({
  embed,
  defaultFollowUpIsoSlice,
  defaultCompleted,
  showSavedSuccess,
}: {
  embed: boolean;
  /** Value for datetime-local: `visit.follow_up_at` as `YYYY-MM-DDTHH:mm` or empty */
  defaultFollowUpIsoSlice: string;
  defaultCompleted: boolean;
  showSavedSuccess: boolean;
}) {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const form = document.getElementById(FORM_ID);
    if (!form) return;
    let safety: number | undefined;
    const onSubmit = () => {
      setSaving(true);
      if (safety !== undefined) window.clearTimeout(safety);
      safety = window.setTimeout(() => setSaving(false), 90_000);
    };
    form.addEventListener("submit", onSubmit);
    return () => {
      form.removeEventListener("submit", onSubmit);
      if (safety !== undefined) window.clearTimeout(safety);
    };
  }, []);

  useEffect(() => {
    if (showSavedSuccess) setSaving(false);
  }, [showSavedSuccess]);

  return (
    <div
      className={
        embed
          ? "mt-3 rounded-lg border border-primary/25 bg-primary-fixed/10 px-2 py-2 text-[11px]"
          : "mx-auto mt-4 flex max-w-5xl flex-col gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-low/80 px-4 py-4"
      }
    >
      <p className={embed ? "text-slate-700" : "text-[12px] font-semibold text-on-surface"}>Follow-up & save visit</p>

      <div className="grid gap-3 sm:max-w-md">
        <label className="flex flex-col gap-1">
          <span className={embed ? "text-[11px] text-slate-600" : "text-[11px] font-semibold text-on-surface-variant"}>
            Follow-up date / time
          </span>
          <input
            form={FORM_ID}
            className={embed ? "rounded border border-slate-300 px-2 py-1 text-[12px]" : "input-soft input-compact"}
            type="datetime-local"
            name="follow_up_at"
            defaultValue={defaultFollowUpIsoSlice}
          />
        </label>
        <label className="flex items-center gap-2 text-[13px]">
          <input
            form={FORM_ID}
            type="checkbox"
            name="complete_visit"
            defaultChecked={defaultCompleted}
            className="rounded border-outline-variant"
          />
          Mark visit complete
        </label>
      </div>

      {showSavedSuccess ? (
        <p
          className={
            embed
              ? "rounded border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-medium text-emerald-900"
              : "rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-[12px] font-medium text-emerald-900"
          }
          role="status"
        >
          Visit information was saved successfully.
        </p>
      ) : null}

      <p className={embed ? "text-[11px] text-slate-600" : "text-[11px] text-on-surface-variant"}>
        Saves clinical evaluation, SOAP fields, follow-up, and completion. Prescription lines are saved when you add them above.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary btn-compact"
          disabled={saving}
          aria-busy={saving}
          onClick={() => document.getElementById("visit-submit-save")?.click()}
        >
          {saving ? "Saving…" : "Save entire visit"}
        </button>
        <button
          type="button"
          className="btn-secondary btn-compact"
          disabled={saving}
          aria-busy={saving}
          onClick={() => document.getElementById("visit-submit-complete")?.click()}
        >
          {saving ? "Saving…" : "Complete visit"}
        </button>
      </div>
    </div>
  );
}
