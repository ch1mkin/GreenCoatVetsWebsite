import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { beginPortalEmailOtpForUser } from "@/lib/auth/portal-email-otp";
import { resolveWebPortalLoginForUser } from "@/lib/auth/resolve-web-portal-login";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

type PendingAuthCookie = { name: string; value: string; options?: CookieOptions };

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/login";
  return next;
}

function redirectWithAuthCookies(request: NextRequest, redirectTo: URL, cookies: PendingAuthCookie[]) {
  const response = NextResponse.redirect(redirectTo);
  cookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

function loginErrorRedirect(
  request: NextRequest,
  cookies: PendingAuthCookie[],
  error: string,
  message?: string,
) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", error);
  if (message) {
    loginUrl.searchParams.set("message", message.slice(0, 240));
  }
  return redirectWithAuthCookies(request, loginUrl, cookies);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  const pendingCookies: PendingAuthCookie[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach((cookie) => {
          pendingCookies.push(cookie);
        });
      },
    },
  });

  try {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return loginErrorRedirect(request, pendingCookies, "oauth_exchange_failed");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return loginErrorRedirect(request, pendingCookies, "oauth_no_user");
    }

    let routing;
    try {
      routing = await resolveWebPortalLoginForUser(supabase, user);
    } catch (routingError) {
      await supabase.auth.signOut();
      const message =
        routingError instanceof Error ? routingError.message : "Could not verify account access.";
      return loginErrorRedirect(request, pendingCookies, "portal_access_denied", message);
    }

    if (routing.ok && routing.kind === "external") {
      await supabase.auth.signOut();
      return redirectWithAuthCookies(request, new URL(routing.url), pendingCookies);
    }

    if (!routing.ok) {
      await supabase.auth.signOut();
      return loginErrorRedirect(request, pendingCookies, "portal_access_denied", routing.error);
    }

    const invite = (request.nextUrl.searchParams.get("invite") ?? "").trim();
    if (invite) {
      const { error: inviteError } = await supabase.rpc("consume_clinic_role_invite", {
        p_token: invite,
        p_full_name: null,
        p_phone: null,
      });
      if (inviteError) {
        await supabase.auth.signOut();
        return loginErrorRedirect(request, pendingCookies, "portal_access_denied", inviteError.message);
      }
    }

    try {
      await beginPortalEmailOtpForUser(user.id);
    } catch (otpError) {
      await supabase.auth.signOut();
      const message =
        otpError instanceof Error ? otpError.message : "Could not send verification code.";
      return loginErrorRedirect(request, pendingCookies, "otp_send_failed", message);
    }

    const verifyUrl = new URL("/login/verify-email", request.url);
    verifyUrl.searchParams.set("next", routing.next);
    return redirectWithAuthCookies(request, verifyUrl, pendingCookies);
  } catch (error) {
    console.error("[auth/callback] Google sign-in failed:", error);
    return loginErrorRedirect(
      request,
      pendingCookies,
      "oauth_callback_failed",
      "Google sign-in could not be completed. Please try again.",
    );
  }
}
