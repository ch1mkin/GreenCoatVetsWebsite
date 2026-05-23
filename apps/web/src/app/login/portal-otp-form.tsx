"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { beginPortalLoginOtpAction, verifyPortalLoginOtpAction } from "./otp-actions";

export function PortalOtpForm({
  email,
  nextPath,
  sendCodeOnMount = false,
}: {
  email: string;
  nextPath: string;
  sendCodeOnMount?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const autoSendStarted = useRef(false);

  useEffect(() => {
    if (!sendCodeOnMount || autoSendStarted.current) return;
    autoSendStarted.current = true;

    startTransition(async () => {
      const result = await beginPortalLoginOtpAction(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`A 4-digit code was sent to ${result.sentTo || email}.`);
    });
  }, [sendCodeOnMount, email]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("code", code);
      formData.set("next", nextPath);
      const result = await verifyPortalLoginOtpAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(result.next || "/dashboard");
      router.refresh();
    });
  }

  function resendCode() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await beginPortalLoginOtpAction(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`A fresh 4-digit code was sent to ${result.sentTo || email}.`);
    });
  }

  return (
    <form className="space-y-4 rounded-2xl border border-white/60 p-8 shadow-[0_24px_64px_-12px_rgba(23,28,31,0.12)] backdrop-blur-xl bg-white/85" onSubmit={handleSubmit}>
      <div className="text-center">
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-background">Verify your email</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Enter the 4-digit code sent to <span className="font-semibold text-on-background">{email}</span>.
        </p>
      </div>

      <input
        className="input-soft w-full px-4 py-4 text-center text-2xl tracking-[0.45em]"
        inputMode="numeric"
        maxLength={4}
        minLength={4}
        pattern="\d{4}"
        placeholder="0000"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
        required
      />

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-error">{error}</p> : null}

      <button className="btn-primary w-full py-4 disabled:opacity-60" type="submit" disabled={pending}>
        {pending ? "Verifying…" : "Verify and continue"}
      </button>
      <button
        type="button"
        className="w-full rounded-2xl border border-outline-variant/30 px-4 py-3 text-sm font-semibold text-on-surface transition hover:bg-surface-container-low disabled:opacity-60"
        onClick={resendCode}
        disabled={pending}
      >
        Resend code
      </button>
    </form>
  );
}
