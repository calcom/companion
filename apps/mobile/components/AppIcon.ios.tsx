import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import { StyleSheet, type ViewStyle } from "react-native";
import { getSFSymbolForIonicon } from "@/constants/sfSymbols";
import type { AppIconProps } from "./AppIcon";

export type { AppIconName, AppIconProps } from "./AppIcon";

/**
 * iOS: draws the SF Symbol that matches the Ionicons name, so icons share the system's
 * weight and optical alignment with the text and controls around them. A name without a
 * symbol in the map still draws as Ionicons.
 */
export function AppIcon({ name, size = 20, color, style, accessibilityLabel }: AppIconProps) {
  const fallback = (
    <Ionicons
      name={name}
      size={size}
      color={color as React.ComponentProps<typeof Ionicons>["color"]}
      style={style}
      accessibilityLabel={accessibilityLabel}
    />
  );
  const symbol = getSFSymbolForIonicon(name);
  if (!symbol) return fallback;

  // Ionicons take text styles; a symbol is a view, so keep only what affects layout.
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  return (
    <SymbolView
      name={symbol}
      size={size}
      tintColor={color}
      type="monochrome"
      fallback={fallback}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          width: size,
          height: size,
          margin: flat.margin,
          marginTop: flat.marginTop,
          marginBottom: flat.marginBottom,
          marginLeft: flat.marginLeft,
          marginRight: flat.marginRight,
          marginHorizontal: flat.marginHorizontal,
          marginVertical: flat.marginVertical,
          marginStart: flat.marginStart,
          marginEnd: flat.marginEnd,
          opacity: flat.opacity,
          transform: flat.transform,
          position: flat.position,
          top: flat.top,
          left: flat.left,
          right: flat.right,
          bottom: flat.bottom,
          alignSelf: flat.alignSelf,
        },
      ]}
    />
  );
}
