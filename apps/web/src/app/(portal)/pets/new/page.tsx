import Link from "next/link";
import { redirect } from "next/navigation";
import { createPet } from "../actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

export default async function NewPatientPage() {
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

  const { data: owners } = await supabase
    .from("owners")
    .select("id, full_name, first_name, last_name")
    .eq("clinic_id", clinic_id)
    .order("full_name", { ascending: true })
    .limit(400);

  return (
    <AppShell
      title="New patient"
      subtitle="Link the patient to a client contact, then enter clinical identity fields."
      activeHref="/pets"
      navGroups={navGroups}
      topRight={
        <Link className="btn-secondary text-sm" href="/pets">
          Cancel
        </Link>
      }
    >
      <form action={createPet} className="card-soft workspace-form max-w-3xl space-y-6 text-sm">
        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Owner (client)
          </h2>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-medium text-on-background">Owner *</span>
            <select className="input-soft" name="owner_id" required>
              <option value="">Select client contact</option>
              {(owners ?? []).map((o) => {
                const label =
                  o.first_name && o.last_name
                    ? `${o.first_name} ${o.last_name}`
                    : o.full_name;
                return (
                  <option key={o.id} value={o.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Patient
          </h2>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-medium text-on-background">Patient name *</span>
            <input className="input-soft" name="name" required placeholder="Patient name" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Microchip number</span>
            <input className="input-soft" name="microchip_id" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Weight (kg)</span>
            <input className="input-soft" name="weight_kg" type="number" step="0.01" min="0" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Date of birth</span>
            <input className="input-soft" name="date_of_birth" type="date" />
          </label>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" name="date_of_birth_estimated" className="rounded border-outline-variant" />
            <span>Estimated DOB</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Sex</span>
            <select className="input-soft" name="gender">
              <option value="">—</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Species *</span>
            <input className="input-soft" name="species" required placeholder="e.g. Dog, Cat" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-medium text-on-background">Breed</span>
            <input className="input-soft" name="breed" placeholder="Breed" />
          </label>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Animal notes</h2>
          <textarea className="input-soft mt-2 min-h-[100px] w-full" name="animal_notes" placeholder="Clinical notes about the patient…" />
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" name="animal_notes_important" className="rounded border-outline-variant" />
            <span className="font-medium text-error">Notes important</span>
          </label>
        </section>

        <div className="flex flex-wrap gap-2 border-t border-outline-variant/20 pt-4">
          <SubmitButton className="btn-primary" pendingLabel="Saving…">
            Save patient
          </SubmitButton>
          <Link className="btn-secondary" href="/pets">
            Back to directory
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
