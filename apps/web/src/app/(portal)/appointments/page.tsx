import Link from "next/link";
import { redirect } from "next/navigation";
import { createAppointment, updateAppointmentStatus } from "./actions";
import { createVisitFromAppointment } from "@/app/(portal)/visits/actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

type SearchParams = {
  date?: string;
  status?: string;
};

const typeOptions = [
  "consultation",
  "vaccination",
  "surgery",
  "grooming",
  "emergency",
] as const;

const statusOptions = [
  "scheduled",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
] as const;

function pickName(row: unknown, key: "full_name" | "name"): string {
  if (!row) return "-";
  if (Array.isArray(row)) {
    const first = row[0] as Record<string, string> | undefined;
    return first?.[key] ?? "-";
  }
  return (row as Record<string, string>)[key] ?? "-";
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const date = (searchParams.date ?? "").trim();
  const status = (searchParams.status ?? "").trim();

  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (!access.isSuperAdmin && !["clinic_admin", "branch_admin", "doctor", "receptionist"].includes(role)) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const [branchesRes, doctorsRes, ownersRes, petsRes] = await Promise.all([
    supabase
      .from("branches")
      .select("id, name")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("staff_profiles")
      .select("id, full_name")
      .eq("clinic_id", clinic_id)
      .eq("role", "doctor")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    supabase
      .from("owners")
      .select("id, full_name")
      .eq("clinic_id", clinic_id)
      .order("full_name", { ascending: true })
      .limit(300),
    supabase
      .from("pets")
      .select("id, name, owner_id")
      .eq("clinic_id", clinic_id)
      .order("name", { ascending: true })
      .limit(300),
  ]);

  if (branchesRes.error) throw new Error(branchesRes.error.message);
  if (doctorsRes.error) throw new Error(doctorsRes.error.message);
  if (ownersRes.error) throw new Error(ownersRes.error.message);
  if (petsRes.error) throw new Error(petsRes.error.message);

  const branchOptions = branchesRes.data ?? [];
  const hasBranches = branchOptions.length > 0;

  let query = supabase
    .from("appointments")
    .select(
      "id, starts_at, appointment_type, status, notes, owners(full_name), pets(name), branches(name), staff_profiles(full_name)"
    )
    .eq("clinic_id", clinic_id)
    .order("starts_at", { ascending: true })
    .limit(50);

  if (status && statusOptions.includes(status as (typeof statusOptions)[number])) {
    query = query.eq("status", status);
  }
  if (date) {
    query = query.gte("starts_at", `${date}T00:00:00`).lt("starts_at", `${date}T23:59:59`);
  }

  const { data: appointments, error: appointmentsError } = await query;
  if (appointmentsError) throw new Error(appointmentsError.message);

  const ownerMap = new Map((ownersRes.data ?? []).map((o) => [o.id, o.full_name]));

  async function startConsultation(formData: FormData) {
    "use server";
    const visitId = await createVisitFromAppointment(formData);
    redirect(`/visits/${visitId}`);
  }

  return (
    <AppShell
      title="Appointments"
      subtitle="List view — pair with the calendar board for scheduling."
      activeHref="/appointments"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary text-sm" href="/api/exports/appointments">
            Export appointments (Excel CSV)
          </a>
          <Link className="btn-secondary text-sm" href="/appointments/calendar">
            Calendar board
          </Link>
          <Link className="btn-primary text-sm" href="/dashboard">
            Dashboard
          </Link>
        </div>
      }
    >
      <section className="card-soft">
        <h2 className="font-headline text-lg font-bold">Filters</h2>
        <form className="mt-3 grid gap-3 md:grid-cols-3" method="get">
          <input className="input-soft" type="date" name="date" defaultValue={date} />
          <select className="input-soft" name="status" defaultValue={status}>
            <option value="">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="btn-primary" type="submit">
            Apply
          </button>
        </form>
      </section>

      <section className="mt-6 card-soft" id="create-appointment">
        <h2 className="font-headline text-lg font-bold">Create appointment</h2>
        {!hasBranches ? (
          <div className="mt-3 rounded-xl border border-primary/25 bg-primary-container/15 p-4 text-sm text-on-surface">
            <p className="font-semibold text-on-surface">No branches for this clinic yet</p>
            <p className="mt-1 text-on-surface-variant">
              Appointments need a branch. Clinic admins can add locations under{" "}
              <Link className="font-bold text-primary underline" href="/branches">
                Branches
              </Link>
              . New clinics created by a super admin automatically get a &quot;Main&quot; branch after the latest migration.
            </p>
          </div>
        ) : null}
        <form action={createAppointment} className="mt-3 grid gap-3 md:grid-cols-2">
          <select className="input-soft" name="branch_id" required disabled={!hasBranches}>
            <option value="">{hasBranches ? "Select branch" : "Add a branch first"}</option>
            {branchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select className="input-soft" name="doctor_id">
            <option value="">Assign doctor (optional)</option>
            {doctorsRes.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
          <select className="input-soft" name="owner_id" required>
            <option value="">Select owner</option>
            {ownersRes.data?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name}
              </option>
            ))}
          </select>
          <select className="input-soft" name="pet_id" required>
            <option value="">Select pet</option>
            {petsRes.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({ownerMap.get(p.owner_id) ?? "Unknown owner"})
              </option>
            ))}
          </select>
          <select className="input-soft" name="appointment_type" required>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input className="input-soft" type="datetime-local" name="starts_at" required />
          <textarea
            className="input-soft md:col-span-2"
            name="notes"
            placeholder="Notes (optional)"
            rows={2}
          />
          <SubmitButton className="btn-primary md:col-span-2" pendingLabel="Saving appointment…" disabled={!hasBranches}>
            Save appointment
          </SubmitButton>
        </form>
      </section>

      <section className="mt-6 overflow-hidden rounded-xl bg-surface-container-low p-4">
        <h2 className="mb-3 font-headline text-lg font-bold">Upcoming / filtered</h2>
        <div className="overflow-x-auto rounded-xl bg-surface-container-lowest p-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-on-surface-variant">
                <th className="px-3 py-3">Time</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Pet</th>
                <th className="px-3 py-3">Branch</th>
                <th className="px-3 py-3">Doctor</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
                <th className="px-3 py-3">Consultation</th>
              </tr>
            </thead>
            <tbody>
              {appointments?.map((appt) => (
                <tr className="border-t border-outline-variant/20 odd:bg-surface even:bg-surface-container-low" key={appt.id} id={`appt-${appt.id}`}>
                  <td className="px-3 py-3">{new Date(appt.starts_at).toLocaleString()}</td>
                  <td className="px-3 py-3">{appt.appointment_type}</td>
                  <td className="px-3 py-3">{pickName(appt.owners, "full_name")}</td>
                  <td className="px-3 py-3">{pickName(appt.pets, "name")}</td>
                  <td className="px-3 py-3">{pickName(appt.branches, "name")}</td>
                  <td className="px-3 py-3">{pickName(appt.staff_profiles, "full_name")}</td>
                  <td className="px-3 py-3">{appt.status}</td>
                  <td className="px-3 py-3">
                    <form action={updateAppointmentStatus} className="flex flex-wrap gap-2">
                      <input type="hidden" name="appointment_id" value={appt.id} />
                      <select className="input-soft py-1.5 text-xs" name="status" defaultValue={appt.status}>
                        {statusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <SubmitButton className="btn-secondary py-1.5 text-xs" pendingLabel="…">
                        Update
                      </SubmitButton>
                    </form>
                  </td>
                  <td className="px-3 py-3">
                    <form action={startConsultation}>
                      <input type="hidden" name="appointment_id" value={appt.id} />
                      <SubmitButton className="btn-primary py-1.5 text-xs" pendingLabel="…">
                        Open visit
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!appointments?.length ? (
            <p className="px-3 py-4 text-sm text-on-surface-variant">No appointments found.</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
