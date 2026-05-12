import Link from "next/link";
import { getPlatformBranding } from "@/lib/platform-branding";
import { requestWebsitePasswordResetAction } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const branding = await getPlatformBranding();
  const sent = searchParams?.sent === "1";
  const error = typeof searchParams?.error === "string" ? searchParams.error : "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <form className="w-full space-y-4 rounded-lg border p-6" action={requestWebsitePasswordResetAction}>
        <div className="flex items-center gap-3">
          {branding.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-md object-contain" />
          ) : null}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{branding.product_name}</p>
            <h1 className="text-2xl font-semibold">Forgot password</h1>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Enter your login email and we will send you a password reset link.</p>
        {sent ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">If that email exists, a reset link has been sent.</p> : null}
        {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">That reset link is no longer valid. Request a new one below.</p> : null}

        <input className="w-full rounded-md border px-3 py-2" type="email" name="email" placeholder="Email" required />

        <button className="gradient-primary w-full rounded-xl px-4 py-3 font-headline text-sm font-bold text-on-primary shadow-md" type="submit">
          Send reset link
        </button>

        <Link className="block text-center text-sm underline" href="/login">
          Back to login
        </Link>
      </form>
    </main>
  );
}
