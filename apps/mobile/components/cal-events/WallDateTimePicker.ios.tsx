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
  mode = "datetime",
  onChange,
  onClose,
}: WallDateTimePickerProps) {
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);
  // SwiftUI's picker only shows the device's zone, so a wall time the device's clock skips (its
  // spring-forward hour) shows an hour later. The picker echoes its selection when it opens: drop
  // that echo so opening alone doesn't move the time.
  const selection = wallTimeToCalendarDate(value);
  const shownWallTime = calendarDateToWallTime(selection);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/*
        Neither Pressable is an accessibility element, so VoiceOver reaches the picker and Done
        inside instead of one grouped "Close"; Done and the escape gesture dismiss it there.
      */}
      <Pressable
        onPress={onClose}
        accessible={false}
        onAccessibilityEscape={onClose}
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
          accessible={false}
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
              selection={selection}
              range={minWallTime ? { start: wallTimeToCalendarDate(minWallTime) } : undefined}
              displayedComponents={mode === "time" ? ["hourAndMinute"] : ["date", "hourAndMinute"]}
              onDateChange={(date) => {
                const picked = calendarDateToWallTime(date);
                if (picked !== shownWallTime) onChange(picked);
              }}
              modifiers={[datePickerStyle(mode === "time" ? "wheel" : "graphical")]}
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
