"use client";

import { deleteFooterLink } from "@/app/admin/(dashboard)/footer/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";

export function DeleteFooterLinkForm({ id }: { id: string }) {
  return (
    <form
      action={deleteFooterLink}
      onSubmit={(e) => {
        if (!confirm("Remove this link from the footer?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <AdminSubmitButton
        pendingLabel="Removing…"
        className="text-xs font-bold text-red-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-70"
      >
        Remove
      </AdminSubmitButton>
    </form>
  );
}
