import { createClient } from "@/lib/supabase/server";

export type PublicStaffRow = {
  id: string;
  full_name: string;
  specialization: string | null;
  experience_years: number | null;
  bio: string | null;
  photo_url: string | null;
  role: "doctor" | "lab_technician" | "pharmacist";
  branch_name: string | null;
};

/** Anonymous-safe directory for marketing pages (backed by RPC + security definer). */
export async function getPublicStaffForClinic(clinicId: string): Promise<PublicStaffRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_public_staff_for_clinic", { p_clinic_id: clinicId });
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicStaffRow[];
}
