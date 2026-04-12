/** Referred lab / imaging tests — persisted in visit_clinical_evaluations.tests_referred (jsonb array). */
export const REFERRED_TEST_OPTIONS = [
  "CBC",
  "NSAID 6",
  "CHEM 17",
  "CHEM 15",
  "CHEM 10",
  "SDMA",
  "TT4",
  "FRU",
  "PHBR",
  "UPC",
  "CRP",
  "P4",
  "Snap 4Dx",
  "Parvo",
  "X ray",
  "USG",
] as const;

export type ReferredTestCode = (typeof REFERRED_TEST_OPTIONS)[number];

export function testFieldName(code: string): string {
  return `test_${code.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}
