import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { theme } from "../theme/theme";

type Props = {
  /** Outer ring diameter */
  size?: number;
  message?: string;
  style?: ViewStyle;
};

/**
 * Animated circular border with a paw in the center — for screen / module loading.
 */
export function PawCircularLoader({ size = 76, message, style }: Props) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 880,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={[styles.wrap, style]} accessibilityRole="progressbar" accessibilityLabel={message ?? "Loading"}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              transform: [{ rotate: spin }],
            },
          ]}
        />
        <View style={styles.pawCenter} pointerEvents="none">
          <Text style={{ fontSize: Math.max(18, size * 0.32), lineHeight: Math.max(20, size * 0.36) }}>🐾</Text>
        </View>
      </View>
      {message ? <Text style={styles.msg}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  ring: {
    position: "absolute",
    borderWidth: 4,
    borderColor: `${theme.primary}22`,
    borderTopColor: theme.primary,
    borderRightColor: `${theme.primary}55`,
  },
  pawCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  msg: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.onSurfaceVariant,
    textAlign: "center",
  },
});
