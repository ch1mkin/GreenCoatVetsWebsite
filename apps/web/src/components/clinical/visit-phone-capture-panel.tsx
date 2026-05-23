"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

type SessionResponse = {
  captureUrl: string;
  expiresAt: string;
  qrImageUrl: string;
};

export function VisitPhoneCapturePanel({
  visitId,
  onUploaded,
  variant = "attachments",
}: {
  visitId: string;
  onUploaded?: () => void;
  variant?: "attachments" | "photo-sheet";
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);

  const startSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/visits/phone-capture/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId }),
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
  }, [startSession]);

  useEffect(() => {
    if (!session || !onUploaded) return;
    const interval = window.setInterval(() => {
      onUploaded();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [session, onUploaded]);

  const title = variant === "photo-sheet" ? "Phone camera — photo sheet" : "Phone camera (doctor)";
  const description =
    variant === "photo-sheet"
      ? "Scan this QR on your phone while this visit is open on your laptop. The original photo appears below — then save as the visit PDF."
      : "Scan this QR on your phone while this visit is open on your laptop. Photos upload straight into this visit's attachments.";

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="text-[11px] font-semibold text-primary">{title}</p>
      <p className="mt-1 text-[11px] text-on-surface-variant">{description}</p>

      {error ? <p className="mt-2 text-[11px] text-red-700">{error}</p> : null}

      {loading && !session ? <p className="mt-2 text-[11px] text-on-surface-variant">Preparing QR…</p> : null}

      {session ? (
        <div className="mt-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div className="rounded-lg border border-outline-variant/20 bg-white p-2 shadow-sm">
            <Image
              src={session.qrImageUrl}
              alt="QR code to open phone capture"
              width={160}
              height={160}
              unoptimized
              className="h-40 w-40"
            />
          </div>
          <div className="min-w-0 space-y-2 text-[11px]">
            <p className="text-on-surface-variant">
              Link expires {new Date(session.expiresAt).toLocaleString()}.
            </p>
            <a className="break-all font-medium text-primary underline" href={session.captureUrl}>
              Open on phone
            </a>
            <button type="button" className="btn-secondary btn-compact block" onClick={() => void startSession()}>
              Refresh QR
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
