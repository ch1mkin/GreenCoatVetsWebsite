import Link from "next/link";
import { getPlatformBranding } from "@/lib/platform-branding";
import { requestPortalPasswordResetAction } from "./actions";

export default async function ForgotPasswordPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const branding = await getPlatformBranding();
  const sent = searchParams.sent === "1" || searchParams.sent === "true";
  const error = typeof searchParams.error === "string" ? searchParams.error : "";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 login-bg-gradient" aria-hidden />
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
        <form
          action={requestPortalPasswordResetAction}
          className="glass-card w-full max-w-md rounded-2xl border border-white/60 p-8 shadow-[0_24px_64px_-12px_rgba(23,28,31,0.12)] backdrop-blur-xl"
        >
          <div className="mb-6 flex items-center gap-3">
            {branding.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-contain" />
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{branding.product_name}</p>
              <h1 className="font-headline text-2xl font-extrabold text-on-background">Forgot password?</h1>
            </div>
          </div>

          <p className="text-sm text-on-surface-variant">
            Enter your work email and we will send you a link to reset your clinic portal password.
          </p>

          {sent ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              If an account exists for that email, a reset link has been sent. Check your inbox and spam folder.
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              That reset link is no longer valid. Request a new one below.
            </p>
          ) : null}

          <label className="mt-6 block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Work email</span>
            <input
              className="input-soft w-full px-4 py-3.5"
              type="email"
              name="email"
              placeholder="you@clinic.com"
              required
              autoComplete="email"
            />
          </label>

          <button type="submit" className="btn-primary mt-6 w-full py-3.5">
            Send reset link
          </button>

          <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </form>
      </main>
    </div>
  );
}
