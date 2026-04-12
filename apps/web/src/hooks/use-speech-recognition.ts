"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecStatus = "idle" | "listening" | "unsupported";

function getSpeechRecognitionCtor(): (new () => SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(lang: string) {
  const [status, setStatus] = useState<SpeechRecStatus>("idle");
  const [line, setLine] = useState("");
  const [error, setError] = useState<string | null>(null);
  const finalRef = useRef("");
  const recRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i]![0]!.transcript;
        if (event.results[i]!.isFinal) {
          const t = piece.trim();
          if (t) {
            finalRef.current = finalRef.current ? `${finalRef.current} ${t}` : t;
          }
        } else {
          interim += piece;
        }
      }
      const show = (finalRef.current + (interim ? ` ${interim.trim()}` : "")).trim();
      setLine(show);
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      if (ev.error === "aborted" || ev.error === "no-speech") return;
      setError(ev.error === "not-allowed" ? "Microphone permission denied." : ev.message || ev.error);
      setStatus("idle");
    };

    rec.onend = () => {
      setStatus("idle");
    };

    recRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* noop */
      }
      recRef.current = null;
    };
  }, []);

  useEffect(() => {
    const rec = recRef.current;
    if (rec && status !== "unsupported") {
      rec.lang = lang;
    }
  }, [lang, status]);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    setError(null);
    finalRef.current = "";
    setLine("");
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.lang = lang;
      rec.start();
      setStatus("listening");
    } catch {
      setError("Could not start microphone. Try again.");
      setStatus("idle");
    }
  }, [lang]);

  const stop = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      /* noop */
    }
    setStatus("idle");
  }, []);

  const clearLine = useCallback(() => {
    finalRef.current = "";
    setLine("");
    setError(null);
  }, []);

  return { status, line, error, start, stop, clearLine };
}
