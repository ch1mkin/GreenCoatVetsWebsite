import Link from "next/link";
import { redirect } from "next/navigation";
import { OnlineConsultRoomClient } from "@/components/consult/online-consult-room-client";
import { resolveClinic } from "@/lib/clinic/resolve-clinic";
import { createClient } from "@/lib/supabase/server";

type RoomPayload = {
  room_name: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  pet_name: string;
  owner_name: string;
  doctor_name: string;
};

export default async function OnlineConsultRoomPage({
  params,
  searchParams,
}: {
  params: { appointmentId: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const appointmentId = params.appointmentId?.trim();
  const tokenRaw = searchParams?.token;
  const token = (Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw)?.trim() || null;
  const role = String(searchParams?.role ?? "guest").trim();

  if (!appointmentId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#1a2e28] px-4 text-white">
        <p>Invalid consultation link.</p>
      </main>
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (role !== "doctor" && !user) {
    const redirectPath = `/consult/room/${appointmentId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
    redirect(`/login?redirect=${encodeURIComponent(redirectPath)}`);
  }

  const { data: roomData, error } = await supabase.rpc("validate_online_consult_join", {
    p_appointment_id: appointmentId,
    p_token: token,
  });

  if (error || !roomData) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#1a2e28] px-4 text-center text-white">
        <h1 className="text-xl font-bold">Cannot join this call</h1>
        <p className="max-w-md text-sm text-white/80">{error?.message ?? "This link may be expired or invalid."}</p>
        {!user ? (
          <Link href={`/login?redirect=/consult/room/${appointmentId}`} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-on-primary">
            Log in as pet owner
          </Link>
        ) : null}
        <Link href="/" className="text-sm underline text-white/70">
          Home
        </Link>
      </main>
    );
  }

  const room = roomData as RoomPayload;
  const clinic = await resolveClinic();
  const displayName =
    role === "doctor"
      ? room.doctor_name || "Veterinarian"
      : user
        ? room.owner_name || "Pet owner"
        : room.owner_name || "Guest";

  const startsAt = new Date(room.starts_at).getTime();
  const earlyWindowMs = 10 * 60 * 1000;
  if (role !== "doctor" && Date.now() < startsAt - earlyWindowMs) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#1a2e28] px-4 text-center text-white">
        <h1 className="text-xl font-bold">Waiting room</h1>
        <p className="text-sm text-white/80">
          Your consultation starts at {new Date(room.starts_at).toLocaleString()}. You can join up to 10 minutes early.
        </p>
        <p className="text-xs text-white/60">Refresh this page when it is time.</p>
      </main>
    );
  }

  return (
    <OnlineConsultRoomClient
      appointmentId={appointmentId}
      clinicName={clinic.name}
      displayName={displayName}
      room={room}
    />
  );
}
