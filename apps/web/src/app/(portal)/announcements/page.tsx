import Link from "next/link";
import { redirect } from "next/navigation";
import { publishClinicAnnouncement } from "./actions";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

type AnnouncementRow = {
  id: string;
  title: string;
  message: string;
  created_at: string;
  clinics?: { name: string } | { name: string }[] | null;
};

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getUserAccess();
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  const r = role.toLowerCase();
  const canPublish =
    access.isSuperAdmin || r === "clinic_admin" || r === "branch_admin";

  if (!canPublish) {
    redirect("/dashboard");
  }

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  const saved = searchParams.saved === "1" || searchParams.saved === "true";
  const errorParam = searchParams.error;
  const errorMessage = typeof errorParam === "string" ? errorParam : null;

  const { data: clinics } = access.isSuperAdmin
    ? await supabase.from("clinics").select("id, name").eq("is_active", true).order("name", { ascending: true })
    : { data: null };

  const { data: rows } = access.isSuperAdmin
    ? await supabase
        .from("clinic_announcements")
        .select("id, title, message, created_at, clinics(name)")
        .order("created_at", { ascending: false })
        .limit(50)
    : await supabase
        .from("clinic_announcements")
        .select("id, title, message, created_at, clinics(name)")
        .eq("clinic_id", clinic_id)
        .order("created_at", { ascending: false })
        .limit(50);

  const announcements = (rows ?? []) as AnnouncementRow[];

  async function signOut() {
    "use server";
    const sb = createClient();
    await sb.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      title="Announcements"
      subtitle="Reach every staff member in this clinic — they get an in-app notification on mobile and can read history here."
      activeHref="/announcements"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" href="/notifications-center">
            Communication hub
          </Link>
          <Link className="btn-secondary" href="/dashboard">
            Dashboard
          </Link>
          <form action={signOut}>
            <button
              className="rounded-md border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-low"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      }
    >
      {saved ? (
        <div className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-900">
          Announcement published — staff have been notified.
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-900">{errorMessage}</div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
          <h2 className="font-headline text-lg font-bold text-on-surface">New announcement</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Sends a push-channel notification to each active staff membership (all roles except pet owners) for this clinic.
          </p>
          <form action={publishClinicAnnouncement} className="mt-6 space-y-4">
            {access.isSuperAdmin ? (
              <div>
                <label className="text-xs font-bold uppercase text-on-surface-variant" htmlFor="clinic_id">
                  Clinic
                </label>
                <select
                  id="clinic_id"
                  name="clinic_id"
                  required
                  className="input-soft mt-2 w-full"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select clinic
                  </option>
                  {(clinics ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="clinic_id" value={clinic_id} />
            )}
            <div>
              <label className="text-xs font-bold uppercase text-on-surface-variant" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                name="title"
                required
                maxLength={200}
                className="input-soft mt-2 w-full"
                placeholder="e.g. Holiday hours this week"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase text-on-surface-variant" htmlFor="message">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={6}
                maxLength={4000}
                className="input-soft mt-2 min-h-[120px] w-full"
                placeholder="Details for your team…"
              />
            </div>
            <SubmitButton className="btn-primary font-headline font-bold">
              Publish &amp; notify staff
            </SubmitButton>
          </form>
        </section>

        <section className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5 sm:p-6">
          <h2 className="font-headline text-lg font-bold text-on-surface">Recent (this clinic)</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Published announcements for the clinic context you are using.</p>
          <ul className="mt-6 space-y-4">
            {announcements.map((a) => {
              const cn = a.clinics;
              const clinicName = Array.isArray(cn) ? cn[0]?.name : cn?.name;
              return (
              <li key={a.id} className="rounded-md border border-outline-variant/15 bg-surface-container-lowest p-3">
                {access.isSuperAdmin && clinicName ? (
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">{clinicName}</p>
                ) : null}
                <p className="font-headline font-bold text-on-surface">{a.title}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface-variant">{a.message}</p>
                <p className="mt-3 text-xs font-medium text-on-surface-variant/80">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </li>
            );
            })}
          </ul>
          {!announcements.length ? (
            <p className="mt-6 text-sm text-on-surface-variant">No announcements yet for this clinic.</p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
