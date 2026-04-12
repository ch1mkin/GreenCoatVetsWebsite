import { updateMarketingSettings } from "@/app/admin/(dashboard)/actions";
import { AdminFlashMessages } from "@/components/admin/admin-flash-messages";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";
import { MarketingImageFields } from "@/components/admin/marketing-image-fields";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_HOMEPAGE_COPY, DEFAULT_HOMEPAGE_IMAGES, type HomepageImageKey } from "@/lib/marketing/defaults";
import { getMarketingSiteSettings, mergeHomepageImages } from "@/lib/marketing/get-marketing-site";

const IMG_LABELS: Record<HomepageImageKey, string> = {
  hero: "Hero (homepage)",
  mission_a: "Mission section image A",
  mission_b: "Mission section image B",
  surgery: "Surgery / bento section",
  map_hero: "Locations map strip",
  facility_surgery: "Locations — surgery card",
  facility_calm: "Locations — calm card",
  facility_lab: "Locations — lab card",
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireSuperAdmin();
  const saved = searchParams.saved === "1" || searchParams.saved === "true";
  const errorParam = searchParams.error;
  const errorMessage = typeof errorParam === "string" ? errorParam : null;

  const supabase = createClient();
  const { data: clinics } = await supabase.from("clinics").select("id, name, slug").eq("is_active", true).order("name");

  const settings = await getMarketingSiteSettings();
  const merged = mergeHomepageImages(settings.homepage_images);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-headline text-3xl font-bold">Site &amp; clinic</h1>
        <p className="mt-2 text-slate-600">
          Set which clinic this website is <strong>branded for</strong> and the fallback clinic when no subdomain / custom domain matches. Image URLs
          override the built‑in GreenCoatVets placeholders.
        </p>
      </div>

      <AdminFlashMessages saved={saved} error={errorMessage} />

      <form action={updateMarketingSettings} className="space-y-10">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Website branding &amp; fallback clinic</h2>
          <p className="mt-1 text-sm text-slate-600">
            When the request <strong>doesn’t</strong> match a clinic <code className="rounded bg-slate-100 px-1">subdomain</code> or{" "}
            <code className="rounded bg-slate-100 px-1">custom_domain</code>, the site resolves the clinic in this order:{" "}
            <strong>Website branded for</strong> → <strong>Default clinic</strong> → first active clinic.
          </p>
          <div className="mt-6 space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="website_branded_for_clinic_id">
                Website branded for
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Primary clinic this deployment represents (name in copy, <code className="rounded bg-slate-50 px-1">resolveClinic()</code>, pet-owner
                signup target when no host match). Optional.
              </p>
              <select
                id="website_branded_for_clinic_id"
                name="website_branded_for_clinic_id"
                defaultValue={settings.website_branded_for_clinic_id ?? ""}
                className="mt-2 w-full max-w-lg rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              >
                <option value="">— Not set (use default clinic below) —</option>
                {(clinics ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="default_clinic_id">
                Default clinic (fallback)
              </label>
              <p className="mt-1 text-xs text-slate-500">
                Used when <strong>Website branded for</strong> is empty and there is no host match.
              </p>
              <select
                id="default_clinic_id"
                name="default_clinic_id"
                defaultValue={settings.default_clinic_id ?? ""}
                className="mt-2 w-full max-w-lg rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              >
                <option value="">— None (use first active clinic) —</option>
                {(clinics ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.slug})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Contact form notifications</h2>
          <p className="mt-1 text-sm text-slate-600">
            Public <code className="rounded bg-slate-100 px-1">/contact</code> submissions are emailed to this address when{" "}
            <strong>Hostinger SMTP</strong> env vars are set on the server (same as the staff portal). If empty, the app falls back to the resolved
            clinic&apos;s <code className="rounded bg-slate-50 px-1">support_email</code>.
          </p>
          <div className="mt-6 max-w-xl">
            <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="contact_form_recipient_email">
              Inbox (super admin)
            </label>
            <input
              id="contact_form_recipient_email"
              name="contact_form_recipient_email"
              type="email"
              autoComplete="email"
              defaultValue={settings.contact_form_recipient_email ?? ""}
              placeholder="you@yourclinic.com"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Homepage headline &amp; header phone</h2>
          <p className="mt-1 text-sm text-slate-600">
            Edits the <strong>hero text</strong> on the public home page and the <strong>Call now</strong> chip in the site header (every page).
            Leave a field empty to use the built‑in default for that line.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="copy_hero_line1">
                Hero — first line
              </label>
              <p className="mt-0.5 text-xs text-slate-500">Default: &ldquo;{DEFAULT_HOMEPAGE_COPY.hero_line1}&rdquo;</p>
              <input
                id="copy_hero_line1"
                name="copy_hero_line1"
                type="text"
                defaultValue={settings.homepage_copy.hero_line1 ?? ""}
                placeholder={DEFAULT_HOMEPAGE_COPY.hero_line1}
                className="mt-2 w-full max-w-xl rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="copy_hero_gradient">
                Hero — accent line (gradient)
              </label>
              <p className="mt-0.5 text-xs text-slate-500">Default: &ldquo;{DEFAULT_HOMEPAGE_COPY.hero_gradient}&rdquo;</p>
              <input
                id="copy_hero_gradient"
                name="copy_hero_gradient"
                type="text"
                defaultValue={settings.homepage_copy.hero_gradient ?? ""}
                placeholder={DEFAULT_HOMEPAGE_COPY.hero_gradient}
                className="mt-2 w-full max-w-xl rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="copy_hero_tagline">
                Hero — supporting tagline
              </label>
              <p className="mt-0.5 text-xs text-slate-500">Short paragraph under the headline.</p>
              <textarea
                id="copy_hero_tagline"
                name="copy_hero_tagline"
                rows={3}
                defaultValue={settings.homepage_copy.hero_tagline ?? ""}
                placeholder={DEFAULT_HOMEPAGE_COPY.hero_tagline}
                className="mt-2 w-full max-w-2xl rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-8">
            <h3 className="font-headline text-base font-bold text-slate-800">Header &ldquo;Call now&rdquo; button</h3>
            <p className="mt-1 text-sm text-slate-600">
              Shown in the top navigation on the marketing site. Both fields are required for the button to appear.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="copy_navbar_call_display">
                  Number as shown (label)
                </label>
                <input
                  id="copy_navbar_call_display"
                  name="copy_navbar_call_display"
                  type="text"
                  defaultValue={settings.homepage_copy.navbar_call_display ?? ""}
                  placeholder="+91 98765 43210"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="copy_navbar_call_tel_href">
                  Tel link (href)
                </label>
                <p className="mt-0.5 text-xs text-slate-500">Use international format, e.g. tel:+919876543210</p>
                <input
                  id="copy_navbar_call_tel_href"
                  name="copy_navbar_call_tel_href"
                  type="text"
                  defaultValue={settings.homepage_copy.navbar_call_tel_href ?? ""}
                  placeholder="tel:+919876543210"
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm text-slate-900"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Homepage &amp; locations images</h2>
          <p className="mt-1 text-sm text-slate-600">
            Paste full HTTPS URLs — live preview updates as you type. Leave empty to keep the built‑in default for each slot.
          </p>
          <div className="mt-6">
            <MarketingImageFields
              fields={(Object.keys(DEFAULT_HOMEPAGE_IMAGES) as HomepageImageKey[]).map((key) => ({
                key,
                label: IMG_LABELS[key],
                defaultValue: settings.homepage_images[key] ?? "",
                fallbackUrl: merged[key],
              }))}
            />
            <div className="mt-10 border-t border-slate-200 pt-8">
              <h3 className="font-headline text-base font-bold text-slate-800">Hero image carousel (optional)</h3>
              <p className="mt-1 text-sm text-slate-600">
                The main <strong>Hero</strong> image is always slide 1. Add up to two more HTTPS URLs to rotate in the homepage hero (same aspect ratio
                recommended).
              </p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="img_hero_slide_2">
                    Hero slide 2 URL
                  </label>
                  <input
                    id="img_hero_slide_2"
                    name="img_hero_slide_2"
                    type="url"
                    defaultValue={settings.homepage_images.hero_slide_2 ?? ""}
                    placeholder="Optional — full HTTPS URL"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="img_hero_slide_3">
                    Hero slide 3 URL
                  </label>
                  <input
                    id="img_hero_slide_3"
                    name="img_hero_slide_3"
                    type="url"
                    defaultValue={settings.homepage_images.hero_slide_3 ?? ""}
                    placeholder="Optional — full HTTPS URL"
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Instagram — homepage reels &amp; posts</h2>
          <p className="mt-1 text-sm text-slate-600">
            Paste one <strong>public</strong> Instagram post or reel URL per line (copy from the browser or Share → Copy link). After you save, the
            marketing home page shows embedded players — no Instagram login needed for visitors. Invalid lines are skipped. Use Chrome or Safari for
            best results when embedding.
          </p>
          <div className="mt-4 max-w-3xl">
            <label className="block text-xs font-bold uppercase text-slate-500" htmlFor="instagram_embed_urls">
              Post / reel URLs
            </label>
            <textarea
              id="instagram_embed_urls"
              name="instagram_embed_urls"
              rows={8}
              defaultValue={settings.instagram_embed_urls.join("\n")}
              placeholder="https://www.instagram.com/reel/AbCdEfGh123/&#10;https://www.instagram.com/p/XyZaBcDe456/"
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 font-mono text-sm text-slate-900"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-primary">Footer social links</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {(
              [
                ["social_website_url", "website_url", "Website"],
                ["social_instagram_url", "instagram_url", "Instagram"],
                ["social_facebook_url", "facebook_url", "Facebook"],
                ["social_youtube_url", "youtube_url", "YouTube"],
                ["social_linkedin_url", "linkedin_url", "LinkedIn"],
              ] as const
            ).map(([fieldName, key, label]) => (
              <div key={fieldName}>
                <label className="block text-xs font-bold text-slate-600" htmlFor={fieldName}>
                  {label}
                </label>
                <input
                  id={fieldName}
                  name={fieldName}
                  type="url"
                  defaultValue={settings.social_links[key] ?? ""}
                  placeholder="https://"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        </section>

        <AdminSubmitButton
          pendingLabel="Saving settings…"
          className="gradient-primary min-w-[200px] rounded-xl px-8 py-3 font-headline font-bold text-on-primary shadow-lg disabled:cursor-not-allowed disabled:opacity-80"
        >
          Save changes
        </AdminSubmitButton>
      </form>
    </div>
  );
}
