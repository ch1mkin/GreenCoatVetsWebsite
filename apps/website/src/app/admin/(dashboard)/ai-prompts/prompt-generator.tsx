"use client";

import { useState, useTransition } from "react";
import { generateInstagramPromptPack, type InstagramPromptPack } from "./actions";

const GEMINI_URL = "https://gemini.google.com/app";

type FormState = {
  clinicName: string;
  theme: string;
  audience: string;
  campaignGoal: string;
  season: string;
  tone: string;
};

const INITIAL_FORM: FormState = {
  clinicName: "GreenCoatVets",
  theme: "",
  audience: "Pet parents in India",
  campaignGoal: "Increase shares and saves",
  season: "",
  tone: "Warm, trustworthy, playful",
};

export function PromptGenerator() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState<InstagramPromptPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<false | "prompt" | "caption">(false);
  const [isPending, startTransition] = useTransition();

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setCopied(false);

    startTransition(() => {
      void (async () => {
        try {
          const result = await generateInstagramPromptPack(form);
          if (!result.ok) {
            setResult(null);
            setError(result.error);
            return;
          }
          setResult(result.pack);
        } catch (err) {
          setResult(null);
          setError(err instanceof Error ? err.message : "Failed to generate prompt.");
        }
      })();
    });
  }

  async function copyText(value: string, kind: "prompt" | "caption") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function copyPromptAndOpenGemini() {
    if (!result) return;
    await copyText(result.geminiPrompt, "prompt");
    window.open(GEMINI_URL, "_blank", "noopener,noreferrer");
  }

  const captionText = result ? `${result.captionHook}\n\n${result.captionBody}\n\n${result.hashtags.join(" ")}` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="font-headline text-xl font-bold text-slate-900">Generate a post concept</h2>
          <p className="mt-2 text-sm text-slate-600">
            DeepSeek R1 creates the strategy and Gemini-ready art prompt. The output stays focused on illustrated, 2D,
            non-realistic Instagram creatives.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Recommended OpenRouter model: <code className="rounded bg-slate-100 px-1 py-0.5">deepseek/deepseek-v4-flash:free</code>
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Clinic name</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              value={form.clinicName}
              onChange={(event) => updateField("clinicName", event.target.value)}
              placeholder="GreenCoatVets"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Theme</span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              value={form.theme}
              onChange={(event) => updateField("theme", event.target.value)}
              placeholder="Summer skin allergies in dogs"
              required
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Audience</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                value={form.audience}
                onChange={(event) => updateField("audience", event.target.value)}
                placeholder="New pet parents"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Goal</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                value={form.campaignGoal}
                onChange={(event) => updateField("campaignGoal", event.target.value)}
                placeholder="Increase saves"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Season / event</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                value={form.season}
                onChange={(event) => updateField("season", event.target.value)}
                placeholder="Monsoon, World Rabies Day, festive travel"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Tone</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                value={form.tone}
                onChange={(event) => updateField("tone", event.target.value)}
                placeholder="Friendly and educational"
              />
            </label>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <button
          type="submit"
          disabled={isPending}
          className="gradient-primary mt-6 inline-flex min-w-[220px] items-center justify-center rounded-xl px-6 py-3 font-headline text-sm font-bold text-on-primary shadow-lg disabled:opacity-60"
        >
          {isPending ? "Generating..." : "Generate trending ideas"}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-xl font-bold text-slate-900">Output pack</h2>
            <p className="mt-2 text-sm text-slate-600">
              Use the idea list for planning, then copy the Gemini prompt to generate artwork.
            </p>
          </div>
          {result ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText(captionText, "caption")}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copied === "caption" ? "Caption copied" : "Copy caption"}
              </button>
              <button
                type="button"
                onClick={copyPromptAndOpenGemini}
                className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10"
              >
                {copied === "prompt" ? "Prompt copied" : "Copy prompt + open Gemini"}
              </button>
            </div>
          ) : null}
        </div>

        {result ? (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Recommended concept</p>
              <h3 className="mt-2 font-headline text-lg font-bold text-slate-900">{result.conceptTitle}</h3>
              <p className="mt-2 text-sm text-slate-700">{result.trendAngle}</p>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Trending post ideas</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-800">
                  {result.postIdeas.map((idea) => (
                    <li key={idea} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      {idea}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Art direction</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-800">
                  {result.artDirection.map((item) => (
                    <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Caption draft</h3>
              <p className="mt-3 text-sm font-semibold text-slate-900">{result.captionHook}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{result.captionBody}</p>
              <p className="mt-3 text-sm text-primary">{result.hashtags.join(" ")}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Gemini image prompt</h3>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">{result.geminiPrompt}</p>
              <p className="mt-3 text-xs text-slate-500">
                Gemini opens in a new tab. The prompt is copied first so you can paste it immediately.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-sm text-slate-500">
            Generate a prompt pack to see the best current post angles, a ready-to-edit caption, and a Gemini-ready 2D
            illustration prompt.
          </div>
        )}
      </section>
    </div>
  );
}
