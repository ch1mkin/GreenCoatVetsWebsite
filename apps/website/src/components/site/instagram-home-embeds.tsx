"use client";

import { useEffect, useId } from "react";

declare global {
  interface Window {
    instgrm?: { Embeds: { process: () => void } };
  }
}

const EMBED_SCRIPT_ID = "instagram-embed-js";
const EMBED_SRC = "https://www.instagram.com/embed.js";

function loadEmbedScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === "undefined") return;
    const existing = document.getElementById(EMBED_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "1") {
      resolve();
      return;
    }
    if (existing && !existing.dataset.loaded) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Instagram embed script failed")), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.id = EMBED_SCRIPT_ID;
    s.async = true;
    s.src = EMBED_SRC;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("Instagram embed script failed"));
    document.body.appendChild(s);
  });
}

export function InstagramHomeEmbeds({ urls }: { urls: string[] }) {
  const headingId = useId();

  useEffect(() => {
    if (!urls.length) return;
    let cancelled = false;
    const run = async () => {
      try {
        await loadEmbedScript();
        if (cancelled) return;
        window.instgrm?.Embeds.process();
        // Second pass after layout (embed.js sometimes needs a tick)
        requestAnimationFrame(() => window.instgrm?.Embeds.process());
      } catch {
        /* non-fatal: embed may still render on retry */
      }
    };
    void run();
    const t = window.setTimeout(run, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [urls]);

  if (!urls.length) return null;

  return (
    <section className="bg-surface py-16 sm:py-20" aria-labelledby={headingId}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 space-y-2 text-center sm:text-left">
          <p className="font-label text-sm font-bold uppercase tracking-widest text-primary">Social</p>
          <h2 id={headingId} className="font-headline text-3xl font-extrabold text-on-surface sm:text-4xl">
            From our Instagram
          </h2>
          <p className="max-w-2xl text-on-surface-variant">
            Latest reels and posts from your curated list — update manually in admin or sync from Instagram when Graph API credentials are configured.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {urls.map((permalink) => (
            <div
              key={permalink}
              className="flex min-h-[480px] justify-center overflow-hidden rounded-[2rem] border border-outline-variant/25 bg-surface-container-lowest p-4 shadow-sm sm:min-h-[520px]"
            >
              <blockquote
                className="instagram-media"
                data-instgrm-captioned
                data-instgrm-permalink={permalink}
                data-instgrm-version="14"
                style={{
                  background: "#fff",
                  border: 0,
                  borderRadius: "12px",
                  margin: "0 auto",
                  maxWidth: "540px",
                  minWidth: "240px",
                  width: "100%",
                }}
              >
                <a href={permalink} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  View on Instagram
                </a>
              </blockquote>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
