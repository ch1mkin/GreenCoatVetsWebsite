import Link from "next/link";
import { getPlatformBranding } from "@/lib/platform-branding";
import { completePortalPasswordResetAction } from "./actions";

function errorMessage(code: string): string | null {
  switch (code) {
    case "short_password":
      return "Use a password with at least 8 characters.";
    case "password_mismatch":
      return "Password confirmation does not match.";
    case "update_failed":
      return "We could not update the password. Please try again.";
    case "server_config":
      return "Password reset is not configured on the server.";
    default:
      return null;
  }
}

export default async function ResetPasswordPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const branding = await getPlatformBranding();
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  const error = typeof searchParams.error === "string" ? searchParams.error : "";
  const message = errorMessage(error);

  if (!token) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 login-bg-gradient" aria-hidden />
        <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
          <div className="glass-card w-full max-w-md rounded-2xl border border-white/60 p-8">
            <h1 className="font-headline text-2xl font-extrabold text-on-background">Reset password</h1>
            <p className="mt-2 text-sm text-on-surface-variant">This reset link is missing or invalid.</p>
            <Link href="/forgot-password" className="btn-primary mt-6 block py-3.5 text-center">
              Request new reset link
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 login-bg-gradient" aria-hidden />
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
        <form
          action={completePortalPasswordResetAction}
          className="glass-card w-full max-w-md rounded-2xl border border-white/60 p-8 shadow-[0_24px_64px_-12px_rgba(23,28,31,0.12)] backdrop-blur-xl"
        >
          <div className="mb-6 flex items-center gap-3">
            {branding.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-contain" />
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{branding.product_name}</p>
              <h1 className="font-headline text-2xl font-extrabold text-on-background">Choose a new password</h1>
            </div>
          </div>

          <p className="text-sm text-on-surface-variant">Set a new password for your clinic portal account.</p>
          {message ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p>
          ) : null}

          <input type="hidden" name="token" value={token} />
          <label className="mt-6 block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">New password</span>
            <input
              className="input-soft w-full px-4 py-3.5"
              type="password"
              name="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Confirm password</span>
            <input
              className="input-soft w-full px-4 py-3.5"
              type="password"
              name="confirm_password"
              placeholder="Repeat new password"
              autoComplete="new-password"
              required
            />
          </label>

          <button type="submit" className="btn-primary mt-6 w-full py-3.5">
            Update password
          </button>

          <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        </form>
      </main>
    </div>
  );
}
