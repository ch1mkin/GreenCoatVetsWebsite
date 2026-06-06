import Link from "next/link";
import type { FooterNavGroup } from "@/lib/marketing/footer-nav";
import type { SocialLinks } from "@/lib/marketing/defaults";

const linkClass =
  "font-body text-sm text-slate-500 transition-all hover:text-teal-600 hover:underline dark:text-slate-400";

function FooterNavItem({
  href,
  label,
  openInNewTab,
}: {
  href: string;
  label: string;
  openInNewTab: boolean;
}) {
  const external = /^https?:\/\//i.test(href.trim());
  if (external) {
    return (
      <a
        href={href.trim()}
        className={linkClass}
        {...(openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {label}
      </a>
    );
  }
  return (
    <Link className={linkClass} href={href.trim()}>
      {label}
    </Link>
  );
}

export function SiteFooter({
  className,
  clinicName,
  productName,
  socialLinks = {},
  footerNav = [],
}: {
  className?: string;
  clinicName: string;
  productName: string;
  socialLinks?: SocialLinks;
  footerNav?: FooterNavGroup[];
}) {
  const year = new Date().getFullYear();
  const {
    instagram_url: instagramUrl,
    facebook_url: facebookUrl,
    youtube_url: youtubeUrl,
    linkedin_url: linkedinUrl,
    website_url: websiteUrl,
  } = socialLinks;

  return (
    <footer className={`w-full bg-slate-100 pb-8 pt-16 dark:bg-slate-950 ${className ?? ""}`}>
      <div className="mx-auto flex max-w-7xl flex-col gap-12 px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm shrink-0 lg:max-w-xs">
          <span className="mb-4 block font-headline text-xl font-bold text-slate-900 dark:text-slate-100">{productName}</span>
          <p className="font-body text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Clinical sanctuary for {clinicName}. Compassionate veterinary care with modern standards.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            {websiteUrl ? (
              <a
                className="text-slate-400 transition-colors hover:text-primary"
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Website"
              >
                <span className="material-symbols-outlined text-xl">public</span>
              </a>
            ) : null}
            {instagramUrl ? (
              <a
                className="text-slate-400 transition-colors hover:text-primary"
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <span className="material-symbols-outlined text-xl">photo_camera</span>
              </a>
            ) : null}
            {facebookUrl ? (
              <a
                className="text-slate-400 transition-colors hover:text-primary"
                href={facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
              >
                <span className="material-symbols-outlined text-xl">thumb_up</span>
              </a>
            ) : null}
            {youtubeUrl ? (
              <a
                className="text-slate-400 transition-colors hover:text-primary"
                href={youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="YouTube"
              >
                <span className="material-symbols-outlined text-xl">play_circle</span>
              </a>
            ) : null}
            {linkedinUrl ? (
              <a
                className="text-slate-400 transition-colors hover:text-primary"
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
              >
                <span className="material-symbols-outlined text-xl">work</span>
              </a>
            ) : null}
            <Link className="text-slate-400 transition-colors hover:text-primary" href="/contact" aria-label="Contact">
              <span className="material-symbols-outlined text-xl">chat</span>
            </Link>
          </div>
        </div>

        <div className="flex flex-1 flex-wrap gap-12 lg:justify-end">
          {footerNav.map((group) => (
            <div key={group.id} className="min-w-[140px]">
              <h4 className="mb-6 font-headline font-bold text-teal-800 dark:text-teal-300">{group.title}</h4>
              <ul className="space-y-4">
                {group.links.map((item) => (
                  <li key={item.id || `${group.slug}-${item.href}-${item.label}`}>
                    <FooterNavItem href={item.href} label={item.label} openInNewTab={item.openInNewTab} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="min-w-[140px]">
            <h4 className="mb-6 font-headline font-bold text-teal-800 dark:text-teal-300">Visit</h4>
            <p className="flex items-start gap-2 font-body text-sm text-slate-500 dark:text-slate-400">
              <span className="material-symbols-outlined shrink-0 text-base">location_on</span>
              {clinicName}
            </p>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-16 max-w-7xl border-t border-slate-200 px-6 pt-8 text-center dark:border-slate-800 md:text-left">
        <p className="font-body text-sm text-slate-500 dark:text-slate-400">
          © {year} {productName}. All rights reserved.{" "}
          <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">
            Site &amp; platform ·{" "}
            <a
              href="https://salhantech.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-slate-600 underline-offset-2 hover:text-primary hover:underline dark:text-slate-300"
            >
              @salhantech
            </a>
          </span>
        </p>
      </div>
    </footer>
  );
}
