import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalComLogo } from "@/components/CalComLogo";

const SIDEBAR_WIDTH = 240;

type IoniconName = keyof typeof Ionicons.glyphMap;

const ROUTE_META: Record<string, { label: string; icon: IoniconName; activeIcon: IoniconName }> = {
  "(bookings)": { label: "Bookings", icon: "calendar-outline", activeIcon: "calendar" },
  "(event-types)": { label: "Event Types", icon: "link-outline", activeIcon: "link" },
  "(availability)": { label: "Availability", icon: "time-outline", activeIcon: "time" },
  "(more)": { label: "More", icon: "ellipsis-horizontal", activeIcon: "ellipsis-horizontal" },
};

/**
 * Vertical navigation sidebar used on tablets. Renders the Cal.com wordmark at
 * the top (inverted in dark mode) and the app's primary sections below, mirroring
 * the Cal.com web layout while staying inside the React Navigation tab navigator.
 */
export function TabletSidebar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";

  const colors = {
    background: isDark ? "#000000" : "#FFFFFF",
    border: isDark ? "#4D4D4D" : "#C6C6C8",
    logo: isDark ? "#FFFFFF" : "#111111",
    active: isDark ? "#FFFFFF" : "#000000",
    inactive: "#A3A3A3",
    activeBackground: isDark ? "#FFFFFF15" : "#00000010",
  };

  return (
    <View
      style={{
        width: SIDEBAR_WIDTH,
        backgroundColor: colors.background,
        borderRightWidth: 0.5,
        borderRightColor: colors.border,
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 12,
        paddingHorizontal: 12,
      }}
    >
      <View style={{ paddingHorizontal: 12, paddingBottom: 24 }}>
        <CalComLogo color={colors.logo} />
      </View>

      {state.routes.map((route) => {
        const meta = ROUTE_META[route.name];
        if (!meta) {
          return null;
        }

        const isFocused = state.routes[state.index]?.key === route.key;
        const color = isFocused ? colors.active : colors.inactive;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            onPress={onPress}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              marginBottom: 4,
              borderRadius: 10,
              backgroundColor: isFocused ? colors.activeBackground : "transparent",
            }}
          >
            <Ionicons name={isFocused ? meta.activeIcon : meta.icon} size={22} color={color} />
            <Text style={{ color, fontSize: 16, fontWeight: isFocused ? "600" : "400" }}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
