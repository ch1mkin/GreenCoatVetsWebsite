import Link from "next/link";
import { redirect } from "next/navigation";
import { getInvoiceTemplateForClinic } from "@/app/(portal)/invoicing/actions";
import { AppShell } from "@/components/web/app-shell";
import { canEditInvoiceTemplate } from "@/lib/auth/invoice-access";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { InvoiceTemplateEditor } from "./invoice-template-editor";

export default async function InvoiceTemplatePage() {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/login");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (!canEditInvoiceTemplate(access)) {
    redirect("/dashboard");
  }

  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const initial = await getInvoiceTemplateForClinic();

  return (
    <AppShell
      title="Invoice PDF template"
      subtitle="Reorder and toggle sections on clinic invoices. Applies to new invoices generated from visits."
      activeHref="/clinic-profile/invoice-template"
      navGroups={navGroups}
      topRight={
        <Link className="btn-secondary text-sm" href="/clinic-profile">
          Clinic profile
        </Link>
      }
    >
      <section className="max-w-3xl border border-outline-variant/25 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
        <InvoiceTemplateEditor initial={initial} />
      </section>
    </AppShell>
  );
}
