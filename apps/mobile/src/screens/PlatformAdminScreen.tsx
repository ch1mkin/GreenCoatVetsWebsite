import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";
import { PawCircularLoader } from "../components/PawCircularLoader";

type ClinicRow = { id: string; name: string; slug: string };

/** Platform super admin — high-level view (clinic list when RLS allows). */
export function PlatformAdminScreen({
  onRefresh,
}: {
  /** Parent refresh (e.g. re-sync session / membership). */
  onRefresh: () => void;
}) {
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.from("clinics").select("id, name, slug").order("name", { ascending: true }).limit(100);
    if (error) setErr(error.message);
    else setClinics((data as ClinicRow[]) ?? []);
    setLoading(false);
  }

  async function refreshAll() {
    await load();
    onRefresh();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <ScrollView
      style={commonStyles.screen}
      contentContainerStyle={commonStyles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={theme.primary} colors={[theme.primary]} />
      }
    >
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>Platform</Text>
        <Text style={styles.lead}>
          You are signed in as a platform super admin. Use the web dashboard for full controls; this screen lists clinics you can
          access.
        </Text>
        {err ? <Text style={styles.err}>{err}</Text> : null}
        {loading && !clinics.length ? (
          <View style={{ marginVertical: 16, alignItems: "center" }}>
            <PawCircularLoader size={64} message="Loading clinics…" />
          </View>
        ) : null}
        {clinics.map((c) => (
          <View style={styles.row} key={c.id}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.slug}>{c.slug}</Text>
          </View>
        ))}
        {!loading && !clinics.length && !err ? (
          <Text style={commonStyles.emptyState}>No clinics loaded (check RLS) or empty project.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  lead: { color: theme.onSurfaceVariant, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  err: { color: theme.error, marginBottom: 8 },
  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.outlineVariant,
  },
  name: { fontWeight: "700", color: theme.onSurface, fontSize: 15 },
  slug: { color: theme.outline, fontSize: 12, marginTop: 2 },
});
