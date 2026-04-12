import { BottomTabBar, BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
/**
 * Full-bleed bottom bar (edge-to-edge width, no side inset from parent padding).
 * Light surface; no side “card” corners — track spans the full screen width.
 */
export function VetCareTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.track, { paddingBottom: bottomPad }]}>
      <BottomTabBar {...props} style={[styles.bar]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    alignSelf: "stretch",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(23, 28, 31, 0.07)",
    ...Platform.select({
      ios: {
        shadowColor: "#171c1f",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.09,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  bar: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderTopWidth: 0,
    elevation: 0,
    shadowOpacity: 0,
    minHeight: 52,
    paddingTop: 6,
    paddingHorizontal: 2,
  },
});
