"use client";

import { deleteFooterGroup } from "@/app/admin/(dashboard)/footer/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";

export function DeleteFooterGroupForm({ id }: { id: string }) {
  return (
    <form
      action={deleteFooterGroup}
      onSubmit={(e) => {
        if (!confirm("Delete this column and all of its links?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <AdminSubmitButton
        pendingLabel="Deleting…"
        className="text-sm font-bold text-red-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-70"
      >
        Delete column
      </AdminSubmitButton>
    </form>
  );
}
