"use client";

import { uploadVisitAttachment } from "@/app/(portal)/visits/actions";
import { SubmitButton } from "@/components/web/submit-button";
import {
  VisitAttachmentsLive,
  type VisitAttachmentRow,
} from "@/components/clinical/visit-attachments-live";
export function VisitAttachmentsSection({
  visitId,
  clinicId,
  petId,
  branchId,
  initialAttachments,
}: {
  visitId: string;
  clinicId: string;
  petId: string;
  branchId: string;
  initialAttachments: VisitAttachmentRow[];
}) {
  return (
    <>
      <form action={uploadVisitAttachment} className="space-y-2" encType="multipart/form-data">
        <input type="hidden" name="visit_id" value={visitId} />
        <input type="hidden" name="pet_id" value={petId} />
        <input type="hidden" name="branch_id" value={branchId} />
        <input className="input-file-soft input-file-compact max-w-md" name="file" type="file" required />
        <SubmitButton className="btn-secondary btn-compact text-xs" pendingLabel="Uploading…">
          Upload file
        </SubmitButton>
      </form>

      <ul className="mt-3 space-y-1.5 text-[11px]">
        <VisitAttachmentsLive visitId={visitId} clinicId={clinicId} initialAttachments={initialAttachments} />
      </ul>
    </>
  );
}
