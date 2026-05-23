import { redirect } from "next/navigation";
import { saveOwnerProfileCompletion, saveStaffProfileCompletion } from "./actions";
import { AppShell } from "@/components/web/app-shell";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getProfileCompletionState } from "@/lib/auth/profile-completion";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/web/submit-button";

export default async function CompleteProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const access = await getUserAccess();
  const supabase = createClient();
  const state = await getProfileCompletionState(supabase, access);
  if (state.complete) {
    redirect("/dashboard");
  }

  const sp = await Promise.resolve(searchParams ?? {});
  const errorMessage = typeof sp.error === "string" ? decodeURIComponent(sp.error) : null;

  const role = (access.membership?.role ?? "pet_owner") as Parameters<typeof getRoleNavGroups>[0];
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  return (
    <AppShell
      title="Complete your profile"
      subtitle="We need your name and phone on file before continuing (used on invoices, visits, and search — not your email)."
      activeHref="/complete-profile"
      navGroups={navGroups}
    >
      <section className="card-soft mx-auto max-w-lg space-y-4">
        {errorMessage ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
            {errorMessage}
          </p>
        ) : null}
        {state.kind === "owner" ? (
          <form action={saveOwnerProfileCompletion} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-on-surface-variant">First name</span>
                <input className="input-soft" name="first_name" required autoComplete="given-name" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-on-surface-variant">Last name</span>
                <input className="input-soft" name="last_name" required autoComplete="family-name" />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-on-surface-variant">Phone</span>
              <input className="input-soft" name="phone" type="tel" required autoComplete="tel" placeholder="+91…" />
            </label>
            <SubmitButton className="btn-primary">Save and continue</SubmitButton>
          </form>
        ) : (
          <form action={saveStaffProfileCompletion} className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-on-surface-variant">Full name</span>
              <input className="input-soft" name="full_name" required autoComplete="name" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-on-surface-variant">Phone</span>
              <input className="input-soft" name="phone" type="tel" required autoComplete="tel" placeholder="+91…" />
            </label>
            <SubmitButton className="btn-primary">Save and continue</SubmitButton>
          </form>
        )}
      </section>
    </AppShell>
  );
}
