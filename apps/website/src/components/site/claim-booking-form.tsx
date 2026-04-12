"use client";

import { useFormState, useFormStatus } from "react-dom";
import { claimGuestBookingWithToken } from "@/app/book/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-primary px-5 py-2.5 font-headline text-sm font-bold text-on-primary disabled:opacity-60"
    >
      {pending ? "Linking…" : "Link booking"}
    </button>
  );
}

export function ClaimBookingForm() {
  const [state, formAction] = useFormState(claimGuestBookingWithToken, {});

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <div>
        <label htmlFor="merge_token" className="text-xs font-bold uppercase text-on-surface-variant">
          Booking code
        </label>
        <input
          id="merge_token"
          name="merge_token"
          type="text"
          placeholder="Paste code from confirmation email / page"
          className="mt-1 w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-on-surface"
          autoComplete="off"
        />
      </div>
      {state?.error ? <p className="text-sm font-medium text-red-700">{state.error}</p> : null}
      <SubmitButton />
    </form>
  );
}
