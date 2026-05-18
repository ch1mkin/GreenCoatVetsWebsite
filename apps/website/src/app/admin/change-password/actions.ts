"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin/session";
import { createClient } from "@/lib/supabase/server";

export async function completeAdminPasswordChangeAction(formData: FormData) {
  const password = String(formData.get("password") ?? "").trim();
  const confirmPassword = String(formData.get("confirm_password") ?? "").trim();

  if (password.length < 8) {
    redirect("/admin/change-password?error=" + encodeURIComponent("Use a password with at least 8 characters."));
  }
  if (password !== confirmPassword) {
    redirect("/admin/change-password?error=" + encodeURIComponent("Password confirmation does not match."));
  }

  const { user, ctx } = await requireAdminSession({ allowPasswordChange: true });
  const supabase = createClient();

  const { error } = await supabase.auth.updateUser({
    password,
    data: {
      ...user.user_metadata,
      must_change_password: false,
    },
  });

  if (error) {
    redirect("/admin/change-password?error=" + encodeURIComponent(error.message));
  }

  revalidatePath("/admin", "layout");
  redirect(ctx.role === "super_admin" ? "/admin?password_updated=1" : "/admin/settings?password_updated=1");
}
