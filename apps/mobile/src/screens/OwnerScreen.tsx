import { formatSpeciesLabel } from "@saasclinics/lib";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Appointment, Order, Pet } from "../types/app";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

export function OwnerScreen({
  pets,
  appointments,
  orders,
  refreshing,
  onRefresh,
}: {
  pets: Pet[];
  appointments: Appointment[];
  orders: Order[];
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
        <Text style={commonStyles.cardTitle}>My pets</Text>
        {pets.map((pet, i) => (
          <View
            style={[commonStyles.row, i === pets.length - 1 && commonStyles.rowLast]}
            key={pet.id}
          >
            <Text style={styles.emphasis}>{pet.name}</Text>
            <View style={commonStyles.pill}>
              <Text style={commonStyles.pillText}>{formatSpeciesLabel(pet.species)}</Text>
            </View>
          </View>
        ))}
        {!pets.length ? <Text style={commonStyles.emptyState}>No pets linked yet.</Text> : null}
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Appointments</Text>
        {appointments.map((appointment, i) => (
          <View
            style={[commonStyles.row, i === appointments.length - 1 && commonStyles.rowLast]}
            key={appointment.id}
          >
            <Text style={commonStyles.muted}>{new Date(appointment.starts_at).toLocaleString()}</Text>
            <View style={commonStyles.pill}>
              <Text style={commonStyles.pillText}>{appointment.status}</Text>
            </View>
          </View>
        ))}
        {!appointments.length ? <Text style={commonStyles.emptyState}>No appointments scheduled.</Text> : null}
      </View>

      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Orders</Text>
        {orders.map((order, i) => (
          <View style={[commonStyles.row, i === orders.length - 1 && commonStyles.rowLast]} key={order.id}>
            <View style={commonStyles.pill}>
              <Text style={commonStyles.pillText}>{order.status}</Text>
            </View>
            <Text style={styles.emphasis}>{String(order.grand_total)}</Text>
          </View>
        ))}
        {!orders.length ? <Text style={commonStyles.emptyState}>No orders yet.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  emphasis: { fontWeight: "700", color: theme.onSurface, fontSize: 15 },
});
