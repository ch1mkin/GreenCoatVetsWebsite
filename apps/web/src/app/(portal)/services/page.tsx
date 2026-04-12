import Link from "next/link";
import { redirect } from "next/navigation";
import { createService, setServiceActive } from "./actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

function branchLabel(branches: unknown): string {
  if (branches == null) return "All branches";
  if (Array.isArray(branches)) return (branches[0] as { name?: string } | undefined)?.name ?? "All branches";
  return (branches as { name?: string }).name ?? "All branches";
}

export default async function ServicesCmsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");

  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  const canManageServices = access.isSuperAdmin || role === "clinic_admin";
  if (!canManageServices) redirect("/dashboard");

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  const [{ data: services, error: servicesError }, { data: branches, error: branchesError }] =
    await Promise.all([
      supabase
        .from("services")
        .select("id, title, slug, short_description, is_active, branches(name)")
        .eq("clinic_id", clinic_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("branches")
        .select("id, name")
        .eq("clinic_id", clinic_id)
        .eq("is_active", true)
        .order("name", { ascending: true }),
    ]);
  if (servicesError) throw new Error(servicesError.message);
  if (branchesError) throw new Error(branchesError.message);

  const list = services ?? [];
  const activeCount = list.filter((s) => s.is_active).length;

  async function signOut() {
    "use server";
    const sb = createClient();
    await sb.auth.signOut();
    redirect("/login");
  }

  return (
    <AppShell
      title="Services CMS"
      subtitle="Published offerings for your clinic website — exams, surgery blocks, and add-on care."
      activeHref="/services"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary text-sm" href="/blog">
            Blog CMS
          </Link>
          <Link className="btn-primary text-sm" href="/dashboard">
            Dashboard
          </Link>
          <form action={signOut}>
            <button
              className="rounded-xl border border-outline-variant/30 px-3 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      }
    >
      <section className="mb-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Total services</p>
          <p className="font-headline mt-2 text-3xl font-extrabold text-primary">{list.length}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Active</p>
          <p className="font-headline mt-2 text-3xl font-extrabold text-on-background">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Branches in use</p>
          <p className="font-headline mt-2 text-3xl font-extrabold text-on-background">{branches?.length ?? 0}</p>
        </div>
      </section>

      <div className="mb-8 flex flex-col gap-4 border-b border-outline-variant/15 pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="font-headline text-xl font-extrabold text-transparent bg-gradient-to-br from-primary to-primary-container bg-clip-text md:text-2xl">
            Service catalog
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Slugs power public URLs; pair with your marketing site when you wire the headless API.
          </p>
        </div>
      </div>

      <section className="mb-10 grid gap-8 lg:grid-cols-5">
        <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm lg:col-span-2">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
              <span className="material-symbols-outlined">add_circle</span>
            </div>
            <div>
              <h3 className="font-headline text-lg font-bold">New service</h3>
              <p className="text-xs text-on-surface-variant">Title, slug, and optional branch scope</p>
            </div>
          </div>
          <form action={createService} className="grid gap-3">
            <input className="input-soft" name="title" placeholder="Service title" required />
            <input className="input-soft" name="slug" placeholder="url-slug" required />
            <select className="input-soft" name="branch_id">
              <option value="">All branches</option>
              {branches?.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <input className="input-soft" name="short_description" placeholder="Short description (card teaser)" />
            <textarea
              className="input-soft min-h-[120px] resize-y"
              name="description"
              placeholder="Detailed description (rich text / markdown in your site)"
            />
            <SubmitButton className="btn-primary w-full">Save service</SubmitButton>
          </form>
        </div>

        <div className="space-y-4 lg:col-span-3">
          {list.map((service) => (
            <article
              key={service.id}
              className={`group rounded-2xl border bg-surface-container-lowest p-5 shadow-sm transition-all hover:shadow-[0_12px_32px_rgba(23,28,31,0.06)] ${
                service.is_active ? "border-primary/20" : "border-outline-variant/20 opacity-90"
              }`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        service.is_active
                          ? "bg-primary-fixed/30 text-on-primary-container"
                          : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {service.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="material-symbols-outlined text-lg text-primary/80">medical_services</span>
                  </div>
                  <h4 className="font-headline mt-2 text-lg font-bold text-on-background">{service.title}</h4>
                  <p className="font-mono text-xs text-on-surface-variant">/{service.slug}</p>
                  <p className="mt-2 text-sm text-on-surface-variant">{service.short_description ?? "—"}</p>
                  <p className="mt-2 text-xs font-medium text-on-surface-variant">
                    <span className="material-symbols-outlined align-middle text-sm">location_on</span>{" "}
                    {branchLabel(service.branches)}
                  </p>
                </div>
                <form action={setServiceActive} className="shrink-0">
                  <input type="hidden" name="id" value={service.id} />
                  <input type="hidden" name="active" value={service.is_active ? "false" : "true"} />
                  <SubmitButton
                    className={
                      service.is_active
                        ? "rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-2 text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
                        : "rounded-xl bg-gradient-to-br from-primary-container to-primary px-4 py-2 text-sm font-semibold text-white shadow-md"
                    }
                    pendingLabel="Updating…"
                  >
                    {service.is_active ? "Deactivate" : "Activate"}
                  </SubmitButton>
                </form>
              </div>
            </article>
          ))}
          {!list.length ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low/50 p-10 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">post_add</span>
              <p className="mt-3 font-medium text-on-surface-variant">No services yet — add your first on the left.</p>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
