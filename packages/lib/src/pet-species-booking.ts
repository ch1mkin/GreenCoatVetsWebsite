/**
 * Canonical species stored on `pets.species`: canine, feline, exotic, avian, equine (lowercase).
 * Labels are simple category names everywhere in the product (no scientific binomials).
 */
export type PetSpeciesBookingOption = { readonly value: string; readonly label: string };

export const PET_SPECIES_BOOKING_OPTIONS: readonly PetSpeciesBookingOption[] = [
  { value: "canine", label: "Canine" },
  { value: "feline", label: "Feline" },
  { value: "exotic", label: "Exotic" },
  { value: "avian", label: "Avian" },
  { value: "equine", label: "Equine" },
] as const;

export const DEFAULT_PET_SPECIES_BOOKING_VALUE = PET_SPECIES_BOOKING_OPTIONS[0].value;

const CANONICAL = new Set(PET_SPECIES_BOOKING_OPTIONS.map((o) => o.value));

/**
 * Map legacy scientific names, common names, or free text to one of the five canonical values.
 */
export function normalizeLegacySpeciesToCanonical(stored: string): string {
  const t = stored.trim();
  if (!t) return DEFAULT_PET_SPECIES_BOOKING_VALUE;
  const l = t.toLowerCase();
  if (CANONICAL.has(l)) return l;

  // Legacy binomials / old product strings → simple category
  if (/\bcanis\b|dog|canine|puppy/.test(l)) return "canine";
  if (/\bfelis\b|cat|feline|kitten/.test(l)) return "feline";
  if (/\baves\b|bird|avian|parrot|cockatiel|budgie|duck|chicken/.test(l)) return "avian";
  if (/\bequus\b|horse|equine|pony|donkey|mule/.test(l)) return "equine";
  if (
    /(oryctolagus|cuniculus|cavia|mustela|ferret|guinea|rodent|rabbit|reptile|snake|lizard|turtle|exotic|hamster|chinchilla)/.test(
      l,
    )
  ) {
    return "exotic";
  }

  return "exotic";
}

const DISPLAY: Record<string, string> = {
  canine: "Canine",
  feline: "Feline",
  exotic: "Exotic",
  avian: "Avian",
  equine: "Equine",
};

/** User-facing label for species (maps legacy DB values to the five simple names). */
export function formatSpeciesLabel(stored: string): string {
  const c = normalizeLegacySpeciesToCanonical(stored);
  return DISPLAY[c] ?? c;
}

/** PostgREST `.or()` filter: canine (canonical + legacy strings). */
export const SPECIES_OR_FILTER_CANINE =
  "species.eq.canine,species.ilike.%canis%,species.ilike.%dog%,species.ilike.%puppy%";

/** PostgREST `.or()` filter: feline. */
export const SPECIES_OR_FILTER_FELINE =
  "species.eq.feline,species.ilike.%felis%,species.ilike.%cat%,species.ilike.%kitten%";

/** PostgREST `.or()` filter: avian. */
export const SPECIES_OR_FILTER_AVIAN =
  "species.eq.avian,species.ilike.%aves%,species.ilike.%bird%,species.ilike.%avian%,species.ilike.%parrot%";

/** PostgREST `.or()` filter: equine. */
export const SPECIES_OR_FILTER_EQUINE =
  "species.eq.equine,species.ilike.%equus%,species.ilike.%horse%,species.ilike.%equine%,species.ilike.%pony%";

/** PostgREST `.or()` filter: exotic + legacy small mammals / exotics. */
export const SPECIES_OR_FILTER_EXOTIC =
  "species.eq.exotic,species.ilike.%oryctolagus%,species.ilike.%cavia%,species.ilike.%mustela%,species.ilike.%rabbit%,species.ilike.%ferret%,species.ilike.%guinea%,species.ilike.%reptile%,species.ilike.%rodent%,species.ilike.%snake%,species.ilike.%lizard%";
