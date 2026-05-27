"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PasswordField } from "@/components/PasswordField";
import { mapAuthError } from "@/lib/auth/map-auth-error";
import { beginPortalLoginOtpAction } from "@/app/login/otp-actions";
import { notifyPortalNewUserRegistrationAction, sendPortalWelcomeEmailAction } from "./actions";

export function SignupForm({
  productName,
  logoUrl,
}: {
  productName: string;
  logoUrl: string | null;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workingHours, setWorkingHours] = useState("");
  const [inviteRole, setInviteRole] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const invite = (searchParams.get("invite") ?? "").trim();

  useEffect(() => {
    if (!invite) {
      setInviteRole(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.rpc("peek_clinic_role_invite", { p_token: invite });
      if (cancelled) return;
      const row = Array.isArray(data) && data[0] ? (data[0] as { role: string }) : null;
      setInviteRole(row?.role ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [invite]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setStatus(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });
    if (signUpError) {
      setIsSubmitting(false);
      setError(mapAuthError(signUpError.message));
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setIsSubmitting(false);
      setError(mapAuthError(signInError.message));
      return;
    }

    if (invite) {
      const { error: inviteError } = await supabase.rpc("consume_clinic_role_invite", {
        p_token: invite,
        p_full_name: fullName || null,
        p_phone: null,
        p_working_hours: inviteRole === "doctor" || inviteRole === "senior_doctor" ? workingHours.trim() || null : null,
      });
      if (inviteError) {
        setIsSubmitting(false);
        setError(mapAuthError(inviteError.message));
        return;
      }
      await sendPortalWelcomeEmailAction({
        email,
        fullName,
        roleLabel: inviteRole ? inviteRole.replace(/_/g, " ") : null,
      });
      void notifyPortalNewUserRegistrationAction({
        fullName,
        email,
        registrationSource: "portal_staff_invite",
        role: inviteRole,
      });
      const otpResult = await beginPortalLoginOtpAction(email);
      if (!otpResult.ok) {
        setIsSubmitting(false);
        setError(otpResult.error);
        return;
      }
      router.push("/login/verify-email?next=/dashboard");
      router.refresh();
      return;
    }

    await supabase.rpc("ensure_primary_clinic_customer_membership", {
      p_full_name: fullName.trim() || null,
      p_phone: null,
    });
    await sendPortalWelcomeEmailAction({
      email,
      fullName,
      roleLabel: null,
    });
    void notifyPortalNewUserRegistrationAction({
      fullName,
      email,
      registrationSource: "portal_customer",
      role: null,
    });
    const otpResult = await beginPortalLoginOtpAction(email);
    if (!otpResult.ok) {
      setIsSubmitting(false);
      setError(otpResult.error);
      return;
    }
    router.push("/login/verify-email?next=/dashboard");
    router.refresh();
    setIsSubmitting(false);
  }

  return (
    <main className="min-h-screen bg-background text-on-background">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-12">
        <section className="relative flex flex-col justify-center px-6 py-12 lg:col-span-5 lg:px-20">
          <div className="absolute left-6 top-8 flex items-center gap-3 lg:left-20">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-contain" />
            ) : null}
            <p className="font-headline text-xl font-extrabold tracking-tight text-primary">{productName}</p>
          </div>

          <div className="w-full max-w-md">
            <h1 className="font-headline text-4xl font-extrabold tracking-tight">Get started</h1>
            <p className="mt-3 text-on-surface-variant">
              Create your account and continue with clinic onboarding.
            </p>
            {invite ? (
              <p className="mt-3 text-sm font-semibold text-primary">
                Invite detected. Clinic and role will be assigned during signup.
              </p>
            ) : null}
            {inviteRole === "doctor" || inviteRole === "senior_doctor" ? (
              <p className="mt-2 text-xs font-semibold text-primary">Doctor invite detected. Working hours are required.</p>
            ) : null}

            <form className="mt-8 space-y-4" onSubmit={onSubmit}>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs font-semibold text-primary">
                Google sign-up is available on the public website only. Create web portal accounts with email and password.
              </div>
              <input
                className="input-soft w-full px-4 py-3.5"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
              {inviteRole === "doctor" ? (
                <input
                  className="input-soft w-full px-4 py-3.5"
                  placeholder="Working hours (e.g. Mon-Sat 10:00-18:00)"
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  required
                />
              ) : null}
              <input className="input-soft w-full px-4 py-3.5" type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <PasswordField
                inputClassName="input-soft w-full px-4 py-3.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              {error ? <p className="text-sm text-error">{error}</p> : null}
              {status ? <p className="text-sm text-primary">{status}</p> : null}
              <button className="btn-primary w-full py-4 disabled:opacity-60" type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Continue"}
              </button>
              <p className="text-center text-sm text-on-surface-variant">
                Already have an account?{" "}
                <Link className="font-bold text-primary hover:underline" href="/login">
                  Log in
                </Link>
              </p>
            </form>
          </div>
        </section>

        <aside className="relative hidden overflow-hidden bg-surface-container-high lg:flex lg:col-span-7">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-container/30 to-primary/60" />
          <div className="relative z-10 m-auto max-w-xl rounded-xl bg-white/80 p-10 shadow-[0_12px_32px_rgba(23,28,31,0.06)] backdrop-blur">
            <p className="font-headline text-2xl font-bold leading-snug text-on-background">
              Calm workflows, precise operations, and role-based access for every part of your clinic.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
