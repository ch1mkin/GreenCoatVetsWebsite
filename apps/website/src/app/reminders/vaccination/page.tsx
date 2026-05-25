import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function VaccinationReminderPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const token = String(searchParams?.token ?? "").trim();
  const action = String(searchParams?.action ?? "").trim().toLowerCase();

  if (!token) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16">
        <h1 className="font-headline text-2xl font-bold">Invalid link</h1>
        <p className="mt-2 text-on-surface-variant">This vaccination reminder link is missing a token.</p>
      </main>
    );
  }

  const supabase = createClient();
  let message = "Manage your pet&apos;s vaccination reminder.";
  let ok = true;

  if (action === "completed" || action === "not_done") {
    const { error } = await supabase.rpc("respond_vaccination_reminder", {
      p_token: token,
      p_status: action === "completed" ? "completed" : "not_done",
    });
    if (error) {
      ok = false;
      message = error.message;
    } else {
      message =
        action === "completed"
          ? "Thank you — we recorded this vaccination as done. Your next reminder will follow your usual interval."
          : "Thanks — we will remind you again tomorrow. Contact the clinic if you need to reschedule.";
    }
  } else if (action === "opt_out") {
    const { error } = await supabase.rpc("opt_out_vaccination_reminder", { p_token: token });
    if (error) {
      ok = false;
      message = error.message;
    } else {
      message = "You will no longer receive automated vaccination reminder emails for this record.";
    }
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-headline text-2xl font-bold text-on-background">Vaccination reminder</h1>
      <p className={`mt-4 text-sm ${ok ? "text-on-surface" : "text-red-700"}`}>{message}</p>
      {!action ? (
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href={`/reminders/vaccination?token=${encodeURIComponent(token)}&action=completed`}
            className="rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-on-primary"
          >
            Yes — vaccination done
          </Link>
          <Link
            href={`/reminders/vaccination?token=${encodeURIComponent(token)}&action=not_done`}
            className="rounded-xl border border-outline-variant px-4 py-3 text-center text-sm font-bold text-on-surface"
          >
            Not yet — remind me tomorrow
          </Link>
          <Link
            href={`/reminders/vaccination?token=${encodeURIComponent(token)}&action=opt_out`}
            className="text-center text-xs text-on-surface-variant underline"
          >
            Stop these emails
          </Link>
        </div>
      ) : (
        <p className="mt-8 text-sm text-on-surface-variant">
          <Link href="/" className="font-semibold text-primary underline">
            Return to clinic website
          </Link>
        </p>
      )}
    </main>
  );
}
