import Link from "next/link";
import { redirect } from "next/navigation";
import { createMedicalRecord } from "./actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

type SearchParams = {
  pet?: string;
};

function pick(row: unknown, rel: string, field: string): string {
  if (!row || typeof row !== "object") return "-";
  const v = (row as Record<string, unknown>)[rel];
  if (v == null) return "-";
  if (Array.isArray(v)) {
    const o = v[0] as Record<string, string> | undefined;
    return o?.[field] ?? "-";
  }
  return (v as Record<string, string>)[field] ?? "-";
}

export default async function MedicalRecordsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (!access.isSuperAdmin && !["clinic_admin", "branch_admin", "doctor", "receptionist", "lab_technician"].includes(role)) {
    redirect("/dashboard");
  }

  const petFilter = (searchParams.pet ?? "").trim();
  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const [{ data: visits, error: visitsError }, { data: pets, error: petsError }] = await Promise.all([
    supabase
      .from("visits")
      .select("id, created_at, pets(name), owners(full_name)")
      .eq("clinic_id", clinic_id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.from("pets").select("id, name").eq("clinic_id", clinic_id).order("name", { ascending: true }).limit(300),
  ]);
  if (visitsError) throw new Error(visitsError.message);
  if (petsError) throw new Error(petsError.message);

  // Backfill records for existing visits so older consultations appear in medical records.
  const { data: existingRecords } = await supabase.from("medical_records").select("visit_id").eq("clinic_id", clinic_id).limit(5000);
  const existingVisitIds = new Set((existingRecords ?? []).map((r) => r.visit_id).filter(Boolean));
  const { data: visitBackfillRows } = await supabase
    .from("visits")
    .select("id, branch_id, pet_id, diagnosis, symptoms, treatment_plan, created_at")
    .eq("clinic_id", clinic_id)
    .order("created_at", { ascending: false })
    .limit(500);
  const missing = (visitBackfillRows ?? []).filter(
    (v) => !existingVisitIds.has(v.id) && Boolean(v.diagnosis || v.symptoms || v.treatment_plan),
  );
  if (missing.length) {
    await supabase.from("medical_records").upsert(
      missing.map((v) => ({
        clinic_id,
        branch_id: v.branch_id,
        pet_id: v.pet_id,
        visit_id: v.id,
        diagnosis: v.diagnosis ?? null,
        notes: v.treatment_plan ?? v.symptoms ?? null,
      })),
      { onConflict: "visit_id" },
    );
  }

  let recordsQuery = supabase
    .from("medical_records")
    .select("id, created_at, diagnosis, lab_tests, notes, visits(id), pets(id, name), branches(name)")
    .eq("clinic_id", clinic_id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (petFilter) recordsQuery = recordsQuery.eq("pet_id", petFilter);
  const { data: records, error: recordsError } = await recordsQuery;
  if (recordsError) throw new Error(recordsError.message);

  const firstRecord = records?.[0];
  const heroPet = firstRecord ? pick(firstRecord, "pets", "name") : "—";

  return (
    <AppShell
      title="Clinical documentation"
      subtitle="Medical records linked to visits — SOAP-style layout."
      activeHref="/medical-records"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary text-sm" href="/appointments">
            Appointments
          </Link>
          <Link className="btn-primary text-sm" href="/dashboard">
            Dashboard
          </Link>
        </div>
      }
    >
      <div className="mb-6 flex flex-col gap-4 border-b border-outline-variant/15 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <nav className="mb-2 flex gap-2 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
            <span>Records</span>
            <span>/</span>
            <span className="text-primary">Patient encounter</span>
          </nav>
          <p className="font-headline text-2xl font-extrabold tracking-tight text-on-background">Medical records</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="btn-secondary cursor-default text-sm opacity-80">Export (soon)</span>
          <Link href="/visits" className="btn-primary flex items-center gap-2 text-sm">
            <span className="material-symbols-outlined text-base">add</span>
            Open visit
          </Link>
        </div>
      </div>

      <div className="relative mb-6 max-w-xl">
        <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant">
          search
        </span>
        <form method="get" className="block">
          <select
            className="input-soft w-full rounded-xl py-2.5 pl-12 pr-4 text-sm"
            name="pet"
            defaultValue={petFilter}
          >
            <option value="">All pets</option>
            {pets?.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name}
              </option>
            ))}
          </select>
        </form>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
          <section className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
            <h3 className="mb-4 font-headline text-lg font-bold text-on-surface">Recent encounters</h3>
            <div className="space-y-3">
              {(visits ?? []).map((v) => {
                const pet = pick(v, "pets", "name");
                const owner = pick(v, "owners", "full_name");
                return (
                  <div
                    key={v.id}
                    className="cursor-pointer rounded-xl border-l-4 border-primary bg-primary/5 p-4 transition-colors hover:bg-primary/10"
                  >
                    <div className="mb-2 flex justify-between gap-2">
                      <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        Visit
                      </span>
                      <span className="text-[11px] text-on-surface-variant">
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="font-bold text-on-surface">
                      {pet} <span className="text-on-surface-variant">• {owner}</span>
                    </h4>
                  </div>
                );
              })}
              {!visits?.length ? <p className="text-sm text-on-surface-variant">No visits yet.</p> : null}
            </div>
          </section>

          <section className="rounded-xl bg-surface-container-lowest p-6 shadow-sm">
            <h3 className="mb-4 font-headline text-lg font-bold text-on-surface">Quick stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-surface-container-low p-3">
                <p className="mb-1 text-[10px] font-bold uppercase text-on-surface-variant">Records (filter)</p>
                <p className="font-headline text-2xl font-bold">{records?.length ?? 0}</p>
                <span className="mt-1 block text-[10px] font-bold text-primary">● Loaded</span>
              </div>
              <div className="rounded-lg bg-tertiary-fixed/20 p-3">
                <p className="mb-1 text-[10px] font-bold uppercase text-on-surface-variant">Pets in clinic</p>
                <p className="font-headline text-2xl font-bold text-tertiary">{pets?.length ?? 0}</p>
                <span className="mt-1 block text-[10px] font-bold text-tertiary">Directory</span>
              </div>
            </div>
          </section>
        </div>

        <div className="col-span-12 space-y-6 lg:col-span-8">
          <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
            <div className="relative h-24 bg-gradient-to-r from-primary/10 to-transparent">
              <div className="absolute bottom-0 left-6 flex translate-y-1/2 items-end gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-surface-container-low font-headline text-2xl font-bold text-primary shadow-md">
                  {String(heroPet).slice(0, 1)}
                </div>
                <div className="pb-2">
                  <h3 className="font-headline text-2xl font-extrabold text-on-background">{heroPet}</h3>
                  <p className="text-sm font-medium text-on-surface-variant">Latest record preview</p>
                </div>
              </div>
            </div>
            <div className="mt-12 space-y-6 p-8 pt-4">
              <div className="flex gap-8 border-b border-surface-container text-sm font-bold text-on-surface-variant">
                <span className="border-b-2 border-primary pb-4 text-primary">Records</span>
                <span className="pb-4 opacity-60">Diagnostics</span>
                <span className="pb-4 opacity-60">History</span>
              </div>

              <section className="card-soft">
                <h2 className="mb-3 font-headline text-lg font-bold">New record from visit</h2>
                <form action={createMedicalRecord} className="grid gap-3">
                  <select className="input-soft" name="visit_id" required>
                    <option value="">Select visit</option>
                    {visits?.map((visit) => (
                      <option key={visit.id} value={visit.id}>
                        {new Date(visit.created_at).toLocaleString()} | {pick(visit, "pets", "name")} |{" "}
                        {pick(visit, "owners", "full_name")}
                      </option>
                    ))}
                  </select>
                  <textarea className="input-soft" name="diagnosis" placeholder="Diagnosis" />
                  <textarea className="input-soft" name="lab_tests" placeholder="Lab tests / findings" />
                  <textarea className="input-soft" name="notes" placeholder="Clinical notes" />
                  <SubmitButton className="btn-primary" pendingLabel="Saving…">
                    Save record
                  </SubmitButton>
                </form>
              </section>

              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Timeline</h3>
                {records?.map((record) => (
                  <article
                    key={record.id}
                    className="glass-card rounded-xl border border-outline-variant/15 p-5 shadow-sm"
                  >
                    <p className="font-semibold text-on-background">
                      {pick(record, "pets", "name")} · {pick(record, "branches", "name")} ·{" "}
                      {new Date(record.created_at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm text-on-surface-variant">
                      <strong>Diagnosis:</strong> {record.diagnosis ?? "—"}
                    </p>
                    <p className="text-sm text-on-surface-variant">
                      <strong>Lab:</strong> {record.lab_tests ?? "—"}
                    </p>
                    <p className="text-sm text-on-surface-variant">
                      <strong>Notes:</strong> {record.notes ?? "—"}
                    </p>
                  </article>
                ))}
                {!records?.length ? (
                  <p className="text-sm text-on-surface-variant">No medical records found for this filter.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Link
        href="#"
        className="fixed bottom-8 right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-container to-primary text-white shadow-2xl transition-transform hover:scale-105"
        aria-label="Back to top"
      >
        <span className="material-symbols-outlined text-2xl">edit_square</span>
      </Link>
    </AppShell>
  );
}
