/** Service area for store delivery (Tricity). */
export const DELIVERY_CITY_OPTIONS = [
  { value: "chandigarh", label: "Chandigarh" },
  { value: "mohali", label: "Mohali (SAS Nagar)" },
  { value: "panchkula", label: "Panchkula" },
] as const;

export type DeliveryCityValue = (typeof DELIVERY_CITY_OPTIONS)[number]["value"];

const NORMALIZED = new Set(DELIVERY_CITY_OPTIONS.map((c) => c.value));

export function normalizeDeliveryCity(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Accepts canonical values or common spellings. */
export function isAllowedDeliveryCity(raw: string): boolean {
  const s = normalizeDeliveryCity(raw);
  if (NORMALIZED.has(s as DeliveryCityValue)) return true;
  if (s.includes("mohali") || s.includes("sahibzada") || s.includes("sas nagar")) return true;
  if (s.includes("chandigarh")) return true;
  if (s.includes("panchkula")) return true;
  return false;
}

export function deliveryCityNotAllowedMessage(): string {
  return "We currently deliver only to Chandigarh, Mohali, and Panchkula. Please choose one of these cities or contact the clinic.";
}
