import { GlassContainer, isLiquidGlassAvailable } from "expo-glass-effect";
import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GlassSurface } from "./GlassSurface";

const SIZE = 40;

/**
 * One round glass control in the header: a glyph on Liquid Glass, the way a toolbar button sits
 * over content in iOS 26. `badge` is a number worth a glance, such as people waiting at the door.
 */
export function HeaderButton({
  icon: Icon,
  label,
  onPress,
  disabled = false,
  badge = 0,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  badge?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} waiting` : label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={disabled && styles.disabled}
    >
      <GlassSurface interactive style={styles.button}>
        <Icon size={19} color="#FFFFFF" strokeWidth={2} />
      </GlassSurface>
      {badge > 0 && (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

/** The header's buttons as one toolbar: on iOS 26 the glass pieces merge as they near each other. */
export function HeaderButtonGroup({ children }: { children: ReactNode }) {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassContainer spacing={10} style={styles.group}>
        {children}
      </GlassContainer>
    );
  }
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
  group: { flexDirection: "row", alignItems: "center", gap: 10 },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  disabled: { opacity: 0.4 },
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#FF9F0A",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#111111", fontSize: 11, fontWeight: "700" },
});
