"use client";

import { useState, useTransition } from "react";
import { ILLUSTRATION_STYLE_OPTIONS } from "@/lib/marketing/build-instagram-prompt-pack";
import { generateInstagramPromptPack, type InstagramPromptPack } from "./actions";

const GEMINI_URL = "https://gemini.google.com/app";

type FormState = {
  clinicName: string;
  scene: string;
  illustrationStyle: string;
  colorPalette: string;
  backgroundColor: string;
  audience: string;
  campaignGoal: string;
  season: string;
  tone: string;
};

type CopiedKind = false | "caption" | "gemini" | "image" | "imageShort" | "negative";

const INITIAL_FORM: FormState = {
  clinicName: "GreenCoatVets",
  scene: "",
  illustrationStyle: ILLUSTRATION_STYLE_OPTIONS[0],
  colorPalette: "pastel blues and warm cream",
  backgroundColor: "white",
  audience: "Pet parents in India",
  campaignGoal: "Increase shares and saves",
  season: "",
  tone: "Warm, trustworthy, playful",
};

export function PromptGenerator() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState<InstagramPromptPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<CopiedKind>(false);
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
          setError(err instanceof Error ? err.message : "Failed to build prompt pack.");
        }
      })();
    });
  }

  async function copyText(value: string, kind: CopiedKind) {
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
    await copyText(result.geminiPrompt, "gemini");
    window.open(GEMINI_URL, "_blank", "noopener,noreferrer");
  }

  const captionText = result ? `${result.captionHook}\n\n${result.captionBody}\n\n${result.hashtags.join(" ")}` : "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="font-headline text-xl font-bold text-slate-900">Build post + image prompts</h2>
          <p className="mt-2 text-sm text-slate-600">
            Fills a fixed flat-vector illustration template from your inputs, plus caption ideas, hashtags, and a standard
            negative prompt for image tools.
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
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Scene, animals, or objects
            </span>
            <input
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              value={form.scene}
              onChange={(event) => updateField("scene", event.target.value)}
              placeholder="a golden retriever puppy getting a gentle check-up with a stethoscope"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Illustration style</span>
            <select
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
              value={form.illustrationStyle}
              onChange={(event) => updateField("illustrationStyle", event.target.value)}
            >
              {ILLUSTRATION_STYLE_OPTIONS.map((style) => (
                <option key={style} value={style}>
                  {style}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Color palette</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                value={form.colorPalette}
                onChange={(event) => updateField("colorPalette", event.target.value)}
                placeholder="pastel blues and warm cream"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Background color</span>
              <input
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900"
                value={form.backgroundColor}
                onChange={(event) => updateField("backgroundColor", event.target.value)}
                placeholder="white"
              />
            </label>
          </div>

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
          {isPending ? "Building..." : "Build content + image prompts"}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-xl font-bold text-slate-900">Output pack</h2>
            <p className="mt-2 text-sm text-slate-600">
              Post content for Instagram, plus image prompts from the flat-vector template for Gemini or any image generator.
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
                {copied === "gemini" ? "Gemini prompt copied" : "Copy Gemini + open"}
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

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Post content</h3>
              <div className="mt-3 grid gap-6 xl:grid-cols-2">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Post ideas</h4>
                  <ul className="mt-2 space-y-2 text-sm text-slate-800">
                    {result.postIdeas.map((idea) => (
                      <li key={idea} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        {idea}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Caption draft</h4>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{result.captionHook}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{result.captionBody}</p>
                  <p className="mt-3 text-sm text-primary">{result.hashtags.join(" ")}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Image generation prompts</h3>
              <div className="mt-3 space-y-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Gemini (detailed)</h4>
                    <button
                      type="button"
                      onClick={() => copyText(result.geminiPrompt, "gemini")}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {copied === "gemini" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{result.geminiPrompt}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Universal image prompt</h4>
                    <button
                      type="button"
                      onClick={() => copyText(result.imagePrompt, "image")}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {copied === "image" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{result.imagePrompt}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Short image prompt</h4>
                    <button
                      type="button"
                      onClick={() => copyText(result.imagePromptShort, "imageShort")}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {copied === "imageShort" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">{result.imagePromptShort}</p>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-800">Negative prompt</h4>
                    <button
                      type="button"
                      onClick={() => copyText(result.negativePrompt, "negative")}
                      className="rounded-lg border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100/50"
                    >
                      {copied === "negative" ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-amber-950">{result.negativePrompt}</p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Art direction</h4>
                  <ul className="mt-2 space-y-2 text-sm text-slate-800">
                    {result.artDirection.map((item) => (
                      <li key={item} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-sm text-slate-500">
            Build a pack to see caption content, hashtags, post ideas, and image prompts for your creative tools.
          </div>
        )}
      </section>
    </div>
  );
}
