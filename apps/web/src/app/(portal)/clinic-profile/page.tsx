import { redirect } from "next/navigation";
import { AppShell } from "@/components/web/app-shell";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { SubmitButton } from "@/components/web/submit-button";
import { updateClinicBranchWebLicenseSettings, updateClinicProfileImage } from "./actions";

export default async function ClinicProfilePage() {
  const access = await getUserAccess();
  if (!access.membership) redirect("/dashboard");
  if (access.membership.role !== "clinic_admin") redirect("/dashboard");

  const role = access.membership.role as
    | "super_admin"
    | "clinic_admin"
    | "branch_admin"
    | "doctor"
    | "receptionist"
    | "lab_technician"
    | "pharmacist"
    | "pet_owner";
  const navGroups = getRoleNavGroups(role, access.isSuperAdmin);

  const supabase = createClient();
  const { data: clinic } = await supabase
    .from("clinics")
    .select("id, name, slug, image_url, branch_web_license_price_paise, branch_web_license_period_days")
    .eq("id", access.membership.clinic_id)
    .maybeSingle();

  return (
    <AppShell
      title="Clinic Profile"
      subtitle="Update clinic branding image used in onboarding"
      activeHref="/clinic-profile"
      navGroups={navGroups}
    >
      <section className="max-w-2xl rounded-3xl border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-sm">
        <h2 className="font-headline text-lg font-bold text-on-background">Branding</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Clinic name and slug are managed in platform settings.</p>
        <p className="mt-4 font-headline text-xl font-bold text-primary">{clinic?.name ?? ""}</p>
        <p className="text-xs font-mono text-on-surface-variant">/{clinic?.slug ?? ""}</p>
        {clinic?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="mt-6 h-52 w-full rounded-2xl border border-outline-variant/15 object-cover shadow-inner"
            src={clinic.image_url}
            alt={clinic.name ?? "Clinic"}
          />
        ) : (
          <div className="mt-6 flex h-40 items-center justify-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low text-sm text-on-surface-variant">
            No hero image yet
          </div>
        )}

        <p className="mt-4 text-sm text-on-surface-variant">
          <a className="font-semibold text-primary underline" href="/clinic-profile/invoice-template">
            Invoice PDF template
          </a>{" "}
          — reorder sections and footer for reception invoices.
        </p>

        <section className="mt-10 border-t border-outline-variant/15 pt-8">
          <h2 className="font-headline text-lg font-bold text-on-background">Branch web portal pricing</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Optional overrides for what branch admins pay for web portal access. Leave a field blank to use the
            platform default from Payments (super admin).
          </p>
          <form action={updateClinicBranchWebLicenseSettings} className="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <label className="text-xs font-bold uppercase text-on-surface-variant" htmlFor="bw_price">
                Price (INR)
              </label>
              <input
                id="bw_price"
                className="input-soft mt-1 w-full"
                name="branch_web_license_price_inr"
                type="number"
                min={1}
                step={1}
                placeholder="Platform default"
                defaultValue={
                  clinic?.branch_web_license_price_paise != null
                    ? Math.round(clinic.branch_web_license_price_paise / 100)
                    : ""
                }
              />
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-bold uppercase text-on-surface-variant" htmlFor="bw_days">
                Term (days)
              </label>
              <input
                id="bw_days"
                className="input-soft mt-1 w-full"
                name="branch_web_license_period_days"
                type="number"
                min={1}
                step={1}
                placeholder="Platform default"
                defaultValue={clinic?.branch_web_license_period_days ?? ""}
              />
            </div>
            <div className="sm:col-span-2">
              <SubmitButton className="btn-primary w-fit">Save license pricing</SubmitButton>
            </div>
          </form>
        </section>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end"
          action={updateClinicProfileImage}
          encType="multipart/form-data"
        >
          <label className="flex-1 text-sm font-medium text-on-surface-variant">
            Replace image
            <input
              className="input-soft mt-2 w-full cursor-pointer text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
              name="clinic_image"
              type="file"
              accept="image/*"
              required
            />
          </label>
          <button className="btn-primary shrink-0 rounded-xl px-6 py-3" type="submit">
            Upload
          </button>
        </form>
      </section>
    </AppShell>
  );
}
