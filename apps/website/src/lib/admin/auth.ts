import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AdminContext =
  | { role: "super_admin" }
  | { role: "marketing_editor"; clinicId: string; userId: string };

export async function requireAdmin(): Promise<AdminContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

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

  redirect("/admin/login?error=forbidden");
}

export async function requireSuperAdmin(): Promise<void> {
  const ctx = await requireAdmin();
  if (ctx.role !== "super_admin") redirect("/admin/blog");
}

/** Target clinic for blog CMS: editor is fixed; super admin uses form value or default / first active clinic. */
export async function resolveBlogAdminClinicId(ctx: AdminContext, formClinicId: string | null | undefined): Promise<string> {
  if (ctx.role === "marketing_editor") {
    return ctx.clinicId;
  }
  const trimmed = formClinicId?.trim();
  if (trimmed) return trimmed;

  const supabase = createClient();
  const { data: mkt } = await supabase
    .from("marketing_site_settings")
    .select("website_branded_for_clinic_id, default_clinic_id")
    .eq("id", "default")
    .maybeSingle();
  const branded = (mkt as { website_branded_for_clinic_id?: string | null } | null)?.website_branded_for_clinic_id;
  if (branded) return branded;
  if (mkt?.default_clinic_id) {
    return mkt.default_clinic_id as string;
  }
  const { data: first } = await supabase
    .from("clinics")
    .select("id")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (first?.id) return first.id as string;
  throw new Error("No active clinic — set a default clinic in Site settings or seed clinics.");
}
