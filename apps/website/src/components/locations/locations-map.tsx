"use client";

import dynamic from "next/dynamic";

export const LocationsMap = dynamic(() => import("./locations-map-inner").then((m) => m.LocationsMapInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-2xl bg-surface-container-low text-sm text-on-surface-variant">
      Loading map…
    </div>
  ),
});
