import Link from "next/link";
import { redirect } from "next/navigation";
import {
  createClinicAsSuperAdmin,
  deleteClinicPermanently,
  refreshUsersFromRegistryAsSuperAdmin,
  setClinicActiveState,
  setClinicWebsiteStoreState,
  updateClinicImageAsSuperAdmin,
  updatePlatformBrandingAsSuperAdmin,
} from "./actions";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { SubmitButton } from "@/components/web/submit-button";
import { formatInr } from "@/lib/format-currency";
import { getPlatformBranding } from "@/lib/platform-branding";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default async function SuperAdminPage() {
  const supabase = createClient();
  const access = await getUserAccess();
  if (!access.isSuperAdmin) redirect("/dashboard");

  const [
    clinicsRes,
    appUsersRes,
    ordersRes,
    membershipsRes,
    orderStatusRes,
    platformBranding,
    brandingRowRes,
  ] = await Promise.all([
    supabase
      .from("clinics")
      .select("id, name, slug, subdomain, custom_domain, image_url, is_active, website_store_enabled, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("app_users").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("grand_total")
      .eq("status", "paid")
      .gte("placed_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(2000),
    supabase.from("user_clinic_memberships").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("orders").select("status").limit(500),
    getPlatformBranding(),
    supabase
      .from("platform_branding")
      .select("primary_clinic_id, website_store_enabled")
      .eq("id", "default")
      .maybeSingle(),
  ]);

  if (clinicsRes.error) throw new Error(clinicsRes.error.message);

  const clinics = clinicsRes.data ?? [];
  const primaryClinicId = (brandingRowRes.data?.primary_clinic_id as string | null) ?? null;
  const websiteStoreEnabled = (brandingRowRes.data?.website_store_enabled as boolean | null) ?? true;
  const activeClinics = clinics.filter((c) => c.is_active).length;
  const totalUsers = appUsersRes.count ?? 0;
  const totalMemberships = membershipsRes.count ?? 0;
  const revenue30 = (ordersRes.data ?? []).reduce((s, o) => s + Number(o.grand_total ?? 0), 0);

  const statusCounts: Record<string, number> = {};
  for (const row of orderStatusRes.data ?? []) {
    const st = row.status ?? "unknown";
    statusCounts[st] = (statusCounts[st] ?? 0) + 1;
  }
  const statusEntries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(1, ...statusEntries.map(([, n]) => n));

  const navGroups = getRoleNavGroups("clinic_admin", true);

  return (
    <AppShell
      title="Platform control"
      subtitle="Multi-tenant administration — figures below are from your database (no demo KPIs)."
      activeHref="/super-admin"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative hidden max-w-xs items-center rounded-full bg-surface-container-low px-4 py-1.5 md:flex">
            <span className="material-symbols-outlined text-on-surface-variant text-lg">search</span>
            <span className="ml-2 truncate text-xs text-on-surface-variant">Use Global Reports to search exports</span>
          </div>
          <Link className="btn-secondary text-sm" href="/super-admin/reports">
            Global reports
          </Link>
          <Link className="btn-secondary text-sm" href="/invite-qrs">
            Invite QRs
          </Link>
          <form action={refreshUsersFromRegistryAsSuperAdmin}>
            <SubmitButton className="btn-secondary text-sm" pendingLabel="Refreshing…">
              Refresh users
            </SubmitButton>
          </form>
          <Link className="btn-primary text-sm" href="/dashboard">
            Dashboard
          </Link>
        </div>
      }
    >
      {/* Bento metrics */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col justify-between rounded-xl border-b-4 border-primary bg-surface-container-lowest p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <span className="material-symbols-outlined">payments</span>
            </span>
            <span className="rounded-full bg-primary-fixed/30 px-2 py-0.5 text-xs font-bold text-on-primary-container">
              30d paid
            </span>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-on-surface-variant">Paid order total (30d)</p>
            <h3 className="mt-1 font-headline text-3xl font-extrabold text-on-background">
              {formatInr(revenue30)}
            </h3>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-secondary-container/40 p-2 text-secondary">
              <span className="material-symbols-outlined">domain</span>
            </span>
            <span className="rounded-full bg-secondary-container/40 px-2 py-0.5 text-xs font-bold text-on-secondary-container">
              {activeClinics} active
            </span>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-on-surface-variant">Clinics (loaded)</p>
            <h3 className="mt-1 font-headline text-3xl font-extrabold">{clinics.length}</h3>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-primary-fixed/30 p-2 text-primary">
              <span className="material-symbols-outlined">group</span>
            </span>
            <span className="rounded-full bg-primary-fixed/30 px-2 py-0.5 text-xs font-bold text-on-primary-fixed-variant">
              Registry
            </span>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-on-surface-variant">App users (app_users)</p>
            <h3 className="mt-1 font-headline text-3xl font-extrabold">{totalUsers}</h3>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-inverse-surface p-6 text-inverse-on-surface shadow-sm">
          <div className="flex items-start justify-between">
            <span className="rounded-lg bg-white/10 p-2">
              <span className="material-symbols-outlined">badge</span>
            </span>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium opacity-70">Active memberships</p>
            <h3 className="mt-1 font-headline text-2xl font-bold">{totalMemberships}</h3>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary-fixed">
              user_clinic_memberships
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Infrastructure / order mix — real data only */}
        <div className="space-y-6 lg:col-span-1">
          <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-headline text-lg font-extrabold">
              <span className="material-symbols-outlined text-primary">palette</span>
              Platform branding
            </h2>
            <p className="mb-4 text-xs text-on-surface-variant">
              PNG logo for the web app, mobile app, and marketing site header. For browser tabs, upload a separate
              square PNG (32×32 or 64×64) as favicon — wide logos appear blank in tabs.
            </p>
            {platformBranding.logo_url ? (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={platformBranding.logo_url}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-md object-contain"
                />
                <p className="text-xs text-on-surface-variant">Current logo preview</p>
              </div>
            ) : (
              <p className="mb-4 text-xs italic text-on-surface-variant">No custom logo yet — using default name only.</p>
            )}
            <form action={updatePlatformBrandingAsSuperAdmin} encType="multipart/form-data" className="space-y-3">
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                <span className="mb-1 block">Product name (shown in app & metadata)</span>
                <input
                  className="input-soft w-full"
                  name="product_name"
                  type="text"
                  defaultValue={platformBranding.product_name}
                  placeholder="GreenCoatVets"
                />
              </label>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                <span className="mb-1 block">Primary clinic for new mobile signups (customer default)</span>
                <select className="input-soft w-full" name="primary_clinic_id" defaultValue={primaryClinicId ?? ""}>
                  <option value="">Select clinic…</option>
                  {clinics
                    .filter((c) => c.is_active)
                    .map((clinic) => (
                      <option key={clinic.id} value={clinic.id}>
                        {clinic.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                <span className="mb-1 block">Website store access</span>
                <select className="input-soft w-full" name="website_store_enabled" defaultValue={websiteStoreEnabled ? "true" : "false"}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled (hidden + blocked)</option>
                </select>
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  <span className="mb-1 block">Website admin access code</span>
                  <input
                    className="input-soft w-full"
                    name="website_admin_access_code"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4,12}"
                    placeholder="Enter 4-12 digit code"
                  />
                </label>
                <label className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  <span className="mb-1 block">Confirm access code</span>
                  <input
                    className="input-soft w-full"
                    name="website_admin_access_code_confirm"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4,12}"
                    placeholder="Re-enter code"
                  />
                </label>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  <span className="mb-1 block">Logo (PNG)</span>
                  <input className="input-file-compact w-full" name="platform_logo" type="file" accept="image/png,.png" />
                </label>
                <SubmitButton
                  className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm"
                  pendingLabel="Saving…"
                >
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    Save branding
                  </span>
                </SubmitButton>
              </div>
              <p className="text-[10px] text-on-surface-variant">
                You can update the name only, logo only, or both. Logo is stored at <code className="rounded bg-surface-container-high px-1">platform/branding/logo.png</code>.
              </p>
            </form>
          </div>

          <div className="rounded-xl bg-surface-container-low p-6">
            <h2 className="mb-6 flex items-center gap-2 font-headline text-lg font-extrabold">
              <span className="material-symbols-outlined text-primary">bar_chart</span>
              Order status mix
            </h2>
            <p className="mb-4 text-xs text-on-surface-variant">
              Sample of up to 500 recent orders — not live infrastructure telemetry.
            </p>
            <div className="space-y-6">
              {statusEntries.length ? (
                statusEntries.map(([status, count]) => (
                  <div key={status} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      <span className="capitalize">{status}</span>
                      <span>{count}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-surface-container-high">
                      <div
                        className="h-full rounded-full bg-primary-container"
                        style={{ width: `${(count / maxStatus) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-on-surface-variant">No orders in sample.</p>
              )}
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <Link
                href="/super-admin/reports"
                className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest py-3 text-xs font-bold text-on-surface transition-all hover:bg-white"
              >
                <span className="material-symbols-outlined text-sm">analytics</span>
                Reports
              </Link>
              <Link
                href="/payments"
                className="flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest py-3 text-xs font-bold text-on-surface transition-all hover:bg-white"
              >
                <span className="material-symbols-outlined text-sm">payments</span>
                Payments
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-container p-6 text-white">
            <div className="relative z-10">
              <h3 className="mb-2 font-headline font-bold">Global reports</h3>
              <p className="text-xs leading-relaxed text-white/90">
                Export clinics, users, and financial rows for offline analysis.
              </p>
              <Link
                href="/super-admin/reports"
                className="mt-4 inline-block rounded-lg bg-white/15 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/25"
              >
                Open reports
              </Link>
            </div>
            <span className="material-symbols-outlined absolute -bottom-4 -right-4 rotate-12 text-9xl text-white/10">
              rocket_launch
            </span>
          </div>
        </div>

        {/* Clinics + create */}
        <div className="space-y-6 lg:col-span-2">
          <section className="overflow-hidden rounded-3xl border border-outline-variant/15 bg-gradient-to-b from-surface-container-lowest via-surface-container-lowest to-surface-container-low/90 shadow-[0_12px_48px_-16px_rgba(23,28,31,0.12)]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/10 bg-surface-container-low/40 px-6 py-5 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed/35 text-primary shadow-sm ring-1 ring-primary/10">
                  <span className="material-symbols-outlined text-[22px]">domain</span>
                </div>
                <div>
                  <h2 className="font-headline text-lg font-extrabold tracking-tight text-on-background md:text-xl">
                    Multi-tenant clinics
                  </h2>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    Up to 100 most recently created — hero image, access, and lifecycle
                  </p>
                </div>
              </div>
              <Link
                href="/super-admin/reports"
                className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/25 bg-surface-container-lowest/90 px-4 py-2.5 text-xs font-bold text-on-surface shadow-sm transition-all hover:border-primary/25 hover:bg-white active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-base text-primary">download</span>
                Export
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/10 bg-surface-container-high/35 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    <th className="px-4 py-4 pl-6 sm:px-6">Clinic</th>
                    <th className="px-4 py-4 sm:px-6">Slug</th>
                    <th className="px-4 py-4 sm:px-6">Status</th>
                    <th className="min-w-[260px] px-4 py-4 pr-6 text-right sm:min-w-[300px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {clinics.map((clinic) => (
                    <tr
                      key={clinic.id}
                      className="transition-colors odd:bg-surface-container-lowest/80 even:bg-surface-container-low/30 hover:bg-primary/[0.03]"
                    >
                      <td className="px-4 py-4 pl-6 sm:px-6">
                        <div className="flex items-center gap-3">
                          {clinic.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={clinic.image_url}
                              alt=""
                              className="h-10 w-10 rounded-xl object-cover ring-2 ring-outline-variant/20 ring-offset-2 ring-offset-surface-container-lowest"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-container/30 to-primary/20 font-headline text-xs font-bold text-primary ring-2 ring-primary/15 ring-offset-2 ring-offset-surface-container-lowest">
                              {initials(clinic.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-on-background">{clinic.name}</p>
                            <p className="truncate text-[10px] text-on-surface-variant">
                              {clinic.subdomain ?? clinic.custom_domain ?? "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 sm:px-6">
                        <span className="inline-flex rounded-lg bg-secondary-container/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-on-secondary-container ring-1 ring-secondary/10">
                          {clinic.slug}
                        </span>
                      </td>
                      <td className="px-4 py-4 sm:px-6">
                        <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-high/60 px-2.5 py-1 ring-1 ring-outline-variant/15">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${clinic.is_active ? "animate-pulse bg-primary shadow-[0_0_8px_rgba(0,108,80,0.45)]" : "bg-tertiary"}`}
                          />
                          <span className="text-[11px] font-semibold text-on-surface">
                            {clinic.is_active ? "Active" : "Blocked"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 pr-6 sm:px-6">
                        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                          <form
                            action={updateClinicImageAsSuperAdmin}
                            encType="multipart/form-data"
                            className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest/70 p-2 shadow-inner sm:max-w-[320px]"
                          >
                            <input type="hidden" name="clinic_id" value={clinic.id} />
                            <label className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant sm:max-w-[150px]">
                              <span className="mb-1 block text-on-surface-variant/80">Hero image</span>
                              <input
                                className="input-file-compact w-full"
                                name="clinic_image"
                                type="file"
                                accept="image/*"
                              />
                            </label>
                            <SubmitButton
                              className="shrink-0 rounded-xl border border-primary/25 bg-gradient-to-br from-primary-container/20 to-primary/10 px-3 py-2 text-xs font-bold text-primary shadow-sm transition-all hover:border-primary/40 hover:from-primary-container/30 active:scale-[0.98]"
                              pendingLabel="…"
                            >
                              <span className="inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">upload</span>
                                Upload
                              </span>
                            </SubmitButton>
                          </form>
                          <div className="flex flex-wrap justify-end gap-2">
                            <form action={setClinicWebsiteStoreState}>
                              <input type="hidden" name="clinic_id" value={clinic.id} />
                              <input type="hidden" name="next_enabled" value={clinic.website_store_enabled ? "false" : "true"} />
                              <SubmitButton
                                className={
                                  clinic.website_store_enabled
                                    ? "rounded-xl border border-outline-variant/35 bg-surface-container-lowest px-3 py-2 text-xs font-bold text-on-surface-variant shadow-sm transition-all hover:border-tertiary/30 hover:bg-tertiary-fixed/20 active:scale-[0.98]"
                                    : "rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary shadow-sm transition-all hover:bg-primary/15 active:scale-[0.98]"
                                }
                                pendingLabel="…"
                              >
                                <span className="inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">
                                    {clinic.website_store_enabled ? "storefront" : "store"}
                                  </span>
                                  {clinic.website_store_enabled ? "Disable store" : "Enable store"}
                                </span>
                              </SubmitButton>
                            </form>
                            <form action={setClinicActiveState}>
                              <input type="hidden" name="clinic_id" value={clinic.id} />
                              <input type="hidden" name="next_state" value={clinic.is_active ? "blocked" : "active"} />
                              <SubmitButton
                                className={
                                  clinic.is_active
                                    ? "rounded-xl border border-outline-variant/35 bg-surface-container-lowest px-3 py-2 text-xs font-bold text-on-surface-variant shadow-sm transition-all hover:border-tertiary/30 hover:bg-tertiary-fixed/20 active:scale-[0.98]"
                                    : "rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-bold text-primary shadow-sm transition-all hover:bg-primary/15 active:scale-[0.98]"
                                }
                                pendingLabel="…"
                              >
                                <span className="inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">
                                    {clinic.is_active ? "block" : "check_circle"}
                                  </span>
                                  {clinic.is_active ? "Block" : "Unblock"}
                                </span>
                              </SubmitButton>
                            </form>
                            <form action={deleteClinicPermanently}>
                              <input type="hidden" name="clinic_id" value={clinic.id} />
                              <SubmitButton
                                className="rounded-xl border border-error/25 bg-error-container/90 px-3 py-2 text-xs font-bold text-on-error-container shadow-sm transition-all hover:bg-error-container active:scale-[0.98]"
                                pendingLabel="…"
                              >
                                <span className="inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                                  Delete
                                </span>
                              </SubmitButton>
                            </form>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/super-admin/reports"
              className="group rounded-xl border border-primary/10 bg-primary/5 p-6 transition-colors hover:bg-primary/10"
            >
              <div className="flex items-center gap-4">
                <span className="rounded-lg bg-primary p-3 text-white shadow-md transition-transform group-hover:scale-105">
                  <span className="material-symbols-outlined">verified</span>
                </span>
                <div>
                  <h4 className="font-headline font-bold">Compliance export</h4>
                  <p className="text-xs text-on-surface-variant">Printable global reports</p>
                </div>
              </div>
            </Link>
            <Link
              href="/invite-qrs"
              className="group rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 transition-colors hover:bg-surface-container-high"
            >
              <div className="flex items-center gap-4">
                <span className="rounded-lg bg-secondary p-3 text-on-secondary shadow-md transition-transform group-hover:scale-105">
                  <span className="material-symbols-outlined">qr_code_2</span>
                </span>
                <div>
                  <h4 className="font-headline font-bold">Clinic onboarding QR</h4>
                  <p className="text-xs text-on-surface-variant">Generate staff invites</p>
                </div>
              </div>
            </Link>
          </div>

          <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm md:p-8">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container/60 text-secondary">
                <span className="material-symbols-outlined">add_business</span>
              </div>
              <div>
                <h2 className="font-headline text-lg font-extrabold text-on-background">Create clinic</h2>
                <p className="text-xs text-on-surface-variant">New tenant — optional hero image blends with onboarding</p>
              </div>
            </div>
            <form action={createClinicAsSuperAdmin} className="grid gap-4 md:grid-cols-2" encType="multipart/form-data">
              <input className="input-soft" name="name" placeholder="Clinic name" required />
              <input className="input-soft" name="slug" placeholder="clinic-slug" required />
              <input className="input-soft" name="subdomain" placeholder="Subdomain (optional)" />
              <input className="input-soft" name="custom_domain" placeholder="Custom domain (optional)" />
              <input className="input-soft" name="support_email" placeholder="Support email (optional)" />
              <input className="input-soft" name="support_phone" placeholder="Support phone (optional)" />
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Hero image (optional)
                </label>
                <input className="input-file-soft mt-2" name="clinic_image" type="file" accept="image/*" />
              </div>
              <input className="input-soft md:col-span-2" name="timezone" placeholder="Timezone (default UTC)" />
              <SubmitButton
                className="btn-primary md:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl py-3.5 shadow-md"
                pendingLabel="Creating…"
              >
                <span className="material-symbols-outlined text-xl">domain_add</span>
                Create clinic
              </SubmitButton>
            </form>
          </section>
        </div>
      </div>

      <Link
        href="/appointments"
        className="fixed bottom-8 right-8 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-container to-primary text-white shadow-2xl transition-transform hover:scale-110 active:scale-95"
        title="New appointment"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </Link>
    </AppShell>
  );
}
