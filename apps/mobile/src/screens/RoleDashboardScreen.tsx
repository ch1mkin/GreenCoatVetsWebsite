import { ScrollView, StyleSheet, Text, View } from "react-native";
import { commonStyles } from "../theme/commonStyles";
import { theme } from "../theme/theme";

type Props = {
  title: string;
  subtitle: string;
  body: string;
};

/** Role-specific home / info tab (clinic admin, branch admin, lab, pharmacy). */
export function RoleDashboardScreen({ title, subtitle, body }: Props) {
  return (
    <ScrollView style={commonStyles.screen} contentContainerStyle={[commonStyles.scrollContent, { paddingTop: 8 }]}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.cardTitle}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: theme.primary,
    fontWeight: "800",
    fontSize: 13,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  body: {
    color: theme.onSurfaceVariant,
    fontSize: 15,
    lineHeight: 22,
  },
});
