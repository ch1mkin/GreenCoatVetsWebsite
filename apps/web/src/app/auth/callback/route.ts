import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { beginPortalEmailOtpForUser } from "@/lib/auth/portal-email-otp";
import { resolveWebPortalLoginForUser } from "@/lib/auth/resolve-web-portal-login";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/login?oauth=google";
  return next;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  let sessionResponse = NextResponse.redirect(new URL("/login", request.url));

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => sessionResponse.cookies.set(name, value, options));
      },
    },
  });

  function redirectWithSession(url: URL) {
    const nextResponse = NextResponse.redirect(url);
    sessionResponse.cookies.getAll().forEach((cookie) => {
      nextResponse.cookies.set(cookie);
    });
    return nextResponse;
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "oauth_exchange_failed");
    return redirectWithSession(loginUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "oauth_no_user");
    return redirectWithSession(loginUrl);
  }

  const routing = await resolveWebPortalLoginForUser(supabase, user);

  if (routing.ok && routing.kind === "external") {
    await supabase.auth.signOut();
    return redirectWithSession(new URL(routing.url));
  }

  if (!routing.ok) {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "portal_access_denied");
    loginUrl.searchParams.set("message", routing.error.slice(0, 240));
    return redirectWithSession(loginUrl);
  }

  try {
    await beginPortalEmailOtpForUser(user.id);
  } catch (otpError) {
    await supabase.auth.signOut();
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "error",
      otpError instanceof Error ? otpError.message : "Could not send verification code.",
    );
    return redirectWithSession(loginUrl);
  }

  const verifyUrl = new URL("/login/verify-email", request.url);
  verifyUrl.searchParams.set("next", routing.next);
  return redirectWithSession(verifyUrl);
}
