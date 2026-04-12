import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

type Prescription = {
  id: string;
  issued_at: string;
  notes: string | null;
  pdf_url: string | null;
};

type Vaccination = {
  id: string;
  vaccine_name: string;
  due_on: string | null;
  status: string | null;
};

export function OwnerHealthScreen({
  prescriptions,
  vaccinations,
  attachments,
  onOpenAttachment,
  onOpenPrescriptionPdf,
  refreshing,
  onRefresh,
}: {
  prescriptions: Prescription[];
  vaccinations: Vaccination[];
  attachments: Array<{
    id: string;
    file_name: string | null;
    created_at: string;
    visit_id: string | null;
  }>;
  onOpenAttachment: (attachmentId: string) => Promise<void>;
  onOpenPrescriptionPdf: (prescriptionId: string) => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Prescriptions</Text>
        {prescriptions.map((prescription, i) => (
          <View
            style={[commonStyles.row, i === prescriptions.length - 1 && commonStyles.rowLast]}
            key={prescription.id}
          >
            <View>
              <Text style={styles.itemTitle}>{new Date(prescription.issued_at).toLocaleDateString()}</Text>
              <Text style={commonStyles.muted}>{prescription.notes ?? "No notes"}</Text>
            </View>
            <Pressable
              style={[commonStyles.btnOutline, !prescription.pdf_url && styles.disabledBtn]}
              disabled={!prescription.pdf_url}
              onPress={() => onOpenPrescriptionPdf(prescription.id)}
            >
              <Text style={commonStyles.btnOutlineText}>PDF</Text>
            </Pressable>
          </View>
        ))}
        {!prescriptions.length ? <Text style={commonStyles.emptyState}>No prescriptions on file.</Text> : null}
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Vaccinations</Text>
        {vaccinations.map((vaccination, i) => (
          <View
            style={[commonStyles.row, i === vaccinations.length - 1 && commonStyles.rowLast]}
            key={vaccination.id}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{vaccination.vaccine_name}</Text>
              <Text style={commonStyles.muted}>
                Due {vaccination.due_on ?? "—"} · {vaccination.status ?? "—"}
              </Text>
            </View>
          </View>
        ))}
        {!vaccinations.length ? <Text style={commonStyles.emptyState}>No vaccination records.</Text> : null}
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Medical files</Text>
        {attachments.map((attachment, i) => (
          <View
            style={[styles.fileRow, i === attachments.length - 1 && styles.fileRowLast]}
            key={attachment.id}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{attachment.file_name ?? "File"}</Text>
              <Text style={commonStyles.muted}>
                {new Date(attachment.created_at).toLocaleString()} · Visit {attachment.visit_id?.slice(0, 8) ?? "—"}…
              </Text>
            </View>
            <Pressable style={commonStyles.btnPrimary} onPress={() => onOpenAttachment(attachment.id)}>
              <Text style={commonStyles.btnPrimaryText}>Open</Text>
            </Pressable>
          </View>
        ))}
        {!attachments.length ? <Text style={commonStyles.emptyState}>No attachments yet.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  itemTitle: { fontWeight: "700", color: theme.onSurface, fontSize: 15 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  fileRowLast: { borderBottomWidth: 0 },
  disabledBtn: { opacity: 0.4 },
});
