import Link from "next/link";
import { Suspense } from "react";
import { AdminLoginForm } from "./login-form";
import { AdminAccessGate } from "./admin-access-gate";
import { isWebsiteAdminUnlocked } from "@/lib/admin/access-code";

function LoginFallback() {
  return (
    <div className="flex min-h-[320px] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
    </div>
  );
}

export default function AdminLoginPage() {
  const unlocked = isWebsiteAdminUnlocked();
  return (
    <div className="admin-login-root admin-login-bg relative min-h-screen overflow-hidden">
      {/* Animated blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="admin-login-blob admin-login-blob-1 left-[-10%] top-[10%] h-[min(80vw,520px)] w-[min(80vw,520px)] bg-emerald-500/40"
          aria-hidden
        />
        <div
          className="admin-login-blob admin-login-blob-2 right-[-15%] top-[30%] h-[min(70vw,440px)] w-[min(70vw,440px)] bg-teal-600/35"
          aria-hidden
        />
        <div
          className="admin-login-blob bottom-[-20%] left-[20%] h-[min(60vw,380px)] w-[min(60vw,380px)] bg-cyan-500/25"
          style={{ animationDelay: "-7s" }}
          aria-hidden
        />
        <div className="admin-login-grid absolute inset-0 opacity-40" aria-hidden />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col lg:flex-row lg:items-stretch">
        {/* Left: brand / admin vibe */}
        <div className="flex flex-1 flex-col justify-center px-8 pb-8 pt-12 text-white lg:max-w-md lg:px-12 lg:pb-16 lg:pt-16 xl:max-w-lg">
          <Link
            href="/"
            className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/10"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Public website
          </Link>

          <div className="mb-2 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Restricted
          </div>

          <h2 className="mt-4 font-headline text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Marketing{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">command</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-300">
            After sign-in, open <strong className="text-slate-200">Site &amp; clinic</strong> to set the public hero copy, header phone
            number, images, and clinic targeting — all in one place.
          </p>

          <ul className="mt-10 space-y-4 text-sm text-slate-400">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                <span className="material-symbols-outlined text-primary-fixed text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  tune
                </span>
              </span>
              Site &amp; clinic — hero text, call button, branding
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                <span className="material-symbols-outlined text-primary-fixed text-xl">image</span>
              </span>
              Hero &amp; location imagery
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5">
                <span className="material-symbols-outlined text-primary-fixed text-xl">share</span>
              </span>
              Footer &amp; social URLs
            </li>
          </ul>
        </div>

        {/* Right: form */}
        <div className="flex flex-1 items-center justify-center px-4 pb-16 pt-4 lg:px-12 lg:py-16">
          {unlocked ? (
            <Suspense fallback={<LoginFallback />}>
              <AdminLoginForm />
            </Suspense>
          ) : (
            <AdminAccessGate />
          )}
        </div>
      </div>
    </div>
  );
}
