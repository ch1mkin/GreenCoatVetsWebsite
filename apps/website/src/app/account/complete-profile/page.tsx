import Link from "next/link";
import { redirect } from "next/navigation";
import { PET_SPECIES_BOOKING_OPTIONS } from "@saasclinics/lib";
import { completeOwnerProfileWithPet } from "@/app/account/actions";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getOwnerPortalContext } from "@/lib/owner/portal";
import { createClient } from "@/lib/supabase/server";

const field =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

export default async function CompleteOwnerProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/account/complete-profile");

  const [clinic, portal] = await Promise.all([resolveClinic(), getOwnerPortalContext(user.id)]);
  if (portal) redirect("/account");

  const metadata = (user.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
    phone?: string;
  };
  const defaultFullName = metadata.full_name?.trim() || metadata.name?.trim() || "";
  const defaultPhone = metadata.phone?.trim() || "";

  return (
    <main className="bg-surface pb-20 pt-8 text-on-background sm:pt-12">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-8">
          <Link href="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Pet owner portal
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-primary">Complete profile</p>
          <h1 className="mt-2 font-headline text-3xl font-extrabold tracking-tight">Finish your pet owner profile</h1>
          <p className="mt-2 text-on-surface-variant">
            Add your contact details and your first pet so your Google login is fully linked to <strong className="text-on-surface">{clinic.name}</strong>.
          </p>
        </div>

        <section className="clinical-shadow rounded-2xl bg-surface-container-lowest p-6 sm:p-8">
          <form action={completeOwnerProfileWithPet} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h2 className="font-headline text-lg font-bold text-on-surface">Owner details</h2>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Full name *</label>
              <input className={field} name="full_name" required defaultValue={defaultFullName} placeholder="Your full name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Phone *</label>
              <input className={field} name="phone" required defaultValue={defaultPhone} placeholder="+91…" inputMode="tel" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Email</label>
              <input className={field} value={user.email ?? ""} disabled readOnly />
            </div>

            <div className="mt-2 sm:col-span-2">
              <h2 className="font-headline text-lg font-bold text-on-surface">First pet</h2>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Pet name *</label>
              <input className={field} name="pet_name" required placeholder="e.g. Luna" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Species *</label>
              <select className={field} name="species" required defaultValue="canine">
                {PET_SPECIES_BOOKING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Breed</label>
              <input className={field} name="breed" placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Gender</label>
              <select className={field} name="gender" defaultValue="">
                <option value="">—</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Date of birth</label>
              <input className={field} name="date_of_birth" type="date" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Weight (kg)</label>
              <input className={field} name="weight_kg" type="number" min="0" step="0.01" placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Color</label>
              <input className={field} name="color" placeholder="Optional" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Microchip ID</label>
              <input className={field} name="microchip_id" placeholder="Optional" />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className="gradient-primary rounded-xl px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-md">
                Save profile and continue
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
