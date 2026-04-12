import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import {
  estimateReadMinutes,
  fetchPublicBlogCategories,
  fetchPublicBlogPosts,
  fetchPublicTagCounts,
  type PublicBlogPostRow,
} from "@/lib/blog/public";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1200&q=80&auto=format&fit=crop";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default async function PublicBlogPage() {
  const clinic = await resolveClinic();
  const [posts, categories, tagCounts] = await Promise.all([
    fetchPublicBlogPosts(clinic.id, 50),
    fetchPublicBlogCategories(clinic.id),
    fetchPublicTagCounts(clinic.id),
  ]);

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <main className="bg-surface pb-24 pt-8 text-on-background sm:pt-12">
      {featured ? (
        <section className="mx-auto mb-16 max-w-7xl px-6">
          <div className="group relative flex min-h-[420px] flex-col overflow-hidden rounded-[2rem] bg-surface-container-lowest shadow-sm md:min-h-[500px] md:flex-row">
            <div className="relative h-64 w-full overflow-hidden md:h-auto md:w-3/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={featured.featured_image_url || PLACEHOLDER_IMG}
                alt=""
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute left-6 top-6">
                <span className="rounded-full bg-primary-fixed px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-on-primary-fixed shadow-lg">
                  Featured
                </span>
              </div>
            </div>
            <div className="flex w-full flex-col justify-center bg-surface-container-lowest p-8 md:w-2/5 md:p-12">
              <div className="mb-4 flex items-center gap-2">
                <span className="font-headline text-xs font-bold uppercase tracking-widest text-primary">
                  {featured.category_name ?? "Insights"}
                </span>
                <span className="h-1 w-1 rounded-full bg-outline-variant" />
                <span className="text-xs text-on-surface-variant">
                  {estimateReadMinutes(`${featured.excerpt ?? ""} ${featured.title}`)} min read
                </span>
                {featured.ai_generated ? (
                  <>
                    <span className="h-1 w-1 rounded-full bg-outline-variant" />
                    <span className="text-xs text-on-surface-variant">AI-assisted</span>
                  </>
                ) : null}
              </div>
              <h1 className="mb-6 font-headline text-3xl font-extrabold leading-tight text-on-background md:text-4xl lg:text-5xl">
                {featured.title}
              </h1>
              <p className="mb-8 text-lg leading-relaxed text-on-surface-variant">{featured.excerpt ?? ""}</p>
              <div className="mt-auto">
                <Link
                  href={`/blog/${featured.slug}`}
                  className="group/link inline-flex items-center gap-2 font-bold text-primary transition-all hover:gap-4"
                >
                  <span>Read featured article</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-10 flex items-center justify-between gap-4">
            <h2 className="font-headline text-2xl font-bold tracking-tight sm:text-3xl">Clinical insights</h2>
            <div className="flex gap-2 opacity-50">
              <span className="material-symbols-outlined text-on-surface-variant">grid_view</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {rest.map((post: PublicBlogPostRow) => (
              <article
                key={post.id}
                className="group flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest transition-all duration-300 hover:-translate-y-1"
              >
                <div className="relative h-56 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={post.featured_image_url || PLACEHOLDER_IMG}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {post.category_name ? (
                    <div className="absolute bottom-4 left-4">
                      <span className="glass-card rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {post.category_name}
                      </span>
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="mb-3 font-headline text-xl font-bold text-on-surface transition-colors group-hover:text-primary">
                    {post.title}
                  </h3>
                  <p className="mb-6 line-clamp-3 text-sm leading-relaxed text-on-surface-variant">{post.excerpt ?? ""}</p>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-[11px] font-medium text-outline">{formatDate(post.published_at)}</span>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="group/btn flex items-center gap-1 text-sm font-bold text-primary"
                    >
                      Read more
                      <span className="material-symbols-outlined text-base transition-transform group-hover/btn:translate-x-1">
                        chevron_right
                      </span>
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!posts.length ? (
            <p className="rounded-xl border border-surface-container-high bg-white/80 p-8 text-center text-on-surface-variant">
              No published articles yet. Check back soon.
            </p>
          ) : null}
        </div>

        <aside className="flex w-full flex-col gap-10 lg:w-80">
          <div className="gradient-primary rounded-xl p-8 text-on-primary shadow-xl">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
              <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                mail
              </span>
            </div>
            <h4 className="mb-3 font-headline text-2xl font-bold">Health tips in your inbox</h4>
            <p className="mb-8 text-sm leading-relaxed text-primary-fixed opacity-90">
              Ask us at reception for our newsletter — or visit the contact page.
            </p>
            <Link
              href="/contact"
              className="block w-full rounded-xl bg-surface-container-lowest py-3 text-center font-headline font-bold text-primary transition-all hover:bg-opacity-90"
            >
              Contact the clinic
            </Link>
            <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-primary-fixed/60">No spam. Only science.</p>
          </div>

          <div className="rounded-xl bg-surface-container-low p-8">
            <h4 className="mb-6 font-headline text-lg font-bold text-on-background">Popular topics</h4>
            <div className="flex flex-wrap gap-2">
              {tagCounts.length ? (
                tagCounts.map((t) => (
                  <span
                    key={t.tag}
                    className="rounded-lg bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-on-surface-variant"
                  >
                    {t.tag} ({t.post_count})
                  </span>
                ))
              ) : (
                <p className="text-sm text-on-surface-variant">Tags will appear as you publish posts.</p>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-surface-container-low">
            <div className="relative h-32 bg-secondary-container" />
            <div className="p-8 pt-6">
              <h4 className="font-headline font-bold text-on-background">{clinic.name}</h4>
              <p className="mb-4 text-xs font-bold uppercase tracking-wider text-primary">Clinical team</p>
              <p className="text-sm italic leading-relaxed text-on-surface-variant">
                “We translate veterinary science into clear guidance for every pet family.”
              </p>
            </div>
          </div>

          {categories.length ? (
            <div className="rounded-xl border border-surface-container-high bg-white/80 p-6">
              <h4 className="mb-3 font-headline text-sm font-bold text-on-background">Categories</h4>
              <ul className="space-y-2 text-sm text-on-surface-variant">
                {categories.map((c) => (
                  <li key={c.id}>{c.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  );
}
