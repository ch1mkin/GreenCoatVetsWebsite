import { Suspense } from "react";
import { SignupForm } from "./signup-form";
import { getPlatformBranding } from "@/lib/platform-branding";

export default async function SignupPage() {
  const branding = await getPlatformBranding();
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SignupForm productName={branding.product_name} logoUrl={branding.logo_url} />
    </Suspense>
  );
}
