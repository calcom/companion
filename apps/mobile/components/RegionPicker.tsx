import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "@/components/AppIcon";
import { getRegionLabel, REGION_OPTIONS, type RegionPickerProps } from "./regionOptions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

/** Android and web: a labelled field that opens a dropdown of the regions. */
export function RegionPicker({ region, onChange, disabled }: RegionPickerProps) {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === "dark";
  const [triggerWidth, setTriggerWidth] = useState(0);

  const onTriggerLayout = (event: LayoutChangeEvent) => {
    setTriggerWidth(event.nativeEvent.layout.width);
  };

  return (
    <View>
      <Text
        className="mb-3 text-[13px] font-medium"
        style={{ color: isDark ? "#A3A3A3" : "#6B7280" }}
      >
        Data region
      </Text>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <TouchableOpacity
            className="min-h-[48px] flex-row items-center justify-between rounded-xl border px-4 py-2.5"
            onLayout={onTriggerLayout}
            accessibilityRole="button"
            accessibilityLabel={`Data region, ${getRegionLabel(region)}`}
            style={{
              borderColor: isDark ? "#4D4D4D" : "#E5E7EB",
              backgroundColor: isDark ? "#171717" : "#FFFFFF",
            }}
            activeOpacity={0.8}
          >
            <Text
              className="text-[15px] font-medium"
              style={{ color: isDark ? "#FFFFFF" : "#111827" }}
            >
              {getRegionLabel(region)}
            </Text>
            <AppIcon name="chevron-down" size={16} color={isDark ? "#A3A3A3" : "#6B7280"} />
          </TouchableOpacity>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          sideOffset={4}
          insets={{ top: insets.top + 8, bottom: insets.bottom + 120, left: 24, right: 24 }}
          className="min-w-0 self-stretch rounded-xl p-0"
          style={triggerWidth > 0 ? { width: triggerWidth } : undefined}
        >
          {REGION_OPTIONS.map((option, index) => {
            const selected = option.value === region;
            return (
              <DropdownMenuItem
                key={option.value}
                className="gap-0 px-1 py-1 active:bg-transparent"
                onPress={() => onChange(option.value)}
              >
                <View
                  className={`w-full flex-row items-center justify-between rounded-md px-2.5 py-1.5 ${
                    index < REGION_OPTIONS.length - 1 ? "mb-0.5" : ""
                  }`}
                  style={{
                    backgroundColor: selected ? (isDark ? "#2C2C2E" : "#F3F4F6") : "transparent",
                  }}
                >
                  <Text
                    className="flex-1 pr-1.5 text-[15px] leading-5"
                    style={{
                      color: selected
                        ? isDark
                          ? "#FFFFFF"
                          : "#111827"
                        : isDark
                          ? "#E5E7EB"
                          : "#374151",
                      fontWeight: selected ? "600" : "400",
                    }}
                  >
                    {option.label}
                  </Text>
                  <View className="w-4 items-end justify-center">
                    {selected ? (
                      <AppIcon name="checkmark" size={16} color={isDark ? "#FFFFFF" : "#111827"} />
                    ) : null}
                  </View>
                </View>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </View>
  );
}
