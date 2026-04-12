import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserAccess } from "@/lib/auth/get-user-access";

/** Prefer directory name over email for subtitles and chrome (never email as primary label). */
export async function getSessionDisplayName(
  supabase: SupabaseClient,
  access: UserAccess,
  fallbackEmail: string | null | undefined
): Promise<string> {
  const email = fallbackEmail?.trim() || "";
  if (!access.membership) {
    return email || "User";
  }

  const clinicId = access.membership.clinic_id;
  const role = access.membership.role;

  if (role === "pet_owner") {
    const { data: owner } = await supabase
      .from("owners")
      .select("first_name, last_name, full_name")
      .eq("user_id", access.userId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (owner) {
      const f = owner.first_name?.trim();
      const l = owner.last_name?.trim();
      if (f && l) return `${f} ${l}`;
      if (owner.full_name?.trim()) return owner.full_name.trim();
    }
    return email || "Pet owner";
  }

  const { data: sp } = await supabase
    .from("staff_profiles")
    .select("full_name")
    .eq("user_id", access.userId)
    .eq("clinic_id", clinicId)
    .eq("role", role)
    .eq("is_active", true)
    .maybeSingle();

  if (sp?.full_name?.trim()) return sp.full_name.trim();
  return email || "Staff";
}
