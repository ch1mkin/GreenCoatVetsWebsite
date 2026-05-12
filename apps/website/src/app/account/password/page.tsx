import Link from "next/link";
import { redirect } from "next/navigation";
import { WebsitePasswordChangeForm } from "./password-change-form";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPasswordPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/account/password");
  }

  return (
    <main className="bg-surface pb-20 pt-8 text-on-background sm:pt-12">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Account security</p>
            <h1 className="mt-1 font-headline text-3xl font-extrabold tracking-tight sm:text-4xl">Change password</h1>
          </div>
          <Link href="/account" className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low">
            Back
          </Link>
        </div>

        <WebsitePasswordChangeForm email={user.email ?? "your account"} />
      </div>
    </main>
  );
}
