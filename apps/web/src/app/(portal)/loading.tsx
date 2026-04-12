import { FullPagePawLoading } from "@/components/web/full-page-paw-loading";

/** Applies to all routes under `(portal)` when the segment is pending (e.g. Dashboard → Branches). */
export default function PortalLoading() {
  return <FullPagePawLoading />;
}
