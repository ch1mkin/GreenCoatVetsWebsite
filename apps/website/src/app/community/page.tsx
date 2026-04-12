import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { clinicMetadata } from "@/lib/seo/clinic-metadata";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return clinicMetadata({
    clinicName: clinic.name,
    title: `Community work | ${clinic.name}`,
    description: `Outreach, NGO partnerships, and community veterinary initiatives by ${clinic.name}.`,
    path: "/community",
  });
}

export default async function CommunityPage() {
  const clinic = await resolveClinic();

  return (
    <main className="bg-surface pb-20">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">Community</p>
        <h1 className="mt-2 font-headline text-4xl font-extrabold text-on-surface sm:text-5xl">Community work</h1>
        <p className="mt-4 text-xl font-medium text-primary">&ldquo;Healing pets. Helping communities.&rdquo;</p>
        <p className="mt-6 text-lg leading-relaxed text-on-surface-variant">
          At {clinic.name}, our mission goes beyond the walls of our clinics. We believe true veterinary care is rooted in compassion,
          accessibility, and community upliftment. Our community initiatives are driven by a deep commitment to making quality care
          available to every pet, regardless of background or circumstance.
        </p>

        <h2 className="mt-12 font-headline text-2xl font-bold text-on-surface">Local partnerships &amp; outreach</h2>
        <p className="mt-4 text-on-surface-variant">
          We&apos;ve actively collaborated with local communities and NGOs to extend our services where they&apos;re needed most:
        </p>

        <ul className="mt-6 space-y-6 text-on-surface-variant">
          <li className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5">
            <span className="text-lg" aria-hidden>
              📍
            </span>{" "}
            <strong className="text-on-surface">Omaxe City outreach</strong>
            <p className="mt-2">
              Regular pet health camps and checkups are conducted in and around Omaxe City, helping more pets access essential care.
            </p>
          </li>
          <li className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5">
            <span className="text-lg" aria-hidden>
              🐾
            </span>{" "}
            <strong className="text-on-surface">In association with Rab De Jeev NGO</strong>
            <p className="mt-2">
              We partner with Rab De Jeev to provide free consultations, diagnostics, and treatments for rescued or community animals —
              giving hundreds of voiceless beings a second chance.
            </p>
          </li>
          <li className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-5">
            <span className="text-lg" aria-hidden>
              💚
            </span>{" "}
            <strong className="text-on-surface">Tabassum welfare initiative</strong>
            <p className="mt-2">
              Through Tabassum, we participate in community consultation drives, delivering medical aid and awareness in underserved
              neighborhoods.
            </p>
          </li>
        </ul>

        <h2 className="mt-12 font-headline text-2xl font-bold text-on-surface">Why we do it</h2>
        <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
          At {clinic.name}, we see pets not as property — but as family. Our community work stems from a belief that every pet deserves a
          chance at a happy, healthy life, and every community deserves access to quality veterinary care.
        </p>

        <h2 className="mt-12 font-headline text-2xl font-bold text-on-surface">Want to support or collaborate?</h2>
        <p className="mt-4 text-on-surface-variant">
          We are always open to partnerships with animal welfare organizations, societies, and volunteers. Reach out to discuss camps,
          outreach, or collaboration.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/contact"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold uppercase tracking-wide text-on-primary"
          >
            Contact us
          </Link>
          <Link
            href="/locations"
            className="inline-flex h-12 items-center justify-center rounded-full border border-outline-variant px-8 text-sm font-bold uppercase tracking-wide text-on-surface"
          >
            Locations
          </Link>
        </div>
      </div>
    </main>
  );
}
