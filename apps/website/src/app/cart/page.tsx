import { redirect } from "next/navigation";
import { isWebsiteStoreEnabled } from "@/lib/store/store-availability";

/** Legacy path — cart is now a slide-over; send users to the store. */
export default async function CartRedirectPage() {
  const storeEnabled = await isWebsiteStoreEnabled();
  redirect(storeEnabled ? "/store" : "/");
}
