import { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { theme } from "../theme/theme";

/** Active tab: green-highlighted icon with subtle selected pill. */
export function VetCareTabButton(props: BottomTabBarButtonProps) {
  const { children, onPress, accessibilityState, accessibilityLabel, testID, style } = props;
  const focused = accessibilityState?.selected;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      style={[styles.flex, !focused && styles.muted, style]}
    >
      <View style={[styles.pill, focused && styles.pillFocused]}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    maxWidth: 68,
  },
  pillFocused: {
    backgroundColor: `${theme.primary}20`,
    borderWidth: 1,
    borderColor: `${theme.primary}66`,
  },
  muted: {
    opacity: 0.62,
    paddingVertical: 6,
  },
});
