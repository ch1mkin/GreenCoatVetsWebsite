import { PawCircularLoader } from "@/components/web/paw-circular-loader";

/** Full-viewport loader for Next.js `loading.tsx` route segments. */
export function FullPagePawLoading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-6">
      <PawCircularLoader size="lg" message="Loading page…" />
    </div>
  );
}
