import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { updateOrderPaymentState, updatePlatformPaymentSettings } from "./actions";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { ClinicContextPicker } from "@/components/web/clinic-context-picker";
import type { AppRole } from "@/lib/auth/permissions";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { resolvePortalClinicContext } from "@/lib/portal/resolve-clinic-context";
import { formatInr } from "@/lib/format-currency";
import { SubmitButton } from "@/components/web/submit-button";

function ownerNameFromOrder(owners: unknown): string {
  if (owners == null) return "—";
  if (Array.isArray(owners)) return (owners[0] as { full_name?: string } | undefined)?.full_name ?? "—";
  return (owners as { full_name?: string }).full_name ?? "—";
}

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "paid") return "bg-primary-fixed/40 text-on-primary-container ring-1 ring-primary/20";
  if (s === "pending") return "bg-tertiary-fixed text-on-tertiary-fixed";
  if (s === "processing") return "bg-secondary-container text-on-secondary-container";
  if (s === "cancelled" || s === "refunded") return "bg-error-container text-on-error-container";
  return "bg-surface-container-high text-on-surface-variant";
}

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

type SearchParams = {
  status?: string;
  q?: string;
  clinic_id?: string;
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");

  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as AppRole;
  const canAccessPayments =
    access.isSuperAdmin || role === "clinic_admin" || role === "receptionist";
  if (!canAccessPayments) redirect("/dashboard");

  const selectedStatus = (searchParams.status ?? "").trim();
  const textQ = (searchParams.q ?? "").trim();
  const { clinicId, clinicName, clinicsForPicker } = await resolvePortalClinicContext(access, searchParams);
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  type PaymentPlatformSettings = {
    razorpay_key_id: string | null;
    razorpay_key_secret: string | null;
    payment_mode: string | null;
    default_branch_web_license_price_paise: number | null;
    default_branch_web_license_period_days: number | null;
  };
  let paymentSettings: PaymentPlatformSettings | null = null;
  if (access.isSuperAdmin) {
    const { data } = await supabase.from("platform_payment_settings").select("*").eq("id", "default").maybeSingle();
    paymentSettings = data as PaymentPlatformSettings | null;
  }

  let query = supabase
    .from("orders")
    .select("id, status, grand_total, placed_at, payment_provider, payment_reference, notes, owners(full_name)")
    .eq("clinic_id", clinicId)
    .order("placed_at", { ascending: false })
    .limit(100);

  if (selectedStatus) query = query.eq("status", selectedStatus);
  if (textQ) {
    const esc = escapeIlike(textQ);
    query = query.or(`payment_reference.ilike.%${esc}%,notes.ilike.%${esc}%`);
  }

  const { data: orders, error } = await query;
  if (error) throw new Error(error.message);

  const rows = orders ?? [];
  const paidTotal = rows.filter((o) => o.status === "paid").reduce((s, o) => s + Number(o.grand_total ?? 0), 0);
  const paidCount = rows.filter((o) => o.status === "paid").length;
  const pendingCount = rows.filter((o) => o.status === "pending").length;

  async function signOut() {
    "use server";
    const sb = createClient();
    await sb.auth.signOut();
    redirect("/login");
  }

  const hasSecret = Boolean(paymentSettings?.razorpay_key_secret);
  const mode = paymentSettings?.payment_mode === "live" ? "live" : "test";

  return (
    <AppShell
      title="Payments"
      subtitle={`Orders for ${clinicName ?? "this clinic"} (INR). Razorpay keys configured here apply to the public website checkout when service role is set.`}
      activeHref="/payments"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary text-sm" href="/ecommerce">
            Ecommerce
          </Link>
          <Link className="btn-primary text-sm" href="/dashboard">
            Dashboard
          </Link>
          <form action={signOut}>
            <button
              className="rounded-md border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      }
    >
      {access.isSuperAdmin && clinicsForPicker.length > 0 ? (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3">
          <Suspense fallback={null}>
            <ClinicContextPicker value={clinicId} clinics={clinicsForPicker} />
          </Suspense>
        </div>
      ) : null}

      {access.isSuperAdmin ? (
        <section className="mb-10 rounded-lg border border-primary/20 bg-primary/5 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-headline text-lg font-bold text-on-background">Razorpay integration (platform)</h2>
            <span
              className={`rounded border border-outline-variant/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                mode === "live" ? "bg-error-container text-on-error-container" : "bg-tertiary-container text-on-tertiary-container"
              }`}
            >
              {mode === "live" ? "Live mode" : "Test mode"}
            </span>
          </div>
          <p className="mb-4 text-sm text-on-surface-variant">
            Use <strong>test</strong> keys (<code className="rounded bg-surface px-1">rzp_test_…</code>) for sandbox payments; switch to{" "}
            <strong>live</strong> only with production keys. The marketing site reads these via{" "}
            <code className="rounded bg-surface px-1">SUPABASE_SERVICE_ROLE_KEY</code> (see deploy docs).
          </p>
          <form action={updatePlatformPaymentSettings} className="grid max-w-2xl gap-4">
            <div>
              <label className="text-xs font-bold uppercase text-on-surface-variant">Razorpay key id</label>
              <input
                className="input-soft mt-1 w-full"
                name="razorpay_key_id"
                defaultValue={paymentSettings?.razorpay_key_id ?? ""}
                placeholder="rzp_test_… or rzp_live_…"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-on-surface-variant">Razorpay key secret</label>
              <input
                className="input-soft mt-1 w-full"
                name="razorpay_key_secret"
                type="password"
                placeholder={hasSecret ? "•••••••• (leave blank to keep)" : "Required on first save"}
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold uppercase text-on-surface-variant">
                  Default branch web license (INR)
                </label>
                <input
                  className="input-soft mt-1 w-full"
                  name="default_branch_web_license_price_inr"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={Math.round(
                    (paymentSettings?.default_branch_web_license_price_paise ?? 49900) / 100
                  )}
                  required
                />
                <p className="mt-1 text-xs text-on-surface-variant">Branch admins pay this per term unless the clinic overrides it.</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-on-surface-variant">License length (days)</label>
                <input
                  className="input-soft mt-1 w-full"
                  name="default_branch_web_license_period_days"
                  type="number"
                  min={1}
                  step={1}
                  defaultValue={paymentSettings?.default_branch_web_license_period_days ?? 30}
                  required
                />
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-xs font-bold uppercase text-on-surface-variant">Payment mode</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="payment_mode" value="test" defaultChecked={mode === "test"} />
                Test — sandbox / test transactions only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="payment_mode" value="live" defaultChecked={mode === "live"} />
                Live — real charges (use live API keys)
              </label>
            </fieldset>
            <SubmitButton className="btn-primary w-fit">Save payment settings</SubmitButton>
          </form>
        </section>
      ) : null}

      <p className="mb-8 max-w-2xl text-sm text-on-surface-variant">
        Figures below reflect the current filters (up to 100 orders). Search matches payment reference or notes.
      </p>

      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-outline-variant/10 bg-gradient-to-br from-primary to-on-primary-fixed-variant p-5 text-white shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Paid total (this list)</p>
          <p className="font-headline mt-2 text-2xl font-extrabold">{formatInr(paidTotal)}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Paid orders</p>
          <p className="font-headline mt-2 text-3xl font-extrabold text-primary">{paidCount}</p>
        </div>
        <div className="rounded-lg border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Pending</p>
          <p className="font-headline mt-2 text-3xl font-extrabold text-tertiary">{pendingCount}</p>
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-outline-variant/10 bg-surface-container-low p-5">
        <form className="flex flex-col gap-4" method="get">
          <input type="hidden" name="clinic_id" value={clinicId} />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Status
              </label>
              <select className="input-soft w-full" name="status" defaultValue={selectedStatus}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="processing">Processing</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Search reference / notes
              </label>
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-lg">
                  search
                </span>
                <input
                  className="input-soft w-full py-3 pl-10"
                  name="q"
                  defaultValue={textQ}
                  placeholder="Payment ref, order id fragment…"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton className="btn-primary">Apply filters</SubmitButton>
            {selectedStatus || textQ ? (
              <Link
                className="btn-secondary"
                href={clinicId ? `/payments?clinic_id=${clinicId}` : "/payments"}
              >
                Clear
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-outline-variant/10 bg-surface-container-lowest shadow-sm">
        <div className="border-b border-outline-variant/10 bg-surface-container-high/30 px-6 py-4">
          <h2 className="font-headline text-lg font-bold text-on-background">Orders</h2>
          <p className="text-xs text-on-surface-variant">{rows.length} row{rows.length === 1 ? "" : "s"} loaded</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-surface-container-highest/25 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
              <tr>
                <th className="px-4 py-4 sm:px-6">Placed</th>
                <th className="px-4 py-4 sm:px-6">Owner</th>
                <th className="px-4 py-4 sm:px-6">Amount (INR)</th>
                <th className="hidden px-4 py-4 sm:table-cell sm:px-6">Provider</th>
                <th className="hidden px-4 py-4 md:table-cell md:px-6">Reference</th>
                <th className="px-4 py-4 sm:px-6">Status</th>
                <th className="px-4 py-4 sm:px-6">Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {rows.map((order) => (
                <tr
                  className="transition-colors odd:bg-surface-container-lowest even:bg-surface-container-low/40 hover:bg-surface-container/80"
                  key={order.id}
                >
                  <td className="whitespace-nowrap px-4 py-4 align-top text-xs sm:px-6">
                    {new Date(order.placed_at).toLocaleString()}
                  </td>
                  <td className="max-w-[140px] px-4 py-4 align-top font-medium sm:max-w-none sm:px-6">
                    {ownerNameFromOrder(order.owners)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 align-top font-headline font-bold sm:px-6">
                    {formatInr(order.grand_total)}
                  </td>
                  <td className="hidden px-4 py-4 align-top text-on-surface-variant sm:table-cell sm:px-6">
                    {order.payment_provider ?? "—"}
                  </td>
                  <td className="hidden max-w-[160px] truncate px-4 py-4 align-top md:table-cell md:px-6">
                    {order.payment_reference ?? "—"}
                  </td>
                  <td className="px-4 py-4 align-top sm:px-6">
                    <span
                      className={`inline-flex rounded border border-outline-variant/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusBadgeClass(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top sm:px-6">
                    <form action={updateOrderPaymentState} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <input type="hidden" name="context_clinic_id" value={clinicId} />
                      <input type="hidden" name="order_id" value={order.id} />
                      <select className="input-soft min-w-[120px] py-2 text-xs" name="status" defaultValue={order.status}>
                        <option value="pending">pending</option>
                        <option value="paid">paid</option>
                        <option value="processing">processing</option>
                        <option value="cancelled">cancelled</option>
                        <option value="refunded">refunded</option>
                      </select>
                      <input
                        className="input-soft min-w-[140px] flex-1 py-2 text-xs"
                        name="payment_reference"
                        defaultValue={order.payment_reference ?? ""}
                        placeholder="Payment ref"
                      />
                      <SubmitButton
                        className="rounded-md border border-outline-variant/40 bg-white px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-container-low"
                        pendingLabel="…"
                      >
                        Save
                      </SubmitButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No orders match this filter.</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
