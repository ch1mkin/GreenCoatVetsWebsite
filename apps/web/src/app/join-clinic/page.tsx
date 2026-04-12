import { redirect } from "next/navigation";
import { joinClinicWithInvite } from "./actions";
import { createClient } from "@/lib/supabase/server";

type SearchParams = {
  invite?: string;
};

export default async function JoinClinicPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const invite = (searchParams.invite ?? "").trim();

  let clinicName = "";
  let clinicImageUrl = "";
  let inviteRole = "";
  if (invite) {
    const { data } = await supabase
      .from("clinic_role_invites")
      .select("role, clinics(name, image_url)")
      .eq("token", invite)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    const clinic = data?.clinics as { name?: string; image_url?: string } | null;
    clinicName = clinic?.name ?? "";
    clinicImageUrl = clinic?.image_url ?? "";
    inviteRole = ((data as { role?: string } | null)?.role ?? "").toLowerCase();
  }

  return (
    <main className="min-h-screen bg-background px-6 pb-12 pt-24">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-12">
        <section className="space-y-6 lg:col-span-5">
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-background">
            Join your clinic
          </h1>
          <p className="text-on-surface-variant">
            Scan a clinic QR and complete onboarding with role and clinic assignment in one step.
          </p>
          <form className="glass-card rounded-xl p-6 shadow-[0_12px_32px_rgba(23,28,31,0.06)]" action={joinClinicWithInvite}>
            <div className="space-y-3">
              <input className="input-soft w-full" name="invite" defaultValue={invite} placeholder="Invite token" required />
              <input className="input-soft w-full" name="full_name" placeholder="Full name (optional)" />
              {inviteRole === "doctor" ? (
                <input
                  className="input-soft w-full"
                  name="working_hours"
                  placeholder="Working hours (e.g. Mon-Sat 10:00-18:00)"
                  required
                />
              ) : null}
              <button className="btn-primary w-full" type="submit">
                Join clinic
              </button>
            </div>
          </form>
        </section>

        <section className="relative overflow-hidden rounded-[2rem] bg-surface-container-high lg:col-span-7">
          {clinicImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clinicImageUrl} alt={clinicName || "Clinic"} className="h-[460px] w-full object-cover lg:h-[620px]" />
          ) : (
            <div className="h-[460px] w-full bg-gradient-to-br from-primary-container/30 to-primary/30 lg:h-[620px]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/60 via-primary/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 rounded-xl bg-white/80 p-5 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Selected Clinic</p>
            <p className="mt-1 font-headline text-2xl font-bold text-on-background">{clinicName}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
