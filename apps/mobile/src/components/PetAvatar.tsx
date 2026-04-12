import { Image, StyleSheet, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { theme } from "../theme/theme";

export function PetAvatar({ uri, size = 40 }: { uri?: string | null; size?: number }) {
  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <MaterialIcons name="pets" size={Math.max(16, size * 0.48)} color={theme.primary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: theme.outlineVariant,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
