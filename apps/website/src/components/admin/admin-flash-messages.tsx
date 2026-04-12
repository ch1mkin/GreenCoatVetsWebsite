type Props = {
  saved?: boolean;
  deleted?: boolean;
  error?: string | null;
};

export function AdminFlashMessages({ saved, deleted, error }: Props) {
  if (!saved && !deleted && !error) return null;
  return (
    <div className="space-y-3">
      {saved ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 shadow-sm"
        >
          <span className="material-symbols-outlined shrink-0 text-emerald-600">check_circle</span>
          <div>
            <p className="font-headline font-bold">Saved successfully</p>
            <p className="mt-0.5 text-emerald-800/90">Your changes are live on the marketing site.</p>
          </div>
        </div>
      ) : null}
      {deleted ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
        >
          <span className="material-symbols-outlined shrink-0 text-amber-700">delete_sweep</span>
          <div>
            <p className="font-headline font-bold">Deleted</p>
            <p className="mt-0.5 text-amber-900/90">The item was removed.</p>
          </div>
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-sm"
        >
          <span className="material-symbols-outlined shrink-0 text-red-600">error</span>
          <div>
            <p className="font-headline font-bold">Could not save</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words">{error}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
