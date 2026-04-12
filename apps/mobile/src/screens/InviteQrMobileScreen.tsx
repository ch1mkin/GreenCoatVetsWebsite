import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";
import { getMobileInviteAllowedRoles } from "../lib/inviteQrPermissions";
import { AppAmbientBackground } from "../components/AppAmbientBackground";
import { theme, shadows } from "../theme/theme";

type InviteRow = {
  id: string;
  clinic_id: string;
  role: string;
  token: string;
  label: string | null;
  used_count: number | null;
  expires_at: string | null;
};

const WEB_BASE = process.env.EXPO_PUBLIC_WEB_APP_URL ?? "http://localhost:3000";
const WEBSITE_BASE = process.env.EXPO_PUBLIC_WEBSITE_APP_URL ?? "http://localhost:3001";

function formatExpiry(iso: string | null): string {
  if (!iso) return "No expiry";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  if (t <= Date.now()) return "Expired";
  const ms = t - Date.now();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export function InviteQrMobileScreen({
  clinicId,
  membershipRole,
}: {
  clinicId: string;
  membershipRole: string;
}) {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState<"qr" | "link">("qr");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresDays, setExpiresDays] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);

  const allowedRoles = useMemo(() => getMobileInviteAllowedRoles(membershipRole), [membershipRole]);

  useEffect(() => {
    if (allowedRoles.length && selectedRole === null) {
      setSelectedRole(allowedRoles[0] ?? null);
    }
  }, [allowedRoles, selectedRole]);

  const loadInvites = useCallback(async () => {
    const { data, error } = await supabase
      .from("clinic_role_invites")
      .select("id, clinic_id, role, token, label, used_count, expires_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) {
      Alert.alert("Invites", error.message);
      setInvites([]);
    } else {
      const rows = (data ?? []) as InviteRow[];
      setInvites(rows);
      setSelectedId((id) => id ?? rows[0]?.id ?? null);
    }
    setLoading(false);
  }, [clinicId]);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const selected = useMemo(() => {
    if (!invites.length) return null;
    return invites.find((i) => i.id === selectedId) ?? invites[0];
  }, [invites, selectedId]);

  const webSignup = selected ? `${WEB_BASE}/signup?invite=${selected.token}` : "";
  const qrUrl = selected
    ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(webSignup)}`
    : "";

  async function onGenerate() {
    if (!allowedRoles.length || !selectedRole) {
      Alert.alert("Not allowed", "Your role cannot create invites. Ask a clinic admin.");
      return;
    }
    setGenerating(true);
    const maxU = maxUses.trim() ? parseInt(maxUses, 10) : null;
    const expDays = expiresDays.trim() ? parseInt(expiresDays, 10) : null;
    if (maxU !== null && (!Number.isInteger(maxU) || maxU <= 0)) {
      setGenerating(false);
      Alert.alert("Validation", "Max uses must be a positive integer.");
      return;
    }
    if (expDays !== null && (!Number.isInteger(expDays) || expDays <= 0)) {
      setGenerating(false);
      Alert.alert("Validation", "Expiry days must be a positive integer.");
      return;
    }
    const expiresAt =
      expDays === null ? null : new Date(Date.now() + expDays * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase.rpc("create_role_invite", {
      p_clinic_id: clinicId,
      p_role: selectedRole,
      p_label: label.trim() || null,
      p_max_uses: maxU,
      p_expires_at: expiresAt,
    });
    setGenerating(false);
    if (error) {
      Alert.alert("Could not create invite", error.message);
      return;
    }
    setLabel("");
    setMaxUses("");
    setExpiresDays("");
    await loadInvites();
  }

  async function shareLink() {
    if (!webSignup) return;
    try {
      await Share.share({ message: webSignup, url: webSignup });
    } catch {
      /* cancelled */
    }
  }

  /** Short fingerprint for the clinic (first 8 hex chars of UUID, no hyphens). */
  const clinicIdDisplay = clinicId.replace(/-/g, "").slice(0, 8).toUpperCase();

  return (
    <View style={styles.root}>
      <AppAmbientBackground />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <LinearGradient colors={[`${theme.primary}18`, `${theme.primaryContainer}30`]} style={styles.heroIcon}>
            <MaterialIcons name="qr-code-2" size={28} color={theme.primary} />
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroKicker}>ACCESS CONTROL</Text>
            <Text style={styles.heroTitle}>Clinic onboarding</Text>
            <Text style={styles.heroSub}>Generate QR codes and shareable links for your team and pet owners.</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.primary} style={{ marginVertical: 24 }} />
        ) : (
          <>
            <View style={styles.toggleRow}>
              <Pressable
                onPress={() => setMode("qr")}
                style={[styles.toggleBtn, mode === "qr" && styles.toggleBtnActive]}
              >
                <MaterialIcons name="qr-code-2" size={22} color={mode === "qr" ? theme.primary : theme.onSurfaceVariant} />
                <Text style={[styles.toggleLabel, mode === "qr" && styles.toggleLabelActive]}>Check-in QR</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("link")}
                style={[styles.toggleBtn, mode === "link" && styles.toggleBtnActive]}
              >
                <MaterialIcons name="link" size={22} color={mode === "link" ? theme.primary : theme.onSurfaceVariant} />
                <Text style={[styles.toggleLabel, mode === "link" && styles.toggleLabelActive]}>Invite link</Text>
              </Pressable>
            </View>

            {invites.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {invites.map((inv) => (
                  <Pressable
                    key={inv.id}
                    onPress={() => setSelectedId(inv.id)}
                    style={[styles.chip, selectedId === inv.id && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, selectedId === inv.id && styles.chipTextOn]} numberOfLines={1}>
                      {inv.label ?? inv.role}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {selected ? (
              mode === "qr" ? (
                <View style={styles.qrWrap}>
                  <View style={styles.cornerTL} />
                  <View style={styles.cornerBR} />
                  <LinearGradient colors={["#36c497", theme.primary]} style={styles.qrGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <View style={styles.qrInner}>
                      <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
                      <View style={styles.encryptedPill}>
                        <View style={styles.pulseDot} />
                        <Text style={styles.encryptedText}>ENCRYPTED SESSION</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              ) : (
                <View style={styles.linkCard}>
                  <Text style={styles.linkLabel}>Web signup</Text>
                  <Text selectable style={styles.linkMono}>
                    {webSignup}
                  </Text>
                  <Text style={[styles.linkLabel, { marginTop: 12 }]}>Website</Text>
                  <Text selectable style={styles.linkMono}>
                    {`${WEBSITE_BASE}/signup?invite=${selected.token}`}
                  </Text>
                </View>
              )
            ) : (
              <View style={styles.emptyPreview}>
                <MaterialIcons name="qr-code-2" size={48} color={`${theme.primary}55`} />
                <Text style={styles.emptyTitle}>No invite yet</Text>
                <Text style={styles.emptySub}>Generate one below to see the QR preview.</Text>
              </View>
            )}

            <View style={styles.metaCard}>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Clinic ID</Text>
                <Text style={styles.metaVal}>{clinicIdDisplay}</Text>
              </View>
              <View style={styles.metaDivider} />
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>Expires in</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <MaterialIcons name="schedule" size={18} color={theme.tertiary} />
                  <Text style={styles.metaVal}>{selected ? formatExpiry(selected.expires_at) : "—"}</Text>
                </View>
              </View>
            </View>

            <Pressable
              style={styles.primaryBtn}
              onPress={() => selected && Linking.openURL(qrUrl)}
              disabled={!selected}
            >
              <LinearGradient colors={["#36c497", theme.primary]} style={styles.primaryGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <MaterialIcons name="download" size={22} color="#fff" />
                <Text style={styles.primaryBtnText}>Open QR image</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.secondaryBtn} onPress={shareLink} disabled={!selected}>
              <MaterialIcons name="share" size={22} color={theme.onSecondaryContainer} />
              <Text style={styles.secondaryBtnText}>Share to staff</Text>
            </Pressable>

            <View style={styles.genSection}>
              <Text style={styles.genTitle}>Generate new invite</Text>
              {!allowedRoles.length ? (
                <Text style={styles.genHint}>
                  View-only: you can still copy links from existing invites. Clinic admins can create staff invites; reception and doctors can
                  create pet-owner invites here or on the web.
                </Text>
              ) : (
                <>
                  {allowedRoles.length > 1 ? (
                    <Text style={styles.inputLabel}>Role</Text>
                  ) : null}
                  {allowedRoles.length > 1 ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {allowedRoles.map((r) => (
                        <Pressable key={r} onPress={() => setSelectedRole(r)} style={[styles.roleChip, selectedRole === r && styles.roleChipOn]}>
                          <Text style={[styles.roleChipText, selectedRole === r && styles.roleChipTextOn]}>{r.replace(/_/g, " ")}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}

                  <Text style={styles.inputLabel}>Label (optional)</Text>
                  <TextInput
                    style={styles.input}
                    value={label}
                    onChangeText={setLabel}
                    placeholder="Front desk check-in"
                    placeholderTextColor={theme.outline}
                  />
                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Max uses</Text>
                      <TextInput
                        style={styles.input}
                        value={maxUses}
                        onChangeText={setMaxUses}
                        keyboardType="number-pad"
                        placeholder="∞"
                        placeholderTextColor={theme.outline}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inputLabel}>Expires (days)</Text>
                      <TextInput
                        style={styles.input}
                        value={expiresDays}
                        onChangeText={setExpiresDays}
                        keyboardType="number-pad"
                        placeholder="∞"
                        placeholderTextColor={theme.outline}
                      />
                    </View>
                  </View>

                  <Pressable style={styles.generateBtn} onPress={onGenerate} disabled={generating}>
                    {generating ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <MaterialIcons name="bolt" size={22} color="#fff" />
                        <Text style={styles.generateBtnText}>Generate invite</Text>
                      </>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },
  hero: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 20 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  heroKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, color: theme.onSurfaceVariant },
  heroTitle: { fontSize: 22, fontWeight: "800", color: theme.onSurface, letterSpacing: -0.3 },
  heroSub: { marginTop: 4, fontSize: 13, color: theme.onSurfaceVariant, lineHeight: 18 },
  toggleRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  toggleBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: theme.surfaceContainerLow,
    borderWidth: 2,
    borderColor: "transparent",
  },
  toggleBtnActive: {
    backgroundColor: "#ffffff",
    borderColor: `${theme.primary}55`,
  },
  toggleLabel: { marginTop: 6, fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: theme.onSurfaceVariant, textTransform: "uppercase" },
  toggleLabelActive: { color: theme.primary },
  chipScroll: { marginBottom: 12, maxHeight: 40 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.surfaceContainerHigh,
    marginRight: 8,
    maxWidth: 200,
  },
  chipOn: { backgroundColor: `${theme.primary}22` },
  chipText: { fontSize: 12, fontWeight: "600", color: theme.onSurfaceVariant },
  chipTextOn: { color: theme.primary, fontWeight: "800" },
  qrWrap: { alignItems: "center", marginBottom: 20 },
  cornerTL: {
    position: "absolute",
    left: -4,
    top: -4,
    width: 44,
    height: 44,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: `${theme.primaryContainer}55`,
    borderTopLeftRadius: 14,
    zIndex: 0,
  },
  cornerBR: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 44,
    height: 44,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: `${theme.primaryContainer}55`,
    borderBottomRightRadius: 14,
    zIndex: 0,
  },
  qrGradient: {
    padding: 3,
    borderRadius: 22,
    width: "100%",
    maxWidth: 300,
    alignSelf: "center",
    ...shadows.card,
  },
  qrInner: {
    borderRadius: 20,
    backgroundColor: "#fff",
    padding: 16,
    alignItems: "center",
  },
  qrImage: { width: 240, height: 240 },
  encryptedPill: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: `${theme.primaryContainer}18`,
  },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primaryContainer },
  encryptedText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, color: theme.primary },
  linkCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}66`,
    backgroundColor: "#ffffff",
    padding: 16,
    marginBottom: 20,
  },
  linkLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: theme.onSurfaceVariant, marginBottom: 6 },
  linkMono: { fontSize: 11, color: theme.onSurface, fontFamily: "Menlo" },
  emptyPreview: { alignItems: "center", paddingVertical: 28, marginBottom: 16 },
  emptyTitle: { marginTop: 8, fontSize: 17, fontWeight: "800", color: theme.onSurface },
  emptySub: { marginTop: 4, fontSize: 13, color: theme.onSurfaceVariant, textAlign: "center", paddingHorizontal: 12 },
  metaCard: {
    borderRadius: 16,
    backgroundColor: theme.surfaceContainerLow,
    padding: 16,
    marginBottom: 16,
  },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaKey: { fontSize: 14, fontWeight: "500", color: theme.onSurfaceVariant },
  metaVal: { fontSize: 16, fontWeight: "800", color: theme.onSurface },
  metaDivider: { height: 1, backgroundColor: `${theme.outlineVariant}33`, marginVertical: 12 },
  primaryBtn: { borderRadius: 14, overflow: "hidden", marginBottom: 10 },
  primaryGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: theme.secondaryContainer,
    marginBottom: 24,
  },
  secondaryBtnText: { color: theme.onSecondaryContainer, fontSize: 16, fontWeight: "800" },
  genSection: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}44`,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  genTitle: { fontSize: 17, fontWeight: "800", color: theme.onSurface, marginBottom: 8 },
  genHint: { fontSize: 13, color: theme.onSurfaceVariant, lineHeight: 18 },
  inputLabel: { fontSize: 11, fontWeight: "700", color: theme.onSurfaceVariant, marginBottom: 6 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${theme.outlineVariant}88`,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.onSurface,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  row2: { flexDirection: "row", gap: 12 },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.surfaceContainerHigh,
    marginRight: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  roleChipOn: { borderColor: `${theme.primary}66`, backgroundColor: `${theme.primary}12` },
  roleChipText: { fontSize: 13, fontWeight: "600", color: theme.onSurfaceVariant, textTransform: "capitalize" },
  roleChipTextOn: { color: theme.primary, fontWeight: "800" },
  generateBtn: {
    marginTop: 4,
    borderRadius: 14,
    backgroundColor: theme.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  generateBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
