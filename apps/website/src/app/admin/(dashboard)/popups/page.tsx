import {
  addMarketingPopup,
  deleteMarketingPopup,
  updateMarketingPopup,
} from "@/app/admin/(dashboard)/actions";
import { AdminFlashMessages } from "@/components/admin/admin-flash-messages";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

const TEMPLATES = ["offer", "community", "reminder", "announcement", "generic"] as const;

type PopupRow = {
  id: string;
  title: string;
  body: string | null;
  template_type: string;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  sort_order: number;
  is_active: boolean;
};

export default async function AdminPopupsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireSuperAdmin();
  const saved = searchParams.saved === "1" || searchParams.saved === "true";
  const deleted = searchParams.deleted === "1" || searchParams.deleted === "true";
  const errorMessage = typeof searchParams.error === "string" ? searchParams.error : null;

  const supabase = createClient();
  const { data } = await supabase
    .from("marketing_site_popups")
    .select("id, title, body, template_type, image_url, cta_label, cta_href, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as PopupRow[];
  const nextSort = rows.length ? Math.max(...rows.map((x) => x.sort_order)) + 1 : 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-headline text-3xl font-bold">Site popups</h1>
        <p className="mt-2 text-slate-600">
          Modals shown on the public marketing site (offers, reminders, announcements). Visitors can dismiss each popup; dismissed IDs are stored in
          the browser only.
        </p>
      </div>

      <AdminFlashMessages saved={saved} deleted={deleted} error={errorMessage} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">Add popup</h2>
        <form action={addMarketingPopup} className="mt-4 grid gap-4">
          <div>
            <label className="text-xs font-bold text-slate-600">Template</label>
            <select name="template_type" className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm" defaultValue="announcement">
              {TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Title</label>
            <input name="title" required className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600">Body (optional)</label>
            <textarea name="body" rows={4} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-600">Image URL (optional)</label>
              <input name="image_url" type="url" placeholder="https://" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">Sort order</label>
              <input
                name="sort_order"
                type="number"
                defaultValue={nextSort}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-600">CTA label (optional)</label>
              <input name="cta_label" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Book now" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">CTA link (optional)</label>
              <input name="cta_href" type="url" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="/book" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked className="rounded border-slate-300" />
            Active
          </label>
          <AdminSubmitButton pendingLabel="Adding…" className="w-fit rounded-xl bg-primary px-5 py-2 font-bold text-white">
            Add popup
          </AdminSubmitButton>
        </form>
      </section>

      <div className="space-y-4">
        {rows.map((row) => (
          <section key={row.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <form action={updateMarketingPopup} className="grid gap-4">
              <input type="hidden" name="id" value={row.id} />
              <div>
                <label className="text-xs font-bold text-slate-600">Template</label>
                <select
                  name="template_type"
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  defaultValue={row.template_type}
                >
                  {TEMPLATES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Title</label>
                <input name="title" required defaultValue={row.title} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Body</label>
                <textarea name="body" rows={4} defaultValue={row.body ?? ""} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">Image URL</label>
                  <input
                    name="image_url"
                    type="url"
                    defaultValue={row.image_url ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Sort order</label>
                  <input
                    name="sort_order"
                    type="number"
                    defaultValue={row.sort_order}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold text-slate-600">CTA label</label>
                  <input name="cta_label" defaultValue={row.cta_label ?? ""} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">CTA link</label>
                  <input
                    name="cta_href"
                    type="url"
                    defaultValue={row.cta_href ?? ""}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_active" defaultChecked={row.is_active} className="rounded border-slate-300" />
                Active
              </label>
              <div className="flex flex-wrap gap-3">
                <AdminSubmitButton pendingLabel="Saving…" className="rounded-xl bg-primary px-5 py-2 font-bold text-white">
                  Save
                </AdminSubmitButton>
              </div>
            </form>
            <form action={deleteMarketingPopup} className="mt-4 border-t border-slate-100 pt-4">
              <input type="hidden" name="id" value={row.id} />
              <AdminSubmitButton pendingLabel="Deleting…" className="text-sm font-semibold text-red-600 hover:underline">
                Delete popup
              </AdminSubmitButton>
            </form>
          </section>
        ))}
      </div>
    </div>
  );
}
