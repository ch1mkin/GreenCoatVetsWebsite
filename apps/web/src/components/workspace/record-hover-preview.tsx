"use client";

import { ReactNode, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DELAY_MS = 280;

/**
 * Rich hover card (ezyVet-style record preview). Shows after a short delay; follows cursor slightly.
 */
export function RecordHoverPreview({ content, children }: { content: ReactNode; children: ReactNode }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onEnter = (e: React.MouseEvent) => {
    clearTimer();
    timer.current = setTimeout(() => {
      setPos({ x: e.clientX + 14, y: e.clientY + 10 });
      setShow(true);
    }, DELAY_MS);
  };

  const onMove = (e: React.MouseEvent) => {
    if (show) {
      setPos({ x: e.clientX + 14, y: e.clientY + 10 });
    }
  };

  const onLeave = () => {
    clearTimer();
    setShow(false);
  };

  const card =
    show && typeof document !== "undefined"
      ? createPortal(
          <div
            className="pointer-events-none z-[100] max-w-[min(100vw-24px,320px)] rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3 text-left text-sm shadow-xl"
            style={{
              position: "fixed",
              left: Math.min(pos.x, typeof window !== "undefined" ? window.innerWidth - 340 : pos.x),
              top: Math.min(pos.y, typeof window !== "undefined" ? window.innerHeight - 200 : pos.y),
            }}
          >
            {content}
          </div>,
          document.body
        )
      : null;

  return (
    <div className="block w-full" onMouseEnter={onEnter} onMouseMove={onMove} onMouseLeave={onLeave}>
      {children}
      {card}
    </div>
  );
}
