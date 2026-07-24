import { useWindowDimensions } from "react-native";
import { isTabletSize } from "@/hooks/is-tablet-size";

/**
 * Returns `true` when the app is running on a tablet-sized screen.
 *
 * Reacts to dimension changes (rotation, split view) via `useWindowDimensions`,
 * so consumers re-render with the correct layout when the window resizes.
 */
export function useIsTablet(): boolean {
  const { width, height } = useWindowDimensions();
  return isTabletSize(width, height);
}
