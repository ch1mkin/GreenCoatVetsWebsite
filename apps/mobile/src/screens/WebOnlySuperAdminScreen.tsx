import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { theme } from "../theme/theme";

/** Platform super admin should use the web dashboard — mobile is intentionally limited. */
export function WebOnlySuperAdminScreen({ onSignOut }: { onSignOut: () => void }) {
  return (
    <View style={styles.wrap}>
      <MaterialIcons name="computer" size={56} color={theme.primary} />
      <Text style={styles.title}>Use the web dashboard</Text>
      <Text style={styles.body}>
        Platform administration (clinics, billing, global settings) is available on the web for security and a full workspace.
      </Text>
      <Pressable style={styles.linkBtn} onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_WEB_APP_URL ?? "https://example.com")}>
        <Text style={styles.linkBtnText}>Open web app</Text>
      </Pressable>
      <Pressable style={styles.outline} onPress={onSignOut}>
        <Text style={styles.outlineText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
    backgroundColor: "transparent",
    gap: 14,
  },
  title: { fontSize: 20, fontWeight: "800", color: theme.onSurface, textAlign: "center" },
  body: { fontSize: 15, color: theme.onSurfaceVariant, textAlign: "center", lineHeight: 22 },
  linkBtn: {
    marginTop: 8,
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  linkBtnText: { color: theme.onPrimary, fontWeight: "800", fontSize: 16 },
  outline: { paddingVertical: 12 },
  outlineText: { color: theme.primary, fontWeight: "700", fontSize: 15 },
});
