"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { DATA_SHARING_CONSENT_KEY } from "@saasclinics/lib";
import { acceptDataSharingConsent } from "@/app/(portal)/consent/actions";

type ProfileGateProps = {
  profileComplete: boolean;
};

/** Redirects incomplete profiles to /complete-profile (except on that route). */
export function ProfileGateClient({ profileComplete }: ProfileGateProps) {
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (profileComplete) return;
    if (path === "/complete-profile" || path?.startsWith("/complete-profile/")) return;
    router.replace("/complete-profile");
  }, [profileComplete, path, router]);

  return null;
}

type ConsentProps = {
  initialAccepted: boolean;
};

/**
 * Blocks interaction until the user accepts the data-sharing disclaimer; persisted in user_consents.
 */
export function DataConsentModal({ initialAccepted }: ConsentProps) {
  const [open, setOpen] = useState(!initialAccepted);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOpen(!initialAccepted);
  }, [initialAccepted]);

  if (!open) return null;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      try {
        await acceptDataSharingConsent();
        setOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save consent.");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-5 shadow-xl">
        <h2 id="consent-title" className="font-headline text-lg font-bold text-on-background">
          Information &amp; consent
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          By using this application you confirm that you share personal and clinical information{" "}
          <strong>voluntarily</strong> for the purpose of veterinary care, billing, and clinic operations. You may
          withdraw consent for non-essential processing in line with clinic policy and applicable law. Continued use
          constitutes acceptance of how your clinic processes data for appointments, records, invoicing, and
          notifications.
        </p>
        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>
        ) : null}
        <p className="mt-2 text-[10px] text-on-surface-variant/80">Reference: {DATA_SHARING_CONSENT_KEY}</p>
        <button
          type="button"
          className="btn-primary mt-5 w-full sm:w-auto"
          disabled={pending}
          onClick={submit}
        >
          {pending ? "Saving…" : "I understand and agree"}
        </button>
      </div>
    </div>
  );
}
