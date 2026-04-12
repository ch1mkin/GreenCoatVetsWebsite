import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  channel: string;
  created_at: string;
  read_at: string | null;
};

export function OwnerInboxScreen({
  notifications,
  refreshing,
  onRefresh,
}: {
  notifications: NotificationItem[];
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
        <Text style={commonStyles.cardTitle}>Inbox</Text>
        <Text style={[commonStyles.muted, { marginBottom: 12 }]}>Clinic updates and reminders.</Text>
        {notifications.map((item, index) => (
          <View
            style={[styles.notif, index === notifications.length - 1 && styles.notifLast]}
            key={item.id}
          >
            <View style={styles.notifHeader}>
              <Text style={styles.notifTitle}>{item.title}</Text>
              <View style={styles.channelPill}>
                <Text style={styles.channelText}>{item.channel}</Text>
              </View>
            </View>
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
            {!item.read_at ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>New</Text>
              </View>
            ) : null}
          </View>
        ))}
        {!notifications.length ? <Text style={commonStyles.emptyState}>You’re all caught up.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  notif: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  notifLast: {
    borderBottomWidth: 0,
  },
  notifHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  notifTitle: { fontWeight: "800", color: theme.onSurface, fontSize: 16, flex: 1 },
  channelPill: {
    backgroundColor: theme.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
  },
  channelText: {
    fontSize: 10,
    fontWeight: "800",
    color: theme.outline,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  message: { color: theme.onSurfaceVariant, marginTop: 6, fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12, color: theme.outline, marginTop: 8, fontWeight: "500" },
  unreadBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    backgroundColor: `${theme.primary}18`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  unreadText: { color: theme.primary, fontWeight: "800", fontSize: 11 },
});
