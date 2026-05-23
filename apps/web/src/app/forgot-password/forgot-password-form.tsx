"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { requestPortalPasswordResetAction } from "./actions";

function SubmitResetLinkButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary mt-6 flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-60" disabled={pending}>
      {pending ? (
        <>
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
            aria-hidden
          />
          Sending reset link…
        </>
      ) : (
        "Send reset link"
      )}
    </button>
  );
}

export function ForgotPasswordForm({
  productName,
  logoUrl,
  sent,
  notice,
  errorMessage,
}: {
  productName: string;
  logoUrl: string | null;
  sent: boolean;
  notice: string | null;
  errorMessage: string | null;
}) {
  return (
    <form
      action={requestPortalPasswordResetAction}
      className="glass-card w-full max-w-md rounded-2xl border border-white/60 p-8 shadow-[0_24px_64px_-12px_rgba(23,28,31,0.12)] backdrop-blur-xl"
    >
      <div className="mb-6 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-contain" />
        ) : null}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{productName}</p>
          <h1 className="font-headline text-2xl font-extrabold text-on-background">Forgot password?</h1>
        </div>
      </div>

      <p className="text-sm text-on-surface-variant">
        Enter your work email and we will send you a link to reset your clinic portal password.
      </p>

      {sent ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {notice ??
            "If an account exists for that email, a reset link has been sent. Check your inbox and spam folder (the link is valid for 24 hours)."}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <label className="mt-6 block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Work email</span>
        <input
          className="input-soft w-full px-4 py-3.5"
          type="email"
          name="email"
          placeholder="you@clinic.com"
          required
          autoComplete="email"
          disabled={sent}
        />
      </label>

      <SubmitResetLinkButton />

      <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-primary hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
