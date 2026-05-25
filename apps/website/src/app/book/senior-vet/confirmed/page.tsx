import Link from "next/link";

export default function SeniorVetConfirmedPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const meet = String(searchParams?.meet ?? "").trim();
  const token = String(searchParams?.token ?? "").trim();

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-headline text-2xl font-bold text-on-background">Consultation booked</h1>
      <p className="mt-4 text-on-surface-variant">
        Payment received. A consent PDF and join link were sent to your email. You will receive a reminder 20 minutes before your slot.
      </p>
      {meet ? (
        <a
          href={meet}
          className="mt-6 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary"
        >
          Open video consultation room
        </a>
      ) : null}
      <p className="mt-3 text-xs text-on-surface-variant">Video runs on this website in a Google Meet–style room. Join at your scheduled time.</p>
      {token ? (
        <p className="mt-4 text-sm">
          Booking code: <span className="font-mono font-bold">{token}</span>
        </p>
      ) : null}
      <Link href="/" className="mt-8 inline-block text-sm font-bold text-primary underline">
        Back to home
      </Link>
    </main>
  );
}
