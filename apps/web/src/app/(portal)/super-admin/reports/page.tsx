import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { AppShell } from "@/components/web/app-shell";
import { PrintButton } from "./print-button";
import { formatInr } from "@/lib/format-currency";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default async function SuperAdminReportsPage() {
  const access = await getUserAccess();
  if (!access.isSuperAdmin) redirect("/dashboard");

  const supabase = createClient();
  const navGroups = getRoleNavGroups("clinic_admin", true);

  const [clinicsRes, usersRes, paymentsRes, prescriptionsRes] = await Promise.all([
    supabase
      .from("clinics")
      .select("id, name, slug, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("app_users")
      .select("id, email, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("orders")
      .select("id, clinic_id, status, grand_total, placed_at")
      .order("placed_at", { ascending: false })
      .limit(500),
    supabase
      .from("prescriptions")
      .select("id, clinic_id, issued_at")
      .order("issued_at", { ascending: false })
      .limit(500),
  ]);

  const clinics = clinicsRes.data ?? [];
  const users = usersRes.data ?? [];
  const orders = paymentsRes.data ?? [];
  const prescriptions = prescriptionsRes.data ?? [];

  const totalRevenue = orders
    .filter((o) => o.status === "paid")
    .reduce((sum, row) => sum + Number(row.grand_total ?? 0), 0);

  const activeClinics = clinics.filter((c) => c.is_active).length;
  const inactiveClinics = clinics.length - activeClinics;

  const orderStatusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    const s = o.status ?? "unknown";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  }, {});
  const orderStatuses = Object.entries(orderStatusCounts).sort((a, b) => b[1] - a[1]);
  const maxStatusCount = Math.max(1, ...orderStatuses.map(([, n]) => n));

  const recentClinics = clinics.slice(0, 8);

  return (
    <AppShell
      title="Network Overview"
      subtitle="Platform-wide metrics from live data (no sample figures)."
      activeHref="/super-admin/reports"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton />
          <Link className="btn-secondary text-sm" href="/super-admin">
            Platform Control
          </Link>
        </div>
      }
    >
      {/* Bento metrics */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="relative flex min-h-[200px] flex-col justify-between overflow-hidden rounded-xl bg-surface-container-lowest p-8 shadow-sm md:col-span-2">
          <div className="relative z-10">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                Paid order revenue (loaded rows)
              </span>
              <span className="text-primary" aria-hidden>
                ◆
              </span>
            </div>
            <h2 className="font-headline text-4xl font-extrabold text-on-background md:text-5xl">
              {formatInr(totalRevenue)}
            </h2>
            <p className="mt-3 text-sm text-on-surface-variant">
              Sum of <span className="font-semibold text-on-surface">grand_total</span> where status is{" "}
              <span className="font-mono text-xs">paid</span> (up to 500 most recent orders).
            </p>
          </div>
          <div className="pointer-events-none absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-8 shadow-sm">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Active clinics
            </p>
            <h3 className="font-headline text-4xl font-bold text-on-background">{activeClinics}</h3>
            <p className="mt-2 text-xs text-on-surface-variant">
              {inactiveClinics ? `${inactiveClinics} inactive in this sample` : "All loaded clinics active"}
            </p>
          </div>
          <div className="mt-4 flex items-end gap-2">
            <div className="flex h-8 w-full items-end gap-1">
              {[0.35, 0.55, 0.75, 1].map((h, i) => (
                <div
                  key={i}
                  className="w-2 rounded-full bg-primary"
                  style={{ height: `${Math.round(h * 100)}%`, opacity: 0.2 + i * 0.2 }}
                />
              ))}
            </div>
            <span className="text-xs font-bold text-primary">Live</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border-l-4 border-primary bg-surface-container-low p-8">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Platform records
            </p>
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
              <h3 className="font-headline text-2xl font-bold text-on-background">Synced</h3>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-on-surface-variant">Users (sample)</span>
              <span className="font-bold text-primary">{users.length}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (users.length / 300) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-on-surface-variant">App users capped at 300 for this view.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Clinics table */}
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low px-6 py-5">
            <h3 className="font-headline text-xl font-bold text-on-background">Recent clinics</h3>
            <p className="text-xs text-on-surface-variant">Newest first (up to 8 shown)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-container-low text-xs uppercase text-on-surface-variant">
                <tr>
                  <th className="px-6 py-4 font-bold">Clinic</th>
                  <th className="px-6 py-4 font-bold">Registered</th>
                  <th className="px-6 py-4 font-bold text-center">Slug</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {recentClinics.map((clinic) => (
                  <tr key={clinic.id} className="group transition-colors hover:bg-surface-container-low">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container font-bold text-primary">
                          {initials(clinic.name)}
                        </div>
                        <div>
                          <p className="font-bold text-on-background">{clinic.name}</p>
                          <p className="max-w-[160px] truncate font-mono text-xs text-on-surface-variant">{clinic.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-sm font-medium text-on-surface-variant">
                      {new Date(clinic.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="rounded bg-secondary-container px-2 py-1 text-[10px] font-extrabold uppercase text-on-secondary-container">
                        {clinic.slug}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div
                        className={`flex items-center gap-2 text-sm font-bold ${
                          clinic.is_active ? "text-primary" : "text-tertiary"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${clinic.is_active ? "bg-primary" : "bg-tertiary-container"}`}
                        />
                        {clinic.is_active ? "Active" : "Inactive"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recentClinics.length ? (
              <p className="px-6 py-8 text-sm text-on-surface-variant">No clinics loaded.</p>
            ) : null}
          </div>
        </div>

        {/* Order status + quick links */}
        <div className="space-y-6">
          <div className="relative overflow-hidden rounded-xl bg-inverse-surface p-6 text-white shadow-xl">
            <div className="relative z-10">
              <div className="mb-6 flex items-center justify-between">
                <h4 className="font-headline text-lg font-bold">Order status mix</h4>
                <span className="text-primary-fixed" aria-hidden>
                  ▣
                </span>
              </div>
              <div className="space-y-4">
                {orderStatuses.length ? (
                  orderStatuses.map(([status, count]) => (
                    <div key={status}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="capitalize">{status}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-primary-container"
                          style={{ width: `${(count / maxStatusCount) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-white/80">No orders in the loaded sample.</p>
                )}
              </div>
            </div>
            <div className="pointer-events-none absolute right-0 top-0 p-2 opacity-10">◎</div>
          </div>

          <div className="rounded-xl bg-surface-container-low p-6">
            <h4 className="mb-4 font-headline font-bold text-on-background">Related surfaces</h4>
            <div className="grid gap-3">
              <Link
                href="/super-admin"
                className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="text-sm font-semibold text-on-surface">Platform control</span>
                <span className="text-on-surface-variant">→</span>
              </Link>
              <Link
                href="/payments"
                className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="text-sm font-semibold text-on-surface">Payments</span>
                <span className="text-on-surface-variant">→</span>
              </Link>
              <Link
                href="/analytics"
                className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="text-sm font-semibold text-on-surface">Analytics</span>
                <span className="text-on-surface-variant">→</span>
              </Link>
            </div>
            <p className="mt-4 text-xs text-on-surface-variant">
              Prescriptions loaded: <span className="font-semibold text-on-surface">{prescriptions.length}</span> (capped
              at 500).
            </p>
          </div>
        </div>
      </div>

      {/* Timeline-style events — factual labels only */}
      <div className="mt-10">
        <h3 className="mb-6 font-headline text-xl font-bold text-on-background">Recent platform activity</h3>
        <div className="relative space-y-8 pl-8 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-0.5 before:bg-outline-variant/40 before:content-['']">
          <div className="relative">
            <div className="absolute -left-[28px] top-1 h-4 w-4 rounded-full border-4 border-surface bg-primary shadow-sm" />
            <div className="glass-card max-w-2xl rounded-xl p-4 shadow-sm">
              <div className="mb-2 flex justify-between">
                <span className="text-xs font-bold uppercase text-primary">Clinics</span>
                <span className="text-xs text-on-surface-variant">Snapshot</span>
              </div>
              <p className="text-sm font-medium text-on-background">
                <span className="font-semibold">{clinics.length}</span> clinic records returned (max 300).
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -left-[28px] top-1 h-4 w-4 rounded-full border-4 border-surface bg-tertiary shadow-sm" />
            <div className="glass-card max-w-2xl rounded-xl p-4 shadow-sm">
              <div className="mb-2 flex justify-between">
                <span className="text-xs font-bold uppercase text-tertiary">Orders</span>
                <span className="text-xs text-on-surface-variant">Snapshot</span>
              </div>
              <p className="text-sm font-medium text-on-background">
                <span className="font-semibold">{orders.length}</span> order rows loaded (max 500) for revenue and status
                breakdown.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
