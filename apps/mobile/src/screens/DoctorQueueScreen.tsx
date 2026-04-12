import { useMemo, useState } from "react";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { DoctorStackParamList } from "../navigation/types";
import { Appointment, DoctorNotification } from "../types/app";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";
import { PetAvatar } from "../components/PetAvatar";

type FilterKey = "upcoming" | "ongoing" | "completed" | "emergency";

export function DoctorQueueScreen({
  appointments,
  onStatusChange,
  notifications,
  refreshing,
  onRefresh,
}: {
  appointments: Appointment[];
  onStatusChange: (appointmentId: string, status: string) => Promise<void>;
  notifications: DoctorNotification[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<DoctorStackParamList>>();
  const [filter, setFilter] = useState<FilterKey>("upcoming");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      const isEmergency = (a.appointment_type ?? "").toLowerCase() === "emergency";
      if (filter === "ongoing" && a.status !== "checked_in") return false;
      if (filter === "emergency") return isEmergency;
      if (filter === "completed") return a.status === "completed";
      if (filter === "upcoming" && a.status !== "scheduled") return false;
      if (!q) return true;
      const petName = (a.pets?.name ?? "").toLowerCase();
      const ownerName = (a.owners?.full_name ?? "").toLowerCase();
      const ownerPhone = (a.owners?.phone ?? "").toLowerCase();
      return petName.includes(q) || ownerName.includes(q) || ownerPhone.includes(q);
    });
  }, [appointments, filter, query]);

  const emergencyCount = appointments.filter((a) => (a.appointment_type ?? "").toLowerCase() === "emergency").length;
  const nextUp = filtered.find((a) => a.status !== "completed" && a.status !== "cancelled" && a.status !== "no_show");

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={[commonStyles.scrollContent, styles.pagePad]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      {nextUp ? (
        <LinearGradient colors={[theme.primaryContainer, theme.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text style={styles.heroOverline}>Next up</Text>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroPet}>{nextUp.pets?.name ?? "Pet"}</Text>
              <Text style={styles.heroMeta}>{nextUp.pets?.breed ?? nextUp.pets?.species ?? "Pet"} · {new Date(nextUp.starts_at).toLocaleTimeString()}</Text>
              <Text style={styles.heroOwner}>{nextUp.owners?.full_name ?? "Owner"}</Text>
            </View>
            <Pressable style={styles.heroBtn} onPress={() => navigation.navigate("Consult", { appointmentId: nextUp.id })}>
              <MaterialIcons name="play-circle" size={18} color={theme.primary} />
              <Text style={styles.heroBtnText}>Start</Text>
            </Pressable>
          </View>
        </LinearGradient>
      ) : null}

      <View style={[commonStyles.card, styles.glassCard]}>
        <Text style={commonStyles.cardTitle}>Today&apos;s queue</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>
          Filters and search keep consultation flow fast.
        </Text>
        <TextInput
          style={[commonStyles.input, styles.searchInput]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search pet name or owner phone"
          placeholderTextColor={theme.outline}
        />

        <View style={styles.chips}>
          {(
            [
              ["upcoming", "Upcoming"],
              ["ongoing", "Ongoing"],
              ["completed", "Completed"],
              ["emergency", "Emergency"],
            ] as const
          ).map(([key, label]) => (
            <Pressable key={key} style={[styles.chip, filter === key && styles.chipOn]} onPress={() => setFilter(key)}>
              <Text style={[styles.chipText, filter === key && styles.chipTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.metaRow}>
          <Text style={commonStyles.muted}>Emergency cases: {emergencyCount}</Text>
          <Text style={commonStyles.muted}>Alerts: {notifications.length}</Text>
        </View>

        <View style={styles.queueWrap}>
        {filtered.map((appointment, index) => (
          <View style={[styles.queueItem, index === 0 && styles.queueItemFirst]} key={appointment.id}>
            <Pressable onPress={() => navigation.navigate("Consult", { appointmentId: appointment.id })}>
              <View style={styles.queueHeader}>
                <View style={styles.timeBox}>
                  <Text style={styles.timeHour}>{new Date(appointment.starts_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
                <PetAvatar uri={appointment.pets?.photo_url} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timeText}>{appointment.pets?.name ?? "Pet"}</Text>
                  <Text style={commonStyles.muted}>
                    {appointment.pets?.name ?? "Pet"} · {appointment.owners?.full_name ?? "Owner"} · {appointment.branches?.name ?? "Branch"}
                  </Text>
                  <View style={[styles.statusChip, chipForStatus(appointment.status)]}>
                    <Text style={styles.statusChipText}>
                      {(appointment.appointment_type ?? "").toLowerCase() === "emergency" ? "Emergency" : appointment.status}
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={theme.outline} />
              </View>
            </Pressable>
            <View style={commonStyles.actionRow}>
              <Pressable style={commonStyles.btnOutline} onPress={() => onStatusChange(appointment.id, "checked_in")}>
                <Text style={commonStyles.btnOutlineText}>Check-in</Text>
              </Pressable>
              <Pressable
                style={commonStyles.btnPrimary}
                onPress={() => navigation.navigate("Consult", { appointmentId: appointment.id })}
              >
                <Text style={commonStyles.btnPrimaryText}>Start consultation</Text>
              </Pressable>
              <Pressable style={commonStyles.btnOutline} onPress={() => onStatusChange(appointment.id, "completed")}>
                <Text style={commonStyles.btnOutlineText}>Complete</Text>
              </Pressable>
            </View>
          </View>
        ))}
        </View>
        {!filtered.length ? <Text style={commonStyles.emptyState}>No appointments for this filter.</Text> : null}
      </View>
    </ScrollView>
  );
}

function chipForStatus(status: string) {
  const s = status.toLowerCase();
  if (s === "completed") return { backgroundColor: `${theme.outlineVariant}66`, borderColor: `${theme.outline}44` };
  if (s === "checked_in") return { backgroundColor: `${theme.primaryFixedDim}55`, borderColor: `${theme.primary}44` };
  if (s === "scheduled") return { backgroundColor: `${theme.secondaryContainer}66`, borderColor: `${theme.secondary}44` };
  return { backgroundColor: `${theme.primaryContainer}66`, borderColor: `${theme.tertiary}44` };
}

const styles = StyleSheet.create({
  pagePad: { paddingTop: 8, paddingBottom: 44 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    backgroundColor: theme.surfaceContainer,
  },
  chipOn: {
    borderColor: theme.primary,
    backgroundColor: `${theme.primary}18`,
  },
  chipText: { fontWeight: "700", fontSize: 12, color: theme.onSurface },
  chipTextOn: { color: theme.primary },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  hero: { borderRadius: 26, padding: 18, marginTop: 4, marginBottom: 10 },
  heroOverline: { color: "#ffffffcc", fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase", fontSize: 11, marginBottom: 6 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroPet: { color: "#fff", fontSize: 28, fontWeight: "900", lineHeight: 30 },
  heroMeta: { color: "#ffffffcc", fontWeight: "700", marginTop: 2 },
  heroOwner: { color: "#fff", marginTop: 8, fontWeight: "700" },
  heroBtn: { backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 6 },
  heroBtnText: { color: theme.primary, fontWeight: "800" },
  glassCard: {
    backgroundColor: `${theme.surfaceContainerLow}dd`,
    borderColor: `${theme.outlineVariant}77`,
  },
  searchInput: { marginBottom: 2 },
  queueWrap: { gap: 10, marginTop: 2 },
  queueItem: {
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}66`,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    backgroundColor: theme.surfaceContainerLow,
  },
  queueItemFirst: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  timeBox: { backgroundColor: theme.surfaceContainerHighest, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: theme.outlineVariant },
  timeHour: { fontWeight: "900", color: theme.primary, fontSize: 12 },
  timeText: { fontWeight: "800", color: theme.onSurface, fontSize: 15 },
  statusChip: {
    alignSelf: "flex-start",
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase", color: theme.onSurfaceVariant },
});
