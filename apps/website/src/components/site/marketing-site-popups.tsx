"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MarketingPopupRow, MarketingPopupTemplate } from "@/lib/marketing/popups";

const STORAGE_PREFIX = "saasclinics_popup_dismissed_";

function accentClass(t: MarketingPopupTemplate): string {
  switch (t) {
    case "offer":
      return "border-amber-200 bg-gradient-to-br from-amber-50 to-white";
    case "community":
      return "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white";
    case "reminder":
      return "border-sky-200 bg-gradient-to-br from-sky-50 to-white";
    case "announcement":
      return "border-primary/30 bg-gradient-to-br from-primary/10 to-white";
    default:
      return "border-slate-200 bg-white";
  }
}

function badgeLabel(t: MarketingPopupTemplate): string {
  switch (t) {
    case "offer":
      return "Offer";
    case "community":
      return "Community";
    case "reminder":
      return "Reminder";
    case "announcement":
      return "Announcement";
    default:
      return "Notice";
  }
}

export function MarketingSitePopups({ popups }: { popups: MarketingPopupRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!popups.length) return;
    const first = popups.find((p) => {
      try {
        return localStorage.getItem(STORAGE_PREFIX + p.id) !== "1";
      } catch {
        return true;
      }
    });
    if (first) setOpenId(first.id);
  }, [popups]);

  if (!popups.length || !openId) return null;

  const popup = popups.find((p) => p.id === openId);
  if (!popup) return null;

  function dismiss() {
    if (!popup) return;
    try {
      localStorage.setItem(STORAGE_PREFIX + popup.id, "1");
    } catch {
      /* ignore */
    }
    const rest = popups.filter((p) => p.id !== popup.id);
    const next = rest.find((p) => {
      try {
        return localStorage.getItem(STORAGE_PREFIX + p.id) !== "1";
      } catch {
        return true;
      }
    });
    setOpenId(next?.id ?? null);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div
        className={`relative max-h-[min(90vh,640px)] w-full max-w-lg overflow-y-auto rounded-3xl border-2 shadow-2xl ${accentClass(popup.template_type)}`}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/10 text-on-surface transition hover:bg-black/20"
          aria-label="Close"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <div className="p-6 pt-10 sm:p-8">
          <span className="inline-flex rounded-full bg-black/5 px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            {badgeLabel(popup.template_type)}
          </span>
          <h2 className="mt-4 font-headline text-2xl font-extrabold text-on-surface">{popup.title}</h2>
          {popup.image_url ? (
            <div className="relative mt-4 aspect-[16/9] w-full overflow-hidden rounded-2xl bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- admin-pasted arbitrary HTTPS URLs */}
              <img src={popup.image_url} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          {popup.body ? <p className="mt-4 whitespace-pre-wrap text-on-surface-variant leading-relaxed">{popup.body}</p> : null}
          <div className="mt-6 flex flex-wrap gap-3">
            {popup.cta_label && popup.cta_href ? (
              <Link
                href={popup.cta_href}
                className="gradient-primary inline-flex flex-1 items-center justify-center rounded-xl px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-lg min-w-[140px]"
                onClick={dismiss}
              >
                {popup.cta_label}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-outline-variant bg-white px-6 py-3 font-headline text-sm font-bold text-on-surface min-w-[120px]"
            >
              {popup.cta_label ? "Maybe later" : "Got it"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
