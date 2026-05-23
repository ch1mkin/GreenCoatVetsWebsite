import type { SupabaseClient } from "@supabase/supabase-js";

/** Roles that may use the clinic staff web portal (not marketing site / pet owner). */
export const WEB_PORTAL_STAFF_ROLES = new Set([
  "super_admin",
  "clinic_admin",
  "branch_admin",
  "doctor",
  "receptionist",
  "lab_technician",
  "pharmacist",
]);

export type UserAuthCapabilities = {
  isSuperAdmin: boolean;
  roles: string[];
  hasWebPortalAccess: boolean;
  hasWebsiteAdminAccess: boolean;
  hasPetOwnerAccess: boolean;
};

function isWebPortalStaffRole(role: string): boolean {
  return WEB_PORTAL_STAFF_ROLES.has(role);
}

export function deriveUserAuthCapabilities(isSuperAdmin: boolean, activeRoles: string[]): UserAuthCapabilities {
  const roles = Array.from(new Set(activeRoles.filter(Boolean)));
  const hasWebsiteAdminAccess = isSuperAdmin || roles.includes("marketing_editor");
  const hasPetOwnerAccess = roles.includes("pet_owner");
  const hasWebPortalAccess = isSuperAdmin || roles.some((role) => isWebPortalStaffRole(role));

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
  email?: string | null,
): Promise<UserAuthCapabilities> {
  const [{ data: superAdmin }, { data: memberships, error: membershipError }, { data: staffRows, error: staffError }] =
    await Promise.all([
      supabase.from("platform_super_admins").select("user_id").eq("user_id", userId).maybeSingle(),
      supabase.from("user_clinic_memberships").select("role").eq("user_id", userId).eq("is_active", true),
      supabase.from("staff_profiles").select("role").eq("user_id", userId).eq("is_active", true),
    ]);

  if (membershipError) {
    throw new Error(membershipError.message);
  }
  if (staffError) {
    throw new Error(staffError.message);
  }

  const membershipRoles = (memberships ?? []).map((row) => String(row.role));
  const staffRoles = (staffRows ?? []).map((row) => String(row.role));
  const roles = Array.from(new Set([...membershipRoles, ...staffRoles]));
  let caps = deriveUserAuthCapabilities(Boolean(superAdmin), roles);

  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (!caps.hasWebPortalAccess && normalizedEmail) {
    try {
      const { data: byEmail, error: emailRpcError } = await supabase.rpc("email_has_web_portal_access", {
        p_email: normalizedEmail,
      });
      if (!emailRpcError && byEmail === true) {
        caps = { ...caps, hasWebPortalAccess: true };
      }
    } catch {
      // RPC available after migration 20260519150000 is applied.
    }
  }

  return caps;
}
