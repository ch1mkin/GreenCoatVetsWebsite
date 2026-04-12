import Link from "next/link";
import { regenerateVisitReportPdfFormAction } from "@/app/(portal)/visits/visit-report-actions";
import { SubmitButton } from "@/components/web/submit-button";

export function VisitReportToolbar({
  visitId,
  petId,
  storedAt,
}: {
  visitId: string;
  petId: string;
  storedAt: string | null;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary-fixed/10 px-3 py-3 text-[12px] sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">description</span>
        <span className="font-headline font-bold text-on-surface">Visit report (PDF)</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          className="btn-secondary btn-compact text-xs"
          href={`/visits/${visitId}/report`}
          target="_blank"
          rel="noreferrer"
        >
          Open / download
        </a>
        <form action={regenerateVisitReportPdfFormAction} className="inline">
          <input type="hidden" name="visit_id" value={visitId} />
          <SubmitButton className="btn-primary btn-compact text-xs" pendingLabel="Saving…">
            Save PDF to pet record
          </SubmitButton>
        </form>
        <Link className="text-xs font-semibold text-primary underline" href={`/pets/${petId}?view=visit_reports`}>
          Pet profile — all reports
        </Link>
      </div>
      {storedAt ? (
        <p className="w-full text-[11px] text-on-surface-variant sm:ml-auto sm:w-auto">
          Last saved to record: {new Date(storedAt).toLocaleString()}
        </p>
      ) : (
        <p className="w-full text-[11px] text-on-surface-variant sm:ml-auto sm:w-auto">
          Saving stores a copy under this patient for staff and owners.
        </p>
      )}
    </div>
  );
}
