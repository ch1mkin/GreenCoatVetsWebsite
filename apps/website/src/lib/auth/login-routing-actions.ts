"use server";

import { fetchUserAuthCapabilities, resolveAuthDestination } from "@saasclinics/lib";
import { getAuthAppUrls } from "@/lib/auth/app-urls";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type WebsiteLoginRoutingResult =
  | { ok: true; kind: "continue"; next: string }
  | { ok: true; kind: "external"; url: string }
  | { ok: false; error: string };

async function resolveWebsiteLoginRouting(
  surface: "website_public" | "website_admin",
): Promise<WebsiteLoginRoutingResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { ok: false, error: "Sign in first to continue." };
  }

  try {
    const { data: membership } = await supabase
      .from("user_clinic_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const websiteStaffRoles = new Set(["super_admin", "clinic_admin", "branch_admin", "doctor", "senior_doctor"]);
    const isWebsiteStaff = typeof membership?.role === "string" && websiteStaffRoles.has(membership.role);

    const lookupClient = createServiceRoleClient() ?? supabase;
    const caps = await fetchUserAuthCapabilities(lookupClient, user.id, user.email);
    const destination = resolveAuthDestination(surface, caps, getAuthAppUrls());

    if (destination.outcome === "continue") {
      return { ok: true, kind: "continue", next: destination.nextPath };
    }

    if (destination.outcome === "redirect_external") {
      if (surface === "website_public" && isWebsiteStaff) {
        return { ok: true, kind: "continue", next: "/staff/online-consults" };
      }
      await supabase.auth.signOut();
      return { ok: true, kind: "external", url: destination.url };
    }

    await supabase.auth.signOut();
    return { ok: false, error: destination.message };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not verify account access.",
    };
  }
}

export async function resolveWebsitePublicLoginRoutingAction(): Promise<WebsiteLoginRoutingResult> {
  return resolveWebsiteLoginRouting("website_public");
}

export async function resolveWebsiteAdminLoginRoutingAction(): Promise<WebsiteLoginRoutingResult> {
  return resolveWebsiteLoginRouting("website_admin");
}
