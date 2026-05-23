"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { completePortalPasswordResetAction } from "./actions";

function SubmitNewPasswordButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary mt-6 flex w-full items-center justify-center gap-2 py-3.5 disabled:opacity-60" disabled={pending}>
      {pending ? (
        <>
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
            aria-hidden
          />
          Updating password…
        </>
      ) : (
        "Update password"
      )}
    </button>
  );
}

export function ResetPasswordForm({
  productName,
  logoUrl,
  token,
  errorMessage,
}: {
  productName: string;
  logoUrl: string | null;
  token: string;
  errorMessage: string | null;
}) {
  return (
    <form
      action={completePortalPasswordResetAction}
      className="glass-card w-full max-w-md rounded-2xl border border-white/60 p-8 shadow-[0_24px_64px_-12px_rgba(23,28,31,0.12)] backdrop-blur-xl"
    >
      <div className="mb-6 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-contain" />
        ) : null}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{productName}</p>
          <h1 className="font-headline text-2xl font-extrabold text-on-background">Choose a new password</h1>
        </div>
      </div>

      <p className="text-sm text-on-surface-variant">Set a new password for your clinic portal account.</p>
      {errorMessage ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <input type="hidden" name="token" value={token} readOnly />
      <label className="mt-6 block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">New password</span>
        <input
          className="input-soft w-full px-4 py-3.5"
          type="password"
          name="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </label>
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Confirm password</span>
        <input
          className="input-soft w-full px-4 py-3.5"
          type="password"
          name="confirm_password"
          placeholder="Repeat new password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </label>

      <SubmitNewPasswordButton />

      <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-primary hover:underline">
        Back to sign in
      </Link>
    </form>
  );
}
