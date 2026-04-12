import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { getPublicStaffForClinic } from "@/lib/clinic/public-staff";
import { clinicMetadata } from "@/lib/seo/clinic-metadata";

const ROLE_LABEL: Record<string, string> = {
  doctor: "Veterinarian",
  lab_technician: "Laboratory",
  pharmacist: "Pharmacy",
};

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return clinicMetadata({
    clinicName: clinic.name,
    title: `${clinic.name} Team`,
    description: `Meet the veterinary team at ${clinic.name}.`,
    path: "/team",
  });
}

export default async function TeamPage() {
  const clinic = await resolveClinic();
  const staff = await getPublicStaffForClinic(clinic.id);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 bg-surface px-6 py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-headline text-4xl font-extrabold text-on-surface">Clinical team</h1>
        <Link className="text-sm font-semibold text-primary underline" href="/doctors">
          Doctors only
        </Link>
      </div>
      <p className="text-on-surface-variant">
        Team bios and photos are updated by staff through the clinic mobile app.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {staff.map((member) => (
          <article
            className="clinical-shadow rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6"
            key={`${member.role}-${member.id}`}
          >
            <div className="flex gap-4">
              {member.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.photo_url}
                  alt=""
                  className="h-24 w-24 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
                  Photo
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {ROLE_LABEL[member.role] ?? member.role}
                </p>
                <h2 className="text-lg font-medium">{member.full_name}</h2>
                <p className="text-sm text-muted-foreground">{member.specialization ?? "—"}</p>
                <p className="text-sm text-muted-foreground">
                  Experience: {member.experience_years ?? 0} years · {member.branch_name ?? "—"}
                </p>
                <p className="mt-2 text-sm">{member.bio ?? ""}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!staff.length ? <p className="text-on-surface-variant">No team members listed yet.</p> : null}
    </main>
  );
}
