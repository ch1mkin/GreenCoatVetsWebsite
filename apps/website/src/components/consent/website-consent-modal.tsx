"use client";

import { DATA_SHARING_CONSENT_KEY, DATA_SHARING_CONSENT_VERSION } from "@saasclinics/lib";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * For logged-in visitors on the marketing site: same consent row as the staff portal (user_consents).
 */
export function WebsiteConsentModal() {
  const [userId, setUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setUserId(null);
        setOpen(false);
        return;
      }
      setUserId(user.id);
      const { data } = await supabase
        .from("user_consents")
        .select("id")
        .eq("user_id", user.id)
        .eq("consent_key", DATA_SHARING_CONSENT_KEY)
        .maybeSingle();
      setOpen(!data);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) {
        setUserId(null);
        setOpen(false);
        return;
      }
      setUserId(session.user.id);
      void (async () => {
        const { data } = await supabase
          .from("user_consents")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("consent_key", DATA_SHARING_CONSENT_KEY)
          .maybeSingle();
        setOpen(!data);
      })();
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!userId || !open) return null;

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { error: upErr } = await supabase.from("user_consents").upsert(
        {
          user_id: userId,
          consent_key: DATA_SHARING_CONSENT_KEY,
          consent_version: DATA_SHARING_CONSENT_VERSION,
          accepted_at: new Date().toISOString(),
        },
        { onConflict: "user_id,consent_key" }
      );
      if (upErr) {
        setError(upErr.message);
        return;
      }
      setOpen(false);
    });
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-consent-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h2 id="site-consent-title" className="font-semibold text-lg text-slate-900">
          Before you continue
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          You are using this site voluntarily. Information you provide (including for orders and appointments) is
          processed for veterinary care and clinic operations. By continuing you acknowledge that you share this
          information willingly, as described in your clinic&apos;s policies.
        </p>
        {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p> : null}
        <button
          type="button"
          className="mt-5 w-full rounded-md bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60 sm:w-auto"
          disabled={pending}
          onClick={submit}
        >
          {pending ? "Saving…" : "I understand and agree"}
        </button>
      </div>
    </div>
  );
}
