"use client";

import { FormEvent, useState } from "react";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("Appointment Inquiry");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, phone, message: `[${subject}] ${message}` }),
    });
    const payload = (await res.json()) as { error?: string };
    setSubmitting(false);

    if (!res.ok) {
      setStatus(payload.error ?? "Failed to submit form.");
      return;
    }

    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
    setStatus("Thanks! Our team will contact you shortly.");
  }

  const inputClass =
    "w-full rounded-lg border-none bg-surface-container-low p-4 font-body text-on-surface transition-all placeholder:text-on-surface-variant/70 focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/40";

  return (
    <form className="space-y-6" onSubmit={onSubmit}>
      <h2 className="font-headline text-2xl font-bold text-on-surface">General inquiry</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="ml-1 text-sm font-medium text-on-surface-variant">Full name</label>
          <input className={inputClass} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <label className="ml-1 text-sm font-medium text-on-surface-variant">Email</label>
          <input
            className={inputClass}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="ml-1 text-sm font-medium text-on-surface-variant">Phone (optional)</label>
        <input className={inputClass} placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="ml-1 text-sm font-medium text-on-surface-variant">Topic</label>
        <select className={`${inputClass} appearance-none`} value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option>Appointment Inquiry</option>
          <option>Prescription Renewal</option>
          <option>Billing Question</option>
          <option>General Feedback</option>
        </select>
      </div>
      <div className="space-y-2">
        <label className="ml-1 text-sm font-medium text-on-surface-variant">Message</label>
        <textarea
          className={`${inputClass} min-h-[140px] resize-y`}
          placeholder="How can we help?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
        />
      </div>
      <button
        className="gradient-primary w-full rounded-xl px-10 py-4 font-headline text-lg font-bold text-on-primary shadow-lg transition-all active:scale-95 disabled:opacity-60 md:w-auto"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Sending…" : "Send secure message"}
      </button>
      {status ? <p className="text-sm text-primary">{status}</p> : null}
    </form>
  );
}
