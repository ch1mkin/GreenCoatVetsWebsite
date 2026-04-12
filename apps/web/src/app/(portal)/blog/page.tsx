import Link from "next/link";
import { redirect } from "next/navigation";
import { createBlogPost, generateBlogDraft, publishBlogPost } from "./actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

type SearchParams = { status?: string; q?: string };

function borderForStatus(status: string) {
  if (status === "published") return "border-l-4 border-primary";
  if (status === "draft") return "border-l-4 border-tertiary-fixed-dim";
  return "border-l-4 border-secondary-fixed-dim";
}

export default async function BlogCmsPage({ searchParams }: { searchParams: SearchParams }) {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  const allowedForAi = new Set<string>(["clinic_admin", "marketing_editor", "clinic_editor"]);
  if (!access.isSuperAdmin && !allowedForAi.has(access.membership?.role ?? "")) redirect("/dashboard");

  const { clinic_id } = await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);
  const supabase = createClient();

  const rawStatus = (searchParams.status ?? "all").toLowerCase();
  const statusFilter =
    rawStatus === "published" || rawStatus === "draft" ? rawStatus : "all";
  const q = (searchParams.q ?? "").trim().toLowerCase();

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, status, ai_generated, excerpt, created_at, published_at, category_id")
    .eq("clinic_id", clinic_id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (statusFilter === "published" || statusFilter === "draft") {
    query = query.eq("status", statusFilter);
  }

  const { data: postsRaw, error } = await query;
  if (error) throw new Error(error.message);

  const posts = (postsRaw ?? []).filter((p) => {
    if (!q) return true;
    return p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
  });

  const buildListHref = (status: string) => {
    const p = new URLSearchParams();
    if (status !== "all") p.set("status", status);
    if (searchParams.q) p.set("q", searchParams.q);
    return `/blog${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <AppShell
      title="Content CMS"
      subtitle="Blog posts for your clinic site — drafts, publishing, and AI drafts."
      activeHref="/blog"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secondary text-sm" href="/dashboard">
            Dashboard
          </Link>
        </div>
      }
    >
      <div className="mb-6 flex flex-col gap-4 border-b border-outline-variant/15 pb-6 md:flex-row md:items-center md:justify-between">
        <nav className="flex flex-wrap items-center gap-4">
          <h2 className="font-headline text-xl font-extrabold text-transparent bg-gradient-to-br from-primary to-primary-container bg-clip-text">
            Blog
          </h2>
          <div className="hidden h-6 w-px bg-outline-variant/30 md:block" />
          <div className="flex flex-wrap gap-4 text-sm font-semibold">
            <span className="text-primary">Manage posts</span>
            <span className="text-on-surface-variant">Categories</span>
          </div>
        </nav>
        <form className="relative max-w-md flex-1" method="get">
          {statusFilter !== "all" ? <input type="hidden" name="status" value={statusFilter} /> : null}
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60">
            search
          </span>
          <input
            className="input-soft w-full rounded-full py-2.5 pl-10 pr-4 text-sm"
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Search articles…"
            type="search"
          />
        </form>
      </div>

      <div className="grid grid-cols-12 items-start gap-8">
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "published", "draft"] as const).map((s) => {
                const active = statusFilter === s;
                return (
                  <Link
                    key={s}
                    href={buildListHref(s)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      active
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
                    }`}
                  >
                    {s === "all" ? "All posts" : s}
                  </Link>
                );
              })}
            </div>
            <span className="flex items-center gap-1 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">filter_list</span>
              Newest first
            </span>
          </div>

          <div className="space-y-4">
            {posts.map((post) => {
              const catName = post.category_id ? "Categorized" : "Uncategorized";
              return (
                <article
                  key={post.id}
                  className={`rounded-xl bg-surface-container-lowest p-5 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.05)] transition-all hover:bg-surface-container ${borderForStatus(post.status)}`}
                >
                  <div className="flex gap-4">
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-low">
                      <span className="material-symbols-outlined text-4xl text-outline-variant/50">article</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="rounded-md bg-primary-container/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          {catName ?? "Uncategorized"}
                        </span>
                        <span className="text-[10px] font-medium text-on-surface-variant">
                          {post.published_at
                            ? `Published ${new Date(post.published_at).toLocaleDateString()}`
                            : `Updated ${new Date(post.created_at).toLocaleString()}`}
                        </span>
                      </div>
                      <h3 className="font-headline text-lg font-bold text-on-background">{post.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                        {post.excerpt ?? "No excerpt yet."}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-primary">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          {post.status}
                          {post.ai_generated ? " • AI draft" : ""}
                        </span>
                        {post.status !== "published" ? (
                          <form action={publishBlogPost}>
                            <input type="hidden" name="id" value={post.id} />
                            <SubmitButton className="text-xs font-bold text-primary hover:underline" pendingLabel="…">
                              Publish
                            </SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            {!posts.length ? (
              <p className="py-8 text-center text-sm text-on-surface-variant">No posts match your filters.</p>
            ) : null}
          </div>
        </div>

        <div className="col-span-12 flex max-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-[0_12px_40px_-12px_rgba(0,108,80,0.08)] lg:sticky lg:top-24 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-surface-container p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <span className="material-symbols-outlined">edit_note</span>
              </div>
              <h3 className="font-headline font-bold text-on-background">Create article</h3>
            </div>
          </div>
          <div className="no-scrollbar flex-1 space-y-5 overflow-y-auto p-6">
            <section className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">AI draft</h4>
              <form action={generateBlogDraft} className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="input-soft flex-1 text-sm"
                  name="topic"
                  placeholder="Topic e.g. spring allergies"
                  required
                />
                <SubmitButton className="btn-primary shrink-0 text-sm" pendingLabel="…">
                  Generate
                </SubmitButton>
              </form>
            </section>

            <form action={createBlogPost} className="space-y-4">
              <div>
                <label className="mb-2 ml-1 block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Title
                </label>
                <input
                  className="input-soft w-full p-4 font-headline text-lg font-semibold"
                  name="title"
                  placeholder="Headline"
                  required
                />
              </div>
              <div>
                <label className="mb-2 ml-1 block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Slug
                </label>
                <input className="input-soft w-full text-sm" name="slug" placeholder="url-slug" required />
              </div>
              <div>
                <label className="mb-2 ml-1 block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Excerpt
                </label>
                <textarea className="input-soft min-h-[80px] w-full text-sm" name="excerpt" placeholder="Short summary" />
              </div>
              <div>
                <label className="mb-2 ml-1 block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Body (Markdown)
                </label>
                <textarea
                  className="input-soft min-h-[160px] w-full resize-none text-sm leading-relaxed"
                  name="body_markdown"
                  placeholder="Write content…"
                />
              </div>
              <div>
                <label className="mb-2 ml-1 block text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Status
                </label>
                <select className="input-soft w-full" name="status" defaultValue="draft">
                  <option value="draft">draft</option>
                  <option value="published">published</option>
                </select>
              </div>
              <SubmitButton className="btn-primary w-full" pendingLabel="Saving…">
                Save post
              </SubmitButton>
            </form>
          </div>
        </div>
      </div>

      <Link
        href="#"
        className="glass-panel fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg md:hidden"
        aria-label="Scroll to editor"
      >
        <span className="material-symbols-outlined text-primary">edit</span>
      </Link>
    </AppShell>
  );
}
