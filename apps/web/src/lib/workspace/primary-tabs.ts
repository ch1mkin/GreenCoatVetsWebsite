import type { NavGroup, NavItem } from "@/lib/auth/permissions";

export type PrimaryTabId =
  | "dashboard"
  | "contacts"
  | "patients"
  | "clinical"
  | "financial"
  | "reporting"
  | "admin"
  | "help";

export const PRIMARY_TAB_ORDER: PrimaryTabId[] = [
  "dashboard",
  "contacts",
  "patients",
  "clinical",
  "financial",
  "reporting",
  "admin",
  "help",
];

const TAB_LABEL: Record<PrimaryTabId, string> = {
  dashboard: "Dashboard",
  contacts: "Contacts",
  patients: "Patients",
  clinical: "Clinical",
  financial: "Financial",
  reporting: "Reporting",
  admin: "Admin",
  help: "Help",
};

/** Preferred landing href when multiple nav items map to the same primary tab. */
const TAB_HREF_PRIORITY: Partial<Record<PrimaryTabId, string[]>> = {
  clinical: [
    "/reception/walk-in",
    "/appointments",
    "/appointments/calendar",
    "/medical-records",
    "/vaccinations",
    "/prescriptions",
    "/visits",
  ],
  financial: ["/invoices", "/payments", "/ecommerce", "/inventory"],
  reporting: ["/analytics", "/super-admin/reports"],
  admin: [
    "/super-admin/users",
    "/super-admin",
    "/team",
    "/branches",
    "/clinic-profile",
    "/invite-qrs",
    "/blog",
    "/services",
    "/notifications-center",
    "/announcements",
  ],
  contacts: ["/owners"],
  patients: ["/pets"],
};

/**
 * Maps a sidebar link to a primary tab. Longer path prefixes are checked first
 * (e.g. /super-admin/reports before /super-admin).
 */
export function primaryTabFromHref(href: string): PrimaryTabId {
  const path = href.split("?")[0] ?? href;
  if (path.startsWith("/help")) return "help";
  if (path.startsWith("/dashboard")) return "dashboard";
  if (path.startsWith("/owners")) return "contacts";
  if (path.startsWith("/pets")) return "patients";
  if (path.startsWith("/super-admin/reports")) return "reporting";
  if (path.startsWith("/analytics")) return "reporting";
  if (path.startsWith("/reception")) return "clinical";
  if (path.startsWith("/appointments")) return "clinical";
  if (path.startsWith("/medical-records")) return "clinical";
  if (path.startsWith("/visits")) return "clinical";
  if (path.startsWith("/vaccinations")) return "clinical";
  if (path.startsWith("/prescriptions")) return "clinical";
  if (path.startsWith("/visits")) return "clinical";
  if (path.startsWith("/invoices")) return "financial";
  if (path.startsWith("/payments")) return "financial";
  if (path.startsWith("/ecommerce")) return "financial";
  if (path.startsWith("/inventory")) return "financial";
  if (path.startsWith("/super-admin")) return "admin";
  if (path.startsWith("/team")) return "admin";
  if (path.startsWith("/branches")) return "admin";
  if (path.startsWith("/clinic-profile/invoice-template")) return "financial";
  if (path.startsWith("/clinic-profile")) return "admin";
  if (path.startsWith("/invite-qrs")) return "admin";
  if (path.startsWith("/blog")) return "admin";
  if (path.startsWith("/services")) return "admin";
  if (path.startsWith("/notifications-center")) return "admin";
  if (path.startsWith("/announcements")) return "admin";
  return "dashboard";
}

export type PrimaryTabLink = { id: PrimaryTabId; label: string; href: string };

function firstHrefForTab(tab: PrimaryTabId, items: NavItem[]): string | null {
  const matching = items.filter((i) => primaryTabFromHref(i.href) === tab);
  if (matching.length === 0) return null;
  const priority = TAB_HREF_PRIORITY[tab];
  if (priority) {
    for (const p of priority) {
      const hit = matching.find((m) => m.href === p || m.href.startsWith(`${p}/`));
      if (hit) return hit.href;
    }
  }
  return matching[0]?.href ?? null;
}

/**
 * Builds primary tab bar links from the user's permitted nav items.
 * Dashboard and Help are always included; other tabs appear only when the role has at least one route in that area.
 */
export function getPrimaryTabLinks(navGroups: NavGroup[]): PrimaryTabLink[] {
  const items = navGroups.flatMap((g) => g.items);
  const out: PrimaryTabLink[] = [];

  for (const id of PRIMARY_TAB_ORDER) {
    if (id === "dashboard") {
      out.push({ id, label: TAB_LABEL[id], href: "/dashboard" });
      continue;
    }
    if (id === "help") {
      out.push({ id, label: TAB_LABEL[id], href: "/help" });
      continue;
    }
    const href = firstHrefForTab(id, items);
    if (href) {
      out.push({ id, label: TAB_LABEL[id], href });
    }
  }
  return out;
}

/** Sidebar: only nav items belonging to the active primary tab. */
export function filterNavGroupsForPrimaryTab(navGroups: NavGroup[], tab: PrimaryTabId): NavGroup[] {
  if (tab === "help") {
    return [{ title: "Help", items: [{ href: "/help", label: "Help center" }] }];
  }
  const filtered: NavGroup[] = [];
  for (const group of navGroups) {
    const items = group.items.filter((i) => primaryTabFromHref(i.href) === tab);
    if (items.length > 0) {
      filtered.push({ title: group.title, items });
    }
  }
  return filtered;
}

/** GET form target for the contextual sidebar search box. */
export function sidebarSearchFormAction(tab: PrimaryTabId): string {
  switch (tab) {
    case "contacts":
      return "/owners";
    case "patients":
    case "clinical":
    case "reporting":
    case "admin":
    case "dashboard":
      return "/pets";
    case "financial":
      return "/ecommerce";
    case "help":
      return "/help";
    default:
      return "/pets";
  }
}
