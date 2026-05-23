import { type NextRequest } from "next/server";
import { resolveWebPortalLoginForUser } from "@/lib/auth/resolve-web-portal-login";
import { createOAuthCallbackClient } from "@/lib/supabase/oauth-callback-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/login";
  return next;
}

function loginErrorRedirect(
  request: NextRequest,
  redirectWithSession: (url: URL | string) => import("next/server").NextResponse,
  error: string,
  message?: string,
) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  if (message) {
    loginUrl.searchParams.set("message", message.slice(0, 240));
  }
  return redirectWithSession(loginUrl);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return createOAuthCallbackClient(request).redirectWithSession(new URL(next, request.url));
  }

  const { supabase, redirectWithSession } = createOAuthCallbackClient(request);

  try {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      console.error("[auth/callback] exchangeCodeForSession:", exchangeError.message);
      return loginErrorRedirect(request, redirectWithSession, "oauth_exchange_failed");
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return loginErrorRedirect(request, redirectWithSession, "oauth_no_user");
    }

    let routing;
    try {
      routing = await resolveWebPortalLoginForUser(supabase, user);
    } catch (routingError) {
      console.error("[auth/callback] resolveWebPortalLoginForUser:", routingError);
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      const message =
        routingError instanceof Error ? routingError.message : "Could not verify account access.";
      return loginErrorRedirect(request, redirectWithSession, "portal_access_denied", message);
    }

    if (routing.ok && routing.kind === "external") {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      return redirectWithSession(new URL(routing.url));
    }

    if (!routing.ok) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
      return loginErrorRedirect(request, redirectWithSession, "portal_access_denied", routing.error);
    }

    const invite = (request.nextUrl.searchParams.get("invite") ?? "").trim();
    if (invite) {
      const { error: inviteError } = await supabase.rpc("consume_clinic_role_invite", {
        p_token: invite,
        p_full_name: null,
        p_phone: null,
      });
      if (inviteError) {
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore */
        }
        return loginErrorRedirect(request, redirectWithSession, "portal_access_denied", inviteError.message);
      }
    }

    const verifyUrl = new URL("/login/verify-email", request.url);
    verifyUrl.searchParams.set("next", routing.next);
    verifyUrl.searchParams.set("send", "1");
    return redirectWithSession(verifyUrl);
  } catch (error) {
    console.error("[auth/callback] Google sign-in failed:", error);
    return loginErrorRedirect(
      request,
      redirectWithSession,
      "oauth_callback_failed",
      "Google sign-in could not be completed. Please try again.",
    );
  }
}
