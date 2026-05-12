"use client";

import { FormEvent, useState, useTransition } from "react";
import { sendNotificationTestEmailAction } from "@/app/(portal)/notifications-center/actions";

export function NotificationTestEmailCard({
  defaultRecipient,
  fromAddress,
}: {
  defaultRecipient?: string | null;
  fromAddress?: string | null;
}) {
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipient?.trim() ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("recipient_email", recipientEmail.trim());
      const result = await sendNotificationTestEmailAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(`Test email sent to ${result.sentTo} from ${result.from}.`);
    });
  }

  return (
    <div className="rounded-3xl border border-outline-variant/20 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed text-primary">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            mark_email_read
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-headline text-xl font-bold text-on-background">SMTP test email</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            Send a real email through the configured Hostinger mailbox to confirm delivery is working.
          </p>
          <p className="mt-2 text-xs font-medium text-on-surface-variant">
            From: <span className="font-semibold text-primary">{fromAddress?.trim() || "Not configured"}</span>
          </p>
        </div>
      </div>

      <form className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={handleSubmit}>
        <label className="flex-1">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-on-surface-variant">Recipient email</span>
          <input
            type="email"
            required
            value={recipientEmail}
            onChange={(event) => setRecipientEmail(event.target.value)}
            className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-background outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="owner@example.com"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden />
              Sending...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[18px]">send</span>
              Send test email
            </>
          )}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm font-medium text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
    </div>
  );
}
