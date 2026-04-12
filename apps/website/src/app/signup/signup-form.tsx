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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setStatus(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(mapLoginError(signUpError.message));
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
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
        <input className="w-full rounded-md border px-3 py-2" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <input className="w-full rounded-md border px-3 py-2" placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <input className="w-full rounded-md border px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordField
          inputClassName="w-full rounded-md border px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {status ? <p className="text-sm text-green-700">{status}</p> : null}
        <button className="w-full rounded-md bg-black px-4 py-2 text-white disabled:opacity-60" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create account"}
        </button>
        <Link className="block text-center text-sm underline" href="/login">
          Already have an account? Login
        </Link>
      </form>
    </main>
  );
}
