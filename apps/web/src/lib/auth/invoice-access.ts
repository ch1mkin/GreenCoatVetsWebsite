import type { UserAccess } from "@/lib/auth/get-user-access";

/** Create/list/download invoices (visit + manual) and PDFs. */
export function canManageInvoices(access: UserAccess): boolean {
  if (access.isSuperAdmin) return true;
  const r = access.membership?.role ?? "";
  return ["receptionist", "clinic_admin", "branch_admin", "super_admin"].includes(r);
}

/** Invoice PDF template editor + preview. */
export function canEditInvoiceTemplate(access: UserAccess): boolean {
  if (access.isSuperAdmin) return true;
  const r = access.membership?.role ?? "";
  return r === "clinic_admin" || r === "branch_admin" || r === "super_admin";
}
