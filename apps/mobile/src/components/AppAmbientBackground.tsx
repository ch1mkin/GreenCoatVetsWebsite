import { useEffect, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme/theme";

const { width: W, height: H } = Dimensions.get("window");

/**
 * Soft base + drifting blobs + slow gradient shimmer for a subtle “live” feel.
 * Use behind main content with pointerEvents="none".
 */
export function AppAmbientBackground() {
  const driftA = useRef(new Animated.Value(0)).current;
  const driftB = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopA = Animated.loop(
      Animated.sequence([
        Animated.timing(driftA, {
          toValue: 1,
          duration: 12000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(driftA, {
          toValue: 0,
          duration: 12000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const loopB = Animated.loop(
      Animated.sequence([
        Animated.timing(driftB, {
          toValue: 1,
          duration: 9500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(driftB, {
          toValue: 0,
          duration: 9500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const loopShimmer = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loopA.start();
    loopB.start();
    loopShimmer.start();
    return () => {
      loopA.stop();
      loopB.stop();
      loopShimmer.stop();
    };
  }, [driftA, driftB, shimmer]);

  const ax = driftA.interpolate({ inputRange: [0, 1], outputRange: [-28, 36] });
  const ay = driftA.interpolate({ inputRange: [0, 1], outputRange: [12, -22] });
  const bx = driftB.interpolate({ inputRange: [0, 1], outputRange: [30, -40] });
  const by = driftB.interpolate({ inputRange: [0, 1], outputRange: [-18, 26] });

  const spin = shimmer.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const gradOpacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.55, 0.35] });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]} />

      <Animated.View
        style={[
          styles.blob,
          {
            top: H * 0.08,
            left: W * 0.02,
            width: W * 0.55,
            height: W * 0.55,
            borderRadius: W * 0.3,
            backgroundColor: `${theme.primary}12`,
            transform: [{ translateX: ax }, { translateY: ay }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.blob,
          {
            bottom: H * 0.12,
            right: -W * 0.08,
            width: W * 0.62,
            height: W * 0.62,
            borderRadius: W * 0.35,
            backgroundColor: `${theme.primaryFixedDim ?? theme.primary}18`,
            transform: [{ translateX: bx }, { translateY: by }],
          },
        ]}
      />
      <View style={[styles.blob, { top: H * 0.42, right: W * 0.12, width: 120, height: 120, borderRadius: 60, backgroundColor: `${theme.tertiary ?? theme.primary}10` }]} />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: gradOpacity }]}>
        <Animated.View style={{ flex: 1, transform: [{ rotate: spin }] }}>
          <LinearGradient
            colors={[`${theme.primary}14`, "transparent", `${theme.primaryContainer ?? theme.primary}22`, "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </Animated.View>

      <LinearGradient
        colors={["transparent", `${theme.surfaceContainerHighest}44`]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    opacity: 0.95,
  },
});
