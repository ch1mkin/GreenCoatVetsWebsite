import type { UserAuthCapabilities } from "./user-auth-capabilities";

export type AuthLoginSurface = "web_portal" | "website_public" | "website_admin";

export type AuthAppUrls = {
  webApp: string;
  websiteApp: string;
};

export type AuthDestinationResult =
  | { outcome: "continue"; nextPath: string; requiresOtp: boolean }
  | { outcome: "redirect_external"; url: string }
  | { outcome: "forbidden"; message: string; suggestedUrl?: string };

function trimBase(url: string): string {
  return url.replace(/\/$/, "");
}

export function resolveAuthDestination(
  surface: AuthLoginSurface,
  caps: UserAuthCapabilities,
  urls: AuthAppUrls,
): AuthDestinationResult {
  const webApp = trimBase(urls.webApp);
  const websiteApp = trimBase(urls.websiteApp);

  switch (surface) {
    case "web_portal":
      if (caps.hasWebPortalAccess) {
        return { outcome: "continue", nextPath: "/dashboard", requiresOtp: true };
      }
      if (caps.hasPetOwnerAccess) {
        return {
          outcome: "redirect_external",
          url: `${websiteApp}/login?hint=pet_owner`,
        };
      }
      if (caps.hasWebsiteAdminAccess) {
        return {
          outcome: "redirect_external",
          url: `${websiteApp}/admin/login?hint=use_website_admin`,
        };
      }
      return {
        outcome: "redirect_external",
        url: `${websiteApp}/login?hint=no_portal_access`,
      };

    case "website_admin":
      if (caps.hasWebsiteAdminAccess) {
        const nextPath = caps.isSuperAdmin ? "/admin" : "/admin/settings";
        return { outcome: "continue", nextPath, requiresOtp: false };
      }
      if (caps.hasWebPortalAccess) {
        return {
          outcome: "redirect_external",
          url: `${webApp}/login?hint=use_web_portal`,
        };
      }
      return {
        outcome: "forbidden",
        message: "Access denied — super admin or website editor only.",
        suggestedUrl: `${websiteApp}/login`,
      };

    case "website_public":
      if (caps.hasPetOwnerAccess) {
        return { outcome: "continue", nextPath: "/account", requiresOtp: false };
      }
      if (caps.hasWebPortalAccess) {
        return {
          outcome: "redirect_external",
          url: `${webApp}/login?hint=use_web_portal`,
        };
      }
      if (caps.hasWebsiteAdminAccess) {
        return {
          outcome: "redirect_external",
          url: `${websiteApp}/admin/login?hint=use_website_admin`,
        };
      }
      return {
        outcome: "forbidden",
        message: "No pet owner account is linked to this sign-in.",
        suggestedUrl: `${websiteApp}/signup`,
      };
  }
}
