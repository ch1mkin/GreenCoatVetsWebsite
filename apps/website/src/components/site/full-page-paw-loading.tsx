import { PawCircularLoader } from "@/components/site/paw-circular-loader";

export function FullPagePawLoading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-surface px-6">
      <PawCircularLoader size="lg" message="Loading module..." />
    </div>
  );
}
