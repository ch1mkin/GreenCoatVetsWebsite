"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AnalyticsBeacon } from "@/components/site/analytics-beacon";
import { BookingFab } from "@/components/site/booking-fab";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { BookingReminderBar } from "@/components/site/booking-reminder-bar";
import { MarketingSitePopups } from "@/components/site/marketing-site-popups";
import type { FooterNavGroup } from "@/lib/marketing/footer-nav";
import type { SocialLinks } from "@/lib/marketing/defaults";
import type { MarketingPopupRow } from "@/lib/marketing/popups";

export function MarketingShell({
  children,
  productName,
  logoUrl,
  clinicName,
  socialLinks,
  footerNav,
  navbarCallDisplay,
  navbarCallTelHref,
  marketingPopups,
  websiteStoreEnabled,
}: {
  children: ReactNode;
  productName: string;
  logoUrl: string | null;
  clinicName: string;
  socialLinks: SocialLinks;
  footerNav: FooterNavGroup[];
  /** Shown as “Call now” when both are set (e.g. +91 … and tel:+91…). */
  navbarCallDisplay?: string;
  navbarCallTelHref?: string;
  marketingPopups: MarketingPopupRow[];
  websiteStoreEnabled: boolean;
}) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const hideNudges = pathname.startsWith("/book") || pathname.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <>
      <MarketingSitePopups popups={marketingPopups} />
      <AnalyticsBeacon />
      <SiteHeader
        productName={productName}
        logoUrl={logoUrl}
        callDisplay={navbarCallDisplay}
        callTelHref={navbarCallTelHref}
        websiteStoreEnabled={websiteStoreEnabled}
      />
      <div className="marketing-atmosphere relative pt-16 sm:pt-20">
        <div className="relative z-[1]">{children}</div>
      </div>
      <SiteFooter
        className="relative z-10"
        clinicName={clinicName}
        productName={productName}
        socialLinks={socialLinks}
        footerNav={footerNav}
      />
      <BookingFab />
      {!hideNudges ? <BookingReminderBar /> : null}
    </>
  );
}
