import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchOwnerVisitSummaries, getOwnerPortalContext } from "@/lib/owner/portal";
import { createClient } from "@/lib/supabase/server";

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export default async function AccountVisitsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/account/visits");

  const portal = await getOwnerPortalContext(user.id);
  if (!portal) redirect("/account");
  const { clinic } = portal;
  const reportsEnabled = clinic.website_owner_visit_reports_enabled ?? true;

  const visits = await fetchOwnerVisitSummaries(user.id, clinic.id, 40);

  return (
    <main className="bg-surface pb-20 pt-8 text-on-background sm:pt-12">
      <div className="mx-auto max-w-3xl px-6">
        <Link href="/account" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Pet owner portal
        </Link>
        <h1 className="mt-4 font-headline text-3xl font-extrabold tracking-tight">Past visits</h1>
        <p className="mt-2 text-on-surface-variant">
          A simple timeline for <strong className="text-on-surface">{clinic.name}</strong>.{" "}
          {reportsEnabled
            ? "Generated visit-report PDFs can be opened here when the clinic has saved them."
            : "Visit-report downloads are currently hidden by the clinic admin."}
        </p>

        <ul className="mt-8 space-y-3">
          {visits.length ? (
            visits.map((v) => (
              <li
                key={v.id}
                className="clinical-shadow rounded-xl border border-surface-container-high bg-surface-container-lowest px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-headline font-bold text-on-surface">{v.pet_name}</p>
                    <p className="text-sm text-on-surface-variant">{v.branch_name}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium text-on-surface">{formatWhen(v.visited_at)}</p>
                    <p className="text-xs text-primary">{v.status_label}</p>
                  </div>
                </div>
                {reportsEnabled ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {v.report_ready ? (
                      <Link
                        href={`/account/visits/${v.id}/report`}
                        className="inline-flex items-center rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
                        target="_blank"
                      >
                        Open visit report PDF
                      </Link>
                    ) : (
                      <span className="text-xs text-on-surface-variant">PDF will appear here after the doctor saves the visit report.</span>
                    )}
                  </div>
                ) : null}
              </li>
            ))
          ) : (
            <li className="rounded-xl border border-dashed border-outline-variant px-4 py-10 text-center text-sm text-on-surface-variant">
              No completed visits on file yet.
            </li>
          )}
        </ul>
      </div>
    </main>
  );
}
