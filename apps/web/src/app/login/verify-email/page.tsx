import { redirect } from "next/navigation";
import { PortalOtpForm } from "../portal-otp-form";
import { createClient } from "@/lib/supabase/server";
import { getPlatformBranding } from "@/lib/platform-branding";

export default async function VerifyPortalEmailPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect("/login");
  }

  const nextPath =
    typeof searchParams?.next === "string" && searchParams.next.startsWith("/") && !searchParams.next.startsWith("//")
      ? searchParams.next
      : "/dashboard";
  const branding = await getPlatformBranding();

  return (
    <div className="min-h-screen bg-surface">
      <main className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <p className="font-headline text-sm font-extrabold uppercase tracking-[0.22em] text-primary">{branding.product_name}</p>
          </div>
          <PortalOtpForm email={user.email} nextPath={nextPath} />
        </div>
      </main>
    </div>
  );
}
