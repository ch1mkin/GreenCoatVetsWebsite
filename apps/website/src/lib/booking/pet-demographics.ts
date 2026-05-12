export const BOOKING_PET_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
] as const;

export type BookingPetGender = (typeof BOOKING_PET_GENDER_OPTIONS)[number]["value"];

export function normalizeBookingPetGender(value: string | null | undefined): BookingPetGender | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "male" || normalized === "female" || normalized === "unknown") {
    return normalized;
  }
  return null;
}

export function parseBookingAgeYearsToMonths(value: string | null | undefined): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const years = Number(raw);
  if (!Number.isFinite(years) || years <= 0) return null;
  return Math.max(1, Math.round(years * 12));
}

export function formatBookingAgeYearsLabel(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const years = Number(raw);
  if (!Number.isFinite(years) || years <= 0) return null;
  const formatted = Number.isInteger(years) ? String(years) : years.toFixed(1).replace(/\.0$/, "");
  return `${formatted} year${years === 1 ? "" : "s"}`;
}
