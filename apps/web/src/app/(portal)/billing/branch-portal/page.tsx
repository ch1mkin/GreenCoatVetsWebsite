import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/web/app-shell";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { formatInr } from "@/lib/format-currency";
import { BranchPortalCheckoutClient } from "./branch-portal-checkout-client";

function isActiveLicense(row: { status: string; valid_until: string | null }): boolean {
  if (row.status !== "active" || !row.valid_until) return false;
  return new Date(row.valid_until).getTime() > Date.now();
}

export default async function BranchPortalBillingPage() {
  const access = await getUserAccess();
  if (access.membership?.role !== "branch_admin") {
    redirect("/dashboard");
  }

  const clinicId = access.membership.clinic_id;
  const role = access.membership.role;
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("branch_id, branches(name)")
    .eq("user_id", user?.id ?? "")
    .eq("clinic_id", clinicId)
    .eq("role", "branch_admin")
    .eq("is_active", true)
    .maybeSingle();

  let branchId = profile?.branch_id as string | null | undefined;
  let branchName = (profile?.branches as { name?: string } | null)?.name ?? null;

  if (!branchId) {
    const { data: firstBranch } = await supabase
      .from("branches")
      .select("id, name")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    branchId = firstBranch?.id ?? null;
    branchName = firstBranch?.name ?? null;
  }

  const { data: quoteRaw } = await supabase.rpc("get_branch_web_portal_quote", { p_clinic_id: clinicId });
  const quote = quoteRaw as { amount_paise?: number; period_days?: number } | null;
  const quotePaise = quote?.amount_paise ?? null;
  const quoteDays = quote?.period_days ?? null;

  let licenses: Array<{
    id: string;
    status: string;
    valid_from: string | null;
    valid_until: string | null;
    amount_paise: number;
    license_period_days: number;
    razorpay_payment_id: string | null;
    created_at: string;
  }> = [];

  if (branchId) {
    const { data } = await supabase
      .from("branch_web_portal_licenses")
      .select(
        "id, status, valid_from, valid_until, amount_paise, license_period_days, razorpay_payment_id, created_at"
      )
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(8);
    licenses = (data ?? []) as typeof licenses;
  }

  const active = licenses.find((l) => isActiveLicense(l));
  const canPay = Boolean(branchId) && !active;

  return (
    <AppShell
      title="Branch web access"
      subtitle="Pay to enable Razorpay-billed access to the web portal for your branch team."
      activeHref="/billing/branch-portal"
      navGroups={navGroups}
    >
      <div className="max-w-2xl space-y-6">
        {!branchId ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            No active branch is linked to your profile. Ask a clinic admin to assign you to a branch, or add a
            branch first under{" "}
            <Link className="font-semibold underline" href="/branches">
              Branches
            </Link>
            .
          </p>
        ) : null}

        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-on-background">Current status</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Branch: <span className="font-semibold text-on-surface">{branchName ?? "—"}</span>
          </p>
          {active ? (
            <div className="mt-4 rounded-md border border-primary/25 bg-primary/5 px-3 py-2.5">
              <p className="text-sm font-semibold text-primary">Access active</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Valid through {new Date(active.valid_until as string).toLocaleString()} ·{" "}
                {active.license_period_days} day term
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-2.5">
              <p className="text-sm font-semibold text-on-surface">No active license</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                Renew or purchase to restore branch web portal access when your clinic requires it.
              </p>
            </div>
          )}

          {quotePaise != null && quoteDays != null ? (
            <p className="mt-4 text-sm text-on-surface-variant">
              Listed price:{" "}
              <span className="font-headline font-bold text-on-surface">
                {formatInr(quotePaise / 100)}
              </span>{" "}
              for {quoteDays} days · Set by clinic or platform defaults (
              <Link className="text-primary underline" href="/payments">
                payments
              </Link>{" "}
              /{" "}
              <Link className="text-primary underline" href="/clinic-profile">
                clinic profile
              </Link>
              ).
            </p>
          ) : null}

          <BranchPortalCheckoutClient userEmail={user?.email ?? null} canPay={canPay} />
        </section>

        {licenses.length > 0 ? (
          <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-sm">
            <h2 className="font-headline text-lg font-bold text-on-background">Recent invoices</h2>
            <ul className="mt-3 divide-y divide-outline-variant/10 text-sm">
              {licenses.map((l) => (
                <li className="flex flex-wrap items-center justify-between gap-2 py-3" key={l.id}>
                  <span className="text-on-surface-variant">{new Date(l.created_at).toLocaleString()}</span>
                  <span className="font-medium capitalize text-on-surface">{l.status}</span>
                  <span className="font-headline text-on-surface">{formatInr(l.amount_paise / 100)}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
