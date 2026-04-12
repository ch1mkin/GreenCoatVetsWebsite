import { getActiveMembership } from "@/lib/auth/get-active-membership";
import type { UserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";

export type PortalClinicContext = {
  clinicId: string;
  clinicName: string | null;
  /** Super admins only: list for switching context */
  clinicsForPicker: { id: string; name: string }[];
};

/**
 * Resolves which clinic's data to show. Super admins can pass `?clinic_id=` to work as a specific tenant.
 */
export async function resolvePortalClinicContext(
  access: UserAccess,
  searchParams: { clinic_id?: string },
): Promise<PortalClinicContext> {
  const supabase = createClient();
  let clinicsForPicker: { id: string; name: string }[] = [];

  if (access.isSuperAdmin) {
    const { data: clinics } = await supabase
      .from("clinics")
      .select("id, name")
      .eq("is_active", true)
      .order("name", { ascending: true });
    clinicsForPicker = (clinics ?? []) as { id: string; name: string }[];
  }

  const requested = searchParams.clinic_id?.trim();
  if (access.isSuperAdmin && requested) {
    const { data: row } = await supabase
      .from("clinics")
      .select("id, name")
      .eq("id", requested)
      .eq("is_active", true)
      .maybeSingle();
    if (row) {
      return { clinicId: row.id as string, clinicName: (row.name as string) ?? null, clinicsForPicker };
    }
  }

  const { clinic_id } = await getActiveMembership();
  const { data: c } = await supabase.from("clinics").select("name").eq("id", clinic_id).maybeSingle();
  return {
    clinicId: clinic_id,
    clinicName: (c?.name as string) ?? null,
    clinicsForPicker,
  };
}
