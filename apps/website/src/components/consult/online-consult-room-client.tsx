"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RoomInfo = {
  room_name: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  pet_name: string;
  owner_name: string;
  doctor_name: string;
};

type Props = {
  appointmentId: string;
  clinicName: string;
  displayName: string;
  room: RoomInfo;
};

export function OnlineConsultRoomClient({ appointmentId, clinicName, displayName, room }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);

  const hangUp = useCallback(() => {
    if (containerRef.current) containerRef.current.innerHTML = "";
    setEnded(true);
  }, []);

  useEffect(() => {
    const endsAt = new Date(room.ends_at).getTime();
    const tick = () => {
      const left = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0 && !ended) {
        hangUp();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [room.ends_at, ended, hangUp]);

  useEffect(() => {
    if (!containerRef.current) return;
    const iframe = document.createElement("iframe");
    // Free alternative to meet.jit.si embed demo limit.
    iframe.src = `https://talky.io/${encodeURIComponent(room.room_name)}#name=${encodeURIComponent(displayName)}`;
    iframe.allow = "camera; microphone; fullscreen; autoplay; display-capture";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.title = "Online consultation room";
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(iframe);
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [room.room_name, displayName]);

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
            <span className={`rounded-full px-3 py-1 font-mono font-bold ${secondsLeft < 120 ? "bg-amber-500/90 text-black" : "bg-white/10"}`}>
              {formatTime(secondsLeft)} left
            </span>
          ) : null}
          <span className="hidden text-white/50 sm:inline">ID {appointmentId.slice(0, 8)}</span>
        </div>
      </header>

      <div ref={containerRef} className="relative min-h-0 flex-1 bg-[#0f1f1a]" />

      <footer className="flex shrink-0 items-center justify-center gap-3 border-t border-white/10 px-4 py-4 sm:gap-4">
        <button
          type="button"
          onClick={hangUp}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-500"
          aria-label="Leave call"
        >
          <span className="material-symbols-outlined text-2xl">call_end</span>
        </button>
      </footer>
    </div>
  );
}
