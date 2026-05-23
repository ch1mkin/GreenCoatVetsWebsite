"use client";

import { useRef, useState } from "react";

export function VisitCaptureClient({ token }: { token: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setStatus("uploading");
    setMessage(null);
    const formData = new FormData();
    formData.set("token", token);
    formData.set("file", file);

    try {
      const res = await fetch("/api/visits/phone-capture/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; fileName?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }
      setStatus("done");
      setMessage(`Uploaded ${data.fileName ?? "photo"} — check attachments on your laptop.`);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-6 bg-surface px-4 py-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-primary">GreenCoatVets</p>
        <h1 className="font-headline text-2xl font-bold text-on-background">Visit photo capture</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Take a photo on your phone. It will appear in this visit&apos;s attachments on the laptop that showed the QR code.
        </p>
      </header>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-12 text-center">
        <span className="material-symbols-outlined text-4xl text-primary">photo_camera</span>
        <span className="font-semibold text-primary">Tap to take or choose a photo</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadFile(file);
          }}
        />
      </label>

      {status === "uploading" ? <p className="text-sm text-on-surface-variant">Uploading…</p> : null}
      {message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            status === "error" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"
          }`}
          role="status"
        >
          {message}
        </p>
      ) : null}

      <p className="text-xs text-on-surface-variant">
        You can upload multiple photos. Keep this visit open on your laptop to see new images appear under Attachments.
      </p>
    </div>
  );
}
