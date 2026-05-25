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
  const listeningRef = useRef(false);

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
      const message =
        ev.error === "not-allowed"
          ? "Microphone permission denied."
          : ev.error === "network"
            ? "Speech recognition needs network access. Check your connection or try Chrome/Edge."
            : ev.error === "service-not-allowed"
              ? "Speech recognition is not available in this browser. Try Chrome or Edge on desktop."
              : ev.message || ev.error;
      setError(message);
      listeningRef.current = false;
      setStatus("idle");
    };

    rec.onend = () => {
      if (listeningRef.current) {
        try {
          rec.start();
          return;
        } catch {
          listeningRef.current = false;
        }
      }
      setStatus("idle");
    };

    recRef.current = rec;
    return () => {
      listeningRef.current = false;
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
      setError("Voice input needs Chrome, Edge, or Safari with microphone access.");
      return;
    }
    setError(null);
    finalRef.current = "";
    setLine("");
    const rec = recRef.current;
    if (!rec) return;
    try {
      rec.lang = lang;
      listeningRef.current = true;
      rec.start();
      setStatus("listening");
    } catch {
      setError("Could not start microphone. Close other apps using the mic and try again.");
      listeningRef.current = false;
      setStatus("idle");
    }
  }, [lang]);

  const stop = useCallback(() => {
    listeningRef.current = false;
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
