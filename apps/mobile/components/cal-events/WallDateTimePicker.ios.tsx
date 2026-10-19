import { DatePicker, Host } from "@expo/ui/swift-ui";
import { datePickerStyle } from "@expo/ui/swift-ui/modifiers";
import { Modal, Pressable, Text, useColorScheme, View } from "react-native";
import { getColors } from "@/constants/colors";
import { calendarDateToWallTime, wallTimeToCalendarDate } from "@/utils/wall-time";
import type { WallDateTimePickerProps } from "./WallDateTimePicker.types";

/**
 * The web's date-and-time popover: a SwiftUI calendar with a time row, over a dimmed backdrop.
 * Picks are face values; the event's timezone turns them into an instant later.
 */
export function WallDateTimePicker({
  visible,
  title,
  value,
  minWallTime,
  onChange,
  onClose,
}: WallDateTimePickerProps) {
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 16,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
        }}
      >
        {/* A Pressable that swallows taps, so only the backdrop closes the panel. */}
        <Pressable
          onPress={() => {}}
          style={{ borderRadius: 20, padding: 12, backgroundColor: theme.background }}
        >
          <Text
            style={{
              color: theme.text,
              fontSize: 17,
              fontWeight: "600",
              textAlign: "center",
              paddingVertical: 8,
            }}
          >
            {title}
          </Text>
          <Host matchContents>
            <DatePicker
              selection={wallTimeToCalendarDate(value)}
              range={minWallTime ? { start: wallTimeToCalendarDate(minWallTime) } : undefined}
              displayedComponents={["date", "hourAndMinute"]}
              onDateChange={(date) => onChange(calendarDateToWallTime(date))}
              modifiers={[datePickerStyle("graphical")]}
            />
          </Host>
          <View style={{ alignItems: "flex-end", paddingTop: 4 }}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              hitSlop={8}
              style={{ paddingVertical: 8, paddingHorizontal: 12 }}
            >
              <Text style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
