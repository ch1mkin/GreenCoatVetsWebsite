/** Roles that can pair a phone and upload visit photos from the web portal. */
export function roleCanUseVisitPhoneCapture(role: string, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  return [
    "clinic_admin",
    "branch_admin",
    "doctor",
    "receptionist",
    "lab_technician",
    "pharmacist",
  ].includes(role);
}
