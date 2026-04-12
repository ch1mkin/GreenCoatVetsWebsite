import Link from "next/link";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-sidebar";
import { requireAdmin } from "@/lib/admin/auth";
import { signOut } from "@/app/admin/(dashboard)/actions";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin();
  const isSuper = ctx.role === "super_admin";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <AdminSidebar isSuper={isSuper} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 shadow-sm md:px-6">
            <div className="min-w-0 md:hidden">
              <span className="font-headline text-sm font-bold text-slate-900">Marketing admin</span>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 md:text-sm"
                target="_blank"
                rel="noreferrer"
              >
                View site
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 md:text-sm"
                >
                  Log out
                </button>
              </form>
            </div>
          </header>
          <AdminMobileNav isSuper={isSuper} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8 lg:px-10">{children}</main>
        </div>
      </div>
    </div>
  );
}
