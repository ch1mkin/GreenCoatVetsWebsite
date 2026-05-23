"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { saveVisitPhotoSheetPdfAction } from "@/app/(portal)/visits/visit-report-actions";
import { VisitAppointmentContext, type VisitAppointmentContextProps } from "@/components/clinical/visit-appointment-context";
import { VisitPhoneCapturePanel } from "@/components/clinical/visit-phone-capture-panel";
import { PawCircularLoader } from "@/components/web/paw-circular-loader";
import { useVisitPhonePhotoSync } from "@/lib/visits/use-visit-phone-photo-sync";

export function VisitPhotoSheetReport({
  visitId,
  clinicId,
  hasSavedPdf,
  showPhoneCapture,
  appointmentContext,
}: {
  visitId: string;
  clinicId: string;
  hasSavedPdf: boolean;
  showPhoneCapture: boolean;
  appointmentContext: VisitAppointmentContextProps;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetPhoto = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setPhotoFile(null);
  }, []);

  const loadPhoto = useCallback(
    (file: File | null, options?: { fromPhone?: boolean }) => {
      resetPhoto();
      setMessage(null);
      setError(null);
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please choose a photo (JPG or PNG).");
        return;
      }

      setPhotoFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setMessage(
        options?.fromPhone
          ? "Photo received from your phone. Review it below, then save as visit PDF."
          : "Photo ready. Save as visit PDF when it looks correct.",
      );
    },
    [resetPhoto],
  );

  const { checkLatestAttachment } = useVisitPhonePhotoSync({
    visitId,
    clinicId,
    enabled: showPhoneCapture,
    onImageFile: (file) => loadPhoto(file, { fromPhone: true }),
  });

  async function savePdf() {
    if (!photoFile) {
      setError("Take or upload a photo first.");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("visit_id", visitId);
      const ext = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = ext === "png" || ext === "jpeg" || ext === "jpg" ? ext : "jpg";
      fd.set(
        "image_file",
        new File([photoFile], `visit-${visitId}-sheet.${safeExt}`, {
          type: photoFile.type || "image/jpeg",
        }),
      );
      const result = await saveVisitPhotoSheetPdfAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Visit report PDF saved using your original photo.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {showPhoneCapture ? (
        <VisitPhoneCapturePanel
          visitId={visitId}
          variant="photo-sheet"
          onUploaded={() => void checkLatestAttachment()}
        />
      ) : null}

      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-4">
        <p className="text-sm font-semibold text-on-background">Photo sheet visit report</p>
        <p className="mt-1 text-[12px] text-on-surface-variant">
          Write on any clinic sheet, then photograph it on this laptop or scan the QR with your phone. The original photo
          is saved as the visit PDF — no filters or scan effects applied.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {hasSavedPdf ? (
            <a
              href={`/visits/${visitId}/report`}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary btn-compact text-xs"
            >
              Open saved PDF
            </a>
          ) : null}
          <button
            type="button"
            className="btn-primary btn-compact text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
          >
            Take or upload on laptop
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              loadPhoto(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn-primary btn-compact text-xs"
            disabled={pending || !photoFile}
            onClick={() => void savePdf()}
          >
            {pending ? "Saving…" : "Save as visit PDF"}
          </button>
          {photoFile ? (
            <button
              type="button"
              className="btn-secondary btn-compact text-xs"
              disabled={pending}
              onClick={() => {
                resetPhoto();
                setMessage(null);
              }}
            >
              Choose another photo
            </button>
          ) : null}
        </div>
      </div>

      <VisitAppointmentContext context={appointmentContext} />

      {message ? <p className="text-[11px] font-medium text-emerald-800">{message}</p> : null}
      {error ? (
        <p className="rounded-lg border border-error/30 bg-error-container/30 px-3 py-2 text-[11px] text-error">
          {error}
        </p>
      ) : null}

      {pending ? (
        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-lowest py-12">
          <PawCircularLoader size="md" message="Saving visit PDF…" />
        </div>
      ) : previewUrl ? (
        <div className="rounded-2xl border border-primary/25 bg-white p-3 shadow-sm">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">Photo preview (original)</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Visit sheet photo" className="max-h-[560px] w-full rounded-lg object-contain" />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-[12px] text-slate-600">
          {showPhoneCapture ? (
            <>
              Scan the QR above with your phone, or use the laptop camera. Your photo appears here exactly as captured
              before you save the visit PDF.
            </>
          ) : (
            <>Photograph the completed sheet in good light, then save the original image as the visit PDF.</>
          )}
        </div>
      )}
    </div>
  );
}
