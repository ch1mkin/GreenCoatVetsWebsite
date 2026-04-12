import { redirect } from "next/navigation";
import { assignUserToClinicAction, getClinicTeamMembers, removeUserFromClinicAction } from "./actions";
import { AppShell } from "@/components/web/app-shell";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

const ASSIGN_ROLES = [
  { value: "doctor", label: "Doctor" },
  { value: "receptionist", label: "Receptionist" },
  { value: "branch_admin", label: "Branch admin" },
  { value: "lab_technician", label: "Lab technician" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "pet_owner", label: "Pet owner" },
] as const;

export default async function TeamManagementPage() {
  const access = await getUserAccess();
  const role = (access.membership?.role ?? "pet_owner") as Parameters<typeof getRoleNavGroups>[0];
  if (role !== "clinic_admin") {
    redirect("/dashboard");
  }

  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  let rows: Awaited<ReturnType<typeof getClinicTeamMembers>> = [];
  try {
    rows = await getClinicTeamMembers();
  } catch {
    rows = [];
  }

  return (
    <AppShell
      title="Team & roles"
      subtitle="Assign staff and pet owner roles by email. The person must already have an account (sign up once)."
      activeHref="/team"
      navGroups={navGroups}
    >
      <section className="card-soft mb-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Assign or update access</h2>
        <form action={assignUserToClinicAction} className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-0.5 text-[11px] md:col-span-2">
            <span className="font-semibold text-slate-700">Account email</span>
            <input
              name="email"
              type="email"
              required
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]"
              placeholder="colleague@clinic.com"
              autoComplete="off"
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px]">
            <span className="font-semibold text-slate-700">Role</span>
            <select name="role" required className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]">
              {ASSIGN_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px]">
            <span className="font-semibold text-slate-700">Display name (staff)</span>
            <input name="full_name" className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]" placeholder="Optional" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px]">
            <span className="font-semibold text-slate-700">Phone</span>
            <input name="phone" className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]" placeholder="+91…" />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px]">
            <span className="font-semibold text-slate-700">Doctor working hours</span>
            <input
              name="working_hours"
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px]"
              placeholder="Required if role is Doctor"
            />
          </label>
          <label className="flex items-center gap-2 text-[11px] md:col-span-2 lg:col-span-3">
            <input type="checkbox" name="confirm_assign" required className="rounded border-slate-300" />
            <span>I confirm assigning this role for this clinic.</span>
          </label>
          <SubmitButton className="btn-primary btn-compact w-fit md:col-span-2 lg:col-span-3" pendingLabel="Saving…">
            Save assignment
          </SubmitButton>
        </form>
      </section>

      <section className="card-soft overflow-x-auto">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Clinic memberships</h2>
        <table className="mt-2 w-full min-w-[520px] border-collapse text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              <th className="py-2 pl-2 pr-2">Email</th>
              <th className="py-2 pr-2">Role</th>
              <th className="py-2 pr-2">Active</th>
              <th className="py-2 pr-2">Updated</th>
              <th className="py-2 pr-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.user_id}-${row.role}`} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="py-1.5 pl-2 pr-2 font-mono text-[11px] text-slate-900">{row.email || row.user_id.slice(0, 8)}</td>
                <td className="py-1.5 pr-2 font-medium capitalize text-slate-800">{row.role.replace(/_/g, " ")}</td>
                <td className="py-1.5 pr-2">{row.is_active ? "Yes" : "No"}</td>
                <td className="py-1.5 pr-2 text-slate-600">
                  {row.updated_at ? new Date(row.updated_at).toLocaleString() : "—"}
                </td>
                <td className="py-1.5 pr-2 text-right">
                  {row.is_active ? (
                    <form action={removeUserFromClinicAction} className="inline-flex flex-col items-end gap-1">
                      <input type="hidden" name="target_user_id" value={row.user_id} />
                      <label className="flex items-center gap-1 text-[10px] text-slate-600">
                        <input type="checkbox" name="confirm_remove" required className="rounded border-slate-300" />
                        Confirm
                      </label>
                      <SubmitButton className="btn-secondary btn-compact text-[10px]" pendingLabel="…">
                        Remove from clinic
                      </SubmitButton>
                    </form>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="mt-2 text-[12px] text-slate-600">No memberships yet.</p> : null}
      </section>
    </AppShell>
  );
}
