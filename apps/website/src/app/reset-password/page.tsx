import Link from "next/link";
import { getPlatformBranding } from "@/lib/platform-branding";
import { completeWebsitePasswordResetAction } from "./actions";

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
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const branding = await getPlatformBranding();
  const token = typeof searchParams?.token === "string" ? searchParams.token : "";
  const error = typeof searchParams?.error === "string" ? searchParams.error : "";
  const message = errorMessage(error);

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
        <div className="w-full space-y-4 rounded-lg border p-6">
          <h1 className="text-2xl font-semibold">Reset password</h1>
          <p className="text-sm text-muted-foreground">This reset link is missing or invalid. Request a new one below.</p>
          <Link className="gradient-primary block rounded-xl px-4 py-3 text-center font-headline text-sm font-bold text-on-primary shadow-md" href="/forgot-password">
            Request new reset link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <form className="w-full space-y-4 rounded-lg border p-6" action={completeWebsitePasswordResetAction}>
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-md object-contain" />
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{branding.product_name}</p>
            <h1 className="text-2xl font-semibold">Choose a new password</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Set a new password for your website account.</p>
        {message ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null}
        <input type="hidden" name="token" value={token} />
        <input className="w-full rounded-md border px-3 py-2" type="password" name="password" placeholder="New password" autoComplete="new-password" required />
        <input
          className="w-full rounded-md border px-3 py-2"
          type="password"
          name="confirm_password"
          placeholder="Confirm new password"
          autoComplete="new-password"
          required
        />

        <button className="gradient-primary w-full rounded-xl px-4 py-3 font-headline text-sm font-bold text-on-primary shadow-md" type="submit">
          Update password
        </button>

        <Link className="block text-center text-sm underline" href="/login">
          Back to login
        </Link>
      </form>
    </main>
  );
}
