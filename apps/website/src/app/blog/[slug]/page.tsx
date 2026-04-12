import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { estimateReadMinutes, fetchPublicBlogPost } from "@/lib/blog/public";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1200&q=80&auto=format&fit=crop";

export default async function PublicBlogDetailsPage({
  params,
}: {
  params: { slug: string };
}) {
  const clinic = await resolveClinic();
  const post = await fetchPublicBlogPost(clinic.id, params.slug);
  if (!post) notFound();

  const readMin = estimateReadMinutes(
    `${post.body_markdown ?? ""} ${post.body_html ?? ""} ${post.excerpt ?? ""}`,
  );

  return (
    <main className="bg-surface pb-24 pt-8 text-on-background sm:pt-12">
      <article className="mx-auto max-w-3xl px-6">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to blog
        </Link>

        <div className="mb-6 flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-primary">
          {post.category_name ? <span className="font-headline font-bold">{post.category_name}</span> : null}
          {post.published_at ? (
            <>
              {post.category_name ? <span className="text-on-surface-variant">·</span> : null}
              <time dateTime={post.published_at} className="text-on-surface-variant">
                {new Date(post.published_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </>
          ) : null}
          <span className="text-on-surface-variant">· {readMin} min read</span>
          {post.ai_generated ? <span className="rounded-full bg-surface-container px-2 py-0.5 text-on-surface-variant">AI-assisted</span> : null}
        </div>

        <h1 className="font-headline text-3xl font-extrabold leading-tight text-on-background sm:text-4xl md:text-5xl">{post.title}</h1>
        {post.excerpt ? <p className="mt-6 text-lg leading-relaxed text-on-surface-variant">{post.excerpt}</p> : null}

        <div className="relative mt-10 overflow-hidden rounded-2xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.featured_image_url || PLACEHOLDER_IMG} alt="" className="h-auto w-full max-h-[420px] object-cover" />
        </div>

        <div className="mt-10 max-w-none">
          {post.body_html ? (
            <div
              className="blog-content text-sm leading-relaxed text-on-surface sm:text-base [&_a]:text-primary [&_h2]:mt-8 [&_h2]:font-headline [&_h2]:text-2xl [&_p]:mb-4"
              dangerouslySetInnerHTML={{ __html: post.body_html }}
            />
          ) : (
            <div className="whitespace-pre-wrap rounded-xl border border-surface-container-high bg-white/80 p-6 text-sm leading-relaxed text-on-surface sm:text-base">
              {post.body_markdown ?? "No content"}
            </div>
          )}
        </div>

        {post.tags?.length ? (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-lg bg-surface-container-low px-3 py-1 text-xs font-semibold text-on-surface-variant"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
      </article>
    </main>
  );
}
