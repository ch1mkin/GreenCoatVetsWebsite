import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "saasclinics_pending_clinic_invite_v1";

export type PendingInvitePayload = {
  token: string;
  fullName: string | null;
  phone: string | null;
  workingHours: string | null;
  inviteRole: string | null;
};

export async function savePendingInvite(p: PendingInvitePayload): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(p));
}

export async function loadPendingInvite(): Promise<PendingInvitePayload | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingInvitePayload;
    if (!parsed?.token || typeof parsed.token !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingInvite(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
