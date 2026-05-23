import { fetchUserAuthCapabilities, resolveAuthDestination } from "@saasclinics/lib";
import type { User } from "@supabase/supabase-js";
import { getAuthAppUrls } from "@/lib/auth/app-urls";
import { reconcilePortalStaffAccessForUser, reconcilePortalStaffAccessWithSessionClient } from "@/lib/auth/reconcile-portal-user";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

export type WebPortalLoginRoutingResult =
  | { ok: true; kind: "otp"; next: string }
  | { ok: true; kind: "external"; url: string }
  | { ok: false; error: string };

async function emailHasRegisteredStaffAccess(
  lookupClient: SupabaseClient,
  email: string,
): Promise<boolean> {
  try {
    const { data, error } = await lookupClient.rpc("email_has_web_portal_access", { p_email: email });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function resolveWebPortalLoginForUser(
  supabase: SupabaseClient,
  user: User,
): Promise<WebPortalLoginRoutingResult> {
  const email = (user.email ?? "").trim().toLowerCase();
  const lookupClient = createServiceRoleClient() ?? supabase;

  if (email) {
    await reconcilePortalStaffAccessForUser(user.id, email);
  }
  await reconcilePortalStaffAccessWithSessionClient(supabase, user.id, user.email);

  let caps = await fetchUserAuthCapabilities(lookupClient, user.id, user.email);

  if (!caps.hasWebPortalAccess && email) {
    const staffEmailRegistered = await emailHasRegisteredStaffAccess(lookupClient, email);
    if (staffEmailRegistered) {
      await reconcilePortalStaffAccessForUser(user.id, email);
      caps = await fetchUserAuthCapabilities(lookupClient, user.id, email);
    }

    if (!caps.hasWebPortalAccess && staffEmailRegistered) {
      return {
        ok: false,
        error:
          "This email is registered for the clinic portal, but we could not link your Google sign-in. Sign in with your work email and password once, or ask your administrator to re-send your invite.",
      };
    }
  }

  const destination = resolveAuthDestination("web_portal", caps, getAuthAppUrls());

  if (destination.outcome === "continue") {
    return { ok: true, kind: "otp", next: destination.nextPath };
  }

  if (destination.outcome === "redirect_external") {
    return { ok: true, kind: "external", url: destination.url };
  }

  return { ok: false, error: destination.message };
}
