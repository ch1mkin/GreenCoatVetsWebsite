"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { shareVisitReportPdfByEmailAction } from "@/app/(portal)/visits/visit-report-actions";

/**
 * Visit report PDF can come from structured visit save or a handwritten full-visit sheet.
 * Download is only available once `storedAt` / `visit_report_pdf_generated_at` is set.
 */
export function VisitReportToolbar({
  visitId,
  petId,
  storedAt,
  source,
  shareEmail,
}: {
  visitId: string;
  petId: string;
  storedAt: string | null;
  source?: string | null;
  shareEmail?: string | null;
}) {
  const canDownload = Boolean(storedAt);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharePending, startShare] = useTransition();

  function handleShare() {
    if (!canDownload) return;
    setShareMessage(null);
    setShareError(null);
    startShare(async () => {
      const fd = new FormData();
      fd.set("visit_id", visitId);
      if (shareEmail?.trim()) fd.set("recipient_email", shareEmail.trim());
      const result = await shareVisitReportPdfByEmailAction(fd);
      if (!result.ok) {
        setShareError(result.error);
        return;
      }
      setShareMessage(`Visit report emailed to ${result.sentTo}.`);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary-fixed/10 px-3 py-3 text-[12px] sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">description</span>
        <span className="font-headline font-bold text-on-surface">Visit report (PDF)</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canDownload ? (
          <a
            className="btn-secondary btn-compact text-xs"
            href={`/visits/${visitId}/report`}
            target="_blank"
            rel="noreferrer"
          >
            Open / download
          </a>
        ) : (
          <span className="rounded-lg border border-outline-variant/40 bg-surface-container-low/80 px-3 py-1.5 text-[11px] font-semibold text-on-surface-variant">
            Download after save
          </span>
        )}
        {canDownload ? (
          <button
            type="button"
            className="btn-secondary btn-compact text-xs disabled:opacity-60"
            disabled={sharePending}
            onClick={handleShare}
          >
            {sharePending ? "Sending..." : "Email PDF"}
          </button>
        ) : null}
        <Link className="text-xs font-semibold text-primary underline" href={`/pets/${petId}?view=visit_reports`}>
          Pet profile — all reports
        </Link>
      </div>
      {shareMessage ? <p className="w-full text-[11px] text-emerald-700">{shareMessage}</p> : null}
      {shareError ? <p className="w-full text-[11px] text-red-700">{shareError}</p> : null}
      {storedAt ? (
        <p className="w-full text-[11px] text-on-surface-variant sm:ml-auto sm:w-auto">
          Last saved to record: {new Date(storedAt).toLocaleString()}
          {source === "handwritten" ? " (handwritten full visit sheet)" : ""}
        </p>
      ) : (
        <p className="w-full text-[11px] text-on-surface-variant sm:ml-auto sm:w-auto">
          The PDF is created when you use <strong>Save entire visit</strong> / <strong>Complete visit</strong> below, or when you
          save the handwritten full visit sheet — then you can download it here and it appears on the patient record for owners.
        </p>
      )}
      {canDownload && !shareEmail?.trim() ? (
        <p className="w-full text-[11px] text-on-surface-variant">Add or confirm the owner email in the appointment intake to enable one-click PDF sharing.</p>
      ) : null}
    </div>
  );
}
