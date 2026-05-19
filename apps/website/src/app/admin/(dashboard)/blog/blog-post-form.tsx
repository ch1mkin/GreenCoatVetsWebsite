import { saveBlogPost } from "@/app/admin/(dashboard)/blog/actions";
import { DeleteBlogPostForm } from "@/app/admin/(dashboard)/blog/delete-blog-post-form";
import type { AdminContext } from "@/lib/admin/auth";

type Category = { id: string; name: string; slug: string };
type Clinic = { id: string; name: string; slug: string };

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body_markdown: string | null;
  body_html: string | null;
  featured_image_url: string | null;
  category_id: string | null;
  tags: string[] | null;
  status: string;
  ai_generated: boolean | null;
};

export function BlogPostForm({
  ctx,
  clinics,
  categories,
  defaultClinicId,
  post,
}: {
  ctx: AdminContext;
  clinics: Clinic[];
  categories: Category[];
  defaultClinicId: string;
  post?: Post;
}) {
  const isSuper = ctx.role === "super_admin";

  return (
    <div className="space-y-8">
      <form action={saveBlogPost} className="space-y-8">
        {post ? <input type="hidden" name="id" value={post.id} /> : null}
        {isSuper && !post ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="clinic_id">
              Clinic
            </label>
            <select
              id="clinic_id"
              name="clinic_id"
              required
              defaultValue={defaultClinicId}
              className="mt-2 w-full max-w-lg rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
            >
              {clinics.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.slug})
                </option>
              ))}
            </select>
          </section>
        ) : null}
        {isSuper && post ? <input type="hidden" name="clinic_id" value={defaultClinicId} /> : null}
        {!isSuper ? <input type="hidden" name="clinic_id" value={ctx.clinicId} /> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Content</h2>
          <div className="mt-4 grid gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="title">
                Title
              </label>
              <input
                id="title"
                name="title"
                required
                defaultValue={post?.title ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="slug">
                Slug (URL segment)
              </label>
              <input
                id="slug"
                name="slug"
                placeholder="auto from title if empty"
                defaultValue={post?.slug ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="excerpt">
                Excerpt
              </label>
              <textarea
                id="excerpt"
                name="excerpt"
                rows={3}
                defaultValue={post?.excerpt ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="body_markdown">
                Body (Markdown)
              </label>
              <textarea
                id="body_markdown"
                name="body_markdown"
                rows={16}
                defaultValue={post?.body_markdown ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm text-slate-900"
              />
            </div>
            {isSuper ? (
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="body_html">
                  Body HTML (optional override)
                </label>
                <textarea
                  id="body_html"
                  name="body_html"
                  rows={6}
                  placeholder="If set, public post page may prefer HTML rendering"
                  defaultValue={post?.body_html ?? ""}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-xs text-slate-900"
                />
              </div>
            ) : null}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="featured_image_url">
                Featured image URL
              </label>
              <input
                id="featured_image_url"
                name="featured_image_url"
                type="url"
                placeholder="https://..."
                defaultValue={post?.featured_image_url ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Taxonomy &amp; flags</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="category_id">
                Category
              </label>
              <select
                id="category_id"
                name="category_id"
                defaultValue={post?.category_id ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="tags">
                Tags (comma-separated)
              </label>
              <input
                id="tags"
                name="tags"
                defaultValue={post?.tags?.join(", ") ?? ""}
                className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={post?.status === "published" ? "published" : "draft"}
                className="rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                id="ai_generated"
                name="ai_generated"
                type="checkbox"
                defaultChecked={post?.ai_generated ?? false}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="ai_generated" className="text-sm text-slate-700">
                Mark as AI-assisted content
              </label>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-xl bg-primary px-6 py-3 font-headline text-sm font-bold text-on-primary">
            Save
          </button>
        </div>
      </form>

      {post ? <DeleteBlogPostForm postId={post.id} /> : null}
    </div>
  );
}
