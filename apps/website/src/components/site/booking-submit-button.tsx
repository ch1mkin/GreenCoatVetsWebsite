"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
};

export function BookingSubmitButton({
  children,
  className = "",
  pendingLabel = "Submitting your booking…",
}: Props) {
  const { pending } = useFormStatus();

  return (
    <>
      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-2xl">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
            <div>
              <p className="font-headline text-sm font-bold text-slate-900">Booking in progress</p>
              <p className="text-sm text-slate-600">{pendingLabel}</p>
            </div>
          </div>
        </div>
      ) : null}
      <button type="submit" disabled={pending} className={`inline-flex items-center justify-center gap-2 disabled:opacity-80 ${className}`}>
        {pending ? (
          <>
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-current/30 border-t-current" aria-hidden />
            <span>{pendingLabel}</span>
          </>
        ) : (
          children
        )}
      </button>
    </>
  );
}
