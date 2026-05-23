import { getPlatformBranding } from "@/lib/platform-branding";
import { ForgotPasswordForm } from "./forgot-password-form";

export const dynamic = "force-dynamic";

function mapForgotPasswordError(code: string): string | null {
  switch (code) {
    case "invalid_token":
      return "That reset link is invalid or was already used. Request a new one below.";
    case "expired_token":
      return "That reset link has expired. Request a new one below.";
    case "send_failed":
      return "We could not send the email right now. Check server mail settings and try again.";
    default:
      return null;
  }
}

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
        <ForgotPasswordForm
          productName={branding.product_name}
          logoUrl={branding.logo_url}
          sent={sent}
          notice={sent ? "If an account exists for that email, a reset link has been sent. Check your inbox and spam folder (the link is valid for 24 hours)." : null}
          errorMessage={mapForgotPasswordError(error)}
        />
      </main>
    </div>
  );
}
