"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminAccessGate() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onUnlock(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const payload = (await res.json()) as { error?: string };
    setLoading(false);
    if (!res.ok) {
      setError(payload.error ?? "Invalid access code.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/20 bg-white/95 p-6 shadow-2xl backdrop-blur">
      <h2 className="font-headline text-2xl font-extrabold text-slate-900">Admin access required</h2>
      <p className="mt-2 text-sm text-slate-600">Enter access code to open staff login.</p>
      <form className="mt-5 space-y-3" onSubmit={onUnlock}>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Access code"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary px-4 py-3 font-headline text-sm font-bold text-white disabled:opacity-60"
        >
          {loading ? "Verifying..." : "Unlock login"}
        </button>
      </form>
    </div>
  );
}
