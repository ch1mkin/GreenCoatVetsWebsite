/** Sunday-based week (matches typical calendar headers). */

export type CalendarView = "day" | "week" | "month";

const DEFAULT_CALENDAR_TIME_ZONE =
  typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

export function resolveCalendarTimeZone(clinicTimeZone?: string | null): string {
  const trimmed = (clinicTimeZone ?? "").trim();
  if (!trimmed) return DEFAULT_CALENDAR_TIME_ZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return DEFAULT_CALENDAR_TIME_ZONE;
  }
}

function datePartsInTimeZone(isoOrDate: string | Date, timeZone: string) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

/** YYYY-MM-DD in the clinic (or viewer) timezone — used for column placement. */
export function toDateKeyInTimeZone(isoOrDate: string | Date, timeZone: string): string {
  const { year, month, day } = datePartsInTimeZone(isoOrDate, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Minutes from midnight in the given timezone (for vertical layout). */
export function minutesFromMidnightInTimeZone(isoOrDate: string | Date, timeZone: string): number {
  const { hour, minute } = datePartsInTimeZone(isoOrDate, timeZone);
  return hour * 60 + minute;
}

export function formatCalendarTime(
  isoOrDate: string | Date,
  timeZone: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return date.toLocaleTimeString(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    ...options,
  });
}

/** Label for a row that starts at hour24:00 on the clinic day grid (8–20). */
export function formatHourLabel(hour24: number): string {
  if (hour24 === 0) return "12 AM";
  if (hour24 === 12) return "12 PM";
  if (hour24 < 12) return `${hour24} AM`;
  return `${hour24 - 12} PM`;
}

export function startOfWeekSunday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function parseLocalDateKey(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

export function startOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x;
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/** First cell in month grid (may be in previous month) — Sunday-aligned. */
export function startOfCalendarGridMonth(monthAnchor: Date): Date {
  const first = startOfMonth(monthAnchor);
  const dow = first.getDay();
  return addDays(first, -dow);
}

export function monthGridDays(monthAnchor: Date): Date[] {
  const start = startOfCalendarGridMonth(monthAnchor);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export type FetchRange = { startIso: string; endIso: string };

export function rangeForView(view: CalendarView, anchor: Date): FetchRange {
  const a = new Date(anchor);
  a.setHours(12, 0, 0, 0);

  if (view === "day") {
    const start = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, 0, 0);
    const end = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  if (view === "week") {
    const ws = startOfWeekSunday(a);
    const we = addDays(ws, 6);
    we.setHours(23, 59, 59, 999);
    ws.setHours(0, 0, 0, 0);
    return { startIso: ws.toISOString(), endIso: we.toISOString() };
  }

  // month — full 6×7 grid may include adjacent-month days
  const gridStart = startOfCalendarGridMonth(a);
  gridStart.setHours(0, 0, 0, 0);
  const gridEnd = addDays(gridStart, 41);
  gridEnd.setHours(23, 59, 59, 999);
  return { startIso: gridStart.toISOString(), endIso: gridEnd.toISOString() };
}
