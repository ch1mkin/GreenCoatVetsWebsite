import type { ReactNode } from "react";

/** Dense modular section: full page uses card; embed uses collapsible &lt;details&gt; to save vertical space. */
export function VisitSection({
  embed,
  id,
  title,
  defaultOpen = false,
  description,
  children,
}: {
  embed: boolean;
  id?: string;
  title: string;
  defaultOpen?: boolean;
  description?: ReactNode;
  children: ReactNode;
}) {
  if (embed) {
    return (
      <details
        id={id}
        className="group rounded-lg border border-slate-200/90 bg-white shadow-sm"
        open={defaultOpen}
      >
        <summary className="cursor-pointer list-none px-3 py-2 font-headline text-[13px] font-bold text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            <span>{title}</span>
            <span className="material-symbols-outlined text-base text-slate-400 transition-transform group-open:rotate-180">
              expand_more
            </span>
          </span>
        </summary>
        <div className="border-t border-slate-100 px-3 pb-3 pt-2 text-[13px] leading-snug">
          {description ? <div className="mb-2 text-[11px] text-slate-600">{description}</div> : null}
          {children}
        </div>
      </details>
    );
  }

  return (
    <section id={id} className="card-soft card-compact scroll-mt-24 space-y-2">
      <h2 className="font-headline text-sm font-bold text-on-background">{title}</h2>
      {description ? <div className="text-[11px] text-on-surface-variant">{description}</div> : null}
      {children}
    </section>
  );
}
