import { redirect } from "next/navigation";
import { PasswordChangeForm } from "./password-change-form";
import { AppShell } from "@/components/web/app-shell";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

function formatRoleLabel(role: string | null) {
  if (!role) return "No clinic role";
  return role.replace(/_/g, " ");
}

export default async function ProfilePage() {
  const access = await getUserAccess();
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const [{ data: authData }, clinicResult] = await Promise.all([
    supabase.auth.getUser(),
    access.membership?.clinic_id
      ? supabase.from("clinics").select("name").eq("id", access.membership.clinic_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const user = authData.user;
  if (!user) {
    redirect("/login");
  }

  const clinicName =
    clinicResult?.data && "name" in clinicResult.data
      ? (clinicResult.data.name as string | null)
      : access.isSuperAdmin && !access.membership
        ? "Platform access"
        : "Not assigned yet";

  return (
    <AppShell
      title="My profile"
      subtitle="View your current account access and update your password whenever you want."
      activeHref="/profile"
      navGroups={navGroups}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="card-soft space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Account details</p>
            <p className="mt-1 text-sm text-slate-600">These values reflect the account currently logged into the clinic portal.</p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Email</dt>
              <dd className="mt-1 break-all text-sm font-semibold text-slate-900">{user.email ?? "No email on file"}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Role</dt>
              <dd className="mt-1 text-sm font-semibold capitalize text-slate-900">{formatRoleLabel(access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : null))}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Clinic</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-900">{clinicName || "Not assigned yet"}</dd>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">User ID</dt>
              <dd className="mt-1 break-all font-mono text-[12px] text-slate-700">{access.userId}</dd>
            </div>
          </dl>
        </section>

        <section className="card-soft">
          <PasswordChangeForm email={user.email ?? "this account"} />
        </section>
      </div>
    </AppShell>
  );
}
