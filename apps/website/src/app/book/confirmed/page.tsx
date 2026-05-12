import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { clinicMetadata } from "@/lib/seo/clinic-metadata";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return clinicMetadata({
    clinicName: clinic.name,
    title: `Booking received | ${clinic.name}`,
    description: "Your appointment request was submitted.",
    path: "/book/confirmed",
  });
}

export default async function BookConfirmedPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const clinic = await resolveClinic();
  const tokenRaw = searchParams.token;
  const token = typeof tokenRaw === "string" ? tokenRaw : Array.isArray(tokenRaw) ? tokenRaw[0] : "";
  const branchRaw = searchParams.branch;
  const branchName = typeof branchRaw === "string" ? branchRaw : Array.isArray(branchRaw) ? branchRaw[0] : "";

  return (
    <main className="bg-surface min-h-[60vh] px-6 py-16">
      <div className="mx-auto max-w-lg rounded-3xl border border-outline-variant/30 bg-surface-container-lowest p-8 shadow-xl">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
          <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
        </div>
        <h1 className="mt-6 font-headline text-2xl font-extrabold text-on-surface">Request received</h1>
        <p className="mt-3 text-on-surface-variant leading-relaxed">
          Thank you — <strong>{clinic.name}</strong> can see this booking in their schedule. Save your reference code below.
        </p>
        {branchName ? (
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-on-surface">
            Your appointment was sent to the <strong>{branchName}</strong> branch.
          </div>
        ) : null}
        {token ? (
          <div className="mt-6 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Your link code</p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-tight text-on-surface break-all">{token}</p>
            <p className="mt-2 text-xs text-on-surface-variant">
              When you create an account with the <strong>same email</strong> you used to book, this visit attaches automatically. Or sign in and enter this
              code under your account to link it.
            </p>
          </div>
        ) : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="gradient-primary inline-flex justify-center rounded-xl px-6 py-3 font-headline font-bold text-on-primary">
            Back to home
          </Link>
          <Link
            href="/signup"
            className="inline-flex justify-center rounded-xl border border-outline-variant px-6 py-3 font-headline font-semibold text-on-surface"
          >
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
