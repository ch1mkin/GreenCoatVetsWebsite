import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserAccess } from "@/lib/auth/get-user-access";

const MIN_NAME_LEN = 2;
const MIN_PHONE_LEN = 8;

function nameFromOwner(o: {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
}): string {
  const f = o.first_name?.trim();
  const l = o.last_name?.trim();
  if (f && l) return `${f} ${l}`;
  return (o.full_name ?? "").trim();
}

export type ProfileCompletionState = {
  complete: boolean;
  kind: "staff" | "owner" | "skipped";
};

/**
 * Staff and pet owners must have a proper display name and phone before using the portal.
 * Platform super admins without clinic membership skip this.
 */
export async function getProfileCompletionState(
  supabase: SupabaseClient,
  access: UserAccess
): Promise<ProfileCompletionState> {
  if (!access.membership) {
    return { complete: true, kind: "skipped" };
  }

  const clinicId = access.membership.clinic_id;
  const role = access.membership.role;

  // Platform super admins do not always have a staff profile row.
  // Skip profile gate for this role to avoid blocking portal access.
  if (role === "super_admin") {
    return { complete: true, kind: "skipped" };
  }

  if (role === "marketing_editor") {
    return { complete: true, kind: "skipped" };
  }

  if (role === "pet_owner") {
    const { data: owner } = await supabase
      .from("owners")
      .select("first_name, last_name, full_name, phone")
      .eq("user_id", access.userId)
      .eq("clinic_id", clinicId)
      .maybeSingle();

    if (!owner) {
      return { complete: false, kind: "owner" };
    }

    const name = nameFromOwner(owner);
    const phoneOk = (owner.phone ?? "").trim().length >= MIN_PHONE_LEN;
    const nameOk = name.length >= MIN_NAME_LEN;
    return { complete: nameOk && phoneOk, kind: "owner" };
  }

  const { data: spRows, error: spError } = await supabase
    .from("staff_profiles")
    .select("full_name, phone, role")
    .eq("user_id", access.userId)
    .eq("clinic_id", clinicId)
    .eq("is_active", true)
    .is("branch_id", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (spError) {
    return { complete: false, kind: "staff" };
  }

  const sp =
    spRows?.find((row) => row.role === role) ??
    spRows?.[0] ??
    null;

  if (!sp) {
    return { complete: false, kind: "staff" };
  }

  const nameOk = (sp.full_name ?? "").trim().length >= MIN_NAME_LEN;
  const phoneOk = (sp.phone ?? "").trim().length >= MIN_PHONE_LEN;
  return { complete: nameOk && phoneOk, kind: "staff" };
}
