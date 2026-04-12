"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { InviteQrRow } from "./types";

function formatExpiryRemaining(iso: string | null): string {
  if (!iso) return "No expiry";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const now = Date.now();
  if (t <= now) return "Expired";
  const ms = t - now;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

function clinicDisplayId(invite: InviteQrRow): string {
  const slug = invite.clinics?.slug?.trim();
  if (slug) return slug.slice(0, 10).toUpperCase();
  return invite.clinic_id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function InviteQrStudio({
  invites,
  webBase,
  websiteBase,
}: {
  invites: InviteQrRow[];
  webBase: string;
  websiteBase: string;
}) {
  const [mode, setMode] = useState<"qr" | "link">("qr");
  const [selectedId, setSelectedId] = useState<string | null>(invites[0]?.id ?? null);

  useEffect(() => {
    if (!invites.length) return;
    if (!selectedId || !invites.some((i) => i.id === selectedId)) {
      setSelectedId(invites[0].id);
    }
  }, [invites, selectedId]);

  const selected = useMemo(() => {
    if (!invites.length) return null;
    return invites.find((i) => i.id === selectedId) ?? invites[0];
  }, [invites, selectedId]);

  if (!invites.length) {
    return (
      <div className="relative mx-auto mb-10 w-full max-w-md rounded-3xl border border-outline-variant/20 bg-surface-container-low/80 p-10 text-center shadow-inner">
        <span className="material-symbols-outlined mb-3 text-5xl text-primary/40">qr_code_2</span>
        <p className="font-headline text-lg font-bold text-on-background">No invite yet</p>
        <p className="mt-2 text-sm text-on-surface-variant">Generate a role invite below — your QR preview will appear here.</p>
      </div>
    );
  }

  if (!selected) return null;

  const webSignup = `${webBase}/signup?invite=${selected.token}`;
  const websiteSignup = `${websiteBase}/signup?invite=${selected.token}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(webSignup)}`;

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy this link:", text);
    }
  }

  async function sharePrimary() {
    const url = mode === "link" ? webSignup : webSignup;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Clinic invite",
          text: "Join with this secure invite link.",
          url,
        });
      } else {
        await copyText(url);
      }
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-8 text-center">
        <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-background">Access control</h2>
        <p className="mt-1 font-medium text-on-surface-variant">Generate dynamic credentials for clinic onboarding</p>
      </div>

      {invites.length > 1 ? (
        <label className="mb-6 block text-left">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Preview invite</span>
          <select
            className="input-soft w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest py-3 pl-3 pr-8 text-sm font-semibold"
            value={selected.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {invites.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {(inv.label || inv.role).slice(0, 48)} · {inv.role}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mb-8 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode("qr")}
          className={`flex flex-col items-center justify-center rounded-xl border-2 p-4 shadow-sm transition-colors ${
            mode === "qr"
              ? "border-primary-container bg-surface-container-lowest"
              : "border-transparent bg-surface-container-low hover:bg-surface-container-high"
          }`}
        >
          <span
            className={`material-symbols-outlined mb-2 ${mode === "qr" ? "text-primary" : "text-on-surface-variant"}`}
            style={mode === "qr" ? { fontVariationSettings: "'FILL' 1" } : undefined}
          >
            qr_code_2
          </span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${mode === "qr" ? "text-primary" : "text-on-surface-variant"}`}
          >
            Check-in QR
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMode("link")}
          className={`flex flex-col items-center justify-center rounded-xl border-2 p-4 shadow-sm transition-colors ${
            mode === "link"
              ? "border-primary-container bg-surface-container-lowest"
              : "border-transparent bg-surface-container-low hover:bg-surface-container-high"
          }`}
        >
          <span className={`material-symbols-outlined mb-2 ${mode === "link" ? "text-primary" : "text-on-surface-variant"}`}>link</span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider ${mode === "link" ? "text-primary" : "text-on-surface-variant"}`}
          >
            Invite link
          </span>
        </button>
      </div>

      {mode === "qr" ? (
        <div className="relative mx-auto mb-8 flex aspect-square w-full max-w-[320px] items-center justify-center">
          <div className="absolute -left-4 -top-4 h-12 w-12 rounded-tl-xl border-l-4 border-t-4 border-primary-container/30" />
          <div className="absolute -bottom-4 -right-4 h-12 w-12 rounded-br-xl border-b-4 border-r-4 border-primary-container/30" />
          <div className="qr-gradient-border w-full max-w-[320px] rounded-3xl shadow-2xl shadow-primary/15">
            <div className="flex flex-col items-center justify-center rounded-[1.35rem] bg-white p-6">
              <Image
                className="h-auto w-full max-h-[240px] object-contain opacity-95"
                src={qrUrl}
                alt="Invite QR code"
                width={280}
                height={280}
                unoptimized
              />
              <div className="mt-4 flex items-center gap-2 rounded-full bg-primary-container/10 px-3 py-1">
                <div className="h-2 w-2 animate-pulse rounded-full bg-primary-container" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Encrypted session</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative mx-auto mb-8 w-full max-w-[320px] rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-lg">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Web app signup</p>
          <p className="break-all rounded-xl bg-surface-container-low p-3 font-mono text-xs text-on-background">{webSignup}</p>
          <p className="mb-2 mt-4 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Public website</p>
          <p className="break-all rounded-xl bg-surface-container-low p-3 font-mono text-xs text-on-background">{websiteSignup}</p>
          <button
            type="button"
            onClick={() => copyText(webSignup)}
            className="btn-secondary mt-4 w-full py-3 text-sm font-bold"
          >
            Copy web link
          </button>
        </div>
      )}

      <div className="mb-8 space-y-4 rounded-xl bg-surface-container-low p-5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-on-surface-variant">Clinic ID</span>
          <span className="font-headline font-bold text-on-background">{clinicDisplayId(selected)}</span>
        </div>
        <div className="h-px w-full bg-outline-variant/20" />
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-on-surface-variant">Expires in</span>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-lg text-tertiary">schedule</span>
            <span className="font-headline font-bold text-on-background">{formatExpiryRemaining(selected.expires_at)}</span>
          </div>
        </div>
        <div className="h-px w-full bg-outline-variant/20" />
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-medium text-on-surface-variant">Role</span>
          <span className="font-headline font-bold capitalize text-primary">{selected.role.replace(/_/g, " ")}</span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <a
          href={qrUrl}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary-container to-primary py-4 font-headline font-bold text-on-primary shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]"
        >
          <span className="material-symbols-outlined text-white">download</span>
          Open QR image
        </a>
        <button
          type="button"
          onClick={() => sharePrimary()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-container py-4 font-headline font-bold text-on-secondary-container transition-transform active:scale-[0.98]"
        >
          <span className="material-symbols-outlined">share</span>
          Share to staff
        </button>
      </div>
    </div>
  );
}
