import Image from "next/image";
import Link from "next/link";
import { createInviteQr } from "./actions";
import { InviteQrStudio } from "./invite-qr-studio";
import type { InviteQrRow } from "./types";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { getRoleNavGroups, roleCanGenerateQr, AppRole } from "@/lib/auth/permissions";
import { AppShell } from "@/components/web/app-shell";
import { getPlatformBranding } from "@/lib/platform-branding";

export default async function InviteQrsPage() {
  const access = await getUserAccess();
  const branding = await getPlatformBranding();
  const supabase = createClient();
  const isSuperAdmin = access.isSuperAdmin;
  const membership = access.membership;
  const role = (membership?.role ?? "pet_owner") as AppRole;
  const qrPerms = roleCanGenerateQr(role, isSuperAdmin);
  const navGroups = getRoleNavGroups(role, isSuperAdmin);
  const flatNavItems = navGroups.flatMap((g) => g.items);

  if (!isSuperAdmin && !membership) {
    throw new Error("No active clinic membership.");
  }

  const { data: clinics } = await supabase.from("clinics").select("id, name").order("name", { ascending: true }).limit(200);

  const defaultClinicId = (isSuperAdmin ? clinics?.[0]?.id : membership?.clinic_id) ?? "";

  let invitesQuery = supabase
    .from("clinic_role_invites")
    .select(
      "id, clinic_id, role, token, label, is_active, max_uses, used_count, expires_at, created_at, clinics(name, slug)"
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (!isSuperAdmin) {
    invitesQuery = invitesQuery.eq("clinic_id", membership?.clinic_id ?? "");
  }

  const { data: invitesRaw, error } = await invitesQuery;

  if (error) {
    throw new Error(error.message);
  }

  const invites = (invitesRaw ?? []).map((row: Record<string, unknown>) => {
    const c = row.clinics;
    const clinics =
      c && Array.isArray(c) ? (c[0] as { name: string; slug: string }) : (c as { name: string; slug: string } | null);
    return { ...row, clinics: clinics ?? null } as InviteQrRow;
  });

  const webBase = process.env.NEXT_PUBLIC_WEB_APP_URL ?? "http://localhost:3000";
  const websiteBase = process.env.NEXT_PUBLIC_WEBSITE_APP_URL ?? "http://localhost:3001";
  const totalScans = invites.reduce((sum, invite) => sum + Number(invite.used_count ?? 0), 0);
  const totalRegistrations = totalScans;
  const topInvite = invites.slice().sort((a, b) => Number(b.used_count ?? 0) - Number(a.used_count ?? 0))[0];

  return (
    <AppShell
      title="Clinic onboarding QR"
      subtitle="Role-based invites — web, website, and mobile-ready"
      activeHref="/invite-qrs"
      navGroups={navGroups}
      topRight={
        isSuperAdmin ? (
          <Link className="btn-secondary" href="/super-admin">
            Platform Control
          </Link>
        ) : null
      }
    >
      {/* Hero strip — reference layout */}
      <div className="mb-10 flex flex-col gap-6 rounded-3xl border border-outline-variant/15 bg-gradient-to-br from-surface-container-lowest via-surface to-surface-container-low/80 p-6 shadow-[0_12px_40px_-12px_rgba(23,28,31,0.08)] md:flex-row md:items-center md:justify-between md:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/15">
            <span className="material-symbols-outlined text-3xl text-primary">qr_code_2</span>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Access control</p>
            <h2 className="bg-gradient-to-br from-primary-container to-primary bg-clip-text font-headline text-2xl font-extrabold tracking-tight text-transparent md:text-3xl">
              {branding.product_name}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-on-surface-variant">
              Generate dynamic credentials for staff and pet-owner onboarding. Same flows on web and mobile.
            </p>
          </div>
        </div>
      </div>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Total scans</p>
          <p className="mt-2 font-headline text-3xl font-extrabold text-primary">{totalScans}</p>
        </article>
        <article className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Registrations</p>
          <p className="mt-2 font-headline text-3xl font-extrabold text-on-background">{totalRegistrations}</p>
        </article>
        <article className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Top invite</p>
          <p className="mt-2 line-clamp-2 font-headline text-lg font-extrabold text-on-background">
            {topInvite?.label ?? topInvite?.role ?? "—"}
          </p>
        </article>
      </section>

      <div className="mb-12">
        <InviteQrStudio invites={invites} webBase={webBase} websiteBase={websiteBase} />
      </div>

      <section className="mb-10 rounded-3xl border border-outline-variant/15 bg-surface-container-low/60 p-6 shadow-inner md:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">add_circle</span>
          <div>
            <h3 className="font-headline text-lg font-extrabold text-on-background">Generate role invite</h3>
            <p className="text-xs text-on-surface-variant">Creates a new token — appears in preview and list below.</p>
          </div>
        </div>
        {qrPerms.allowedRoles.length ? (
          <form action={createInviteQr} className="grid gap-4 md:grid-cols-2">
            {qrPerms.clinicSelectable ? (
              <select
                className="input-soft md:col-span-2"
                name="clinic_id"
                defaultValue={defaultClinicId}
                required
              >
                {clinics?.map((clinic) => (
                  <option key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </option>
                ))}
              </select>
            ) : null}
            <select className="input-soft" name="role" required>
              <option value="">Select role</option>
              {qrPerms.allowedRoles.map((allowedRole) => (
                <option key={allowedRole} value={allowedRole}>
                  {allowedRole.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <input className="input-soft" name="label" placeholder="Label (optional)" />
            <input className="input-soft" name="max_uses" type="number" min={1} placeholder="Max uses (optional)" />
            <input className="input-soft" name="expires_in_days" type="number" min={1} placeholder="Expires in days (optional)" />
            <button
              className="btn-primary md:col-span-2 flex items-center justify-center gap-2 py-4 font-headline font-bold shadow-lg shadow-primary/15"
              type="submit"
            >
              <span className="material-symbols-outlined text-xl">bolt</span>
              Generate invite
            </button>
          </form>
        ) : (
          <p className="text-sm text-on-surface-variant">Your role is not permitted to generate QR invites.</p>
        )}
      </section>

      <section className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest/90 p-6 md:p-8">
        <h3 className="mb-6 font-headline text-lg font-extrabold text-on-background">Recent invites</h3>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {invites.map((invite) => {
            const webSignup = `${webBase}/signup?invite=${invite.token}`;
            const websiteSignup = `${websiteBase}/signup?invite=${invite.token}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(webSignup)}`;

            return (
              <article
                key={invite.id}
                className="group rounded-2xl border border-outline-variant/10 bg-surface p-5 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
              >
                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="truncate font-headline text-lg font-bold text-on-background">
                      {invite.label ?? invite.role.replace(/_/g, " ")}
                    </h4>
                    <p className="text-xs capitalize text-on-surface-variant">{invite.role.replace(/_/g, " ")}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                      invite.is_active ? "bg-primary-fixed/30 text-on-primary-fixed-variant" : "bg-surface-container-high text-on-surface-variant"
                    }`}
                  >
                    {invite.is_active ? "active" : "inactive"}
                  </span>
                </div>
                <div className="qr-gradient-border mb-4 inline-block rounded-2xl p-[2px]">
                  <div className="overflow-hidden rounded-[0.9rem] bg-white p-2">
                    <Image
                      className="h-36 w-36 object-contain transition-transform group-hover:scale-[1.02]"
                      src={qrUrl}
                      alt={`QR for ${invite.role}`}
                      width={144}
                      height={144}
                      unoptimized
                    />
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-surface-container-low p-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Scans</p>
                    <p className="font-headline font-bold text-on-background">{invite.used_count ?? 0}</p>
                  </div>
                  <div className="rounded-xl bg-surface-container-low p-2 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Clinic</p>
                    <p className="truncate font-semibold text-on-background">{invite.clinics?.name ?? invite.clinic_id.slice(0, 6)}</p>
                  </div>
                </div>
                <div className="space-y-1 break-all font-mono text-[10px] leading-relaxed text-on-surface-variant">
                  <p className="opacity-90">{webSignup}</p>
                  <p className="opacity-75">{websiteSignup}</p>
                </div>
              </article>
            );
          })}
        </div>
        {!invites.length ? <p className="text-sm text-on-surface-variant">No invites generated yet.</p> : null}
      </section>

      <section className="mt-10 rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-low/50 p-6">
        <h3 className="mb-3 font-headline text-sm font-extrabold text-on-background">Modules for your role</h3>
        <div className="flex flex-wrap gap-2">
          {flatNavItems.map((item) => (
            <span key={item.href} className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-medium text-on-surface-variant">
              {item.label}
            </span>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
