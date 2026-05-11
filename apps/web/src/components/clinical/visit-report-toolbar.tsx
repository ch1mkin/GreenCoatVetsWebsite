import Link from "next/link";

/**
 * Visit report PDF can come from structured visit save or a handwritten full-visit sheet.
 * Download is only available once `storedAt` / `visit_report_pdf_generated_at` is set.
 */
export function VisitReportToolbar({
  visitId,
  petId,
  storedAt,
  source,
}: {
  visitId: string;
  petId: string;
  storedAt: string | null;
  source?: string | null;
}) {
  const canDownload = Boolean(storedAt);
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
        <Link className="text-xs font-semibold text-primary underline" href={`/pets/${petId}?view=visit_reports`}>
          Pet profile — all reports
        </Link>
      </div>
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
    </div>
  );
}
