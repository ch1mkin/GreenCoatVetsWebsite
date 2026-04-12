import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminBlogListPage() {
  const ctx = await requireAdmin();
  const supabase = createClient();

  let query = supabase
    .from("blog_posts")
    .select("id, title, slug, status, published_at, ai_generated, updated_at, clinic_id, clinics(name)")
    .order("updated_at", { ascending: false });

  if (ctx.role === "marketing_editor") {
    query = query.eq("clinic_id", ctx.clinicId);
  }

  const { data: posts, error } = await query;

  if (error) throw new Error(error.message);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold">Blog</h1>
          <p className="mt-2 text-slate-600">
            Create hand-written or AI-assisted articles. Only published posts appear on the public site.
          </p>
        </div>
        <Link
          href="/admin/blog/new"
          className="rounded-xl bg-primary px-5 py-2.5 font-headline text-sm font-bold text-on-primary shadow-sm"
        >
          New post
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Title</th>
              {ctx.role === "super_admin" ? <th className="px-4 py-3">Clinic</th> : null}
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">AI</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(posts ?? []).map((p) => {
              const clinicName =
                p.clinics && typeof p.clinics === "object" && "name" in p.clinics
                  ? (p.clinics as { name: string }).name
                  : "—";
              return (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{p.title}</td>
                {ctx.role === "super_admin" ? <td className="px-4 py-3 text-slate-600">{clinicName}</td> : null}
                <td className="px-4 py-3 capitalize text-slate-600">{p.status}</td>
                <td className="px-4 py-3 text-slate-600">{p.ai_generated ? "Yes" : "—"}</td>
                <td className="px-4 py-3 text-slate-500">
                  {p.updated_at ? new Date(p.updated_at as string).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/blog/${p.id}`} className="font-semibold text-primary hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
        {!posts?.length ? <p className="px-4 py-8 text-center text-slate-500">No posts yet.</p> : null}
      </div>
    </div>
  );
}
