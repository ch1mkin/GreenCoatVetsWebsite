"use client";

import { FormEvent, useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { mapAuthError } from "@/lib/auth/map-auth-error";
import { createClient } from "@/lib/supabase/client";

export function PasswordChangeForm({ email }: { email: string }) {
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const trimmedPassword = nextPassword.trim();
    if (trimmedPassword.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (trimmedPassword !== confirmPassword.trim()) {
      setError("Password confirmation does not match.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: trimmedPassword,
      });
      if (updateError) {
        setError(mapAuthError(updateError.message));
        return;
      }

      setNextPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully. Use the new password the next time you log in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Password</p>
        <p className="mt-1 text-sm text-slate-600">
          You are signed in as <span className="font-semibold text-slate-900">{email}</span>. Set any password you prefer for future logins.
        </p>
      </div>

      <form className="space-y-3" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-700">New password</span>
          <PasswordField
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
            inputClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
            placeholder="Enter a new password"
            autoComplete="new-password"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold text-slate-700">Confirm password</span>
          <PasswordField
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            inputClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
            placeholder="Confirm the new password"
            autoComplete="new-password"
            required
          />
        </label>

        {error ? <p className="text-sm text-error">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

        <button className="btn-primary" type="submit" disabled={pending}>
          {pending ? "Updating password..." : "Update password"}
        </button>
      </form>
    </div>
  );
}
