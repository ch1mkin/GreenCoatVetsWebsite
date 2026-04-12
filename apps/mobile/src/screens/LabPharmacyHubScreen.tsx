import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

export function LabPharmacyHubScreen({
  role,
  refreshing,
  onRefresh,
}: {
  role: "lab_technician" | "pharmacist";
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const isLab = role === "lab_technician";
  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>{isLab ? "Laboratory hub" : "Pharmacy hub"}</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>
          {isLab
            ? "Track sample collection, pending results, and handoffs from doctors & reception."
            : "Manage prescription fulfillment, pickups, and inventory checks with reception."}
        </Text>
        <View style={styles.row}>
          <MaterialIcons name={isLab ? "biotech" : "medication"} size={40} color={theme.primary} />
          <Text style={styles.body}>
            Use the <Text style={styles.em}>Today</Text> tab for the live queue. Attachments and lab PDFs follow the same medical-files pipeline as doctors.
          </Text>
        </View>
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Checklist</Text>
        {(isLab
          ? ["Verify patient & pet IDs with reception", "Mark sample received / sent-out", "Upload result PDFs to the visit"]
          : ["Verify prescription vs stock", "Flag interactions & allergies", "Notify owner when ready for pickup"]
        ).map((line, i) => (
          <View key={i} style={styles.checkRow}>
            <MaterialIcons name="check-circle-outline" size={20} color={theme.primary} />
            <Text style={styles.checkText}>{line}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  body: { flex: 1, color: theme.onSurfaceVariant, fontSize: 14, lineHeight: 20 },
  em: { fontWeight: "800", color: theme.onSurface },
  checkRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 10 },
  checkText: { flex: 1, color: theme.onSurfaceVariant, fontSize: 14, lineHeight: 20 },
});
