"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  addDays,
  addMonths,
  CalendarView,
  monthGridDays,
  parseLocalDateKey,
  startOfMonth,
  startOfWeekSunday,
  toLocalDateKey,
} from "@/lib/appointments/calendar-utils";
import {
  appointmentBlockClasses,
  appointmentTypeLabel,
  legendDotClass,
} from "@/components/appointments/appointment-type-styles";

const SLOT_PX = 80;
const START_HOUR = 8;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

export type CalendarAppointmentRow = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  appointment_type: string;
  status: string;
  pet_name: string | null;
  owner_name: string | null;
  doctor_name: string | null;
  branch_name: string | null;
};

const TYPE_KEYS = ["consultation", "vaccination", "surgery", "grooming", "emergency"] as const;

function buildHref(opts: {
  date: string;
  view: CalendarView;
  doctorId: string;
  q: string;
}) {
  const sp = new URLSearchParams();
  sp.set("date", opts.date);
  sp.set("view", opts.view);
  if (opts.doctorId) sp.set("doctor_id", opts.doctorId);
  if (opts.q.trim()) sp.set("q", opts.q.trim());
  return `/appointments/calendar?${sp.toString()}`;
}

function minutesSinceDayStart(d: Date): number {
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

function layoutBlock(startsAt: string, endsAt: string | null): { top: number; height: number } | null {
  const start = new Date(startsAt);
  const end = endsAt ? new Date(endsAt) : new Date(start.getTime() + 30 * 60 * 1000);
  const windowStart = START_HOUR * 60;
  const windowEnd = END_HOUR * 60 + 59;
  let startMin = minutesSinceDayStart(start);
  let endMin = Math.max(startMin + 15, minutesSinceDayStart(end));

  if (endMin <= windowStart || startMin >= windowEnd) return null;

  startMin = Math.max(startMin, windowStart);
  endMin = Math.min(endMin, windowEnd);
  const top = ((startMin - windowStart) / 60) * SLOT_PX;
  const height = Math.max(((endMin - startMin) / 60) * SLOT_PX, 36);
  return { top, height };
}

export function AppointmentCalendarBoard({
  anchorDateKey,
  view,
  doctorId,
  searchQ,
  appointments,
}: {
  anchorDateKey: string;
  view: CalendarView;
  doctorId: string;
  searchQ: string;
  doctors: { id: string; full_name: string }[];
  appointments: CalendarAppointmentRow[];
}) {
  const anchor = parseLocalDateKey(anchorDateKey) ?? new Date();
  const weekStart = startOfWeekSunday(anchor);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const miniMonthStart = startOfMonth(anchor);
  const miniGrid = useMemo(() => monthGridDays(miniMonthStart), [miniMonthStart]);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return appointments;
    return appointments.filter((a) => {
      const blob = [a.pet_name, a.owner_name, a.doctor_name, a.branch_name, a.appointment_type]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [appointments, searchQ]);

  const nextUp = useMemo(() => {
    const now = Date.now();
    return [...filtered]
      .filter((a) => a.status !== "cancelled")
      .filter((a) => new Date(a.starts_at).getTime() >= now - 60 * 60 * 1000)
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
      .slice(0, 5);
  }, [filtered]);

  const isToday = (dk: string) => dk === toLocalDateKey(new Date());

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-0 overflow-hidden lg:flex-row">
      {/* Sidebar: mini month + legend + next up */}
      <aside className="hidden w-full shrink-0 flex-col gap-8 overflow-y-auto border-b border-outline-variant/20 bg-surface-container-low p-6 xl:flex xl:w-72 xl:border-b-0 xl:border-r">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-headline text-sm font-bold">
              {miniMonthStart.toLocaleString(undefined, { month: "long", year: "numeric" })}
            </span>
            <div className="flex gap-1">
              <Link
                href={buildHref({
                  date: toLocalDateKey(addMonths(anchor, -1)),
                  view,
                  doctorId,
                  q: searchQ,
                })}
                className="material-symbols-outlined cursor-pointer text-lg text-on-surface-variant transition-colors hover:text-primary"
                aria-label="Previous month"
              >
                chevron_left
              </Link>
              <Link
                href={buildHref({
                  date: toLocalDateKey(addMonths(anchor, 1)),
                  view,
                  doctorId,
                  q: searchQ,
                })}
                className="material-symbols-outlined cursor-pointer text-lg text-on-surface-variant transition-colors hover:text-primary"
                aria-label="Next month"
              >
                chevron_right
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-2 text-center text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant">
            <span>S</span>
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>T</span>
            <span>F</span>
            <span>S</span>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
            {miniGrid.map((d) => {
              const dk = toLocalDateKey(d);
              const inMonth = d.getMonth() === miniMonthStart.getMonth();
              const active = dk === anchorDateKey;
              return (
                <Link
                  key={dk}
                  href={buildHref({ date: dk, view: "week", doctorId, q: searchQ })}
                  className={`rounded-lg p-2 transition-colors ${
                    !inMonth ? "text-outline-variant/50" : "hover:bg-surface-container-lowest"
                  } ${active ? "bg-primary font-bold text-on-primary" : ""}`}
                >
                  {d.getDate()}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Categories</h4>
          <div className="space-y-3">
            {TYPE_KEYS.map((t) => (
              <div key={t} className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${legendDotClass(t)}`} />
                <span className="text-sm font-medium text-on-surface">{appointmentTypeLabel(t)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Next up</h4>
          <div className="space-y-3">
            {nextUp.length ? (
              nextUp.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl bg-surface-container-lowest p-3 shadow-sm"
                >
                  <div className={`h-8 w-2 rounded-full ${legendDotClass(a.appointment_type)}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-on-background">
                      {a.pet_name ?? "Pet"} ({a.owner_name ?? "Owner"})
                    </p>
                    <p className="text-[10px] text-on-surface-variant">
                      {new Date(a.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} •{" "}
                      {appointmentTypeLabel(a.appointment_type)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-on-surface-variant">No upcoming appointments in this range.</p>
            )}
          </div>
        </div>
      </aside>

      {/* Main board */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href={buildHref({ date: anchorDateKey, view: "week", doctorId, q: searchQ })}
              className="flex items-center gap-2 font-headline text-lg font-extrabold text-primary hover:opacity-90 md:text-xl"
            >
              {anchor.toLocaleString(undefined, { month: "long", year: "numeric" })}
              <span className="material-symbols-outlined">expand_more</span>
            </Link>
            <div className="flex rounded-xl bg-surface-container-low p-1">
              {(["day", "week", "month"] as const).map((v) => {
                const active = view === v;
                return (
                  <Link
                    key={v}
                    href={buildHref({ date: anchorDateKey, view: v, doctorId, q: searchQ })}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-all ${
                      active ? "bg-white shadow-sm" : "hover:bg-white/70"
                    }`}
                  >
                    {v}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={buildHref({
                date: toLocalDateKey(addDays(anchor, view === "month" ? -30 : view === "week" ? -7 : -1)),
                view,
                doctorId,
                q: searchQ,
              })}
              className="rounded-lg bg-surface-container-low p-2 transition-colors hover:bg-surface-container-high"
              aria-label="Previous"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </Link>
            <Link
              href={buildHref({ date: toLocalDateKey(new Date()), view, doctorId, q: searchQ })}
              className="rounded-lg bg-surface-container-low px-4 py-1.5 text-sm font-bold hover:bg-surface-container-high"
            >
              Today
            </Link>
            <Link
              href={buildHref({
                date: toLocalDateKey(addDays(anchor, view === "month" ? 30 : view === "week" ? 7 : 1)),
                view,
                doctorId,
                q: searchQ,
              })}
              className="rounded-lg bg-surface-container-low p-2 transition-colors hover:bg-surface-container-high"
              aria-label="Next"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </Link>
          </div>
        </div>

        {view === "month" ? (
          <MonthGrid anchor={anchor} appointments={filtered} buildHref={buildHref} doctorId={doctorId} q={searchQ} />
        ) : (
          <TimeGrid
            view={view}
            anchorDateKey={anchorDateKey}
            weekDays={weekDays}
            appointments={filtered}
            isToday={isToday}
          />
        )}
      </section>

      {/* Mobile bottom */}
      <nav className="fixed bottom-6 left-1/2 z-40 flex min-w-[300px] -translate-x-1/2 items-center justify-center gap-2 rounded-full border border-outline-variant/15 bg-white/90 px-5 py-3 shadow-lg backdrop-blur-xl md:hidden">
        <Link
          href={buildHref({ date: anchorDateKey, view: "week", doctorId, q: searchQ })}
          className="flex items-center gap-2 rounded-full bg-primary/15 px-4 py-2 font-manrope text-[10px] font-semibold uppercase tracking-wider text-primary"
        >
          <span className="material-symbols-outlined text-base">calendar_view_day</span>
          Calendar
        </Link>
        <Link
          href="/appointments"
          className="flex items-center gap-2 px-4 py-2 font-manrope text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
        >
          <span className="material-symbols-outlined text-base">format_list_bulleted</span>
          List
        </Link>
        <Link
          href="/analytics"
          className="flex items-center gap-2 px-4 py-2 font-manrope text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant"
        >
          <span className="material-symbols-outlined text-base">query_stats</span>
          Analytics
        </Link>
      </nav>

      <Link
        href="/appointments#create-appointment"
        className="fixed bottom-24 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-container to-primary text-white shadow-[0_12px_32px_rgba(0,108,80,0.3)] transition-transform hover:scale-105 active:scale-95 md:bottom-8 md:right-8"
        title="New appointment"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </Link>
    </div>
  );
}

function MonthGrid({
  anchor,
  appointments,
  buildHref,
  doctorId,
  q,
}: {
  anchor: Date;
  appointments: CalendarAppointmentRow[];
  buildHref: (o: { date: string; view: CalendarView; doctorId: string; q: string }) => string;
  doctorId: string;
  q: string;
}) {
  const miniMonthStart = startOfMonth(anchor);
  const days = useMemo(() => monthGridDays(miniMonthStart), [miniMonthStart]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of appointments) {
      const k = toLocalDateKey(new Date(a.starts_at));
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [appointments]);

  return (
    <div className="flex-1 overflow-auto px-4 pb-24 md:px-6">
      <div className="calendar-grid min-h-[420px] gap-px overflow-hidden rounded-xl border border-outline-variant/20 bg-outline-variant/20">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-surface-container-low/80 p-2 text-center text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {d}
          </div>
        ))}
        {days.map((d) => {
          const dk = toLocalDateKey(d);
          const inMonth = d.getMonth() === miniMonthStart.getMonth();
          const n = counts.get(dk) ?? 0;
          return (
            <Link
              key={dk}
              href={buildHref({ date: dk, view: "day", doctorId, q })}
              className={`min-h-[72px] bg-surface-container-lowest p-2 transition-colors hover:bg-surface-container ${
                !inMonth ? "opacity-40" : ""
              }`}
            >
              <p className="text-sm font-bold text-on-background">{d.getDate()}</p>
              {n > 0 ? (
                <p className="mt-1 text-[10px] font-semibold text-primary">{n} appt{n > 1 ? "s" : ""}</p>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function TimeGrid({
  view,
  anchorDateKey,
  weekDays,
  appointments,
  isToday,
}: {
  view: "day" | "week";
  anchorDateKey: string;
  weekDays: Date[];
  appointments: CalendarAppointmentRow[];
  isToday: (dk: string) => boolean;
}) {
  const anchorDay = parseLocalDateKey(anchorDateKey) ?? weekDays[0];
  const displayDays = view === "day" ? [anchorDay] : weekDays;
  const displayKeys = displayDays.map((d) => toLocalDateKey(d));

  const totalHeight = (END_HOUR - START_HOUR + 1) * SLOT_PX;

  return (
    <div className={`flex-1 overflow-auto px-4 pb-28 md:px-6 md:pb-10 ${view === "day" ? "" : "min-w-[800px]"}`}>
      <div className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-low/30">
        {/* Day headers */}
        <div
          className={`sticky top-0 z-10 grid bg-surface-container-low/50 backdrop-blur-sm ${
            view === "day" ? "grid-cols-1" : "grid-cols-7"
          }`}
        >
          {displayDays.map((d) => {
            const dk = toLocalDateKey(d);
            const today = isToday(dk);
            return (
              <div key={dk} className="border-none p-4 text-center">
                <p
                  className={`text-[10px] font-bold uppercase tracking-widest ${
                    today ? "text-primary" : "text-on-surface-variant"
                  }`}
                >
                  {d.toLocaleString(undefined, { weekday: "short" })}
                </p>
                <p className={`font-headline text-xl font-bold ${today ? "text-primary" : "text-on-background"}`}>
                  {String(d.getDate()).padStart(2, "0")}
                </p>
              </div>
            );
          })}
        </div>

        <div className="relative" style={{ minHeight: totalHeight }}>
          {/* Time labels */}
          <div
            className="absolute left-0 top-0 flex w-16 flex-col border-r border-outline-variant/30"
            style={{ height: totalHeight }}
          >
            {HOURS.map((h) => (
              <div key={h} className="flex h-20 shrink-0 items-start justify-center border-b border-outline-variant/10 pt-2">
                <span className="text-[10px] font-bold text-on-surface-variant/70">
                  {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
                </span>
              </div>
            ))}
          </div>

          <div className="ml-16" style={{ minHeight: totalHeight }}>
            <div
              className="calendar-grid relative h-full"
              style={{
                gridTemplateColumns: view === "day" ? "minmax(0,1fr)" : "repeat(7, minmax(0, 1fr))",
                minHeight: totalHeight,
              }}
            >
              {displayKeys.map((dk) => (
                <div key={dk} className="relative border-r border-outline-variant/20 last:border-r-0">
                  {HOURS.map((h) => (
                    <div key={h} className="h-20 border-b border-outline-variant/10" />
                  ))}
                </div>
              ))}

              {appointments.map((a) => {
                const start = new Date(a.starts_at);
                const dayKey = toLocalDateKey(start);
                const colIndex = displayKeys.indexOf(dayKey);
                if (colIndex < 0) return null;
                const layout = layoutBlock(a.starts_at, a.ends_at);
                if (!layout) return null;
                const cancelled = a.status === "cancelled";

                return (
                  <Link
                    key={a.id}
                    href={`/appointments#appt-${a.id}`}
                    className={`absolute z-[1] flex flex-col justify-between rounded-xl p-2 shadow-sm transition-all hover:brightness-95 ${appointmentBlockClasses(
                      a.appointment_type
                    )} ${cancelled ? "opacity-50 line-through" : ""}`}
                    style={{
                      top: layout.top,
                      height: layout.height,
                      left:
                        view === "day"
                          ? "4px"
                          : `calc((100% / 7) * ${colIndex} + 5px)`,
                      width: view === "day" ? "calc(100% - 8px)" : "calc(100% / 7 - 10px)",
                    }}
                  >
                    <div>
                      <p className="text-xs font-bold leading-tight">
                        {a.pet_name ?? "Pet"} {a.owner_name ? `(${a.owner_name})` : ""}
                      </p>
                      <p className="text-[10px] opacity-90">{appointmentTypeLabel(a.appointment_type)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        person
                      </span>
                      <span className="text-[10px] font-medium">{a.doctor_name ?? "Unassigned"}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
