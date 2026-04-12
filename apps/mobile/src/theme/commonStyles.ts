import { StyleSheet } from "react-native";
import { theme, shadows } from "./theme";

/** Shared layout + cards for tab screens */
export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 12,
    paddingTop: 4,
  },
  card: {
    backgroundColor: theme.surfaceContainerLow,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}cc`,
    ...shadows.card,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.onSurface,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: theme.outline,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  muted: {
    color: theme.onSurfaceVariant,
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  pill: {
    overflow: "hidden",
    borderRadius: 6,
    backgroundColor: `${theme.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    color: theme.primary,
    fontWeight: "800",
    fontSize: 11,
    textTransform: "capitalize",
  },
  emptyState: {
    color: theme.outline,
    fontStyle: "italic",
    fontSize: 14,
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.surfaceBright,
    fontSize: 15,
    color: theme.onSurface,
  },
  btnPrimary: {
    backgroundColor: theme.primary,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...shadows.card,
  },
  btnPrimaryText: {
    color: theme.onPrimary,
    fontWeight: "800",
    fontSize: 13,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.surfaceContainer,
  },
  btnOutlineText: {
    color: theme.onSurface,
    fontWeight: "700",
    fontSize: 12,
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
});
