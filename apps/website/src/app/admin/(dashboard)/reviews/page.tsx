import { addMarketingReview, deleteMarketingReview, updateMarketingReview } from "@/app/admin/(dashboard)/actions";
import { AdminFlashMessages } from "@/components/admin/admin-flash-messages";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { requireMarketingManager } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

type ReviewRow = {
  id: string;
  reviewer_name: string;
  pet_name: string;
  message: string;
  stars: number;
  owner_image_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireMarketingManager();
  const saved = searchParams.saved === "1" || searchParams.saved === "true";
  const deleted = searchParams.deleted === "1" || searchParams.deleted === "true";
  const errorMessage = typeof searchParams.error === "string" ? searchParams.error : null;
  const supabase = createClient();
  const { data } = await supabase
    .from("marketing_reviews")
    .select("id, reviewer_name, pet_name, message, stars, owner_image_url, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as ReviewRow[];
  const nextSort = rows.length ? Math.max(...rows.map((x) => x.sort_order)) + 1 : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Reviews</h1>
        <p className="mt-2 text-slate-600">Add and edit homepage reviews (message, stars, owner image URL, and pet name).</p>
      </div>
      <AdminFlashMessages saved={saved} deleted={deleted} error={errorMessage} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">Add review</h2>
        <form action={addMarketingReview} className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="reviewer_name" required placeholder="Owner name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input name="pet_name" required placeholder="Pet name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <textarea name="message" required rows={4} placeholder="Review message" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <div className="grid gap-3 sm:grid-cols-3">
            <input name="stars" type="number" min={1} max={5} defaultValue={5} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <input name="sort_order" type="number" defaultValue={nextSort} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked className="rounded border-slate-300" />
              Active
            </label>
          </div>
          <input
            name="owner_image_url"
            type="url"
            placeholder="Owner image URL (optional)"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <AdminSubmitButton pendingLabel="Adding…" className="w-fit rounded-xl bg-primary px-5 py-2 font-bold text-white">
            Add review
          </AdminSubmitButton>
        </form>
      </section>

      {rows.map((row) => (
        <section key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form action={updateMarketingReview} className="grid gap-3">
            <input type="hidden" name="id" value={row.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="reviewer_name"
                required
                defaultValue={row.reviewer_name}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input name="pet_name" required defaultValue={row.pet_name} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <textarea
              name="message"
              required
              rows={4}
              defaultValue={row.message}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                name="stars"
                type="number"
                min={1}
                max={5}
                defaultValue={row.stars}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                name="sort_order"
                type="number"
                defaultValue={row.sort_order}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={row.is_active} className="rounded border-slate-300" />
                Active
              </label>
            </div>
            <input
              name="owner_image_url"
              type="url"
              defaultValue={row.owner_image_url ?? ""}
              placeholder="Owner image URL (optional)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-3">
              <AdminSubmitButton pendingLabel="Saving…" className="rounded-xl bg-primary px-5 py-2 font-bold text-white">
                Save review
              </AdminSubmitButton>
            </div>
          </form>
          <form action={deleteMarketingReview} className="mt-3">
            <input type="hidden" name="id" value={row.id} />
            <AdminSubmitButton
              pendingLabel="Deleting…"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700"
            >
              Delete
            </AdminSubmitButton>
          </form>
        </section>
      ))}
    </div>
  );
}
