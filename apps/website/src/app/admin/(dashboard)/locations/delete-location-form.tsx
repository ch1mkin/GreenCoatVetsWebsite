"use client";

import { deleteMarketingLocation } from "@/app/admin/(dashboard)/actions";
import { AdminSubmitButton } from "@/components/admin/admin-submit-button";

export function DeleteLocationForm({ id }: { id: string }) {
  return (
    <form
      action={deleteMarketingLocation}
      onSubmit={(e) => {
        if (!confirm("Delete this location permanently?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <AdminSubmitButton
        pendingLabel="Deleting…"
        className="text-sm font-bold text-red-600 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-70"
      >
        Delete
      </AdminSubmitButton>
    </form>
  );
}
