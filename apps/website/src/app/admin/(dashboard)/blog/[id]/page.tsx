import { notFound } from "next/navigation";
import { BlogPostForm } from "@/app/admin/(dashboard)/blog/blog-post-form";
import { requireAdmin, type AdminContext } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

async function assertAccess(ctx: AdminContext, postClinicId: string) {
  if (ctx.role === "super_admin") return;
  if (ctx.role === "marketing_editor" && ctx.clinicId === postClinicId) return;
  notFound();
}

export default async function AdminBlogEditPage({ params }: { params: { id: string } }) {
  const ctx = await requireAdmin();
  const supabase = createClient();

  const { data: post, error } = await supabase
    .from("blog_posts")
    .select(
      "id, title, slug, excerpt, body_markdown, body_html, featured_image_url, category_id, tags, status, ai_generated, clinic_id",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!post) notFound();

  await assertAccess(ctx, post.clinic_id as string);

  const { data: clinics } = await supabase.from("clinics").select("id, name, slug").eq("is_active", true).order("name");

  const { data: categories } = await supabase
    .from("blog_categories")
    .select("id, name, slug")
    .eq("clinic_id", post.clinic_id as string)
    .order("name");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Edit post</h1>
        <p className="mt-2 font-mono text-sm text-slate-500">{post.slug}</p>
      </div>
      <BlogPostForm
        ctx={ctx}
        clinics={(clinics ?? []) as { id: string; name: string; slug: string }[]}
        categories={(categories ?? []) as { id: string; name: string; slug: string }[]}
        defaultClinicId={post.clinic_id as string}
        post={
          {
            id: post.id as string,
            title: post.title as string,
            slug: post.slug as string,
            excerpt: post.excerpt as string | null,
            body_markdown: post.body_markdown as string | null,
            body_html: post.body_html as string | null,
            featured_image_url: post.featured_image_url as string | null,
            category_id: post.category_id as string | null,
            tags: post.tags as string[] | null,
            status: post.status as string,
            ai_generated: post.ai_generated as boolean | null,
          }
        }
      />
    </div>
  );
}
