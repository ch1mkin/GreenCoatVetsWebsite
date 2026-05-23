"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/PasswordField";
import { loginHintMessage } from "@/lib/auth/login-hints";
import { resolveWebsitePublicLoginRoutingAction } from "@/lib/auth/login-routing-actions";
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
  const oauthMode = searchParams.get("oauth") === "google";
  const resetDone = searchParams.get("reset") === "1";
  const hintMessage = loginHintMessage(searchParams.get("hint"));

  useEffect(() => {
    if (!oauthMode) return;
    let cancelled = false;

    (async () => {
      setError(null);
      setIsSubmitting(true);
      const supabase = createClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (cancelled) return;
      if (sessionError || !session?.user) {
        setIsSubmitting(false);
        setError(sessionError ? mapLoginError(sessionError.message) : "Google sign-in could not be completed.");
        return;
      }

      if (invite) {
        const { error: inviteError } = await supabase.rpc("consume_clinic_role_invite", {
          p_token: invite,
          p_full_name: null,
          p_phone: null,
        });
        if (cancelled) return;
        if (inviteError) {
          setIsSubmitting(false);
          setError(mapLoginError(inviteError.message));
          return;
        }
      }

      await finishWebsitePublicSignIn(() => cancelled);
    })();

    return () => {
      cancelled = true;
    };
  }, [invite, oauthMode, redirectAfter, router]);

  async function finishWebsitePublicSignIn(isCancelled?: () => boolean) {
    const routing = await resolveWebsitePublicLoginRoutingAction();
    if (isCancelled?.()) return;
    if (!routing.ok) {
      setIsSubmitting(false);
      setError(routing.error);
      return;
    }
    if (routing.kind === "external") {
      window.location.assign(routing.url);
      return;
    }

    const safeRedirect =
      redirectAfter.startsWith("/") && !redirectAfter.startsWith("//") ? redirectAfter : routing.next;
    setIsSubmitting(false);
    router.replace(safeRedirect);
    router.refresh();
  }

  async function onContinueWithGoogle() {
    setError(null);
    setIsSubmitting(true);
    const supabase = createClient();
    const nextParams = new URLSearchParams({ oauth: "google" });
    if (invite) nextParams.set("invite", invite);
    if (redirectAfter) nextParams.set("redirect", redirectAfter);
    const nextPath = `/login?${nextParams.toString()}`;
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", nextPath);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectTo.toString(),
        queryParams: { prompt: "select_account" },
      },
    });

    if (oauthError) {
      setIsSubmitting(false);
      setError(mapLoginError(oauthError.message));
    }
  }

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

    await finishWebsitePublicSignIn();
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
        {resetDone ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Password updated. You can sign in with the new password now.
          </p>
        ) : null}
        {hintMessage ? (
          <p className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary">{hintMessage}</p>
        ) : null}
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
        <div className="space-y-3">
          <button
            type="button"
            onClick={onContinueWithGoogle}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-900 shadow-sm transition hover:border-primary/30 hover:bg-primary/5 disabled:opacity-60"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[13px] font-bold text-[#4285F4] shadow-sm">
              G
            </span>
            Continue with Google
          </button>
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-px flex-1 bg-slate-200" />
            <span>Email and password</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </div>
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
        <Link className="block text-center text-sm underline" href="/forgot-password">
          Forgot password?
        </Link>
        <Link className="block text-center text-sm underline" href="/signup">
          New pet owner? Create account
        </Link>
      </form>
    </main>
  );
}
