import type { SupabaseClient } from "@supabase/supabase-js";

export type UserAuthCapabilities = {
  isSuperAdmin: boolean;
  roles: string[];
  hasWebPortalAccess: boolean;
  hasWebsiteAdminAccess: boolean;
  hasPetOwnerAccess: boolean;
};

export function deriveUserAuthCapabilities(isSuperAdmin: boolean, activeRoles: string[]): UserAuthCapabilities {
  const roles = Array.from(new Set(activeRoles.filter(Boolean)));
  const hasWebsiteAdminAccess = isSuperAdmin || roles.includes("marketing_editor");
  const hasPetOwnerAccess = roles.includes("pet_owner");
  const hasWebPortalAccess =
    isSuperAdmin || roles.some((role) => role !== "marketing_editor" && role !== "pet_owner");

  return {
    isSuperAdmin,
    roles,
    hasWebPortalAccess,
    hasWebsiteAdminAccess,
    hasPetOwnerAccess,
  };
}

export async function fetchUserAuthCapabilities(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserAuthCapabilities> {
  const [{ data: superAdmin }, { data: memberships, error }] = await Promise.all([
    supabase.from("platform_super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("user_clinic_memberships").select("role").eq("user_id", userId).eq("is_active", true),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  const roles = (memberships ?? []).map((row) => String(row.role));
  return deriveUserAuthCapabilities(Boolean(superAdmin), roles);
}
