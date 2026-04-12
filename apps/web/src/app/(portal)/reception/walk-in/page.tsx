import Link from "next/link";
import { redirect } from "next/navigation";
import { createWalkInGuestPatient } from "../actions";
import { AppShell } from "@/components/web/app-shell";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/web/submit-button";

const ALLOWED = new Set([
  "clinic_admin",
  "branch_admin",
  "doctor",
  "receptionist",
  "lab_technician",
  "pharmacist",
]);

export default async function WalkInGuestPage() {
  const access = await getUserAccess();
  const role = (access.membership?.role ?? "pet_owner") as Parameters<typeof getRoleNavGroups>[0];
  if (!access.isSuperAdmin && !ALLOWED.has(role)) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const supabase = createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("clinic_id", clinic_id)
    .eq("is_active", true)
    .order("name", { ascending: true });

  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  return (
    <AppShell
      title="Walk-in guest"
      subtitle="Create a guest contact and patient without a portal login. Full profile can be edited later in Owners / Pets."
      activeHref="/reception/walk-in"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-1">
          <Link className="btn-secondary btn-compact" href="/owners">
            Owners
          </Link>
          <Link className="btn-secondary btn-compact" href="/pets">
            Pets
          </Link>
        </div>
      }
    >
      <form action={createWalkInGuestPatient} className="card-soft max-w-xl space-y-3 text-[12px]">
        <p className="text-[11px] text-slate-600">
          Use for visitors without an app account. Phone is required; owner name defaults to “Guest Walk-in” if left blank.
        </p>

        <label className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-800">Owner name</span>
          <input
            name="owner_name"
            className="rounded border border-slate-200 bg-white px-2 py-1.5"
            placeholder="First Last (optional)"
            autoComplete="name"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-800">Phone *</span>
          <input
            name="phone"
            required
            className="rounded border border-slate-200 bg-white px-2 py-1.5"
            placeholder="+91 98765 43210"
            inputMode="tel"
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-800">Patient name *</span>
          <input name="pet_name" required className="rounded border border-slate-200 bg-white px-2 py-1.5" placeholder="Pet name" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-800">Species *</span>
          <input name="species" className="rounded border border-slate-200 bg-white px-2 py-1.5" placeholder="dog, cat…" defaultValue="dog" />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-800">Primary branch</span>
          <select name="branch_id" className="rounded border border-slate-200 bg-white px-2 py-1.5">
            <option value="">—</option>
            {(branches ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px]">
          <input type="checkbox" name="create_appointment" className="rounded border-slate-300" />
          <span>Also create a same-day appointment (needs branch)</span>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-800">Desk notes</span>
          <textarea name="notes" rows={2} className="rounded border border-slate-200 bg-white px-2 py-1.5" placeholder="Optional" />
        </label>
        <SubmitButton className="btn-primary btn-compact" pendingLabel="Saving…">
          Save walk-in & open patient
        </SubmitButton>
      </form>
    </AppShell>
  );
}
