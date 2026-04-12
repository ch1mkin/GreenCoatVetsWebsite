import Link from "next/link";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { clinicMetadata } from "@/lib/seo/clinic-metadata";

export async function generateMetadata() {
  const clinic = await resolveClinic();
  return clinicMetadata({
    clinicName: clinic.name,
    title: `About us | ${clinic.name}`,
    description: `Who we are, why families choose ${clinic.name}, and our mission for compassionate veterinary care in Tricity.`,
    path: "/about",
  });
}

export default async function AboutPage() {
  const clinic = await resolveClinic();

  return (
    <main className="bg-surface pb-20">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">About</p>
        <h1 className="mt-2 font-headline text-4xl font-extrabold text-on-surface sm:text-5xl">About us</h1>

        <section className="mt-12">
          <h2 className="font-headline text-2xl font-bold text-on-surface">Who we are</h2>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            The inspiration behind {clinic.name} was born from a deep-seated passion for animals and a heartfelt commitment to providing
            quality care. From the very beginning, our journey has been one of growth, learning, and adaptation. While much has evolved
            since we opened our doors, one thing has always remained constant — our unwavering dedication to the well-being of our
            patients.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            Over the years, we&apos;ve not only focused on addressing the health needs of pets but also on creating an environment where
            they feel safe and cared for. We understand that a visit to the vet can be stressful, which is why we go the extra mile to
            make every pet feel right at home — from the moment they walk in, to the moment they leave.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="font-headline text-2xl font-bold text-on-surface">Why choose {clinic.name}</h2>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            Choosing the right veterinary care for your beloved pet is a big decision — and we&apos;re here to make it an easy one. At{" "}
            {clinic.name}, we go beyond treatment — we create trust, comfort, and lifelong wellness.
          </p>
          <ul className="mt-8 space-y-4 text-on-surface-variant">
            <li>
              <span aria-hidden>🩺</span> <strong className="text-on-surface">Unmatched expertise</strong> — skilled vets and support
              staff trained in the latest techniques, from checkups to complex surgeries.
            </li>
            <li>
              <span aria-hidden>🧪</span> <strong className="text-on-surface">Advanced technology</strong> — IDEXX diagnostics for
              accurate, fast results.
            </li>
            <li>
              <span aria-hidden>🐾</span> <strong className="text-on-surface">Compassion-first care</strong> — gentle hands and a kind
              heart for every pet.
            </li>
            <li>
              <span aria-hidden>🏥</span> <strong className="text-on-surface">Comfort-focused environment</strong> — soothing interiors
              and pet-calming practices.
            </li>
            <li>
              <span aria-hidden>📍</span> <strong className="text-on-surface">Community-driven mission</strong> — partnering with NGOs
              and serving underprivileged areas through free and low-cost services.
            </li>
            <li>
              <span aria-hidden>🐶</span> <strong className="text-on-surface">Comprehensive services</strong> — OPD, surgery, dentistry,
              grooming, diagnostics, boarding, and more under one roof.
            </li>
            <li>
              <span aria-hidden>📞</span> <strong className="text-on-surface">Always within reach</strong> — responsive, friendly support
              when you need us.
            </li>
          </ul>
          <p className="mt-8 text-lg leading-relaxed text-on-surface-variant">
            Since our opening, we have performed an average of 3–4 surgeries daily, resulting in:
          </p>
          <ul className="mt-4 space-y-2 text-on-surface-variant">
            <li>✅ Over 5,000 successful surgeries</li>
            <li>🗓️ Nearly 5 years of continuous care and learning</li>
            <li>🐕 Hundreds of breeds, conditions, and unique cases</li>
          </ul>
          <p className="mt-6 text-lg leading-relaxed text-on-surface-variant">
            This isn&apos;t just a number — it&apos;s a reflection of the trust pet parents place in us, and the expertise our team has
            earned over time.
          </p>
          <p className="mt-6 text-center text-2xl" aria-hidden>
            ▼・ᴥ・▼
          </p>
          <p className="mt-2 text-center text-lg font-medium text-on-surface">
            We&apos;re very proud to be a community-driven clinic, and we will always put our patients&apos; well-being before profit.
          </p>
        </section>

        <section className="mt-14">
          <h2 className="font-headline text-2xl font-bold text-on-surface">Our impact</h2>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            At {clinic.name}, we&apos;re proud to be recognized as one of the fastest-growing veterinary clinic chains in Punjab. Since
            our founding in 2020, we&apos;ve committed ourselves not just to medical excellence, but to making a meaningful difference in
            our community every single day.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            On average, we perform 3–4 community surgeries daily, many as part of low-cost wellness and sterilization initiatives. We
            actively collaborate with organizations like <strong>Rab De Jeev</strong> and <strong>Tabassum</strong>, extending care to
            underserved animals with integrity and sincerity.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            Beyond our clinics, we&apos;ve driven change through campaigns like the <strong>Tricity Rabies-Free Mission</strong>, offering
            free rabies vaccinations as part of our mission for safer streets for both pets and people.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            Every step we take is rooted in our core belief: quality veterinary care should be accessible, empathetic, and
            community-driven.
          </p>
          <p className="mt-6">
            <Link href="/community" className="font-bold text-primary underline-offset-4 hover:underline">
              Read about our community work →
            </Link>
          </p>
        </section>

        <section className="mt-14">
          <h2 className="font-headline text-2xl font-bold text-on-surface">Mission &amp; promise</h2>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            At {clinic.name}, our mission is to deliver exceptional veterinary care with compassion, innovation, and integrity. We strive
            to enhance the lives of animals and their families by combining modern medical practices with heartfelt service, ensuring
            every pet receives the respect, attention, and advanced treatment they deserve.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-on-surface-variant">
            We aim to build a healthier community through accessible, ethical, and community-driven care, while nurturing a bond of trust
            with every pet parent who walks through our doors.
          </p>
          <p className="mt-6 font-bold text-on-surface">We promise to:</p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-on-surface-variant">
            <li>Treat your pet like our own — with unwavering care and respect.</li>
            <li>Provide transparent, honest communication throughout your pet&apos;s healthcare journey.</li>
            <li>Offer cutting-edge diagnostics and treatments, backed by trusted technology like IDEXX Laboratories.</li>
            <li>Maintain a stress-free and supportive environment for both pets and pet parents.</li>
            <li>Stay committed to community service, ensuring quality care is available to all — not just a few.</li>
          </ul>
          <p className="mt-6 text-lg font-medium text-on-surface">
            At {clinic.name}, your trust is our greatest responsibility — and we promise to earn it every day.
          </p>
        </section>

        <div className="mt-14 flex flex-wrap gap-4">
          <Link
            href="/book"
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-sm font-bold uppercase tracking-wide text-on-primary"
          >
            Book appointment
          </Link>
          <Link
            href="/contact"
            className="inline-flex h-12 items-center justify-center rounded-full border border-outline-variant px-8 text-sm font-bold uppercase tracking-wide text-on-surface"
          >
            Contact
          </Link>
        </div>
      </div>
    </main>
  );
}
