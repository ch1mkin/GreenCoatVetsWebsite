import Link from "next/link";
import { getPlatformBranding } from "@/lib/platform-branding";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const branding = await getPlatformBranding();
  const name = branding.product_name;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen flex-col bg-surface">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
        <div>
          <div className="flex flex-wrap items-center gap-4">
            {branding.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={branding.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-contain" />
            ) : null}
            <p className="font-headline text-sm font-bold uppercase tracking-widest text-primary">{name}</p>
          </div>
          <h1 className="font-headline mt-2 text-4xl font-extrabold tracking-tight text-on-background md:text-5xl">
            Clinical operations portal
          </h1>
          <p className="mt-4 max-w-xl text-lg font-medium text-on-surface-variant">
            Branches, appointments, medical records, pharmacy, ecommerce, and payments — unified for your clinic team.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {user ? (
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-container to-primary px-6 py-3 font-semibold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98]"
              href="/dashboard"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-primary-container to-primary px-6 py-3 font-semibold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98]"
              href="/login"
            >
              Sign in
            </Link>
          )}
        </div>
        <p className="text-xs text-on-surface-variant">
          Staff accounts are provisioned by your clinic admin. Pet owners use invite links or QR onboarding.
        </p>
      </div>
    </main>
  );
}
