/** Build a single lab_tests line from visit clinical evaluation fields. */
export function formatLabTestsFromEvaluation(
  testsReferred: string[] | null | undefined,
  testsOther: string | null | undefined,
): string | null {
  const referred = (testsReferred ?? []).map((t) => t.trim()).filter(Boolean);
  const other = testsOther?.trim();
  const parts = other ? [...referred, other] : referred;
  return parts.length ? parts.join(", ") : null;
}
