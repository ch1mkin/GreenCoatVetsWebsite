import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { getPlatformBranding } from "@/lib/platform-branding";

export default async function LoginPage() {
  const branding = await getPlatformBranding();
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginForm productName={branding.product_name} logoUrl={branding.logo_url} />
    </Suspense>
  );
}
