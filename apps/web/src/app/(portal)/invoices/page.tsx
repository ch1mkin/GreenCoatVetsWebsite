import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { canManageInvoices } from "@/lib/auth/invoice-access";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { resolveSignedImageUrl } from "@/lib/storage/resolve-signed-image-url";

export default async function InvoicesListPage() {
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

  const { data: rows, error } = await supabase
    .from("clinic_invoices")
    .select("id, invoice_number, grand_total, pdf_storage_path, created_at, visit_id, owner_id, patient_name")
    .eq("clinic_id", clinic_id)
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) throw new Error(error.message);

  const ownerIds = Array.from(
    new Set((rows ?? []).map((r) => r.owner_id).filter(Boolean))
  ) as string[];
  const { data: ownerRows } = ownerIds.length
    ? await supabase.from("owners").select("id, first_name, last_name, full_name").in("id", ownerIds)
    : { data: [] as { id: string; first_name?: string | null; last_name?: string | null; full_name?: string | null }[] };

  const ownerMap = new Map(
    (ownerRows ?? []).map((o) => {
      const label =
        o.first_name && o.last_name ? `${o.first_name} ${o.last_name}`.trim() : o.full_name ?? "—";
      return [o.id, label] as const;
    })
  );

  const enriched = await Promise.all(
    (rows ?? []).map(async (row) => {
      const pdfUrl = row.pdf_storage_path
        ? await resolveSignedImageUrl(supabase, row.pdf_storage_path, { expiresIn: 3600 })
        : null;
      return { ...row, pdfUrl, ownerLabel: ownerMap.get(row.owner_id) ?? "—" };
    })
  );

  return (
    <AppShell
      title="Invoices"
      subtitle="Recent clinic invoices with PDF downloads."
      activeHref="/invoices"
      navGroups={navGroups}
      topRight={
        <Link className="btn-primary text-sm" href="/invoices/new">
          New manual invoice
        </Link>
      }
    >
      <section className="card-soft overflow-x-auto">
        <table className="pms-table min-w-[720px]">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Type</th>
              <th>Owner / patient</th>
              <th>Total</th>
              <th>Created</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((row) => (
              <tr key={row.id}>
                <td className="font-mono font-semibold">{row.invoice_number}</td>
                <td>
                  {row.visit_id ? (
                    <span className="inline-block rounded border border-outline-variant/40 bg-surface-container-high/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
                      Visit
                    </span>
                  ) : (
                    <span className="inline-block rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      Manual
                    </span>
                  )}
                </td>
                <td>
                  <span className="font-medium">{row.ownerLabel}</span>
                  {row.patient_name ? (
                    <span className="text-on-surface-variant"> · {row.patient_name}</span>
                  ) : null}
                </td>
                <td className="tabular-nums">INR {Number(row.grand_total ?? 0).toFixed(2)}</td>
                <td className="text-on-surface-variant">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td>
                  {row.pdfUrl ? (
                    <a className="font-semibold text-primary underline" href={row.pdfUrl} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  ) : (
                    "—"
                  )}
                  {row.visit_id ? (
                    <Link className="ml-2 text-on-surface-variant hover:text-primary" href={`/visits/${row.visit_id}`}>
                      Visit
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!enriched.length ? <p className="py-6 text-on-surface-variant">No invoices yet.</p> : null}
      </section>
    </AppShell>
  );
}
