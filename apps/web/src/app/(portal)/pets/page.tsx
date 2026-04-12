import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createPet } from "./actions";
import { SpeciesChips } from "./species-chips";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";
import { PawCircularLoader } from "@/components/web/paw-circular-loader";
import { PetsDirectoryClient, type PetDirectoryRowData } from "@/components/workspace/pets-directory-client";
import { SPECIES_OR_FILTER_CANINE, SPECIES_OR_FILTER_FELINE } from "@saasclinics/lib";
import { formatSpeciesDisplay } from "@/lib/pets/species-labels";
import { buildSignedUrlMap, urlForDisplay } from "@/lib/storage/resolve-signed-image-url";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

type SearchParams = { species?: string; q?: string };

export default async function PetsPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (
    !access.isSuperAdmin &&
    !["clinic_admin", "receptionist", "doctor", "branch_admin"].includes(role)
  ) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const speciesKey = (searchParams.species ?? "all").toLowerCase();
  const q = (searchParams.q ?? "").trim().toLowerCase();

  let petsQuery = supabase
    .from("pets")
    .select("id, name, species, breed, owner_id, photo_url, created_at, is_active, owners(full_name, first_name, last_name)")
    .eq("clinic_id", clinic_id)
    .order("created_at", { ascending: false })
    .limit(120);

  if (speciesKey === "dog") {
    petsQuery = petsQuery.or(SPECIES_OR_FILTER_CANINE);
  } else if (speciesKey === "cat") {
    petsQuery = petsQuery.or(SPECIES_OR_FILTER_FELINE);
  } else if (speciesKey === "exotic") {
    petsQuery = petsQuery
      .not("species", "ilike", "%canis%")
      .not("species", "ilike", "%dog%")
      .not("species", "ilike", "%canine%")
      .not("species", "ilike", "%felis%")
      .not("species", "ilike", "%cat%")
      .not("species", "ilike", "%feline%");
  }

  const [{ data: petsRaw, error: petsError }, { data: owners, error: ownersError }] = await Promise.all([
    petsQuery,
    supabase
      .from("owners")
      .select("id, full_name, first_name, last_name, photo_url")
      .eq("clinic_id", clinic_id)
      .order("full_name", { ascending: true })
      .limit(200),
  ]);

  if (petsError) throw new Error(petsError.message);
  if (ownersError) throw new Error(ownersError.message);

  const ownerName = (row: {
    owners?:
      | { full_name?: string | null; first_name?: string | null; last_name?: string | null }
      | Array<{ full_name?: string | null; first_name?: string | null; last_name?: string | null }>
      | null;
  }) => {
    const o = row.owners;
    const single = Array.isArray(o) ? o[0] : o;
    if (!single) return "";
    const f = single.first_name?.trim();
    const l = single.last_name?.trim();
    if (f && l) return `${f} ${l}`;
    return single.full_name ?? "";
  };

  const pets = (petsRaw ?? []).filter((row) => {
    if (!q) return true;
    const on = ownerName(row).toLowerCase();
    return (
      row.name.toLowerCase().includes(q) ||
      row.species.toLowerCase().includes(q) ||
      (row.breed ?? "").toLowerCase().includes(q) ||
      on.includes(q)
    );
  }).slice(0, 60);

  const ownerMap = new Map(
    (owners ?? []).map((owner) => {
      const display =
        owner.first_name && owner.last_name
          ? `${owner.first_name} ${owner.last_name}`.trim()
          : owner.full_name;
      return [owner.id, { name: display, photo_url: owner.photo_url as string | null }];
    })
  );

  const pathsToSign: string[] = [];
  for (const pet of pets) {
    if (pet.photo_url) pathsToSign.push(pet.photo_url);
    const o = ownerMap.get(pet.owner_id);
    if (o?.photo_url) pathsToSign.push(o.photo_url);
  }
  const signedPetImages = await buildSignedUrlMap(supabase, pathsToSign);

  const petRows: PetDirectoryRowData[] = (pets ?? []).map((pet) => {
    const owner = ownerMap.get(pet.owner_id);
    const raw = pet.photo_url ?? owner?.photo_url ?? null;
    const img = urlForDisplay(raw, signedPetImages);
    const status = pet.is_active ? "Healthy" : "Inactive";
    const statusClass = pet.is_active
      ? "bg-primary-fixed text-on-primary-fixed-variant"
      : "bg-surface-container-highest text-on-surface-variant";
    return {
      id: pet.id,
      name: pet.name,
      species: formatSpeciesDisplay(pet.species),
      breed: pet.breed ?? "",
      ownerLine: owner?.name ?? ownerName(pet) ?? "—",
      status,
      statusClass,
      avatarUrl: img,
      initials: initials(pet.name),
      addedLabel: pet.created_at ? `Added ${new Date(pet.created_at).toLocaleDateString()}` : "—",
    };
  });

  return (
    <AppShell
      title="Pets"
      subtitle="Patients — search, filter by species, and open records."
      activeHref="/pets"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-1">
          <Link className="btn-primary btn-compact" href="/pets/new">
            New patient
          </Link>
          <Link className="btn-secondary btn-compact" href="/owners">
            Owners
          </Link>
          <Link className="btn-secondary btn-compact" href="/dashboard">
            Home
          </Link>
        </div>
      }
    >
      <section className="mb-2 space-y-2">
        <Suspense
          fallback={
            <div className="flex min-h-[2.75rem] items-center justify-center py-2">
              <PawCircularLoader size="sm" />
            </div>
          }
        >
          <SpeciesChips />
        </Suspense>
      </section>

      <section className="card-soft">
        <form className="flex flex-wrap items-end gap-2" method="get">
          <input type="hidden" name="species" value={speciesKey === "all" ? "" : speciesKey} />
          <div className="relative min-w-[240px] flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-primary/70 text-xl">
              search
            </span>
            <input
              className="workspace-search-input py-2 pl-10 text-[12px]"
              type="search"
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Search pets, species, breed, or owner…"
            />
          </div>
          <button className="btn-primary btn-compact shrink-0 font-semibold" type="submit">
            Search
          </button>
        </form>
      </section>

      <section className="mt-2 card-soft">
        <h2 className="font-headline text-xs font-bold uppercase tracking-wide text-slate-600">Register pet</h2>
        <p className="mt-0.5 text-[11px] text-slate-600">
          Full wizard:{" "}
          <Link className="font-semibold text-primary underline" href="/pets/new">
            New patient
          </Link>
        </p>
        <form action={createPet} className="mt-2 grid gap-2 md:grid-cols-2">
          <select className="input-soft py-2 text-[12px] md:col-span-2" name="owner_id" required>
            <option value="">Select owner</option>
            {owners?.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.first_name && owner.last_name
                  ? `${owner.first_name} ${owner.last_name}`
                  : owner.full_name}
              </option>
            ))}
          </select>
          <input className="input-soft py-2 text-[12px]" name="name" placeholder="Pet name" required />
          <input
            className="input-soft py-2 text-[12px]"
            name="species"
            placeholder="Species (e.g. canine, feline, avian)"
            required
          />
          <input className="input-soft py-2 text-[12px] md:col-span-2" name="breed" placeholder="Breed" />
          <SubmitButton className="btn-primary btn-compact md:col-span-2" pendingLabel="Saving pet…">
            Quick save pet
          </SubmitButton>
        </form>
      </section>

      <section className="mt-3 space-y-2">
        <h2 className="font-headline text-xs font-bold uppercase tracking-wide text-slate-700">Directory</h2>
        <PetsDirectoryClient rows={petRows} />
      </section>
    </AppShell>
  );
}
