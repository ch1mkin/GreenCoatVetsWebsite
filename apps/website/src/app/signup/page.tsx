import { Suspense } from "react";
import { WebsiteSignupForm } from "./signup-form";
import { getPlatformBranding } from "@/lib/platform-branding";

export default async function WebsiteSignupPage() {
  const branding = await getPlatformBranding();
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <WebsiteSignupForm productName={branding.product_name} logoUrl={branding.logo_url} />
    </Suspense>
  );
}
