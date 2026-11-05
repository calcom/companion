import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { Platform, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";

/** Darkens the glass so white glyphs stay legible over a bright picture. */
const GLASS_TINT = "rgba(0, 0, 0, 0.45)";

/**
 * Liquid Glass where iOS 26 offers it, a translucent dark surface everywhere else. Call controls
 * float over video, so they need to read against anything.
 */
export function GlassSurface({
  style,
  children,
  interactive = false,
}: {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  interactive?: boolean;
}) {
  if (Platform.OS === "ios" && isLiquidGlassAvailable()) {
    return (
      <GlassView
        style={style}
        glassEffectStyle="regular"
        tintColor={GLASS_TINT}
        isInteractive={interactive}
      >
        {children}
      </GlassView>
    );
  }
  return <View style={[styles.fallback, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "rgba(40, 40, 44, 0.78)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.14)",
  },
});
