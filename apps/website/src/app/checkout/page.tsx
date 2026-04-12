import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckoutClient } from "./checkout-client";
import { isWebsiteStoreEnabled } from "@/lib/store/store-availability";

export default async function CheckoutPage() {
  const storeEnabled = await isWebsiteStoreEnabled();
  if (!storeEnabled) redirect("/");

  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <CheckoutClient />
    </Suspense>
  );
}
