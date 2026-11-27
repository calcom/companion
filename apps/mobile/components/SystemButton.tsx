import {
  ActivityIndicator,
  type StyleProp,
  Text,
  useColorScheme,
  type ViewStyle,
} from "react-native";
import { AppPressable } from "@/components/AppPressable";

type SystemButtonProps = {
  title: string;
  onPress: () => void;
  /** "prominent" fills with the app's accent; "bordered" is the quieter tinted capsule. */
  variant?: "prominent" | "bordered";
  /** "large" is the 50pt full-width call to action; "regular" hugs its label. */
  size?: "regular" | "large";
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A capsule button in the shape of iOS's bordered and bordered-prominent buttons.
 *
 * - At least 44pt tall (HIG minimum hit target); 50pt for a large call to action.
 * - Continuous corners, 17pt semibold label (iOS "headline").
 * - Disabled dims to 40% opacity instead of turning gray, as UIKit does.
 * - Press feedback and a light haptic come from AppPressable.
 */
export function SystemButton({
  title,
  onPress,
  variant = "prominent",
  size = "regular",
  disabled = false,
  loading = false,
  accessibilityHint,
  style,
}: SystemButtonProps) {
  const isDark = useColorScheme() === "dark";
  const prominent = variant === "prominent";
  const background = prominent
    ? isDark
      ? "#FFFFFF"
      : "#111111"
    : isDark
      ? "rgba(255,255,255,0.14)"
      : "rgba(0,0,0,0.06)";
  const foreground = prominent ? (isDark ? "#000000" : "#FFFFFF") : isDark ? "#FFFFFF" : "#111111";
  const inactive = disabled || loading;
  const large = size === "large";

  return (
    <AppPressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        {
          minHeight: large ? 50 : 44,
          paddingHorizontal: large ? 24 : 20,
          borderRadius: large ? 25 : 22,
          borderCurve: "continuous",
          backgroundColor: background,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          alignSelf: large ? "stretch" : "center",
          opacity: disabled && !loading ? 0.4 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.6}
          style={{ color: foreground, fontSize: 17, fontWeight: "600", letterSpacing: -0.4 }}
        >
          {title}
        </Text>
      )}
    </AppPressable>
  );
}
