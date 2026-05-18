import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { AdminContext } from "./auth";
import { userMustChangePassword } from "./must-change-password";

export async function getAuthenticatedUser(): Promise<User> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return user;
}

/** Resolves admin role without forcing password change (for the change-password page). */
export async function resolveAdminContextForUser(user: User): Promise<AdminContext | null> {
  const supabase = createClient();
  const { data: isSuper } = await supabase.rpc("is_super_admin");
  if (isSuper) return { role: "super_admin" };

  const { data: membership } = await supabase
    .from("user_clinic_memberships")
    .select("clinic_id")
    .eq("user_id", user.id)
    .eq("role", "marketing_editor")
    .eq("is_active", true)
    .maybeSingle();

  if (membership?.clinic_id) {
    return { role: "marketing_editor", clinicId: membership.clinic_id as string, userId: user.id };
  }

  return null;
}

export async function requireAdminSession(options?: { allowPasswordChange?: boolean }): Promise<{
  user: User;
  ctx: AdminContext;
}> {
  const user = await getAuthenticatedUser();
  const ctx = await resolveAdminContextForUser(user);
  if (!ctx) redirect("/admin/login?error=forbidden");

  if (!options?.allowPasswordChange && userMustChangePassword(user)) {
    redirect("/admin/change-password");
  }

  return { user, ctx };
}
