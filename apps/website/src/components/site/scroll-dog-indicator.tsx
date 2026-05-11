"use client";

import { useEffect, useRef, useState } from "react";

type Direction = "up" | "down";
type IdlePose = "sit" | "sleep";

/**
 * Decorative site-wide scroll tracker for the public website.
 * It does not replace the native scrollbar; it mirrors page scroll with a playful paw marker.
 */
export function ScrollDogIndicator() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState<Direction>("down");
  const [moving, setMoving] = useState(false);
  const [idlePose, setIdlePose] = useState<IdlePose>("sit");
  const lastY = useRef(0);
  const moveTimer = useRef<number | undefined>(undefined);
  const sleepTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const clearTimers = () => {
      if (moveTimer.current !== undefined) window.clearTimeout(moveTimer.current);
      if (sleepTimer.current !== undefined) window.clearTimeout(sleepTimer.current);
    };

    const update = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 0);
      const y = window.scrollY;
      setVisible(maxScroll > 280);
      setProgress(maxScroll > 0 ? Math.min(Math.max(y / maxScroll, 0), 1) : 0);

      const delta = y - lastY.current;
      if (Math.abs(delta) > 1) {
        setDirection(delta > 0 ? "down" : "up");
        setMoving(true);
        setIdlePose("sit");
        clearTimers();
        moveTimer.current = window.setTimeout(() => setMoving(false), 140);
        sleepTimer.current = window.setTimeout(() => setIdlePose("sleep"), 1250);
      }
      lastY.current = y;
    };

    update();
    const initialSleep = window.setTimeout(() => setIdlePose("sleep"), 1250);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.clearTimeout(initialSleep);
      clearTimers();
    };
  }, []);

  if (!visible) return null;

  const stateClass = moving ? `scroll-dog--${direction}` : idlePose === "sleep" ? "scroll-dog--sleep" : "scroll-dog--sit";

  return (
    <div className="scroll-dog-indicator" aria-hidden="true">
      <div className="scroll-dog-track" />
      <div
        className={`scroll-dog-runner ${stateClass}`}
        style={{ top: `calc(${progress.toFixed(4)} * (100% - 3rem))` }}
      >
        <span className="scroll-dog-shadow" />
        <span className="material-symbols-outlined scroll-dog-emoji scroll-paw-icon">pets</span>
        {moving ? (
          <span className="scroll-dog-arrow">{direction === "down" ? "↓" : "↑"}</span>
        ) : idlePose === "sleep" ? (
          <span className="scroll-dog-zzz">Zzz</span>
        ) : null}
      </div>
    </div>
  );
}
