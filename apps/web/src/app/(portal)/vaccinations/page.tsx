import Link from "next/link";
import { createVaccinationRecord, sendVaccinationReminderNow, updateVaccinationRecord } from "./actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  due?: string;
};

function joinedRelationName(rel: unknown): string {
  if (rel == null) return "-";
  if (Array.isArray(rel)) return (rel[0] as { name?: string })?.name ?? "-";
  return (rel as { name?: string }).name ?? "-";
}

export default async function VaccinationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const due = (searchParams.due ?? "all").trim();
  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();

  const [petsRes, branchesRes] = await Promise.all([
    supabase
      .from("pets")
      .select("id, name")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .order("name", { ascending: true })
      .limit(300),
    supabase
      .from("branches")
      .select("id, name")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  if (petsRes.error) throw new Error(petsRes.error.message);
  if (branchesRes.error) throw new Error(branchesRes.error.message);

  const today = new Date().toISOString().slice(0, 10);
  let recordsQuery = supabase
    .from("vaccination_records")
    .select("id, vaccine_name, dose, administered_on, due_on, status, reminder_sent_at, pets(name), branches(name)")
    .eq("clinic_id", clinic_id)
    .order("due_on", { ascending: true, nullsFirst: false })
    .limit(100);

  if (due === "today") {
    recordsQuery = recordsQuery.eq("due_on", today);
  } else if (due === "overdue") {
    recordsQuery = recordsQuery.lt("due_on", today);
  } else if (due === "upcoming") {
    recordsQuery = recordsQuery.gte("due_on", today);
  }

  const { data: records, error: recordsError } = await recordsQuery;
  if (recordsError) throw new Error(recordsError.message);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Vaccinations</h1>
        <Link className="rounded-md border px-3 py-2" href="/dashboard">
          Dashboard
        </Link>
      </div>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-medium">Due-date filter</h2>
        <form className="flex gap-2" method="get">
          <select className="rounded-md border px-3 py-2" name="due" defaultValue={due}>
            <option value="all">All</option>
            <option value="today">Due today</option>
            <option value="overdue">Overdue</option>
            <option value="upcoming">Upcoming</option>
          </select>
          <button className="rounded-md bg-black px-4 py-2 text-white" type="submit">
            Apply
          </button>
        </form>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-medium">Create Vaccination Record</h2>
        <form action={createVaccinationRecord} className="grid gap-3 md:grid-cols-2">
          <select className="rounded-md border px-3 py-2" name="pet_id" required>
            <option value="">Select pet</option>
            {petsRes.data?.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.name}
              </option>
            ))}
          </select>
          <select className="rounded-md border px-3 py-2" name="branch_id">
            <option value="">Select branch (optional)</option>
            {branchesRes.data?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <input className="rounded-md border px-3 py-2" name="vaccine_name" placeholder="Vaccine name" required />
          <input className="rounded-md border px-3 py-2" name="dose" placeholder="Dose" />
          <input className="rounded-md border px-3 py-2" type="date" name="administered_on" />
          <input className="rounded-md border px-3 py-2" type="date" name="due_on" />
          <input
            className="rounded-md border px-3 py-2 md:col-span-2"
            name="status"
            placeholder="Status (scheduled/administered/due/reminded)"
          />
          <button className="rounded-md bg-black px-4 py-2 text-white md:col-span-2" type="submit">
            Save record
          </button>
        </form>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-medium">Vaccination Records</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Pet</th>
                <th className="py-2">Vaccine</th>
                <th className="py-2">Dose</th>
                <th className="py-2">Administered</th>
                <th className="py-2">Due</th>
                <th className="py-2">Branch</th>
                <th className="py-2">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records?.map((record) => (
                <tr className="border-b align-top" key={record.id}>
                  <td className="py-2">{joinedRelationName(record.pets)}</td>
                  <td className="py-2">{record.vaccine_name}</td>
                  <td className="py-2">{record.dose ?? "-"}</td>
                  <td className="py-2">{record.administered_on ?? "-"}</td>
                  <td className="py-2">{record.due_on ?? "-"}</td>
                  <td className="py-2">{joinedRelationName(record.branches)}</td>
                  <td className="py-2">{record.status ?? "-"}</td>
                  <td className="py-2">
                    <form action={updateVaccinationRecord} className="mb-2 flex gap-2">
                      <input type="hidden" name="id" value={record.id} />
                      <input
                        className="w-32 rounded-md border px-2 py-1"
                        name="status"
                        defaultValue={record.status ?? ""}
                        placeholder="status"
                      />
                      <input
                        className="rounded-md border px-2 py-1"
                        type="date"
                        name="due_on"
                        defaultValue={record.due_on ?? ""}
                      />
                      <button className="rounded-md border px-2 py-1" type="submit">
                        Save
                      </button>
                    </form>
                    <form action={sendVaccinationReminderNow}>
                      <input type="hidden" name="id" value={record.id} />
                      <button className="rounded-md bg-primary px-2 py-1 text-white" type="submit">
                        Send reminder
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!records?.length ? <p className="pt-3 text-sm text-muted-foreground">No vaccination records found.</p> : null}
        </div>
      </section>
    </main>
  );
}
