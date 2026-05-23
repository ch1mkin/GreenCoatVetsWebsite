"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { saveVisitPhotoSheetPdfAction } from "@/app/(portal)/visits/visit-report-actions";
import { VisitAppointmentContext, type VisitAppointmentContextProps } from "@/components/clinical/visit-appointment-context";
import { VisitPhoneCapturePanel } from "@/components/clinical/visit-phone-capture-panel";
import { PawCircularLoader } from "@/components/web/paw-circular-loader";
import { enhanceDocumentPhoto } from "@/lib/visits/enhance-document-photo";
import { useVisitPhonePhotoSync } from "@/lib/visits/use-visit-phone-photo-sync";

const EXPORT_MIME = "image/jpeg";

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
  const sourceFileRef = useRef<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string | null>(null);
  const [enhancedPreview, setEnhancedPreview] = useState<string | null>(null);
  const [enhancedBlob, setEnhancedBlob] = useState<Blob | null>(null);
  const [extraClarity, setExtraClarity] = useState(true);
  const [hasSourcePhoto, setHasSourcePhoto] = useState(false);
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
    sourceFileRef.current = null;
    setHasSourcePhoto(false);
  }, []);

  const runEnhancement = useCallback(
    async (file: File, options?: { fromPhone?: boolean; clarity?: boolean }) => {
      const useClarity = options?.clarity ?? extraClarity;
      setMessage(null);
      setError(null);
      setPending(true);
      try {
        if (!originalPreview) {
          setOriginalPreview(URL.createObjectURL(file));
        }
        const blob = await enhanceDocumentPhoto(file, { extraClarity: useClarity });
        setEnhancedPreview((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(blob);
        });
        setEnhancedBlob(blob);
        setMessage(
          options?.fromPhone
            ? `Photo received from your phone. ${useClarity ? "Extra clarity applied." : "Standard scan applied."} Save when ready.`
            : useClarity
              ? "Extra clarity applied for PDF — review the scan, then save."
              : "Document preview ready. Save when the sheet looks clear.",
        );
      } catch (scanError) {
        setError(scanError instanceof Error ? scanError.message : "Failed to process the photo.");
      } finally {
        setPending(false);
      }
    },
    [extraClarity, originalPreview],
  );

  const handleFileChange = useCallback(
    async (file: File | null, options?: { fromPhone?: boolean }) => {
      resetPreviews();
      setMessage(null);
      setError(null);
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setError("Please choose a photo (JPG or PNG).");
        return;
      }

      sourceFileRef.current = file;
      setHasSourcePhoto(true);
      setOriginalPreview(URL.createObjectURL(file));
      await runEnhancement(file, { fromPhone: options?.fromPhone, clarity: extraClarity });
    },
    [extraClarity, resetPreviews, runEnhancement],
  );

  const reapplyClarity = useCallback(async () => {
    const file = sourceFileRef.current;
    if (!file) {
      setError("Take or upload a photo first.");
      return;
    }
    await runEnhancement(file, { clarity: extraClarity });
  }, [extraClarity, runEnhancement]);

  const { checkLatestAttachment } = useVisitPhonePhotoSync({
    visitId,
    clinicId,
    enabled: showPhoneCapture,
    onImageFile: (file) => handleFileChange(file, { fromPhone: true }),
  });

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
          Write on any clinic sheet, then photograph it on this laptop or scan the QR with your phone. We turn it into a
          clean scanned document PDF for this visit.
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
            {pending ? "Processing…" : "Take or upload on laptop"}
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

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-outline-variant/15 bg-white/80 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex cursor-pointer items-start gap-2 text-[12px] text-on-surface">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary"
              checked={extraClarity}
              onChange={(event) => setExtraClarity(event.target.checked)}
            />
            <span>
              <span className="font-semibold text-on-background">Extra clarity for PDF</span>
              <span className="mt-0.5 block text-[11px] text-on-surface-variant">
                Sharper text, higher contrast, and a cleaner white background — recommended before saving the visit PDF.
              </span>
            </span>
          </label>
          {hasSourcePhoto ? (
            <button
              type="button"
              className="btn-secondary btn-compact shrink-0 text-xs"
              disabled={pending}
              onClick={() => void reapplyClarity()}
            >
              {pending ? "Processing…" : extraClarity ? "Apply extra clarity" : "Apply standard scan"}
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

      {pending && !originalPreview && !enhancedPreview ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-lowest py-12">
          <PawCircularLoader
            size="md"
            message={extraClarity ? "Applying extra clarity for PDF…" : "Enhancing document scan…"}
          />
        </div>
      ) : null}

      {originalPreview || enhancedPreview ? (
        <div className="relative grid gap-4 lg:grid-cols-2">
          {pending ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/80 backdrop-blur-[1px]">
              <PawCircularLoader
                size="md"
                message={extraClarity ? "Applying extra clarity for PDF…" : "Enhancing document scan…"}
              />
            </div>
          ) : null}
          {originalPreview ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Original photo</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={originalPreview} alt="Original handwritten sheet" className="max-h-[520px] w-full rounded-lg object-contain" />
            </div>
          ) : null}
          {enhancedPreview ? (
            <div className="rounded-2xl border border-primary/25 bg-white p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">
                Scanned document preview{extraClarity ? " · extra clarity" : ""}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enhancedPreview} alt="Enhanced document" className="max-h-[520px] w-full rounded-lg object-contain" />
            </div>
          ) : null}
        </div>
      ) : !originalPreview && !enhancedPreview ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-[12px] text-slate-600">
          {showPhoneCapture ? (
            <>
              Scan the QR above with your phone, or use the laptop camera. The cleaned scan preview appears here before
              you save the visit PDF.
            </>
          ) : (
            <>Photograph the completed sheet in good light. The preview will show a cleaned, high-contrast scan before saving.</>
          )}
        </div>
      ) : null}
    </div>
  );
}
