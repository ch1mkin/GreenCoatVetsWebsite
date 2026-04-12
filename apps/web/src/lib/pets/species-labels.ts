/** Prefer taxonomic / binomial display when present; map legacy common names for filters and directory. */
export function formatSpeciesDisplay(raw: string): string {
  const t = raw.trim();
  if (!t) return raw;
  const s = t.toLowerCase();
  if (s === "canis familiaris" || s.includes("canis")) return "Canis familiaris";
  if (s === "felis catus" || (s.includes("felis") && s.includes("catus"))) return "Felis catus";
  if (s === "oryctolagus cuniculus" || s.includes("oryctolagus") || s.includes("cuniculus")) return "Oryctolagus cuniculus";
  if (s === "aves" || s === "avian" || s === "bird") return "Aves";
  if (s.includes("bird")) return t;
  if (s === "equus caballus" || s.includes("equus")) return "Equus caballus";
  if (s.includes("cavia porcellus") || s.includes("cavia")) return "Cavia porcellus";
  if (s.includes("mustela") && s.includes("furo")) return "Mustela putorius furo";
  if (s === "dog" || s === "canine" || s.includes("dog")) return "Canis familiaris";
  if (s === "cat" || s === "feline" || s.includes("cat")) return "Felis catus";
  if (s === "exotic" || s.includes("rabbit") || s.includes("rodent") || s.includes("reptile")) return t;
  return t;
}
