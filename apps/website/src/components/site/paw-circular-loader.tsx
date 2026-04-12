import type { HTMLAttributes } from "react";

const sizeClasses = {
  sm: { wrap: "h-12 w-12", paw: "text-2xl" },
  md: { wrap: "h-20 w-20", paw: "text-3xl" },
  lg: { wrap: "h-28 w-28", paw: "text-5xl" },
} as const;

type Size = keyof typeof sizeClasses;

export type PawCircularLoaderProps = {
  size?: Size;
  message?: string;
  className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, "children">;

export function PawCircularLoader({ size = "md", message, className = "", ...rest }: PawCircularLoaderProps) {
  const dim = sizeClasses[size];
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={`flex flex-col items-center justify-center gap-3 ${className}`} {...rest}>
      <div className={`relative flex ${dim.wrap} shrink-0 items-center justify-center`}>
        <div
          className="absolute inset-0 rounded-full border-4 border-primary/15 border-t-primary motion-safe:animate-spin"
          style={{ animationDuration: "0.85s" }}
        />
        <span className={`relative z-[1] select-none leading-none ${dim.paw}`} aria-hidden>
          🐾
        </span>
      </div>
      {message ? <p className="text-center text-sm font-medium text-on-surface-variant">{message}</p> : null}
    </div>
  );
}
