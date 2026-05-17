"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { saveVisitPhotoSheetPdfAction } from "@/app/(portal)/visits/visit-report-actions";
import { VisitAppointmentContext, type VisitAppointmentContextProps } from "@/components/clinical/visit-appointment-context";
import { enhanceDocumentPhoto } from "@/lib/visits/enhance-document-photo";

const EXPORT_MIME = "image/jpeg";

export function VisitPhotoSheetReport({
  visitId,
  hasSavedPdf,
  appointmentContext,
}: {
  visitId: string;
  hasSavedPdf: boolean;
  appointmentContext: VisitAppointmentContextProps;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [enhancedPreview, setEnhancedPreview] = useState<string | null>(null);
  const [enhancedBlob, setEnhancedBlob] = useState<Blob | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetPreviews = useCallback(() => {
    setOriginalPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setEnhancedPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setEnhancedBlob(null);
  }, []);

  const handleFileChange = useCallback(
    async (file: File | null) => {
      resetPreviews();
      setMessage(null);
      setError(null);
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please choose a photo (JPG or PNG).");
        return;
      }

      setPending(true);
      try {
        setOriginalPreview(URL.createObjectURL(file));
        const blob = await enhanceDocumentPhoto(file);
        setEnhancedBlob(blob);
        setEnhancedPreview(URL.createObjectURL(blob));
        setMessage("Document preview ready. Save when the sheet looks clear.");
      } catch (scanError) {
        setError(scanError instanceof Error ? scanError.message : "Failed to process the photo.");
      } finally {
        setPending(false);
      }
    },
    [resetPreviews],
  );

  async function savePdf() {
    if (!enhancedBlob) {
      setError("Take or upload a photo first.");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("visit_id", visitId);
      fd.set("image_file", new File([enhancedBlob], `visit-${visitId}-sheet.jpg`, { type: EXPORT_MIME }));
      const result = await saveVisitPhotoSheetPdfAction(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Visit report PDF saved from the photographed sheet.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 py-4">
        <p className="text-sm font-semibold text-on-background">Photo sheet visit report</p>
        <p className="mt-1 text-[12px] text-on-surface-variant">
          Write on any casual clinic sheet, take a photo, and we will turn it into a clean scanned document PDF — the
          same workflow many clinics use for paper notes.
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
            {pending ? "Processing…" : "Take or upload photo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              void handleFileChange(file);
              event.target.value = "";
            }}
          />
          <button
            type="button"
            className="btn-primary btn-compact text-xs"
            disabled={pending || !enhancedBlob}
            onClick={() => void savePdf()}
          >
            {pending ? "Saving…" : "Save as visit PDF"}
          </button>
        </div>
      </div>

      <VisitAppointmentContext context={appointmentContext} />

      {message ? <p className="text-[11px] font-medium text-emerald-800">{message}</p> : null}
      {error ? (
        <p className="rounded-lg border border-error/30 bg-error-container/30 px-3 py-2 text-[11px] text-error">
          {error}
        </p>
      ) : null}

      {originalPreview || enhancedPreview ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {originalPreview ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Original photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={originalPreview} alt="Original handwritten sheet" className="max-h-[520px] w-full rounded-lg object-contain" />
            </div>
          ) : null}
          {enhancedPreview ? (
            <div className="rounded-2xl border border-primary/25 bg-white p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">Scanned document preview</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enhancedPreview} alt="Enhanced document" className="max-h-[520px] w-full rounded-lg object-contain" />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-[12px] text-slate-600">
          Photograph the completed sheet in good light. The preview will show a cleaned, high-contrast scan before saving.
        </div>
      )}
    </div>
  );
}
