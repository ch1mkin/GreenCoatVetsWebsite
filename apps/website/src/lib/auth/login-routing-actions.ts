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
    const lookupClient = createServiceRoleClient() ?? supabase;
    const caps = await fetchUserAuthCapabilities(lookupClient, user.id, user.email);
    const destination = resolveAuthDestination(surface, caps, getAuthAppUrls());

    if (destination.outcome === "continue") {
      return { ok: true, kind: "continue", next: destination.nextPath };
    }

    if (destination.outcome === "redirect_external") {
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
