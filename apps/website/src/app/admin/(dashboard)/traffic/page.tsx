import { requireSuperAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";

type ViewRow = { path: string; created_at: string };

export default async function AdminTrafficPage() {
  await requireSuperAdmin();
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - 14);

  const { data: rows, error } = await supabase
    .from("marketing_site_page_views")
    .select("path, created_at")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(8000);

  if (error) throw new Error(error.message);
  const list = (rows ?? []) as ViewRow[];

  const total = list.length;
  const byPath = new Map<string, number>();
  const byDay = new Map<string, number>();

  for (const r of list) {
    byPath.set(r.path, (byPath.get(r.path) ?? 0) + 1);
    const day = r.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const topPaths = Array.from(byPath.entries()).sort((a, b) => b[1] - a[1]).slice(0, 25);
  const days = Array.from(byDay.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Site traffic</h1>
        <p className="mt-2 text-slate-600">
          Anonymous page views recorded from the public marketing site (path only, last 14 days). Super admins only.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase text-slate-500">Views (14d)</p>
          <p className="mt-2 font-headline text-3xl font-bold text-primary">{total}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:col-span-2">
          <p className="text-xs font-bold uppercase text-slate-500">Note</p>
          <p className="mt-2 text-sm text-slate-600">
            Hits fire once per navigation on public routes (excluding <code className="rounded bg-slate-100 px-1">/admin</code>). Ad-blockers may
            reduce counts.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">By day</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2">Views</th>
              </tr>
            </thead>
            <tbody>
              {days.length ? (
                days.map(([d, n]) => (
                  <tr key={d} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-mono text-xs">{d}</td>
                    <td className="py-2">{n}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="py-6 text-slate-500">
                    No data yet — browse the public site to generate views.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-primary">Top paths</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Path</th>
                <th className="py-2">Views</th>
              </tr>
            </thead>
            <tbody>
              {topPaths.length ? (
                topPaths.map(([path, n]) => (
                  <tr key={path} className="border-b border-slate-100">
                    <td className="max-w-xl truncate py-2 pr-4 font-mono text-xs">{path}</td>
                    <td className="py-2">{n}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="py-6 text-slate-500">
                    No paths recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
