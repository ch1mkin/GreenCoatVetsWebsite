"use client";

import { FormEvent, useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { completeAdminPasswordChangeAction } from "./actions";

export function AdminChangePasswordForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData();
    formData.set("password", password);
    formData.set("confirm_password", confirmPassword);

    try {
      await completeAdminPasswordChangeAction(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/95 p-8 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">Required step</p>
        <h1 className="mt-2 font-headline text-2xl font-extrabold text-slate-900">Set your password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Signed in as <span className="font-semibold text-slate-900">{email}</span>. Replace the temporary password
          your administrator sent you before using the marketing admin panel.
        </p>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">New password</span>
          <PasswordField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
            inputClassName="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Confirm password</span>
          <PasswordField
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="Repeat new password"
            inputClassName="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-slate-900 outline-none focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-8 w-full rounded-xl bg-primary py-3.5 font-headline text-sm font-bold text-white shadow-lg shadow-primary/30 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save password and continue"}
      </button>
    </form>
  );
}
