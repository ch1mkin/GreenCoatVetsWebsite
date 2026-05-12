"use client";

import { FormEvent, useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { mapLoginError } from "@/lib/auth/map-auth-error";
import { createClient } from "@/lib/supabase/client";

export function WebsitePasswordChangeForm({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const nextPassword = password.trim();
    if (nextPassword.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (nextPassword !== confirmPassword.trim()) {
      setError("Password confirmation does not match.");
      return;
    }

    setPending(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
      if (updateError) {
        setError(mapLoginError(updateError.message));
        return;
      }
      setPassword("");
      setConfirmPassword("");
      setMessage("Password updated successfully.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4 rounded-2xl border border-surface-container-high bg-surface-container-lowest p-6" onSubmit={onSubmit}>
      <div>
        <p className="font-headline text-lg font-bold text-on-surface">Password</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          You are signed in as <span className="font-semibold text-on-surface">{email}</span>.
        </p>
      </div>

      <PasswordField
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        inputClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
        placeholder="New password"
        autoComplete="new-password"
        required
      />
      <PasswordField
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        inputClassName="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
        placeholder="Confirm new password"
        autoComplete="new-password"
        required
      />

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}

      <button className="gradient-primary rounded-xl px-4 py-3 font-headline text-sm font-bold text-on-primary shadow-md disabled:opacity-60" type="submit" disabled={pending}>
        {pending ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
