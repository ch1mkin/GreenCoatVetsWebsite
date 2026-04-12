import Link from "next/link";
import { redirect } from "next/navigation";
import { createBranch, setBranchActive } from "./actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

export default async function BranchesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");

  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  const canManage = access.isSuperAdmin || role === "clinic_admin";
  if (!canManage) redirect("/dashboard");

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  const { data: clinic } = await supabase.from("clinics").select("id, name").eq("id", clinic_id).maybeSingle();

  const { data: branches, error } = await supabase
    .from("branches")
    .select("id, name, code, city, phone, address_line1, is_active, created_at")
    .eq("clinic_id", clinic_id)
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  const list = branches ?? [];
  const activeCount = list.filter((b) => b.is_active).length;

  return (
    <AppShell
      title="Branches"
      subtitle={`Locations for ${clinic?.name ?? "your clinic"} — used when booking appointments, inventory, and services.`}
      activeHref="/branches"
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
      <section className="card-soft">
        <h2 className="font-headline text-lg font-bold">Why branches matter</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Each branch is tied to your clinic (<span className="font-mono text-xs">{clinic_id.slice(0, 8)}…</span>). Staff
          choose a branch when creating appointments, recording inventory, and publishing services — so data stays grouped by
          location.
        </p>
      </section>

      <section className="mt-6 card-soft">
        <h2 className="font-headline text-lg font-bold">Add a branch</h2>
        <form action={createBranch} className="mt-3 grid gap-3 md:grid-cols-2">
          <input className="input-soft md:col-span-2" name="name" placeholder="Branch name (e.g. North Campus)" required />
          <input className="input-soft" name="code" placeholder="Short code (optional, e.g. NORTH)" />
          <input className="input-soft" name="city" placeholder="City" />
          <input className="input-soft md:col-span-2" name="address_line1" placeholder="Address line 1" />
          <input className="input-soft md:col-span-2" name="phone" placeholder="Branch phone" />
          <SubmitButton className="btn-primary md:col-span-2" pendingLabel="Creating branch…">
            Create branch
          </SubmitButton>
        </form>
      </section>

      <section className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-headline text-lg font-bold text-on-background">Your locations</h2>
          <span className="text-xs font-semibold text-on-surface-variant">
            {activeCount} active · {list.length} total
          </span>
        </div>
        {!list.length ? (
          <p className="py-6 text-sm text-on-surface-variant">
            No branches yet. Add one above — after you run the latest database migration, existing clinics also get a default
            &quot;Main&quot; branch automatically.
          </p>
        ) : null}
        {list.map((b) => (
          <div
            key={b.id}
            className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 transition-all hover:bg-surface-container sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-headline text-base font-bold text-on-surface">{b.name}</h3>
                {b.code ? (
                  <span className="rounded-md bg-primary-fixed/20 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                    {b.code}
                  </span>
                ) : null}
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    b.is_active
                      ? "bg-primary-fixed text-on-primary-fixed-variant"
                      : "bg-surface-container-highest text-on-surface-variant"
                  }`}
                >
                  {b.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 text-xs text-on-surface-variant">
                {[b.address_line1, b.city].filter(Boolean).join(" · ") || "No address yet"}
                {b.phone ? ` · ${b.phone}` : ""}
              </p>
              <p className="mt-1 text-[11px] text-on-surface-variant/70">
                Added {b.created_at ? new Date(b.created_at).toLocaleDateString() : "—"}
              </p>
            </div>
            <form action={setBranchActive} className="shrink-0">
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="next_active" value={b.is_active ? "false" : "true"} />
              <button className={b.is_active ? "btn-secondary text-sm" : "btn-primary text-sm"} type="submit">
                {b.is_active ? "Deactivate" : "Reactivate"}
              </button>
            </form>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
