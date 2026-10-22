import { Ionicons } from "@expo/vector-icons";
import { Fragment } from "react";
import { Pressable, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Text } from "@/components/ui/text";
import { getColors } from "@/constants/colors";
import type { CalEventMenuProps } from "./CalEventMenu.types";

/** An event card's "⋯" menu: the Links card's menu, its groups split by dividers. */
export function CalEventMenu({ groups, accessibilityLabel }: CalEventMenuProps) {
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);
  const insets = useSafeAreaInsets();
  const iconColor = isDark ? "#E5E5EA" : "#374151";
  const shown = groups.filter((group) => group.length > 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          hitSlop={8}
          className="items-center justify-center rounded-lg border border-cal-border bg-white dark:border-cal-border-dark dark:bg-[#171717]"
          style={{ width: 36, height: 36, flexShrink: 0 }}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={isDark ? "#FFFFFF" : "#3C3F44"} />
        </Pressable>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        insets={{ top: insets.top, bottom: insets.bottom, left: 12, right: 12 }}
        sideOffset={8}
        className="w-44"
        align="end"
      >
        {shown.map((group, index) => (
          <Fragment key={group[0].label}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            {group.map((item) => (
              <DropdownMenuItem
                key={item.label}
                variant={item.destructive ? "destructive" : undefined}
                onPress={item.onPress}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={item.destructive ? theme.destructive : iconColor}
                  style={{ marginRight: 8 }}
                />
                <Text style={item.destructive ? { color: theme.destructive } : undefined}>
                  {item.label}
                </Text>
              </DropdownMenuItem>
            ))}
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
