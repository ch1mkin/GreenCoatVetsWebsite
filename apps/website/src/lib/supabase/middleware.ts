import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getWebAppOrigin } from "@/lib/auth/web-app-origin";
import { supabaseAnonKey, supabaseUrl } from "./env";

function redirectOAuthCodeToWebPortal(request: NextRequest): NextResponse | null {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return null;

  const webCallback = new URL("/auth/callback", getWebAppOrigin());
  webCallback.searchParams.set("code", code);
  const next = request.nextUrl.searchParams.get("next");
  webCallback.searchParams.set(
    "next",
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/login",
  );
  return NextResponse.redirect(webCallback);
}

export async function updateSession(request: NextRequest) {
  const oauthBridge = redirectOAuthCodeToWebPortal(request);
  if (oauthBridge) return oauthBridge;
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();

  return supabaseResponse;
}
