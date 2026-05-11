"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/PasswordField";
import { mapLoginError } from "@/lib/auth/map-auth-error";

export function WebsiteSignupForm({
  productName,
  logoUrl,
}: {
  productName: string;
  logoUrl: string | null;
}) {
  const searchParams = useSearchParams();
  const invite = (searchParams.get("invite") ?? "").trim();
  const emailFromUrl = (searchParams.get("email") ?? "").trim();
  const oauthMode = searchParams.get("oauth") === "google";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (emailFromUrl) setEmail(emailFromUrl);
  }, [emailFromUrl]);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user?.email?.trim();
      if (u) setEmail((prev) => prev || u);
    });
  }, []);

  useEffect(() => {
    if (!oauthMode) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session?.user) return;
      const metadata = session.user.user_metadata as {
        full_name?: string;
        name?: string;
        phone?: string;
        email?: string;
      } | undefined;
      setEmail((prev) => prev || session.user.email || metadata?.email || "");
      setFullName((prev) => prev || metadata?.full_name || metadata?.name || "");
      setPhone((prev) => prev || metadata?.phone || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [oauthMode]);

  async function onContinueWithGoogle() {
    setIsSubmitting(true);
    setError(null);
    setStatus(null);

    const supabase = createClient();
    const nextParams = new URLSearchParams({ oauth: "google" });
    if (invite) nextParams.set("invite", invite);
    if (email) nextParams.set("email", email);
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", `/signup?${nextParams.toString()}`);
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
    setIsSubmitting(true);
    setError(null);
    setStatus(null);

    const supabase = createClient();
    let signInError: { message: string } | null = null;
    if (!oauthMode) {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(mapLoginError(signUpError.message));
        setIsSubmitting(false);
        return;
      }

      const signInResult = await supabase.auth.signInWithPassword({ email, password });
      signInError = signInResult.error;
    } else {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setError("Continue with Google first, then finish signup here.");
        setIsSubmitting(false);
        return;
      }
      signInError = null;
    }

    if (!signInError) {
      if (invite) {
        const { error: inviteError } = await supabase.rpc("consume_clinic_role_invite", {
          p_token: invite,
          p_full_name: fullName,
          p_phone: phone,
        });
        if (inviteError) {
          setError(mapLoginError(inviteError.message));
          setIsSubmitting(false);
          return;
        }
      } else {
        const res = await fetch("/api/register-owner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fullName, phone }),
        });
        if (!res.ok) {
          const payload = (await res.json()) as { error?: string };
          setError(payload.error ?? "Owner profile setup failed.");
          setIsSubmitting(false);
          return;
        }
      }

      setIsSubmitting(false);
      router.push("/account");
      router.refresh();
      return;
    }

    if (invite) {
      setStatus("Account created. Verify email (if required), then login from this invite link to join the clinic.");
      setIsSubmitting(false);
      return;
    }

    setStatus("Account created. Verify email (if required), then login to complete owner profile.");
    setIsSubmitting(false);
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
            <h1 className="text-2xl font-semibold">Create Pet Owner Account</h1>
          </div>
        </div>
        {invite ? (
          <p className="text-sm text-muted-foreground">
            Invite detected. Your clinic and role will be assigned during signup.
          </p>
        ) : null}
        {oauthMode ? (
          <p className="text-sm font-medium text-primary">Google account connected. Finish your profile details below.</p>
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
            <span>Or continue with email</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
        </div>
        <input className="w-full rounded-md border px-3 py-2" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input className="w-full rounded-md border px-3 py-2" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input className="w-full rounded-md border px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {!oauthMode ? (
          <PasswordField
            inputClassName="w-full rounded-md border px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        ) : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {status ? <p className="text-sm text-green-700">{status}</p> : null}
        <button className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-60" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : oauthMode ? "Finish signup" : "Create account"}
        </button>
        <Link className="block text-center text-sm underline" href="/login">
          Already have an account? Login
        </Link>
      </form>
    </main>
  );
}
