/**
 * VetCare-inspired palette (Material 3–style greens + cool neutrals).
 * Use across screens for a consistent clinical look.
 */
export const theme = {
  primary: "#006c50",
  primaryContainer: "#36c497",
  primaryFixedDim: "#56ddae",
  onPrimary: "#ffffff",
  onPrimaryContainer: "#004c37",
  secondary: "#545f73",
  secondaryContainer: "#d5e0f8",
  onSecondaryContainer: "#586377",
  tertiary: "#7f5600",
  background: "#f7f8fa",
  surface: "#f7f8fa",
  surfaceBright: "#ffffff",
  surfaceContainerLow: "#f5f6f8",
  surfaceContainer: "#eef1f4",
  surfaceContainerHigh: "#e8ecef",
  surfaceContainerHighest: "#e2e6ea",
  onSurface: "#171c1f",
  onSurfaceVariant: "#3d4a43",
  outline: "#6c7a73",
  outlineVariant: "#bbcac1",
  error: "#ba1a1a",
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",
  inversePrimary: "#56ddae",
  /** Gradient stops for buttons / hero */
  gradientStart: "#36c497",
  gradientEnd: "#006c50",
} as const;

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  fab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  logo: {
    shadowColor: "#006c50",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 3,
  },
};
