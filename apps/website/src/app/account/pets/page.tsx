import Link from "next/link";
import { redirect } from "next/navigation";
import { addPet } from "@/app/account/actions";
import { getOwnerPortalContext } from "@/lib/owner/portal";
import { createClient } from "@/lib/supabase/server";

const field =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

export default async function AccountPetsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/account/pets");

  const portal = await getOwnerPortalContext(user.id);
  if (!portal) redirect("/account");
  const { owner, clinic } = portal;

  const { data: pets } = await supabase
    .from("pets")
    .select("id, name, species, breed, gender, date_of_birth, weight_kg, is_active")
    .eq("clinic_id", clinic.id)
    .eq("owner_id", owner.id)
    .order("name", { ascending: true });

  return (
    <main className="bg-surface pb-20 pt-8 text-on-background sm:pt-12">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-8">
          <Link href="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Pet owner portal
          </Link>
          <h1 className="mt-4 font-headline text-3xl font-extrabold tracking-tight">My pets</h1>
          <p className="mt-2 text-on-surface-variant">
            Register pets for <strong className="text-on-surface">{clinic.name}</strong> so you can book appointments for them.
          </p>
        </div>

        <section className="clinical-shadow mb-10 rounded-2xl bg-surface-container-lowest p-6 sm:p-8">
          <h2 className="font-headline text-lg font-bold text-on-surface">Add a pet</h2>
          <form action={addPet} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Name *</label>
              <input className={field} name="name" required placeholder="e.g. Luna" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase text-on-surface-variant">Species *</label>
              <input className={field} name="species" required placeholder="e.g. canine, feline, avian" />
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
              <input className={field} name="weight_kg" type="number" step="0.01" min="0" placeholder="Optional" />
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
              <button
                type="submit"
                className="gradient-primary rounded-xl px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-md"
              >
                Save pet
              </button>
            </div>
          </form>
        </section>

        <section>
          <h2 className="font-headline text-lg font-bold text-on-surface">Your pets</h2>
          <ul className="mt-4 space-y-3">
            {(pets ?? []).length ? (
              (pets ?? []).map((pet) => (
                <li
                  key={pet.id}
                  className="clinical-shadow flex flex-wrap items-center justify-between gap-2 rounded-xl border border-surface-container-high bg-white px-4 py-3"
                >
                  <div>
                    <p className="font-headline font-bold text-on-surface">{pet.name}</p>
                    <p className="text-sm text-on-surface-variant">
                      {pet.species}
                      {pet.breed ? ` · ${pet.breed}` : ""}
                      {!pet.is_active ? <span className="ml-2 text-error">(inactive)</span> : null}
                    </p>
                  </div>
                </li>
              ))
            ) : (
              <li className="rounded-xl border border-dashed border-outline-variant px-4 py-8 text-center text-sm text-on-surface-variant">
                No pets yet — use the form above.
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
