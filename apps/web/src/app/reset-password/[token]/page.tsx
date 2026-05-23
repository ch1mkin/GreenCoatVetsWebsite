import Link from "next/link";
import { validatePortalPasswordResetToken } from "@/lib/auth/portal-password-reset";
import { getPlatformBranding } from "@/lib/platform-branding";
import { ResetPasswordForm } from "../reset-password-form";

export const dynamic = "force-dynamic";

function formErrorMessage(code: string): string | null {
  switch (code) {
    case "short_password":
      return "Use a password with at least 8 characters.";
    case "password_mismatch":
      return "Password confirmation does not match.";
    case "update_failed":
      return "We could not update the password. Please try again or request a new link.";
    case "server_config":
      return "Password reset is not configured on the server. Contact your administrator.";
    default:
      return null;
  }
}

function tokenErrorMessage(reason: string): string {
  switch (reason) {
    case "expired":
      return "This reset link has expired. Request a new one below.";
    case "used":
      return "This reset link was already used. Request a new one below.";
    case "missing":
    case "invalid":
    default:
      return "This reset link is invalid. Request a new one below.";
  }
}

export default async function ResetPasswordWithTokenPage({
  params,
  searchParams = {},
}: {
  params: { token: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const branding = await getPlatformBranding();
  const token = decodeURIComponent(params.token ?? "").trim();
  const formError = typeof searchParams.error === "string" ? formErrorMessage(searchParams.error) : null;

  const validation = await validatePortalPasswordResetToken(token);

  if (!validation.ok) {
    return (
      <div className="relative min-h-screen overflow-hidden">
        <div className="absolute inset-0 login-bg-gradient" aria-hidden />
        <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
          <div className="glass-card w-full max-w-md rounded-2xl border border-white/60 p-8">
            <h1 className="font-headline text-2xl font-extrabold text-on-background">Reset password</h1>
            <p className="mt-2 text-sm text-on-surface-variant">{tokenErrorMessage(validation.reason)}</p>
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
        <ResetPasswordForm
          productName={branding.product_name}
          logoUrl={branding.logo_url}
          token={token}
          errorMessage={formError}
        />
      </main>
    </div>
  );
}
