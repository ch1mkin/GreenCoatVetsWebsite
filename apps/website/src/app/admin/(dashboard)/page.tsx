import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";

export default async function AdminHomePage() {
  const ctx = await requireAdmin();
  if (ctx.role === "marketing_editor") redirect("/admin/blog");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Configure which clinic this site uses when the domain doesn’t match a clinic, replace marketing images, footer social links, and
          public branch locations.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <Link
            href="/admin/settings"
            className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-headline text-lg font-bold text-primary">Site &amp; clinic</h2>
            <p className="mt-2 text-sm text-slate-600">Default clinic for this deployment, image URLs, social links.</p>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/locations"
            className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-headline text-lg font-bold text-primary">Locations</h2>
            <p className="mt-2 text-sm text-slate-600">Add, edit, or hide branches on the public locations page.</p>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/traffic"
            className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-headline text-lg font-bold text-primary">Traffic</h2>
            <p className="mt-2 text-sm text-slate-600">Anonymous page views on this marketing site (paths only).</p>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/blog"
            className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-headline text-lg font-bold text-primary">Blog</h2>
            <p className="mt-2 text-sm text-slate-600">Publish articles, AI-assisted or hand-written.</p>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/ai-prompts"
            className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-headline text-lg font-bold text-primary">Instagram AI prompts</h2>
            <p className="mt-2 text-sm text-slate-600">
              Generate trending post angles plus a Gemini-ready 2D illustration prompt for marketing creatives.
            </p>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/faqs"
            className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-headline text-lg font-bold text-primary">FAQs</h2>
            <p className="mt-2 text-sm text-slate-600">Create, edit, reorder, or hide frequently asked questions.</p>
          </Link>
        </li>
        <li>
          <Link
            href="/admin/reviews"
            className="block rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-headline text-lg font-bold text-primary">Reviews</h2>
            <p className="mt-2 text-sm text-slate-600">Manage custom owner reviews with stars, pet names, and profile images.</p>
          </Link>
        </li>
      </ul>
      <p className="text-xs text-slate-500">
        Super admins manage site settings; <strong>marketing editors</strong> can sign in to manage blog posts only.
      </p>
    </div>
  );
}
