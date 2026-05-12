import Link from "next/link";
import { redirect } from "next/navigation";
import { ClaimBookingForm } from "@/components/site/claim-booking-form";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getOwnerPortalContext } from "@/lib/owner/portal";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account");
  }

  const siteClinic = await resolveClinic();
  const portal = await getOwnerPortalContext(user.id);
  const ownerClinic = portal?.clinic;
  const owner = portal?.owner ?? null;
  const claimed = searchParams.claimed === "1" || searchParams.claimed === "true";

  return (
    <main className="bg-surface pb-20 pt-8 text-on-background sm:pt-12">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Pet owner portal</p>
          <div className="mt-1 flex flex-row items-center justify-between gap-3">
            <h1 className="min-w-0 font-headline text-3xl font-extrabold tracking-tight sm:text-4xl">Welcome back</h1>
            <form action="/auth/signout" method="post" className="shrink-0">
              <button
                type="submit"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:border-red-300 hover:bg-red-100"
              >
                Sign out
              </button>
            </form>
          </div>
          <p className="mt-2 text-on-surface-variant">
            Signed in as <span className="font-medium text-on-surface">{user.email}</span>
          </p>
          <p className="mt-3 text-sm text-on-surface-variant">
            {ownerClinic ? (
              <>
                Your clinic: <strong className="text-on-surface">{ownerClinic.name}</strong>
                {!portal?.siteMatchesOwnerClinic ? (
                  <span className="mt-1 block text-xs opacity-90">
                    This website is currently branded for <strong>{siteClinic.name}</strong>; your account and bookings are with{" "}
                    <strong>{ownerClinic.name}</strong>.
                  </span>
                ) : null}
              </>
            ) : (
              <>
                Public site clinic: <strong className="text-on-surface">{siteClinic.name}</strong>
                <span className="ml-1 text-xs opacity-80">
                  (from host match or marketing admin default when no domain match applies)
                </span>
              </>
            )}
          </p>
        </div>

        {claimed ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/90 px-5 py-4 text-emerald-950">
            <p className="font-headline font-bold text-emerald-900">Guest booking linked</p>
            <p className="mt-1 text-sm opacity-90">Your appointment is now under this account.</p>
          </div>
        ) : null}

        {!owner ? (
          <div className="clinical-shadow rounded-2xl border border-amber-200 bg-amber-50/90 p-6 text-amber-950">
            <h2 className="font-headline text-lg font-bold">Finish registration</h2>
            <p className="mt-2 text-sm leading-relaxed opacity-90">
              No pet owner profile is linked yet for this login. Complete signup to attach your account to a clinic (usually the one tied to this
              website: <strong>{siteClinic.name}</strong>).
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={
                  user.email
                    ? `/signup?email=${encodeURIComponent(user.email)}`
                    : "/signup"
                }
                className="rounded-xl bg-primary px-5 py-2.5 font-headline text-sm font-bold text-on-primary"
              >
                Complete pet owner signup
              </Link>
              <Link href="/contact" className="rounded-xl border border-amber-300 px-5 py-2.5 text-sm font-semibold">
                Contact clinic
              </Link>
            </div>
            <div className="mt-6 border-t border-amber-300/50 pt-6">
              <h3 className="font-headline text-base font-bold">Already booked as a guest?</h3>
              <p className="mt-1 text-sm opacity-90">Paste the code from your confirmation page to attach that visit to this login.</p>
              <ClaimBookingForm />
            </div>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-on-surface-variant">
              Book visits, register pets, and see recent appointments. Full medical records remain clinician-managed, and visit-report PDF access
              appears here whenever your clinic has enabled website downloads.
            </p>

            <ul className="grid gap-4 sm:grid-cols-2">
              <li>
                <Link
                  href="/book"
                  className="clinical-shadow flex h-full flex-col rounded-2xl border border-surface-container-high bg-surface-container-lowest p-6 transition-shadow hover:shadow-md"
                >
                  <span className="material-symbols-outlined text-3xl text-primary">calendar_month</span>
                  <span className="mt-3 font-headline text-lg font-bold text-on-surface">Book appointment</span>
                  <span className="mt-1 text-sm text-on-surface-variant">Choose branch, vet, pet, and time.</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/account/pets"
                  className="clinical-shadow flex h-full flex-col rounded-2xl border border-surface-container-high bg-surface-container-lowest p-6 transition-shadow hover:shadow-md"
                >
                  <span className="material-symbols-outlined text-3xl text-primary">pets</span>
                  <span className="mt-3 font-headline text-lg font-bold text-on-surface">My pets</span>
                  <span className="mt-1 text-sm text-on-surface-variant">Add and manage your companions.</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/account/appointments"
                  className="clinical-shadow flex h-full flex-col rounded-2xl border border-surface-container-high bg-surface-container-lowest p-6 transition-shadow hover:shadow-md"
                >
                  <span className="material-symbols-outlined text-3xl text-primary">schedule</span>
                  <span className="mt-3 font-headline text-lg font-bold text-on-surface">Appointments</span>
                  <span className="mt-1 text-sm text-on-surface-variant">Upcoming and past bookings.</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/account/visits"
                  className="clinical-shadow flex h-full flex-col rounded-2xl border border-surface-container-high bg-surface-container-lowest p-6 transition-shadow hover:shadow-md"
                >
                  <span className="material-symbols-outlined text-3xl text-primary">history</span>
                  <span className="mt-3 font-headline text-lg font-bold text-on-surface">Past visits</span>
                  <span className="mt-1 text-sm text-on-surface-variant">Timeline plus saved visit-report PDFs when available.</span>
                </Link>
              </li>
            </ul>

            <div className="mt-10 rounded-2xl border border-outline-variant/30 bg-surface-container-low/80 p-5">
              <p className="font-headline text-sm font-semibold text-on-surface">Link a guest booking</p>
              <p className="mt-1 text-sm text-on-surface-variant">
                If you booked with a different email, paste your confirmation code here to move the appointment under this account.
              </p>
              <ClaimBookingForm />
            </div>

            <div className="mt-10 rounded-2xl border border-surface-container-high bg-surface-container-low/50 p-5 text-sm text-on-surface-variant">
              <p className="font-headline font-semibold text-on-surface">Also available</p>
              <div className="mt-3 flex flex-wrap gap-4">
                <Link href="/account/orders" className="font-medium text-primary hover:underline">
                  Store orders
                </Link>
                <Link href="/" className="font-medium text-primary hover:underline">
                  Marketing site home
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
