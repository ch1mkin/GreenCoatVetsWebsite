"use client";

import { useFormStatus } from "react-dom";
import { deleteBlogPost } from "@/app/admin/(dashboard)/blog/actions";

function DeleteBlogSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <>
      {pending ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-6 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-5 shadow-2xl">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />
            <div>
              <p className="font-headline text-sm font-bold text-slate-900">Deleting post</p>
              <p className="text-sm text-slate-600">Please wait…</p>
            </div>
          </div>
        </div>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-800/30 border-t-red-800" aria-hidden />
            Deleting…
          </span>
        ) : (
          "Delete post"
        )}
      </button>
    </>
  );
}

export function DeleteBlogPostForm({ postId }: { postId: string }) {
  return (
    <form
      action={deleteBlogPost}
      className="border-t border-slate-200 pt-8"
      onSubmit={(event) => {
        if (!confirm("Delete this blog post permanently? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={postId} />
      <DeleteBlogSubmitButton />
    </form>
  );
}
