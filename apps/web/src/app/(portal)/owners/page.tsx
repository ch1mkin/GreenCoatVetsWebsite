import { formatSpeciesLabel } from "@saasclinics/lib";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createOwner } from "./actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";
import { OwnersDirectoryClient, type OwnerDirectoryRowData } from "@/components/workspace/owners-directory-client";
import { OwnersDirectoryWithBulkDelete } from "@/components/workspace/owners-directory-with-bulk-delete";
import { buildSignedUrlMap, urlForDisplay } from "@/lib/storage/resolve-signed-image-url";

type SearchParams = {
  q?: string;
  deleted?: string;
  error?: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const query = (searchParams.q ?? "").trim();
  const deleted = searchParams.deleted === "1" || searchParams.deleted === "true";
  const errorMessage = (searchParams.error ?? "").trim() || null;
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as
    | "super_admin"
    | "clinic_admin"
    | "branch_admin"
    | "doctor"
    | "receptionist"
    | "lab_technician"
    | "pharmacist"
    | "pet_owner";
  if (
    !access.isSuperAdmin &&
    !["clinic_admin", "receptionist", "doctor", "branch_admin"].includes(role)
  ) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  let ownersQuery = supabase
    .from("owners")
    .select(
      "id, full_name, first_name, last_name, phone, email, city, address, business_name, website, photo_url, created_at, pets(id, name, species, breed, photo_url, created_at)"
    )
    .eq("clinic_id", clinic_id)
    .order("created_at", { ascending: false })
    .limit(40);

  if (query) {
    const q = query.replace(/%/g, "\\%").replace(/_/g, "\\_");
    ownersQuery = ownersQuery.or(
      `full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,business_name.ilike.%${q}%,website.ilike.%${q}%,address.ilike.%${q}%`
    );
  }

  const { data: owners, error } = await ownersQuery;
  if (error) {
    throw new Error(error.message);
  }

  type PetRow = { id: string; name: string; species: string; breed: string | null; photo_url: string | null; created_at: string };
  const pathsToSign: string[] = [];
  for (const owner of owners ?? []) {
    const pets = (owner.pets as PetRow[] | null) ?? [];
    const sorted = [...pets].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const primary = sorted[0];
    if (owner.photo_url) pathsToSign.push(owner.photo_url);
    if (primary?.photo_url) pathsToSign.push(primary.photo_url);
  }
  const signedOwnerImages = await buildSignedUrlMap(supabase, pathsToSign);

  const ownerRows: OwnerDirectoryRowData[] = (owners ?? []).map((owner) => {
    const pets = (owner.pets as PetRow[] | null) ?? [];
    const sorted = [...pets].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const primary = sorted[0];
    const rawAvatar = owner.photo_url ?? primary?.photo_url ?? null;
    const avatarSrc = urlForDisplay(rawAvatar, signedOwnerImages);
    const subtitle = primary
      ? `${formatSpeciesLabel(primary.species)}${primary.breed ? ` • ${primary.breed}` : ""}`
      : "No pets yet";
    const displayName =
      owner.first_name && owner.last_name
        ? `${owner.first_name} ${owner.last_name}`.trim()
        : owner.full_name;
    return {
      id: owner.id,
      fullName: displayName,
      phone: owner.phone,
      email: owner.email,
      subtitle,
      avatarUrl: avatarSrc,
      initials: initials(displayName),
      addedLabel: owner.created_at ? `Added ${new Date(owner.created_at).toLocaleDateString()}` : "—",
    };
  });

  return (
    <AppShell
      title="Patients / Owners"
      subtitle="Search owners and see linked pets with photo placeholders when none uploaded."
      activeHref="/owners"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-1">
          <a className="btn-secondary btn-compact" href="/api/exports/contacts">
            Export contacts (Excel CSV)
          </a>
          <Link className="btn-secondary btn-compact" href="/pets">
            Pets
          </Link>
          <Link className="btn-primary btn-compact" href="/dashboard">
            Home
          </Link>
        </div>
      }
    >
      {errorMessage ? (
        <section className="card-soft mb-3 border border-red-200 bg-red-50 text-red-900">
          <p className="font-semibold">Could not delete selected clients</p>
          <p className="mt-1 text-sm">{errorMessage}</p>
        </section>
      ) : null}
      {deleted ? (
        <section className="card-soft mb-3 border border-emerald-200 bg-emerald-50 text-emerald-950">
          <p className="font-semibold">Clients deleted</p>
          <p className="mt-1 text-sm">Selected owner records and linked pets were permanently removed.</p>
        </section>
      ) : null}
      <section className="card-soft">
        <form className="flex flex-wrap items-end gap-2" method="get">
          <div className="relative min-w-[240px] flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-primary/70 text-xl">
              search
            </span>
            <input
              className="workspace-search-input py-2 pl-10 text-[12px]"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Name, phone, email, business, website, address…"
            />
          </div>
          <button className="btn-primary btn-compact shrink-0 font-semibold" type="submit">
            Search
          </button>
        </form>
      </section>

      <section className="mt-2 card-soft">
        <h2 className="font-headline text-xs font-bold uppercase tracking-wide text-slate-600">Quick add client</h2>
        <p className="mt-0.5 text-[11px] text-slate-600">
          Full form:{" "}
          <Link className="font-semibold text-primary underline" href="/owners/new">
            New client
          </Link>
          .
        </p>
        <form action={createOwner} className="mt-2 grid gap-2 md:grid-cols-2">
          <input className="input-soft py-2 text-[12px]" name="first_name" placeholder="First name *" required />
          <input className="input-soft py-2 text-[12px]" name="last_name" placeholder="Last name *" required />
          <input className="input-soft py-2 text-[12px]" name="phone" placeholder="Phone *" required />
          <input className="input-soft py-2 text-[12px]" name="email" placeholder="Email" type="email" />
          <SubmitButton className="btn-primary btn-compact md:col-span-2" pendingLabel="Saving owner…">
            Save client
          </SubmitButton>
        </form>
      </section>

      <section className="mt-3 space-y-2">
        <h2 className="font-headline text-xs font-bold uppercase tracking-wide text-slate-700">Directory</h2>
        {access.isSuperAdmin ? (
          <OwnersDirectoryWithBulkDelete rows={ownerRows} clinicId={clinic_id} />
        ) : (
          <OwnersDirectoryClient rows={ownerRows} />
        )}
      </section>
    </AppShell>
  );
}
