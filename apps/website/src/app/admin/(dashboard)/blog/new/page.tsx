import { BlogPostForm } from "@/app/admin/(dashboard)/blog/blog-post-form";
import { requireAdmin, resolveBlogAdminClinicId } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { generateBlogDraft } from "@/app/admin/(dashboard)/blog/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import Link from "next/link";

export default async function AdminBlogNewPage() {
  const ctx = await requireAdmin();
  const supabase = createClient();
  const defaultClinicId = await resolveBlogAdminClinicId(ctx, null);

  const { data: clinics } = await supabase.from("clinics").select("id, name, slug").eq("is_active", true).order("name");

  const { data: categories } = await supabase
    .from("blog_categories")
    .select("id, name, slug")
    .eq("clinic_id", defaultClinicId)
    .order("name");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">New post</h1>
        <p className="mt-2 text-slate-600">Drafts stay private until you publish.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">AI draft generator</h2>
        <p className="mt-1 text-sm text-slate-600">Generate a new markdown draft connected to this clinic. You can edit and publish it after.</p>
        <form action={generateBlogDraft} className="mt-5 space-y-4">
          {ctx.role === "super_admin" ? (
            <div>
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
                {(clinics ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.slug})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <input type="hidden" name="clinic_id" value={ctx.clinicId} />
          )}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="topic">
              Topic
            </label>
            <input
              id="topic"
              name="topic"
              required
              placeholder="e.g. spring allergies in pets"
              className="mt-2 w-full max-w-lg rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
            />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <AdminSubmitButton className="btn-primary" pendingLabel="Generating…">
              Generate
            </AdminSubmitButton>
            <Link href="/admin/blog" className="text-sm font-semibold text-primary hover:underline">
              Back to blog list
            </Link>
          </div>
        </form>
      </section>

      <BlogPostForm
        ctx={ctx}
        clinics={(clinics ?? []) as { id: string; name: string; slug: string }[]}
        categories={(categories ?? []) as { id: string; name: string; slug: string }[]}
        defaultClinicId={defaultClinicId}
      />
    </div>
  );
}
