import type { ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { useIsTablet } from "@/hooks/useIsTablet";

/**
 * Maximum width, in density-independent pixels, that primary content columns
 * are allowed to grow to on tablets. Phone-sized screens are unconstrained.
 */
export const TABLET_MAX_CONTENT_WIDTH = 760;

interface ResponsiveContentContainerProps {
  children: ReactNode;
  /** Classes forwarded to the wrapper (e.g. `flex-1`, padding). */
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Constrains and centers its children into a readable column on tablets while
 * leaving phone layouts untouched. Native chrome (tab bar, navigation headers)
 * stays full-width — only the scrollable body content is centered, which is the
 * expected behavior for a phone-first layout scaled up to an iPad canvas.
 */
export function ResponsiveContentContainer({
  children,
  className,
  style,
}: ResponsiveContentContainerProps) {
  const isTablet = useIsTablet();

  return (
    <View
      className={className}
      style={[
        isTablet && {
          width: "100%",
          maxWidth: TABLET_MAX_CONTENT_WIDTH,
          alignSelf: "center",
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
