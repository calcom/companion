import { type ColorValue, Platform, PlatformColor } from "react-native";

/**
 * iOS semantic system colors, with the matching UIKit values for other platforms.
 *
 * On iOS these are PlatformColors, so they follow light/dark mode, Increase Contrast and the
 * elevated (sheet) variants on their own, the way UIKit views do. Elsewhere they resolve to the
 * UIKit values for the current scheme.
 */
const FALLBACKS = {
  label: ["#000000", "#FFFFFF"],
  secondaryLabel: ["#3C3C4399", "#EBEBF599"],
  tertiaryLabel: ["#3C3C434D", "#EBEBF54D"],
  systemBackground: ["#FFFFFF", "#000000"],
  systemGroupedBackground: ["#F2F2F7", "#000000"],
  secondarySystemGroupedBackground: ["#FFFFFF", "#1C1C1E"],
  tertiarySystemFill: ["#7676801F", "#7676803D"],
  systemGray4: ["#D1D1D6", "#3A3A3C"],
  separator: ["#3C3C434A", "#54545899"],
  systemRed: ["#FF3B30", "#FF453A"],
  link: ["#007AFF", "#0984FF"],
} as const;

export type SystemColorName = keyof typeof FALLBACKS;

export function systemColor(name: SystemColorName, isDark: boolean): ColorValue {
  if (Platform.OS === "ios") return PlatformColor(name);
  return FALLBACKS[name][isDark ? 1 : 0];
}
