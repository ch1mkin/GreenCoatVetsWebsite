"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/PasswordField";
import { mapLoginError } from "@/lib/auth/map-auth-error";

export function LoginForm({
  productName,
  logoUrl,
}: {
  productName: string;
  logoUrl: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const invite = (searchParams.get("invite") ?? "").trim();
  const redirectAfter = (searchParams.get("redirect") ?? "").trim();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setIsSubmitting(false);
      setError(mapLoginError(signInError.message));
      return;
    }

    if (invite) {
      const { error: inviteError } = await supabase.rpc("consume_clinic_role_invite", {
        p_token: invite,
        p_full_name: null,
        p_phone: null,
      });
      if (inviteError) {
        setIsSubmitting(false);
        setError(mapLoginError(inviteError.message));
        return;
      }
    }

    setIsSubmitting(false);
    const safeRedirect =
      redirectAfter.startsWith("/") && !redirectAfter.startsWith("//") ? redirectAfter : "/account";
    router.push(safeRedirect);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <form className="w-full space-y-4 rounded-lg border p-6" onSubmit={onSubmit}>
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-contain" />
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{productName}</p>
            <h1 className="text-2xl font-semibold">Pet Owner Login</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Sign in to view appointments, orders, and pet records.
        </p>
        {redirectAfter === "/book" ? (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">
            Sign in to continue to <strong>book an appointment</strong>.
          </p>
        ) : null}
        {invite ? (
          <p className="text-xs text-muted-foreground">
            Invite detected. We will auto-assign your clinic role after login.
          </p>
        ) : null}
        <input
          className="w-full rounded-md border px-3 py-2"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordField
          inputClassName="w-full rounded-md border px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          className="gradient-primary w-full rounded-xl px-4 py-3 font-headline text-sm font-bold text-on-primary shadow-md disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <Link className="block text-center text-sm underline" href="/signup">
          New pet owner? Create account
        </Link>
      </form>
    </main>
  );
}
