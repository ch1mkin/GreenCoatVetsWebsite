export type SpeciesClass = "canine" | "feline" | "exotic" | "avian" | "equine";

export function inferSpeciesClass(species: string): SpeciesClass {
  const s = species.toLowerCase().trim();
  if (s === "canine" || s === "feline" || s === "exotic" || s === "avian" || s === "equine") {
    return s;
  }
  if (/\bcanis\b/.test(s) || /\b(dog|canine|puppy)\b/.test(s) || s.includes("dog")) return "canine";
  if (/\bfelis\b/.test(s) || /\b(cat|feline|kitten)\b/.test(s) || s.includes("cat")) return "feline";
  if (/\baves\b/.test(s) || /(bird|avian|parrot|cockatiel)/.test(s)) return "avian";
  if (/\bequus\b/.test(s) || /(horse|equine|pony)/.test(s)) return "equine";
  if (/(oryctolagus|cuniculus|cavia|mustela|ferret|guinea|rodent|rabbit)/.test(s)) return "exotic";
  return "exotic";
}

export const SPECIES_CLASS_OPTIONS: { id: SpeciesClass; label: string }[] = [
  { id: "canine", label: "Canine" },
  { id: "feline", label: "Feline" },
  { id: "exotic", label: "Exotic" },
  { id: "avian", label: "Avian" },
  { id: "equine", label: "Equine" },
];
