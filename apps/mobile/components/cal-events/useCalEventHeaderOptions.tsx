import { useRouter } from "expo-router";
import { Platform, useColorScheme } from "react-native";
import { HeaderBackButton } from "@/components/HeaderButtons";
import { HeaderButtonWrapper } from "@/components/HeaderButtonWrapper";

/**
 * The header of an Events screen pushed onto the Events stack. On the web and Android it's the
 * Links and Bookings header: a round back button, no divider. iOS keeps its native header.
 */
export function useCalEventHeaderOptions(backTitle: string) {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  return {
    headerBackTitle: backTitle,
    ...(Platform.OS === "ios"
      ? {}
      : {
          headerStyle: { backgroundColor: isDark ? "black" : "white" },
          headerShadowVisible: false,
          headerLeft: () => (
            <HeaderButtonWrapper side="left">
              <HeaderBackButton onPress={() => router.back()} />
            </HeaderButtonWrapper>
          ),
        }),
  };
}
