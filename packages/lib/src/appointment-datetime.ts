/** Minimum value for `<input type="datetime-local" />` (local timezone). */
export function getMinAppointmentDateTimeLocalValue(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function parseAppointmentDateTimeLocal(raw: string): Date {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    throw new Error("Date and time are required.");
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid appointment date and time.");
  }
  return parsed;
}

/** Rejects appointments in the past (with a 1-minute grace for clock skew). */
export function assertAppointmentStartsInFuture(raw: string, now = new Date()): Date {
  const startsAt = parseAppointmentDateTimeLocal(raw);
  if (startsAt.getTime() < now.getTime() - 60_000) {
    throw new Error("Please choose a future date and time. Past appointments cannot be booked.");
  }
  return startsAt;
}
