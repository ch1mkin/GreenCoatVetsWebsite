import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserAccess } from "@/lib/auth/get-user-access";

export function isClinicStaffRole(role: string): boolean {
  return ["clinic_admin", "receptionist", "doctor", "branch_admin", "lab_technician", "pharmacist"].includes(role);
}

/**
 * Staff (same clinic), super admin, or owning pet owner may view the visit report PDF.
 */
export async function assertVisitReportAccess(
  supabase: SupabaseClient,
  access: UserAccess,
  visitId: string
): Promise<{ clinic_id: string; owner_id: string }> {
  const { data: visit, error } = await supabase
    .from("visits")
    .select("id, clinic_id, owner_id")
    .eq("id", visitId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!visit) throw new Error("Visit not found.");

  if (access.isSuperAdmin) {
    return { clinic_id: visit.clinic_id as string, owner_id: visit.owner_id as string };
  }

  const m = access.membership;
  if (!m) throw new Error("Unauthorized.");

  if (m.clinic_id !== visit.clinic_id) throw new Error("Unauthorized.");

  if (m.role === "super_admin" || isClinicStaffRole(m.role)) {
    return { clinic_id: visit.clinic_id as string, owner_id: visit.owner_id as string };
  }

  if (m.role === "pet_owner") {
    const { data: owner } = await supabase.from("owners").select("user_id").eq("id", visit.owner_id as string).maybeSingle();
    if (owner?.user_id !== access.userId) throw new Error("Unauthorized.");
    return { clinic_id: visit.clinic_id as string, owner_id: visit.owner_id as string };
  }

  throw new Error("Unauthorized.");
}
