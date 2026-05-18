"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/PasswordField";
import { createClient } from "@/lib/supabase/client";
import { userMustChangePassword } from "@/lib/admin/must-change-password";
import { mapLoginError } from "@/lib/auth/map-auth-error";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const err = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(
    err === "forbidden" ? "Access denied — super admin or website editor only." : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage(mapLoginError(error.message));
      return;
    }

    if (userMustChangePassword(data.user)) {
      router.refresh();
      router.push("/admin/change-password");
      return;
    }

    const { data: isSuper } = await supabase.rpc("is_super_admin");
    if (isSuper) {
      router.refresh();
      router.push("/admin");
      return;
    }
    const { data: editor } = await supabase
      .from("user_clinic_memberships")
      .select("clinic_id")
      .eq("user_id", data.user.id)
      .eq("role", "marketing_editor")
      .eq("is_active", true)
      .maybeSingle();
    router.refresh();
    router.push(editor?.clinic_id ? "/admin/settings" : "/admin/login?error=forbidden");
  }

  return (
    <div className="group relative w-full max-w-[420px]">
      {/* Glow behind card */}
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary/50 via-emerald-500/20 to-transparent opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
      <form
        onSubmit={onSubmit}
        className="group relative overflow-hidden rounded-2xl border border-white/20 bg-white/95 p-8 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-40 w-40 rounded-full bg-primary/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-teal-600/10 blur-2xl" />

        <div className="relative">
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
              <span className="material-symbols-outlined text-2xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                admin_panel_settings
              </span>
              <span className="admin-login-ring absolute inset-0 rounded-xl ring-2 ring-primary/30 ring-offset-2 ring-offset-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">SaaSClinics</p>
              <h1 className="font-headline text-xl font-extrabold tracking-tight text-slate-900">Control center</h1>
            </div>
          </div>

          <p className="mb-6 text-sm leading-relaxed text-slate-600">
            For <span className="font-semibold text-slate-800">super administrators</span> (full site) and{" "}
            <span className="font-semibold text-slate-800">website editors</span> (blog, homepage images, and reviews). Accounts are managed in the main platform.
          </p>

          {message ? (
            <p
              className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              <span className="material-symbols-outlined shrink-0 text-lg text-red-600">error</span>
              {message}
            </p>
          ) : null}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="email">
                Work email
              </label>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-11 pr-4 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                  placeholder="you@clinic.com"
                />
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Password</span>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-[calc(50%-2px)] z-[1] -translate-y-1/2 text-slate-400 text-xl">
                  lock
                </span>
                <PasswordField
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  inputClassName="w-full rounded-xl border border-slate-200 bg-slate-50/80 py-3 pl-11 pr-12 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="relative mt-8 w-full overflow-hidden rounded-xl py-3.5 font-headline text-sm font-bold text-white shadow-lg shadow-primary/30 transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-primary via-emerald-600 to-primary bg-[length:200%_100%] transition-all duration-500 hover:bg-right" />
            <span className="admin-login-shine pointer-events-none absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
            <span className="relative flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Authenticating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                    login
                  </span>
                  Enter dashboard
                </>
              )}
            </span>
          </button>

          <p className="mt-6 text-center text-[11px] text-slate-400">
            <span className="material-symbols-outlined align-middle text-sm text-slate-300">shield</span> Encrypted session · Role verified
            after login
          </p>
        </div>
      </form>
    </div>
  );
}
