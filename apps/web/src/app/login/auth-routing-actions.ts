"use server";

import { resolveWebPortalLoginForUser } from "@/lib/auth/resolve-web-portal-login";
import { createClient } from "@/lib/supabase/server";

export type WebPortalLoginRoutingResult =
  | { ok: true; kind: "otp"; next: string }
  | { ok: true; kind: "external"; url: string }
  | { ok: false; error: string };

export async function resolveWebPortalLoginRoutingAction(): Promise<WebPortalLoginRoutingResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { ok: false, error: "Sign in first to continue." };
  }

  try {
    const result = await resolveWebPortalLoginForUser(supabase, user);
    if (!result.ok || result.kind === "external") {
      await supabase.auth.signOut();
    }
    return result;
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not verify account access.",
    };
  }
}
