import type { LucideIcon } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GlassSurface } from "./GlassSurface";

const SIZE = 56;

/**
 * One round control. `active` is the "something is off" look — a muted microphone shows as a
 * solid white disc with a dark glyph, the way FaceTime does — and `tone="destructive"` is the
 * red hang-up. `badge` is a count worth a glance, like unread chat.
 */
export function TrayButton({
  icon: Icon,
  label,
  onPress,
  active = false,
  disabled = false,
  tone = "neutral",
  size = SIZE,
  badge = 0,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: "neutral" | "destructive";
  size?: number;
  badge?: number;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  const iconColor = tone === "destructive" ? "#FFFFFF" : active ? "#111111" : "#FFFFFF";
  const content = <Icon size={size * 0.42} color={iconColor} strokeWidth={2} />;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} unread` : label}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={[styles.pressable, disabled && styles.disabled]}
    >
      {tone === "destructive" ? (
        <View style={[styles.center, round, styles.destructive]}>{content}</View>
      ) : active ? (
        <View style={[styles.center, round, styles.active]}>{content}</View>
      ) : (
        <GlassSurface interactive style={[styles.center, round]}>
          {content}
        </GlassSurface>
      )}
      {badge > 0 && (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TrayLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  pressable: { alignItems: "center" },
  disabled: { opacity: 0.4 },
  center: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  active: { backgroundColor: "#FFFFFF" },
  destructive: { backgroundColor: "#FF3B30" },
  label: { color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 6 },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
});
