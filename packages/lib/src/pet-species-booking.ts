/**
 * Canonical species values stored on `pets.species` for owner / guest bookings and pet profiles.
 * Binomial or standard taxonomic labels align with clinical records, visits, and prescriptions.
 */
export type PetSpeciesBookingOption = { readonly value: string; readonly label: string };

export const PET_SPECIES_BOOKING_OPTIONS: readonly PetSpeciesBookingOption[] = [
  { value: "Canis familiaris", label: "Canis familiaris (domestic dog)" },
  { value: "Felis catus", label: "Felis catus (domestic cat)" },
  { value: "Oryctolagus cuniculus", label: "Oryctolagus cuniculus (rabbit)" },
  { value: "Aves", label: "Aves (birds)" },
  { value: "Equus caballus", label: "Equus caballus (horse)" },
  { value: "Cavia porcellus", label: "Cavia porcellus (guinea pig)" },
  { value: "Mustela putorius furo", label: "Mustela putorius furo (ferret)" },
] as const;

export const DEFAULT_PET_SPECIES_BOOKING_VALUE = PET_SPECIES_BOOKING_OPTIONS[0].value;

/** Set of canonical booking values (for validation / normalizing legacy common names). */
const BOOKING_SPECIES_VALUE_SET = new Set(PET_SPECIES_BOOKING_OPTIONS.map((o) => o.value));

/**
 * Map legacy common names or unknown text to a canonical booking value when possible;
 * otherwise returns trimmed `stored` (custom taxonomic / clinic-specific label).
 */
export function normalizeLegacySpeciesToCanonical(stored: string): string {
  const t = stored.trim();
  if (!t) return DEFAULT_PET_SPECIES_BOOKING_VALUE;
  if (BOOKING_SPECIES_VALUE_SET.has(t)) return t;
  const l = t.toLowerCase();
  const byLower = PET_SPECIES_BOOKING_OPTIONS.find((o) => o.value.toLowerCase() === l);
  if (byLower) return byLower.value;
  if (l === "dog" || l === "canine" || l === "puppy") return "Canis familiaris";
  if (l === "cat" || l === "feline" || l === "kitten") return "Felis catus";
  if (l === "bird" || l === "avian") return "Aves";
  if (l === "rabbit") return "Oryctolagus cuniculus";
  if (l === "horse" || l === "equine" || l === "pony") return "Equus caballus";
  if (l.includes("guinea")) return "Cavia porcellus";
  if (l === "ferret") return "Mustela putorius furo";
  return t;
}

/** PostgREST `.or()` filter: canine patients (legacy + scientific strings). */
export const SPECIES_OR_FILTER_CANINE =
  "species.ilike.%canis%,species.ilike.%dog%,species.ilike.%canine%,species.ilike.%puppy%";

/** PostgREST `.or()` filter: feline patients. */
export const SPECIES_OR_FILTER_FELINE =
  "species.ilike.%felis%,species.ilike.%cat%,species.ilike.%feline%,species.ilike.%kitten%";
