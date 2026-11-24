import { useRouter } from "expo-router";
import { Platform, useColorScheme, View } from "react-native";
import { CalEventMenu } from "@/components/cal-event-list-item/CalEventMenu";
import type { CalEventMenuItem } from "@/components/cal-event-list-item/CalEventMenu.types";
import {
  HEADER_ICON_BUTTON_CLASS,
  HeaderBackButton,
  HeaderPillButton,
} from "@/components/HeaderButtons";
import { HeaderButtonWrapper } from "@/components/HeaderButtonWrapper";

/** A labelled button on the header's right, such as Edit. */
export interface CalEventHeaderAction {
  label: string;
  onPress: () => void;
}

/**
 * The header of an Events screen pushed onto the Events stack, with an optional "⋯" `menu` and
 * `action` on its right, as in the editor. On the web and Android it's the Links and Bookings
 * header: a round back button, no divider, round "⋯" and a pill. iOS keeps its native header,
 * with a native menu and button.
 */
export function useCalEventHeaderOptions(
  backTitle: string,
  action?: CalEventHeaderAction | null,
  menu: CalEventMenuItem[] = []
) {
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const hasRight = !!action || menu.length > 0;
  if (Platform.OS === "ios") {
    return {
      headerBackTitle: backTitle,
      unstable_headerRightItems: hasRight
        ? () => [
            ...(menu.length > 0
              ? [
                  {
                    type: "menu" as const,
                    label: "",
                    accessibilityLabel: "More actions",
                    icon: { type: "sfSymbol" as const, name: "ellipsis" as const },
                    sharesBackground: true,
                    menu: {
                      items: menu.map((item) => ({
                        type: "action" as const,
                        label: item.label,
                        icon: { type: "sfSymbol" as const, name: item.systemImage },
                        destructive: item.destructive,
                        onPress: item.onPress,
                      })),
                    },
                  },
                ]
              : []),
            ...(action
              ? [
                  {
                    type: "button" as const,
                    label: action.label,
                    sharesBackground: true,
                    onPress: action.onPress,
                  },
                ]
              : []),
          ]
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
    headerRight: hasRight
      ? () => (
          <HeaderButtonWrapper side="right">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {menu.length > 0 ? (
                <CalEventMenu
                  groups={[menu]}
                  accessibilityLabel="More actions"
                  triggerClassName={HEADER_ICON_BUTTON_CLASS}
                />
              ) : null}
              {action ? <HeaderPillButton label={action.label} onPress={action.onPress} /> : null}
            </View>
          </HeaderButtonWrapper>
        )
      : undefined,
  };
}
