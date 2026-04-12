/** Aligns with web portal pet sex values (`pets.gender`). */
export const PET_GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
] as const;

export type PetGenderValue = (typeof PET_GENDER_OPTIONS)[number]["value"];

export function parseAgeYearsToMonths(yearsText: string): number | null {
  const t = yearsText.trim().replace(",", ".");
  if (!t) return null;
  const y = parseFloat(t);
  if (!Number.isFinite(y) || y < 0 || y > 120) return null;
  return Math.round(y * 12);
}

/** Prefill age field from DB `age_months`. */
export function monthsToAgeYearsInput(months: number | null | undefined): string {
  if (months == null || !Number.isFinite(months)) return "";
  const y = months / 12;
  return Number.isInteger(y) ? String(y) : y.toFixed(1).replace(/\.0$/, "");
}

export function formatPetAgeGenderSubtitle(pet: {
  gender?: string | null;
  age_months?: number | null;
}): string {
  const g = pet.gender?.trim();
  /** Omit "unknown" so default sex does not clutter every row. */
  const genderLabel = g === "male" ? "Male" : g === "female" ? "Female" : "";
  const m = pet.age_months;
  let agePart = "";
  if (m != null && Number.isFinite(m) && m >= 0) {
    if (m < 24) agePart = `${m} mo`;
    else agePart = `${Math.round((m / 12) * 10) / 10} yr`;
  }
  return [genderLabel, agePart].filter(Boolean).join(" · ");
}
