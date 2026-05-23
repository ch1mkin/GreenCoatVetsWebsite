import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlatformBranding } from "@/lib/platform-branding";

export const dynamic = "force-dynamic";

/** Legacy query links (?token=) redirect to path-based URLs so tokens are not stripped by caches. */
export default async function ResetPasswordRedirectPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const token = typeof searchParams.token === "string" ? searchParams.token.trim() : "";
  if (token) {
    redirect(`/reset-password/${encodeURIComponent(token)}`);
  }

  const branding = await getPlatformBranding();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 login-bg-gradient" aria-hidden />
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
        <div className="glass-card w-full max-w-md rounded-2xl border border-white/60 p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">{branding.product_name}</p>
          <h1 className="font-headline text-2xl font-extrabold text-on-background">Reset password</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Open the reset link from your email, or request a new one.</p>
          <Link href="/forgot-password" className="btn-primary mt-6 block py-3.5 text-center">
            Request reset link
          </Link>
        </div>
      </main>
    </div>
  );
}
