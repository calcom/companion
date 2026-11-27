import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

export type AppIconName = ComponentProps<typeof Ionicons>["name"];

export type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: ColorValue;
  style?: ComponentProps<typeof Ionicons>["style"];
  accessibilityLabel?: string;
};

/**
 * The app's icon. Android and web draw Ionicons; iOS swaps in the matching SF Symbol
 * (see AppIcon.ios.tsx). Callers keep using Ionicons names on every platform.
 */
export function AppIcon({ name, size = 20, color, style, accessibilityLabel }: AppIconProps) {
  return (
    <Ionicons
      name={name}
      size={size}
      color={color as ComponentProps<typeof Ionicons>["color"]}
      style={style}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
