import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/web/app-shell";
import { getUserAccess } from "@/lib/auth/get-user-access";
import { getRoleNavGroups } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { clearClinicPrescriptionTemplate, updateClinicPrescriptionTemplate } from "../actions";

export default async function PrescriptionTemplatePage() {
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
    .select("name, prescription_template_url, prescription_template_updated_at")
    .eq("id", access.membership.clinic_id)
    .maybeSingle();

  return (
    <AppShell
      title="Handwritten Prescription Template"
      subtitle="Upload the sheet doctors trace on when they choose the handwritten prescription workspace."
      activeHref="/clinic-profile/prescription-template"
      navGroups={navGroups}
      topRight={
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary text-sm" href="/clinic-profile">
            Clinic profile
          </Link>
          <Link className="btn-primary text-sm" href="/medicines">
            Medicine catalog
          </Link>
        </div>
      }
    >
      <section className="mx-auto max-w-4xl space-y-5">
        <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="font-headline text-lg font-bold text-on-background">{clinic?.name ?? "Clinic"} template</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Upload a clean prescription sheet image with empty fields. Doctors can then write over it using mouse or stylus,
            and the saved sheet becomes a PDF record for the pet.
          </p>
          <div className="mt-4 rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            Best results: portrait PNG/JPG, light background, dark printed lines, and a full-page sheet at roughly A4 ratio.
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
            <form action={updateClinicPrescriptionTemplate} encType="multipart/form-data">
              <h3 className="font-headline text-base font-bold text-on-background">Upload / replace image</h3>
              <p className="mt-1 text-sm text-on-surface-variant">PNG, JPG, or WebP only.</p>
              <label className="mt-4 block text-sm font-medium text-on-surface-variant">
                Template image
                <input
                  className="input-soft mt-2 w-full cursor-pointer text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary"
                  type="file"
                  name="template_image"
                  accept="image/png,image/jpeg,image/webp"
                  required
                />
              </label>
              <button className="btn-primary mt-4" type="submit">
                Upload template
              </button>
            </form>
            {clinic?.prescription_template_url ? (
              <form action={clearClinicPrescriptionTemplate} className="mt-3">
                <button className="btn-secondary text-sm" type="submit">
                  Use built-in blank sheet instead
                </button>
              </form>
            ) : null}
          </div>

          <div className="rounded-3xl border border-outline-variant/15 bg-surface-container-lowest p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-headline text-base font-bold text-on-background">Preview</h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  {clinic?.prescription_template_url
                    ? "Current clinic image used as the handwriting background."
                    : "No uploaded image yet. Doctors will see the built-in blank prescription layout."}
                </p>
              </div>
              <p className="text-xs text-on-surface-variant">
                {clinic?.prescription_template_updated_at
                  ? `Updated ${new Date(clinic.prescription_template_updated_at).toLocaleString()}`
                  : "Never uploaded"}
              </p>
            </div>
            {clinic?.prescription_template_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clinic.prescription_template_url}
                alt="Prescription template"
                className="mt-4 w-full rounded-2xl border border-outline-variant/15 bg-white object-contain shadow-sm"
              />
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-outline-variant/30 bg-white px-6 py-16 text-center text-sm text-on-surface-variant">
                Built-in blank handwritten sheet will be used until an image is uploaded here.
              </div>
            )}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
