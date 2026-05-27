import Link from "next/link";
import Script from "next/script";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { clinicMetadata } from "@/lib/seo/clinic-metadata";
import { createClient } from "@/lib/supabase/server";
import { SeniorVetConsultClient } from "@/components/site/senior-vet-consult-client";

const field =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3.5 font-body text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return clinicMetadata({
    clinicName: clinic.name,
    title: `Senior Vet online consultation | ${clinic.name}`,
    description: `Book a paid video consultation with a senior veterinarian at ${clinic.name}.`,
    path: "/book/senior-vet",
  });
}

export default async function SeniorVetBookPage() {
  const clinic = await resolveClinic();
  const supabase = createClient();

  const [{ data: settings }, { data: branches }, { data: doctors }] = await Promise.all([
    supabase.from("clinic_online_consult_settings").select("*").eq("clinic_id", clinic.id).maybeSingle(),
    supabase.rpc("get_public_branches_for_clinic", { p_clinic_id: clinic.id }),
    supabase.rpc("get_public_senior_booking_doctors", { p_clinic_id: clinic.id }),
  ]);

  if (!settings?.enabled) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-headline text-2xl font-bold">Online consultation unavailable</h1>
        <p className="mt-2 text-on-surface-variant">Senior Vet online booking is not enabled for this clinic yet.</p>
        <Link href="/book" className="mt-6 inline-block font-bold text-primary underline">
          Standard booking
        </Link>
      </main>
    );
  }

  const doctorRows = (doctors ?? []) as { id: string; full_name: string; branch_id: string | null }[];
  const branchRows = (branches ?? []) as { id: string; name: string }[];
  const priceInr = Math.round((settings.price_paise ?? 0) / 100);

  return (
    <main className="bg-surface pb-20">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-headline text-3xl font-extrabold text-on-background">{settings.product_name}</h1>
        <p className="mt-2 text-on-surface-variant">
          Book with a Senior doctor only, sign consent, and join a private video room on this website (Meet-style). Session length:{" "}
          {settings.duration_minutes} minutes.
        </p>
        {!settings.test_mode ? <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" /> : null}
        <div className="mt-10">
          <SeniorVetConsultClient
            clinicId={clinic.id}
            clinicName={clinic.name}
            productName={settings.product_name}
            priceInr={priceInr}
            testMode={Boolean(settings.test_mode)}
            branches={branchRows}
            doctors={doctorRows}
            fieldClassName={field}
          />
        </div>
      </div>
    </main>
  );
}
