import Link from "next/link";
import { ReactNode } from "react";
import { SOFTWARE_NAME_SHORT } from "@/lib/branding";
import type { NavGroup } from "@/lib/auth/permissions";
import { getPlatformBranding } from "@/lib/platform-branding";
import { WorkspaceGlobalSearch } from "@/components/workspace/workspace-global-search";
import { WorkspaceRecordTabsStrip } from "@/components/workspace/workspace-record-tabs-strip";
import { WorkspaceSidebarFrame } from "@/components/workspace/workspace-sidebar-frame";
import { WorkspaceSidebarSearch } from "@/components/workspace/workspace-sidebar-search";
import { WorkspaceTaskPanelToggle } from "@/components/workspace/workspace-task-panel";
import type { RecordTabEntry } from "@/lib/workspace/record-tabs-types";
import { WorkspaceChainConnector } from "@/components/workspace/workspace-chain-connector";
import {
  filterNavGroupsForPrimaryTab,
  getPrimaryTabLinks,
  primaryTabFromHref,
  type PrimaryTabId,
} from "@/lib/workspace/primary-tabs";
import { primaryModuleTabClass } from "@/lib/workspace/pms-module-chrome";

export async function AppShell({
  title,
  subtitle,
  activeHref,
  navGroups,
  children,
  topRight,
  recordTabs,
}: {
  title: string;
  subtitle?: string;
  activeHref?: string;
  navGroups: NavGroup[];
  children: ReactNode;
  topRight?: ReactNode;
  /** Optional pinned record tabs (e.g. open patient or contact record). */
  recordTabs?: RecordTabEntry[];
}) {
  const branding = await getPlatformBranding();
  const displayName = branding.product_name || SOFTWARE_NAME_SHORT;
  const activePath = activeHref ?? "/dashboard";
  const activeTab = primaryTabFromHref(activePath);
  const primaryTabs = getPrimaryTabLinks(navGroups);
  const sidebarGroups = filterNavGroupsForPrimaryTab(navGroups, activeTab);

  return (
    <div className="portal-workspace pms-shell flex min-h-screen flex-col bg-[#d8e0ea] text-on-background">
      {/* PMS chrome: color-coded module tabs + chained workspace strip (ezyVet-style) */}
      <header className="sticky top-0 z-40 border-b border-black/20 bg-[#0f172a] text-white shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
        <div className="flex min-h-[44px] min-w-0 items-end gap-1 px-2 pb-0 pt-1.5 sm:px-3">
          <div className="flex min-w-0 shrink-0 items-center gap-2 pb-1 pr-2">
            {branding.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logo_url}
                alt=""
                className="h-8 w-8 shrink-0 rounded-md border border-white/10 bg-white/10 object-contain"
              />
            ) : null}
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-[11px] font-bold leading-tight text-white/95">{displayName}</p>
              <p className="truncate text-[9px] font-medium uppercase tracking-wide text-white/45">
                Practice suite
              </p>
            </div>
          </div>
          <nav
            className="no-scrollbar flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto"
            aria-label="Primary modules"
          >
            {primaryTabs.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={isActive ? "page" : undefined}
                  className={primaryModuleTabClass(tab.id, isActive)}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <div className="pms-header-search hidden min-w-[200px] max-w-md shrink-0 items-center gap-1 pb-1 sm:flex sm:max-w-[min(24rem,28vw)]">
            <WorkspaceGlobalSearch />
            <WorkspaceTaskPanelToggle />
            <Link
              href="/help"
              className="flex h-8 items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 text-[11px] font-semibold text-white/85 hover:bg-white/10"
              title="Help"
            >
              <span className="material-symbols-outlined text-[17px]">help</span>
              <span className="hidden lg:inline">Help</span>
            </Link>
          </div>
        </div>
        <div className="pms-header-search border-t border-white/10 px-2 py-2 sm:hidden">
          <WorkspaceGlobalSearch />
        </div>
        <WorkspaceChainConnector />
        <WorkspaceRecordTabsStrip initialTabs={recordTabs} />
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <WorkspaceSidebarFrame title={sidebarTitle(activeTab)}>
          <WorkspaceSidebarSearch activeTab={activeTab} />
          <nav className="sidebar-scroll flex flex-col gap-0 px-1.5 pb-3 pt-0.5">
            {sidebarGroups.length === 0 ? (
              <p className="px-1.5 py-2 text-[11px] leading-snug text-on-surface-variant">
                No shortcuts for this area. Use the primary tabs above to switch modules.
              </p>
            ) : (
              sidebarGroups.map((group) => (
                <div key={group.title} className="mb-2 last:mb-0">
                  <p className="mb-0.5 px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/75">
                    {group.title}
                  </p>
                  <div className="flex flex-col gap-px">
                    {group.items.map((item) => {
                      const active =
                        item.href === activePath ||
                        (item.href !== "/dashboard" && activePath.startsWith(`${item.href}/`));
                      return (
                        <Link
                          key={`${group.title}-${item.href}`}
                          href={item.href}
                          className={
                            active
                              ? "rounded border border-primary/30 bg-white px-2 py-1.5 text-[11px] font-semibold text-primary shadow-sm"
                              : "rounded px-2 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:bg-white/80"
                          }
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </nav>
        </WorkspaceSidebarFrame>

        <div className="flex min-w-0 flex-1 flex-col bg-[#c5ced9]">
          <div className="pms-main-frame flex min-h-0 flex-1 flex-col p-1 sm:p-1.5">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-slate-400/70 bg-[#eef1f6] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_rgba(15,23,42,0.07)]">
              <div className="sticky top-0 z-20 shrink-0 border-b border-slate-300/90 bg-gradient-to-b from-[#f0f3f8] to-white px-2 py-1.5 md:px-3">
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 border-l-[3px] border-primary pl-2">
                    <h1 className="font-headline text-sm font-bold leading-tight tracking-tight text-slate-900">
                      {title}
                    </h1>
                    {subtitle ? (
                      <p className="mt-0.5 text-[10px] leading-snug text-slate-600">{subtitle}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">{topRight}</div>
                </div>
              </div>
              <div className="sidebar-scroll pms-workspace-scroll min-h-0 flex-1 overflow-y-auto bg-[#f4f6fa] px-2 py-2 md:px-2.5 md:pb-2.5">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function sidebarTitle(tab: PrimaryTabId): string {
  switch (tab) {
    case "dashboard":
      return "Dashboard";
    case "contacts":
      return "Contacts";
    case "patients":
      return "Patients";
    case "clinical":
      return "Clinical";
    case "financial":
      return "Financial";
    case "reporting":
      return "Reporting";
    case "admin":
      return "Administration";
    case "help":
      return "Help";
    default:
      return "Navigation";
  }
}
