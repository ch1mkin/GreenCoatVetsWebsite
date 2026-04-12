import Link from "next/link";
import { notFound } from "next/navigation";
import { clinicMetadata } from "@/lib/seo/clinic-metadata";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const clinic = await resolveClinic();
  const supabase = createClient();
  const { data: service } = await supabase
    .from("services")
    .select("title, short_description")
    .eq("clinic_id", clinic.id)
    .eq("slug", params.slug)
    .eq("is_active", true)
    .maybeSingle();

  return clinicMetadata({
    clinicName: clinic.name,
    title: service ? `${service.title} | ${clinic.name}` : `${clinic.name} Service`,
    description: service?.short_description ?? `Service details for ${clinic.name}.`,
    path: `/services/${params.slug}`,
  });
}

export default async function ServiceDetailsPage({ params }: { params: { slug: string } }) {
  const clinic = await resolveClinic();
  const supabase = createClient();
  const { data: service, error } = await supabase
    .from("services")
    .select("id, title, short_description, description")
    .eq("clinic_id", clinic.id)
    .eq("slug", params.slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!service) notFound();
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "MedicalProcedure",
    name: service.title,
    description: service.short_description ?? service.description ?? "",
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">{service.title}</h1>
        <Link className="rounded-md border px-3 py-2" href="/services">
          Back
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">{service.short_description ?? "-"}</p>
      <article className="rounded-lg border p-4 whitespace-pre-wrap text-sm leading-6">
        {service.description ?? "No detailed content added yet."}
      </article>
      <Link className="inline-block rounded-md bg-black px-4 py-2 text-white" href="/book">
        Book this service
      </Link>
    </main>
  );
}
