import { Host, Picker, Text as SwiftText } from "@expo/ui/swift-ui";
import {
  disabled as disabledModifier,
  labelsHidden,
  pickerStyle,
  tag,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { Text, useColorScheme, View } from "react-native";
import { haptics } from "@/utils/haptics";
import type { CalRegion } from "@/utils/region";
import { REGION_OPTIONS, type RegionPickerProps } from "./regionOptions";

/**
 * iOS: a grouped row with SwiftUI's menu-style Picker on the trailing edge, the way Settings
 * shows a choice. Tapping the value opens the system menu with a checkmark on the current one.
 */
export function RegionPicker({ region, onChange, disabled }: RegionPickerProps) {
  const isDark = useColorScheme() === "dark";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 52,
        paddingLeft: 16,
        paddingRight: 8,
        borderRadius: 14,
        borderCurve: "continuous",
        backgroundColor: isDark ? "#1C1C1E" : "#F2F2F7",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{ fontSize: 17, color: isDark ? "#FFFFFF" : "#000000" }}
        maxFontSizeMultiplier={1.6}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        Data region
      </Text>
      <Host matchContents>
        <Picker
          label="Data region"
          selection={region}
          onSelectionChange={(next) => {
            haptics.selection();
            onChange(next as CalRegion);
          }}
          modifiers={[
            pickerStyle("menu"),
            labelsHidden(),
            tint(isDark ? "#EBEBF599" : "#3C3C4399"),
            disabledModifier(Boolean(disabled)),
          ]}
        >
          {REGION_OPTIONS.map((option) => (
            <SwiftText key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </SwiftText>
          ))}
        </Picker>
      </Host>
    </View>
  );
}
