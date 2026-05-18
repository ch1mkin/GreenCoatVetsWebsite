import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminChangePasswordForm } from "./change-password-form";
import { requireAdminSession } from "@/lib/admin/session";
import { userMustChangePassword } from "@/lib/admin/must-change-password";

export default async function AdminChangePasswordPage({
  searchParams = {},
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { user, ctx } = await requireAdminSession({ allowPasswordChange: true });
  const errorMessage = typeof searchParams.error === "string" ? searchParams.error : null;

  if (!userMustChangePassword(user)) {
    redirect(ctx.role === "super_admin" ? "/admin" : "/admin/settings");
  }

  return (
    <div className="admin-login-root admin-login-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="admin-login-blob admin-login-blob-1 left-[-10%] top-[10%] h-[min(80vw,520px)] w-[min(80vw,520px)] bg-emerald-500/40" aria-hidden />
      </div>
      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
        <Link
          href="/admin/login"
          className="mb-6 inline-flex w-fit items-center gap-2 text-sm font-medium text-white/80 hover:text-white"
        >
          ← Back to sign in
        </Link>
        {errorMessage ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage}</p>
        ) : null}
        <AdminChangePasswordForm email={user.email ?? "your account"} />
        <p className="mt-4 text-center text-xs text-white/70">Need help? Contact your clinic administrator.</p>
      </div>
    </div>
  );
}
