import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/web/app-shell";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";

const SECTIONS: { id: string; title: string; body: string[] }[] = [
  {
    id: "overview",
    title: "Workspace overview",
    body: [
      "The clinic portal is organised like leading practice systems: primary tabs across the top open major areas (Dashboard, Contacts, Patients, Clinical, Financial, Reporting, Admin, Help).",
      "Each primary area shows a left sidebar with shortcuts to records and tools for that module, plus a contextual search box.",
      "Record tabs (below the primary bar) will pin open patient or contact records as we extend navigation history.",
    ],
  },
  {
    id: "primary-tabs",
    title: "Primary tabs",
    body: [
      "Dashboard — KPIs, calendar shortcuts, and daily operational snapshot.",
      "Contacts — owner/client records and communication context.",
      "Patients — animal records, species filters, and patient search.",
      "Clinical — appointments, visits, medical records, visit prescriptions, and lab work.",
      "Financial — POS, invoices, ecommerce catalogue, and inventory where enabled.",
      "Reporting — analytics and (for platform admins) global reports.",
      "Admin — branches, clinic profile, invites, content tools, and notifications.",
      "Help — this documentation panel.",
    ],
  },
  {
    id: "sidebars",
    title: "Sidebars & record layout",
    body: [
      "The left sidebar lists shortcuts permitted for your role within the active primary tab. Drag the right edge to resize; use the chevron to collapse.",
      "Patient records open with a detail header and sub-tabs (Details, Clinical, Financial, etc.). Double-click or open related records from sidebars as we roll out deeper linking.",
      "Global search (top bar) jumps to patient search; module sidebars use contextual search forms.",
    ],
  },
  {
    id: "tasks-support",
    title: "Tasks, quick links & support",
    body: [
      "The task panel surfaces operational messages and background jobs.",
      "Use Help for internal documentation. For product support, contact your clinic administrator or platform operator.",
    ],
  },
];

function matchesQuery(section: (typeof SECTIONS)[0], q: string) {
  if (!q) return true;
  const blob = `${section.title} ${section.body.join(" ")}`.toLowerCase();
  return blob.includes(q.toLowerCase());
}

export default async function HelpPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const access = await getUserAccess();
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  const q = (searchParams.q ?? "").trim();
  const visible = SECTIONS.filter((s) => matchesQuery(s, q));

  return (
    <AppShell
      title="Help & documentation"
      subtitle="In-product guide to the veterinary workspace."
      activeHref="/help"
      navGroups={navGroups}
      topRight={
        <Link className="btn-secondary text-sm" href="/dashboard">
          Dashboard
        </Link>
      }
    >
      <section className="card-soft mb-6">
        <form method="get" className="flex flex-wrap gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search help topics…"
            className="input-soft min-w-[200px] flex-1"
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>
      </section>

      <div className="space-y-4">
        {visible.map((section) => (
          <article key={section.id} id={section.id} className="card-soft scroll-mt-24">
            <h2 className="font-headline text-lg font-bold text-on-background">{section.title}</h2>
            <div className="mt-3 space-y-2 text-sm text-on-surface-variant">
              {section.body.map((p, i) => (
                <p key={`${section.id}-${i}`}>{p}</p>
              ))}
            </div>
          </article>
        ))}
        {!visible.length ? (
          <p className="text-sm text-on-surface-variant">No topics match that search.</p>
        ) : null}
      </div>

    </AppShell>
  );
}
