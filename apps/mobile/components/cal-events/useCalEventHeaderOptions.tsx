import { useRouter } from "expo-router";
import { Platform, useColorScheme } from "react-native";
import { HeaderBackButton, HeaderPillButton } from "@/components/HeaderButtons";
import { HeaderButtonWrapper } from "@/components/HeaderButtonWrapper";

/** A labelled button on the header's right, such as Edit. */
export interface CalEventHeaderAction {
  label: string;
  onPress: () => void;
}

/**
 * The header of an Events screen pushed onto the Events stack. On the web and Android it's the
 * Links and Bookings header: a round back button, no divider, and `action` as a pill. iOS keeps
 * its native header, with `action` as a native button.
 */
export function useCalEventHeaderOptions(backTitle: string, action?: CalEventHeaderAction | null) {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  if (Platform.OS === "ios") {
    return {
      headerBackTitle: backTitle,
      unstable_headerRightItems: action
        ? () => [{ type: "button" as const, label: action.label, onPress: action.onPress }]
        : undefined,
    };
  }
  return {
    headerBackTitle: backTitle,
    headerStyle: { backgroundColor: isDark ? "black" : "white" },
    headerShadowVisible: false,
    headerLeft: () => (
      <HeaderButtonWrapper side="left">
        <HeaderBackButton onPress={() => router.back()} />
      </HeaderButtonWrapper>
    ),
    headerRight: action
      ? () => (
          <HeaderButtonWrapper side="right">
            <HeaderPillButton label={action.label} onPress={action.onPress} />
          </HeaderButtonWrapper>
        )
      : undefined,
  };
}
