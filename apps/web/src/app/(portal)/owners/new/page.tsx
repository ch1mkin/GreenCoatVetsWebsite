import Link from "next/link";
import { redirect } from "next/navigation";
import { createOwner } from "../actions";
import { getActiveMembership } from "@/lib/auth/get-active-membership";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { AppShell } from "@/components/web/app-shell";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { SubmitButton } from "@/components/web/submit-button";

export default async function NewContactPage() {
  const access = await getUserAccess();
  if (!access.membership && !access.isSuperAdmin) redirect("/dashboard");
  const role = (access.membership?.role ?? (access.isSuperAdmin ? "super_admin" : "pet_owner")) as Parameters<
    typeof getRoleNavGroups
  >[0];
  if (
    !access.isSuperAdmin &&
    !["clinic_admin", "receptionist", "doctor", "branch_admin"].includes(role)
  ) {
    redirect("/dashboard");
  }

  await getActiveMembership();
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  return (
    <AppShell
      title="New client contact"
      subtitle="Customer record — personal details, contact methods, and address."
      activeHref="/owners"
      navGroups={navGroups}
      topRight={
        <Link className="btn-secondary text-sm" href="/owners">
          Cancel
        </Link>
      }
    >
      <form action={createOwner} className="card-soft workspace-form max-w-3xl space-y-6 text-sm">
        <input type="hidden" name="contact_type" value="customer" />

        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Contact type</h2>
          <p className="mt-1 text-on-surface-variant">New records default to Customer (client).</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Personal details
          </h2>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Title</span>
            <select className="input-soft" name="title">
              <option value="">—</option>
              <option value="Mr">Mr</option>
              <option value="Mrs">Mrs</option>
              <option value="Ms">Ms</option>
              <option value="Miss">Miss</option>
              <option value="Dr">Dr</option>
            </select>
          </label>
          <div />
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">First name *</span>
            <input className="input-soft" name="first_name" required autoComplete="given-name" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Last name *</span>
            <input className="input-soft" name="last_name" required autoComplete="family-name" />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Email / phone
          </h2>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-medium text-on-background">Email</span>
            <input className="input-soft" name="email" type="email" autoComplete="email" />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-medium text-on-background">Phone *</span>
            <input className="input-soft" name="phone" required type="tel" autoComplete="tel" />
          </label>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
            Physical address
          </h2>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="font-medium text-on-background">Street address</span>
            <input className="input-soft" name="address" autoComplete="street-address" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">City</span>
            <input className="input-soft" name="city" autoComplete="address-level2" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">State / region</span>
            <input className="input-soft" name="state" autoComplete="address-level1" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Postal code</span>
            <input className="input-soft" name="postal_code" autoComplete="postal-code" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Country</span>
            <input className="input-soft" name="country" autoComplete="country-name" />
          </label>
        </section>

        <section className="space-y-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="post_mail_to_physical" defaultChecked className="rounded border-outline-variant" />
            <span>Post mail to physical address (same as postal)</span>
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <h2 className="md:col-span-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              Postal address (if different)
            </h2>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span className="font-medium text-on-background">Postal street</span>
              <input className="input-soft" name="postal_address" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-on-background">Postal city</span>
              <input className="input-soft" name="postal_city" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-on-background">Postal state</span>
              <input className="input-soft" name="postal_state" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-on-background">Postal code</span>
              <input className="input-soft" name="postal_postal_code" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-on-background">Postal country</span>
              <input className="input-soft" name="postal_country" />
            </label>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <h2 className="md:col-span-2 text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Other</h2>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Business name</span>
            <input className="input-soft" name="business_name" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium text-on-background">Website</span>
            <input className="input-soft" name="website" type="url" />
          </label>
        </section>

        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Contact notes</h2>
          <label className="mt-2 flex flex-col gap-1">
            <textarea className="input-soft min-h-[100px]" name="contact_notes" placeholder="General notes visible to staff…" />
          </label>
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" name="contact_notes_important" className="rounded border-outline-variant" />
            <span className="font-medium text-error">Notes important</span>
            <span className="text-on-surface-variant">(highlight for billing / scheduling)</span>
          </label>
        </section>

        <div className="flex flex-wrap gap-2 border-t border-outline-variant/20 pt-4">
          <SubmitButton className="btn-primary" pendingLabel="Saving…">
            Save contact
          </SubmitButton>
          <Link className="btn-secondary" href="/owners">
            Back to directory
          </Link>
        </div>
      </form>
    </AppShell>
  );
}
