import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { formatInr } from "@/lib/format-currency";

export default async function AnalyticsPage() {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (!access.isSuperAdmin && !["clinic_admin", "branch_admin"].includes(role)) redirect("/dashboard");

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [
    appointmentsTodayRes,
    paidOrdersRes,
    lowStockItemsRes,
    expiringItemsRes,
    popularProductsRes,
    newPetsRes,
    membershipsRes,
    newMembershipsRes,
    ownersCountRes,
    monthAppointmentsRes,
    staffRes,
    apptsByDoctorRes,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .gte("starts_at", `${today}T00:00:00`)
      .lt("starts_at", `${today}T23:59:59`),
    supabase
      .from("orders")
      .select("grand_total, placed_at")
      .eq("clinic_id", clinic_id)
      .eq("status", "paid")
      .gte("placed_at", weekAgo),
    supabase
      .from("inventory_items")
      .select("id, name, stock_quantity, reorder_level")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .order("stock_quantity", { ascending: true })
      .limit(8),
    supabase
      .from("inventory_items")
      .select("id, name, expiry_date")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .not("expiry_date", "is", null)
      .order("expiry_date", { ascending: true })
      .limit(8),
    supabase
      .from("order_items")
      .select("quantity, products(name, clinic_id)")
      .limit(500),
    supabase
      .from("pets")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .gte("created_at", weekAgo),
    supabase
      .from("user_clinic_memberships")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .eq("is_active", true),
    supabase
      .from("user_clinic_memberships")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id)
      .gte("created_at", weekAgo),
    supabase
      .from("owners")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinic_id),
    supabase
      .from("appointments")
      .select("appointment_type")
      .eq("clinic_id", clinic_id)
      .gte("starts_at", monthStart)
      .limit(500),
    supabase
      .from("staff_profiles")
      .select("id, full_name, role")
      .eq("clinic_id", clinic_id)
      .eq("is_active", true)
      .limit(50),
    supabase
      .from("appointments")
      .select("doctor_id")
      .eq("clinic_id", clinic_id)
      .gte("starts_at", weekAgo)
      .not("doctor_id", "is", null)
      .limit(800),
  ]);

  const appointmentsToday = appointmentsTodayRes.count ?? 0;
  const paidOrders = paidOrdersRes.data ?? [];
  const weeklyRevenue = paidOrders.reduce((sum, o) => sum + Number(o.grand_total ?? 0), 0);
  const newRegistrations = newPetsRes.count ?? 0;
  const teamMembers = membershipsRes.count ?? 0;
  const newTeamThisWeek = newMembershipsRes.count ?? 0;
  const ownerCount = ownersCountRes.count ?? 0;

  /** Revenue by day (last 7d) — local dates */
  const dayKeys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    dayKeys.push(d.toISOString().slice(0, 10));
  }
  const revenueByDay = new Map<string, number>();
  for (const k of dayKeys) revenueByDay.set(k, 0);
  for (const o of paidOrders) {
    if (!o.placed_at) continue;
    const k = new Date(o.placed_at).toISOString().slice(0, 10);
    if (revenueByDay.has(k)) {
      revenueByDay.set(k, (revenueByDay.get(k) ?? 0) + Number(o.grand_total ?? 0));
    }
  }
  const maxDayRev = Math.max(1, ...Array.from(revenueByDay.values()));

  const typeCount = new Map<string, number>();
  for (const row of monthAppointmentsRes.data ?? []) {
    const t = row.appointment_type ?? "unknown";
    typeCount.set(t, (typeCount.get(t) ?? 0) + 1);
  }
  const typeEntries = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(1, ...typeEntries.map(([, n]) => n));

  const doctorHits = new Map<string, number>();
  for (const row of apptsByDoctorRes.data ?? []) {
    const id = row.doctor_id as string;
    doctorHits.set(id, (doctorHits.get(id) ?? 0) + 1);
  }
  const staffList = staffRes.data ?? [];
  const staffRows = staffList
    .filter((s) => s.role === "doctor" || doctorHits.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.full_name,
      role: s.role,
      appts: doctorHits.get(s.id) ?? 0,
    }))
    .sort((a, b) => b.appts - a.appts)
    .slice(0, 8);

  const lowStock = (lowStockItemsRes.data ?? []).filter((item) => item.stock_quantity <= item.reorder_level);
  const expiringSoon = (expiringItemsRes.data ?? []).filter((item) => {
    if (!item.expiry_date) return false;
    const diff = new Date(item.expiry_date).getTime() - Date.now();
    return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
  });

  const popularMap = new Map<string, number>();
  for (const row of popularProductsRes.data ?? []) {
    const product = row.products as { name?: string; clinic_id?: string } | null;
    if (!product?.name || product.clinic_id !== clinic_id) continue;
    popularMap.set(product.name, (popularMap.get(product.name) ?? 0) + Number(row.quantity ?? 0));
  }
  const popularProducts = Array.from(popularMap.entries())
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);
  const popMax = Math.max(1, ...popularProducts.map((p) => p.qty));

  const avgTicket = paidOrders.length ? weeklyRevenue / paidOrders.length : 0;
  const monthAppts = monthAppointmentsRes.data?.length ?? 0;
  const dayRevenueValues = Array.from(revenueByDay.values());
  const peakDayRevenue = Math.max(0, ...dayRevenueValues);
  const peakSharePct =
    weeklyRevenue > 0 ? Math.round((peakDayRevenue / weeklyRevenue) * 100) : 0;

  return (
    <AppShell
      title="Analytics insights"
      subtitle="Clinic operations + product usage from your database. Page-level web analytics require an external tool or event table."
      activeHref="/analytics"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary text-sm" href="/dashboard">
            Dashboard
          </Link>
        </div>
      }
    >
      <div className="mb-6 rounded-xl border border-primary/10 bg-primary/5 p-4 text-sm text-on-surface-variant">
        <p className="font-semibold text-on-background">Website &amp; product analytics</p>
        <p className="mt-1">
          <strong>Included:</strong> users tied to this clinic (memberships), pets/owners, appointments, and commerce
          totals from Supabase.
        </p>
        <p className="mt-1">
          <strong>Not tracked in-app yet:</strong> marketing page views / sessions. Plug in Plausible, PostHog, or GA4,
          or add a <code className="rounded bg-surface-container-low px-1 text-xs">page_events</code> table to record
          routes.
        </p>
      </div>

      <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="rounded-xl border border-outline-variant/5 bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-primary-container/10 p-2 text-primary">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <span className="rounded-full bg-primary-fixed px-2 py-1 text-xs font-bold text-on-primary-fixed-variant">
              7d
            </span>
          </div>
          <p className="text-sm font-medium text-on-surface-variant">Avg paid order (7d)</p>
          <h3 className="mt-1 font-headline text-2xl font-bold">
            {formatInr(avgTicket)}
          </h3>
        </div>

        <div className="rounded-xl border border-outline-variant/5 bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-secondary-container p-2 text-secondary">
              <span className="material-symbols-outlined">group</span>
            </div>
            <span className="rounded-full bg-primary-fixed px-2 py-1 text-xs font-bold text-on-primary-fixed-variant">
              Active
            </span>
          </div>
          <p className="text-sm font-medium text-on-surface-variant">Team seats (memberships)</p>
          <h3 className="mt-1 font-headline text-2xl font-bold">{teamMembers}</h3>
        </div>

        <div className="rounded-xl border border-outline-variant/5 bg-surface-container-lowest p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-tertiary-fixed p-2 text-on-tertiary-fixed">
              <span className="material-symbols-outlined">schedule</span>
            </div>
            <span className="text-xs font-bold text-on-tertiary-fixed-variant">Month</span>
          </div>
          <p className="text-sm font-medium text-on-surface-variant">Appointments (month to date)</p>
          <h3 className="mt-1 font-headline text-2xl font-bold">{monthAppts}</h3>
        </div>

        <div className="rounded-xl bg-gradient-to-br from-primary to-primary-container p-6 text-white shadow-lg">
          <div className="mb-4 flex items-start justify-between">
            <div className="rounded-lg bg-white/20 p-2">
              <span className="material-symbols-outlined">trending_up</span>
            </div>
          </div>
          <p className="text-sm font-medium text-white/80">Revenue (7d paid orders)</p>
          <h3 className="mt-1 font-headline text-2xl font-bold">
            {formatInr(weeklyRevenue)}
          </h3>
          <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-white" style={{ width: `${Math.min(100, peakSharePct)}%` }} />
          </div>
          <p className="mt-2 text-[10px] text-white/70">
            Peak day share of 7d revenue: {peakSharePct}% (not a forecast).
          </p>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl bg-surface-container-lowest p-8 shadow-sm">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="font-headline text-xl font-bold">Paid revenue by day</h2>
              <p className="text-sm text-on-surface-variant">Last 7 days — same clinic</p>
            </div>
          </div>
          <div className="flex h-64 items-end justify-between gap-2">
            {dayKeys.map((k) => {
              const v = revenueByDay.get(k) ?? 0;
              const h = (v / maxDayRev) * 100;
              return (
                <div key={k} className="group relative flex w-full flex-col items-center">
                  <div
                    className="w-full rounded-t-lg bg-primary/20 transition-all group-hover:bg-primary/40"
                    style={{ height: `${Math.max(8, h)}%` }}
                  />
                  <span className="mt-2 text-[10px] font-bold text-on-surface-variant">
                    {k.slice(5).replace("-", "/")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col rounded-xl bg-surface-container-low p-8">
          <h2 className="mb-6 font-headline text-xl font-bold">Popular products</h2>
          <div className="flex-1 space-y-6">
            {popularProducts.map((product) => (
              <div key={product.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{product.name}</span>
                  <span className="font-bold text-primary">{product.qty}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-container-highest">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(product.qty / popMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!popularProducts.length ? (
              <p className="text-sm text-on-surface-variant">No product sales in sampled order items.</p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-sm font-medium text-on-surface-variant">Pet owners (directory)</p>
          <p className="mt-1 font-headline text-3xl font-bold">{ownerCount}</p>
        </div>
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-sm font-medium text-on-surface-variant">New pets (7d)</p>
          <p className="mt-1 font-headline text-3xl font-bold">{newRegistrations}</p>
        </div>
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
          <p className="text-sm font-medium text-on-surface-variant">New membership rows (7d)</p>
          <p className="mt-1 font-headline text-3xl font-bold">{newTeamThisWeek}</p>
          <p className="mt-2 text-xs text-on-surface-variant">Invites / role changes create rows.</p>
        </div>
      </section>

      <section className="mb-8 rounded-xl bg-surface-container-low p-6">
        <h2 className="mb-4 font-headline text-lg font-bold">Appointment types (month)</h2>
        <div className="space-y-4">
          {typeEntries.map(([t, n]) => (
            <div key={t} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="capitalize">{t}</span>
                <span className="font-bold text-primary">{n}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-surface-container-highest">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(n / maxType) * 100}%` }} />
              </div>
            </div>
          ))}
          {!typeEntries.length ? <p className="text-sm text-on-surface-variant">No appointments this month.</p> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-outline-variant/5 bg-surface-container-lowest shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-surface-container-low px-8 py-6 md:flex-row md:items-center">
          <div>
            <h2 className="font-headline text-xl font-bold">Staff &amp; appointments</h2>
            <p className="text-sm text-on-surface-variant">Appointment counts per doctor (last 7 days)</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-8 py-4">Practitioner</th>
                <th className="px-8 py-4">Role</th>
                <th className="px-8 py-4">Appointments (7d)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {staffRows.map((s) => (
                <tr key={s.id} className="hover:bg-surface-container/30">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed font-bold text-primary">
                        {initials(s.name)}
                      </div>
                      <p className="font-bold text-on-surface">{s.name}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-sm capitalize">{s.role}</td>
                  <td className="px-8 py-5 font-medium">{s.appts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!staffRows.length ? (
            <p className="px-8 py-6 text-sm text-on-surface-variant">No doctor-linked appointments this week.</p>
          ) : null}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
          <h2 className="mb-3 font-headline text-lg font-bold">Low stock</h2>
          <ul className="space-y-2 text-sm">
            {lowStock.map((item) => (
              <li key={item.id}>
                {item.name}: {item.stock_quantity} (reorder: {item.reorder_level})
              </li>
            ))}
          </ul>
          {!lowStock.length ? <p className="text-sm text-on-surface-variant">No low-stock alerts.</p> : null}
        </div>
        <div className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
          <h2 className="mb-3 font-headline text-lg font-bold">Expiry (30d)</h2>
          <ul className="space-y-2 text-sm">
            {expiringSoon.map((item) => (
              <li key={item.id}>
                {item.name}: {item.expiry_date}
              </li>
            ))}
          </ul>
          {!expiringSoon.length ? <p className="text-sm text-on-surface-variant">No expiry alerts.</p> : null}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-dashed border-outline-variant/30 bg-surface-container-low/50 p-6">
        <h3 className="font-headline font-bold text-on-background">Today&apos;s schedule volume</h3>
        <p className="mt-2 text-3xl font-bold text-primary">{appointmentsToday}</p>
        <p className="text-sm text-on-surface-variant">Appointments starting today for this clinic.</p>
      </section>

      <Link
        href="/appointments/calendar"
        className="fixed bottom-8 right-8 z-40 flex items-center gap-2 rounded-full bg-primary px-5 py-4 text-white shadow-2xl transition-all hover:bg-primary-container"
      >
        <span className="material-symbols-outlined">add</span>
        <span className="pr-1 font-bold">Calendar</span>
      </Link>
    </AppShell>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}
