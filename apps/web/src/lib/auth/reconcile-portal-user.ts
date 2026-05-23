import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchUserAuthCapabilities } from "@saasclinics/lib";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export async function reconcilePortalStaffAccessForUser(
  currentUserId: string,
  email: string | null | undefined,
): Promise<{ reconciled: boolean }> {
  const admin = createServiceRoleClient();
  if (!admin) return { reconciled: false };

  const normalizedEmail = (email ?? "").trim().toLowerCase();
  if (!normalizedEmail) return { reconciled: false };

  const before = await fetchUserAuthCapabilities(admin, currentUserId, normalizedEmail);
  if (before.hasWebPortalAccess) return { reconciled: false };

  const { data, error } = await admin.rpc("reconcile_portal_user_for_oauth", {
    p_current: currentUserId,
    p_email: normalizedEmail,
  });

  if (error) {
    console.error("[reconcile_portal_user_for_oauth]", error.message);
    return { reconciled: false };
  }

  const payload = data as { reconciled?: boolean } | null;
  return { reconciled: Boolean(payload?.reconciled) };
}

export async function reconcilePortalStaffAccessWithSessionClient(
  supabase: SupabaseClient,
  currentUserId: string,
  email: string | null | undefined,
): Promise<void> {
  const fromService = await reconcilePortalStaffAccessForUser(currentUserId, email);
  if (fromService.reconciled) return;

  try {
    await supabase.rpc("reconcile_portal_auth_user_by_email");
  } catch {
    // Migration may not be applied yet.
  }
}
