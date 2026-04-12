/** Must match website `isAllowedDeliveryCity` expectations (Tricity). */
export const DELIVERY_CITIES = [
  { value: "chandigarh", label: "Chandigarh" },
  { value: "mohali", label: "Mohali (SAS Nagar)" },
  { value: "panchkula", label: "Panchkula" },
] as const;

export type DeliveryCityValue = (typeof DELIVERY_CITIES)[number]["value"];
