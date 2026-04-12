"use client";

import { useFormStatus } from "react-dom";

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  /** When true, submit is disabled even when not pending (e.g. missing prerequisites). */
  disabled?: boolean;
  /** Associate with a form elsewhere on the page (HTML5 `form` attribute). */
  form?: string;
};

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingLabel = "Saving…",
  disabled = false,
  form,
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      form={form}
      disabled={pending || disabled}
      className={`inline-flex items-center justify-center gap-2 ${className}`}
    >
      {pending ? (
        <>
          <span
            className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
            aria-hidden
          />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
