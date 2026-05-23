"use client";

import { useCallback, useEffect, useState } from "react";

type SessionResponse = {
  captureUrl: string;
  expiresAt: string;
  issuedAt?: number;
  qrDataUrl?: string;
  qrImageUrl?: string;
};

export function VisitPhoneCapturePanel({
  visitId,
  sessionKey,
  onUploaded,
  variant = "attachments",
  compact = false,
}: {
  visitId: string;
  sessionKey: string | number;
  onUploaded?: () => void;
  variant?: "attachments" | "photo-sheet";
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [qrLoadFailed, setQrLoadFailed] = useState(false);

  const startSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSession(null);
    setQrLoadFailed(false);
    try {
      const res = await fetch("/api/visits/phone-capture/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId }),
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = (await res.json()) as SessionResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not start phone capture.");
      }
      setSession(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start phone capture.");
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    void startSession();
  }, [startSession, sessionKey]);

  useEffect(() => {
    if (!session || !onUploaded) return;
    const interval = window.setInterval(() => {
      onUploaded();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [session, onUploaded]);

  const title = variant === "photo-sheet" ? "Phone camera — photo sheet" : "Phone camera";
  const description =
    variant === "photo-sheet"
      ? "Scan this QR on your phone to upload a photo for this visit. A new code is generated each time you open the visit or Photo sheet tab."
      : "Scan this QR on your phone to upload photos into this visit.";

  const qrSrc =
    session?.qrDataUrl ||
    (session?.qrImageUrl ? session.qrImageUrl : null);

  return (
    <section
      className={`rounded-xl border-2 border-primary/30 bg-white shadow-sm ${compact ? "p-2" : "p-3"}`}
      aria-label="Phone photo capture"
    >
      <p className={`font-semibold text-primary ${compact ? "text-[11px]" : "text-xs"}`}>{title}</p>
      <p className={`mt-1 text-slate-600 ${compact ? "text-[10px]" : "text-[11px]"}`}>{description}</p>

      {loading ? (
        <p className={`mt-3 text-slate-600 ${compact ? "text-[10px]" : "text-[11px]"}`}>Preparing QR code…</p>
      ) : null}

      {error ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-900" role="alert">
            {error}
          </p>
          <button type="button" className="btn-secondary btn-compact text-xs" onClick={() => void startSession()}>
            Try again
          </button>
        </div>
      ) : null}

      {session && !loading ? (
        <div className={`mt-3 flex flex-col gap-3 ${compact ? "" : "sm:flex-row sm:items-start"}`}>
          <div className="shrink-0 rounded-lg border border-slate-200 bg-white p-2">
            {qrSrc && !qrLoadFailed ? (
              // Native img — works in all browsers without Next.js image config
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrSrc}
                alt="QR code — scan with your phone camera"
                width={200}
                height={200}
                className="block h-[200px] w-[200px] max-w-full object-contain"
                onError={() => setQrLoadFailed(true)}
              />
            ) : (
              <div className="flex h-[200px] w-[200px] max-w-full flex-col items-center justify-center gap-2 bg-slate-50 px-3 text-center text-[11px] text-slate-600">
                <p>QR image could not load in this browser.</p>
                <p className="font-medium">Use the link below on your phone instead.</p>
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2 text-[11px] text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">Expires:</span>{" "}
              {new Date(session.expiresAt).toLocaleString()}
            </p>
            <p className="break-all">
              <span className="font-semibold text-slate-900">Phone link:</span>{" "}
              <a className="font-medium text-primary underline" href={session.captureUrl}>
                {session.captureUrl}
              </a>
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                className="btn-primary btn-compact text-xs"
                href={session.captureUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open on phone
              </a>
              <button type="button" className="btn-secondary btn-compact text-xs" onClick={() => void startSession()}>
                New QR code
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
