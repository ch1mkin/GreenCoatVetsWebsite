import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups, type AppRole } from "@/lib/auth/permissions";
import { AppShell } from "@/components/web/app-shell";
import { createClient } from "@/lib/supabase/server";
import { saveOnlineConsultSettings } from "./actions";

export default async function OnlineConsultSettingsPage() {
  const membership = await getActiveMembership();
  const access = await getUserAccess();
  const supabase = createClient();
  const { data: settings } = await supabase
    .from("clinic_online_consult_settings")
    .select("*")
    .eq("clinic_id", membership.clinic_id)
    .maybeSingle();

  const nav = getRoleNavGroups(membership.role as AppRole, access.isSuperAdmin);
  const priceInr = settings?.price_paise != null ? (settings.price_paise / 100).toFixed(0) : "999";

  return (
    <AppShell navGroups={nav} title="Senior Vet online consultation">
      <p className="mb-6 max-w-2xl text-sm text-on-surface-variant">
        Owners book and pay on the public website, sign consent, and join a Meet-style video room on your clinic site. Calls are limited to the duration below.
      </p>

      <form action={saveOnlineConsultSettings} className="max-w-xl space-y-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="enabled" defaultChecked={settings?.enabled ?? false} className="h-4 w-4" />
          Enable Senior Vet online booking
        </label>
        <label className="block text-sm">
          Product name (shown at checkout)
          <input name="product_name" defaultValue={settings?.product_name ?? "Senior Vet consultation"} className="mt-1 w-full rounded-lg border px-3 py-2" required />
        </label>
        <label className="block text-sm">
          Price (INR)
          <input name="price_inr" type="number" min={0} step={1} defaultValue={priceInr} className="mt-1 w-full rounded-lg border px-3 py-2" required />
        </label>
        <label className="block text-sm">
          Consultation duration (minutes)
          <input name="duration_minutes" type="number" min={5} max={60} defaultValue={settings?.duration_minutes ?? 10} className="mt-1 w-full rounded-lg border px-3 py-2" />
        </label>
        <label className="block text-sm">
          Email reminder (minutes before start)
          <input
            name="reminder_minutes_before"
            type="number"
            min={5}
            max={120}
            defaultValue={settings?.reminder_minutes_before ?? 20}
            className="mt-1 w-full rounded-lg border px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-on-primary">
          Save settings
        </button>
      </form>
    </AppShell>
  );
}
