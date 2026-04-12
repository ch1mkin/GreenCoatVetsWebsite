/**
 * Visual "chain" between primary module tabs and workspace record tabs (PMS-style navigation).
 */
export function WorkspaceChainConnector() {
  return (
    <div
      className="flex h-7 shrink-0 items-center gap-2 border-b border-black/20 bg-gradient-to-r from-slate-900/90 via-slate-800/95 to-slate-900/90 px-3"
      aria-hidden
    >
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/45">
        <span className="material-symbols-outlined text-[16px] text-amber-400/90">account_tree</span>
        <span className="hidden sm:inline">Linked workspace</span>
      </div>
      <div className="relative h-0 min-w-[24px] flex-1 border-t border-dashed border-white/25" />
      <span
        className="material-symbols-outlined shrink-0 text-[18px] text-cyan-300/90"
        title="Chained context"
      >
        link
      </span>
      <div className="relative h-0 min-w-[24px] flex-1 border-t border-dashed border-white/25" />
      <div className="hidden items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-white/40 sm:flex">
        <span>Records</span>
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
      </div>
    </div>
  );
}
