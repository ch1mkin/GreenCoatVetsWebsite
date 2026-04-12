import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DoctorStackParamList } from "../navigation/types";
import { DoctorQueueScreen } from "./DoctorQueueScreen";
import { DoctorConsultScreen } from "./DoctorConsultScreen";
import { Appointment, DoctorNotification } from "../types/app";
import { theme } from "../theme/theme";

const Stack = createNativeStackNavigator<DoctorStackParamList>();

export function DoctorNavigator({
  appointments,
  clinicId,
  doctorStaffId,
  ensureVisitForAppointment,
  onUploadVisitImage,
  onStatusChange,
  notifications,
  medicineNames,
  refreshing,
  onRefresh,
}: {
  appointments: Appointment[];
  clinicId: string;
  doctorStaffId: string | null;
  ensureVisitForAppointment: (appointmentId: string, complete?: boolean) => Promise<string | null>;
  onUploadVisitImage: (appointmentId: string, uri: string, mimeType?: string, base64?: string | null) => Promise<void>;
  onStatusChange: (appointmentId: string, status: string) => Promise<void>;
  notifications: DoctorNotification[];
  medicineNames: string[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTintColor: theme.primary,
        headerStyle: { backgroundColor: theme.surfaceContainerHigh },
        headerTitleStyle: { fontWeight: "800" },
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      <Stack.Screen name="Queue" options={{ title: "Today's queue" }}>
        {() => (
          <DoctorQueueScreen
            appointments={appointments}
            onStatusChange={onStatusChange}
            notifications={notifications}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Consult" options={{ title: "Consultation" }}>
        {() => (
          <DoctorConsultScreen
            clinicId={clinicId}
            doctorStaffId={doctorStaffId}
            ensureVisitForAppointment={ensureVisitForAppointment}
            onUploadVisitImage={onUploadVisitImage}
            onStatusChange={onStatusChange}
            medicineNames={medicineNames}
            onRefresh={onRefresh}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
