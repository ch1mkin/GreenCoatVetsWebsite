import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Appointment } from "../types/app";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

export function DoctorScreen({
  appointments,
  onStatusChange,
  onSaveNote,
  onUploadDocument,
  refreshing,
  onRefresh,
}: {
  appointments: Appointment[];
  onStatusChange: (appointmentId: string, status: string) => Promise<void>;
  onSaveNote: (appointmentId: string, note: string) => Promise<void>;
  onUploadDocument: (appointmentId: string) => Promise<void>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Doctor queue</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>
          Triage visits, notes, and documents for today’s appointments.
        </Text>
        {appointments.map((appointment, index) => (
          <View style={[styles.queueItem, index === 0 && styles.queueItemFirst]} key={appointment.id}>
            <View style={styles.queueHeader}>
              <Text style={styles.timeText}>{new Date(appointment.starts_at).toLocaleString()}</Text>
              <View style={commonStyles.pill}>
                <Text style={commonStyles.pillText}>{appointment.status}</Text>
              </View>
            </View>
            <TextInput
              style={[commonStyles.input, { marginTop: 10 }]}
              placeholder="Quick consultation note"
              placeholderTextColor={theme.outline}
              value={notes[appointment.id] ?? ""}
              onChangeText={(text) => setNotes((prev) => ({ ...prev, [appointment.id]: text }))}
            />
            <View style={commonStyles.actionRow}>
              <Pressable style={commonStyles.btnOutline} onPress={() => onStatusChange(appointment.id, "checked_in")}>
                <Text style={commonStyles.btnOutlineText}>Check-in</Text>
              </Pressable>
              <Pressable style={commonStyles.btnPrimary} onPress={() => onStatusChange(appointment.id, "completed")}>
                <Text style={commonStyles.btnPrimaryText}>Complete</Text>
              </Pressable>
              <Pressable style={commonStyles.btnOutline} onPress={() => onSaveNote(appointment.id, notes[appointment.id] ?? "")}>
                <Text style={commonStyles.btnOutlineText}>Save note</Text>
              </Pressable>
              <Pressable style={commonStyles.btnOutline} onPress={() => onUploadDocument(appointment.id)}>
                <Text style={commonStyles.btnOutlineText}>Upload</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {!appointments.length ? <Text style={commonStyles.emptyState}>No appointments in your queue.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  queueItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.outlineVariant,
    paddingTop: 14,
    marginTop: 14,
  },
  queueItemFirst: {
    borderTopWidth: 0,
    marginTop: 0,
    paddingTop: 0,
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  timeText: { fontWeight: "700", color: theme.onSurface, flex: 1, fontSize: 14 },
});
