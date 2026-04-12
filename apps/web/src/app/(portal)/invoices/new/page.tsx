import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { canManageInvoices } from "@/lib/auth/invoice-access";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { ManualInvoiceClient } from "./manual-invoice-client";

function ownerLabel(o: { first_name?: string | null; last_name?: string | null; full_name?: string | null }) {
  const f = o.first_name?.trim();
  const l = o.last_name?.trim();
  if (f && l) return `${f} ${l}`;
  return o.full_name?.trim() || "—";
}

export default async function NewManualInvoicePage() {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/login");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (!canManageInvoices(access)) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const [{ data: branches }, { data: ownerRows }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("clinic_id", clinic_id).eq("is_active", true).order("name"),
    supabase
      .from("owners")
      .select("id, first_name, last_name, full_name")
      .eq("clinic_id", clinic_id)
      .order("full_name")
      .limit(500),
  ]);

  const branchList = (branches ?? []) as { id: string; name: string }[];
  const owners =
    (ownerRows ?? []).map((o) => ({
      id: o.id as string,
      label: ownerLabel(o as { first_name?: string | null; last_name?: string | null; full_name?: string | null }),
    })) ?? [];

  if (!branchList.length) {
    return (
      <AppShell
        title="Manual invoice"
        subtitle="Add a branch first."
        activeHref="/invoices"
        navGroups={navGroups}
      >
        <p className="text-on-surface-variant">
          No active branches found.{" "}
          <Link className="font-semibold text-primary underline" href="/branches">
            Manage branches
          </Link>
        </p>
      </AppShell>
    );
  }

  if (!owners.length) {
    return (
      <AppShell
        title="Manual invoice"
        subtitle="Add an owner first."
        activeHref="/invoices"
        navGroups={navGroups}
      >
        <p className="text-on-surface-variant">
          No contacts in this clinic yet.{" "}
          <Link className="font-semibold text-primary underline" href="/owners">
            Add owners
          </Link>
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="New manual invoice"
      subtitle="Create an on-demand invoice for a client without linking a visit. Saved to Invoices with PDF."
      activeHref="/invoices"
      navGroups={navGroups}
      topRight={
        <Link className="btn-secondary text-sm" href="/invoices">
          Back to list
        </Link>
      }
    >
      <ManualInvoiceClient branches={branchList} owners={owners} />
    </AppShell>
  );
}
