"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type RoomInfo = {
  room_name: string;
  starts_at: string;
  ends_at: string;
  call_started_at?: string | null;
  call_ends_at?: string | null;
  duration_minutes: number;
  pet_name: string;
  owner_name: string;
  doctor_name: string;
};

type Props = {
  appointmentId: string;
  clinicName: string;
  role: "doctor" | "owner";
  room: RoomInfo;
};

type SignalMessage =
  | { type: "doctor_started" }
  | { type: "owner_ready" }
  | { type: "call_ended" }
  | { type: "timer_sync"; call_ends_at: string }
  | { type: "offer"; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; candidate: RTCIceCandidateInit };

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

export function OnlineConsultRoomClient({ appointmentId, clinicName, role, room }: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const endedRef = useRef(false);
  const callEndsAtRef = useRef<number | null>(
    room.call_ends_at ? new Date(room.call_ends_at).getTime() : null,
  );
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [connectionLabel, setConnectionLabel] = useState("Preparing camera and microphone...");

  const sendSignal = useCallback(async (payload: SignalMessage) => {
    if (!channelRef.current) return;
    await channelRef.current.send({ type: "broadcast", event: "signal", payload });
  }, []);

  const ensurePeerConnection = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pc.onicecandidate = (event) => {
      if (event.candidate) void sendSignal({ type: "ice", candidate: event.candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      const incoming = event.streams[0];
      if (!incoming) return;
      for (const track of incoming.getTracks()) {
        remoteStreamRef.current.addTrack(track);
      }
      setConnectionLabel("Connected");
    };
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current as MediaStream);
      });
    }
    pcRef.current = pc;
    return pc;
  }, [sendSignal]);

  const hangUp = useCallback(
    (notifyRemote = true) => {
      if (endedRef.current) return;
      endedRef.current = true;
      if (notifyRemote) void sendSignal({ type: "call_ended" });
      pcRef.current?.close();
      pcRef.current = null;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
      setEnded(true);
    },
    [sendSignal],
  );

  const applyCallEndsAt = useCallback((iso: string) => {
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) return;
    callEndsAtRef.current = ms;
  }, []);

  useEffect(() => {
    if (room.call_ends_at) applyCallEndsAt(room.call_ends_at);
  }, [room.call_ends_at, applyCallEndsAt]);

  useEffect(() => {
    const tick = () => {
      const endsAt = callEndsAtRef.current;
      if (endsAt == null) {
        setSecondsLeft(null);
        return;
      }
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !endedRef.current) {
        hangUp(false);
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [hangUp]);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const roomChannel = supabase.channel(`online-consult:${room.room_name}`, {
      config: { broadcast: { self: false } },
    });
    channelRef.current = roomChannel;

    const onSignal = async (payload: SignalMessage) => {
      if (!mounted || endedRef.current) return;
      if (payload.type === "doctor_started" && role === "owner") {
        setConnectionLabel("Doctor joined. Connecting...");
      }
      if (payload.type === "call_ended") {
        hangUp(false);
        return;
      }
      if (payload.type === "timer_sync") {
        applyCallEndsAt(payload.call_ends_at);
        return;
      }
      if (payload.type === "owner_ready" && role === "doctor") {
        const pc = await ensurePeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal({ type: "offer", sdp: offer });
      }
      if (payload.type === "offer" && role === "owner") {
        const pc = await ensurePeerConnection();
        await pc.setRemoteDescription(payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({ type: "answer", sdp: answer });
      }
      if (payload.type === "answer" && role === "doctor") {
        const pc = await ensurePeerConnection();
        await pc.setRemoteDescription(payload.sdp);
      }
      if (payload.type === "ice") {
        const pc = await ensurePeerConnection();
        await pc.addIceCandidate(payload.candidate);
      }
    };

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (!mounted) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setConnectionLabel(role === "doctor" ? "Waiting for owner to join..." : "Waiting for doctor to start...");
      } catch {
        setConnectionLabel("Camera/mic permission required to start call.");
        return;
      }

      roomChannel.on("broadcast", { event: "signal" }, (packet) => {
        const payload = (packet as { payload?: SignalMessage }).payload;
        if (payload) void onSignal(payload);
      });

      await new Promise<void>((resolve) => {
        roomChannel.subscribe((status) => {
          if (status === "SUBSCRIBED") resolve();
        });
      });

      if (!mounted) return;
      if (role === "doctor") {
        await sendSignal({ type: "doctor_started" });
        if (room.call_ends_at) {
          await sendSignal({ type: "timer_sync", call_ends_at: room.call_ends_at });
        }
      }
      if (role === "owner") await sendSignal({ type: "owner_ready" });
    })();

    return () => {
      mounted = false;
      pcRef.current?.close();
      pcRef.current = null;
      roomChannel.unsubscribe();
      channelRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
      remoteStreamRef.current = null;
    };
  }, [applyCallEndsAt, ensurePeerConnection, hangUp, role, room.call_ends_at, room.room_name, sendSignal]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (ended) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#1a2e28] px-4 text-white">
        <h1 className="text-2xl font-bold">Call ended</h1>
        <p className="mt-2 text-center text-white/80">Thank you for using {clinicName} online consultation.</p>
        <a href="/" className="mt-8 rounded-full bg-white/10 px-6 py-3 text-sm font-bold hover:bg-white/20">
          Back to website
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#1a2e28] text-white">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{clinicName}</p>
          <p className="truncate text-xs text-white/70">
            {room.pet_name} · {room.doctor_name}
          </p>
        </div>
        <div className="flex items-center gap-3 text-right text-xs">
          {secondsLeft != null ? (
            <span
              className={`rounded-full px-3 py-1 font-mono font-bold ${secondsLeft < 120 ? "bg-amber-500/90 text-black" : "bg-white/10"}`}
            >
              {formatTime(secondsLeft)} left
            </span>
          ) : (
            <span className="rounded-full bg-white/10 px-3 py-1 text-white/70">
              {room.duration_minutes} min session
            </span>
          )}
          <span className="hidden text-white/50 sm:inline">ID {appointmentId.slice(0, 8)}</span>
        </div>
      </header>

      <div className="relative min-h-0 flex-1 bg-[#0f1f1a] p-3">
        <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full rounded-xl bg-black object-cover" />
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-6 right-6 h-28 w-44 rounded-lg border border-white/30 bg-black object-cover shadow-lg"
        />
        <div className="absolute left-6 top-6 rounded-full bg-black/60 px-3 py-1 text-xs text-white/90">{connectionLabel}</div>
      </div>

      <footer className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 px-4 py-4 sm:gap-4">
        <button
          type="button"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            localStreamRef.current?.getAudioTracks().forEach((t) => {
              t.enabled = !next;
            });
          }}
          className={`flex h-12 w-12 items-center justify-center rounded-full ${muted ? "bg-red-600" : "bg-white/15 hover:bg-white/25"}`}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          <span className="material-symbols-outlined text-xl">{muted ? "mic_off" : "mic"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !videoOff;
            setVideoOff(next);
            localStreamRef.current?.getVideoTracks().forEach((t) => {
              t.enabled = !next;
            });
          }}
          className={`flex h-12 w-12 items-center justify-center rounded-full ${videoOff ? "bg-red-600" : "bg-white/15 hover:bg-white/25"}`}
          aria-label={videoOff ? "Turn camera on" : "Turn camera off"}
        >
          <span className="material-symbols-outlined text-xl">{videoOff ? "videocam_off" : "videocam"}</span>
        </button>
        <button
          type="button"
          onClick={() => hangUp(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-500"
          aria-label="Leave call"
        >
          <span className="material-symbols-outlined text-2xl">call_end</span>
        </button>
      </footer>
    </div>
  );
}
