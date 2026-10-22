import { Modal, Pressable, Text, useColorScheme, View } from "react-native";
import { getColors, getGroupedSurfaces } from "@/constants/colors";
import { isSameWallDay, splitWallTimeParts } from "@/utils/wall-time";
import type { WallDateTimePickerProps } from "./WallDateTimePicker.types";

/** Web (the extension): the browser's own date-and-time input, which takes wall times as they are. */
export function WallDateTimePicker({
  visible,
  title,
  value,
  minWallTime,
  mode = "datetime",
  onChange,
  onClose,
}: WallDateTimePickerProps) {
  const { date, timeOfDay } = splitWallTimeParts(value);
  const minTimeOfDay =
    minWallTime && isSameWallDay(minWallTime, value)
      ? splitWallTimeParts(minWallTime).timeOfDay
      : undefined;
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            borderRadius: 16,
            padding: 16,
            gap: 12,
            backgroundColor: getGroupedSurfaces(isDark).card,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}>{title}</Text>
          {/*
            Time mode keeps the value's day, so only a minimum on that day limits it. Browsers still
            accept an earlier time, and holding each change at the minimum would stop typing "11" at
            its "01", so the save checks it.
          */}
          <input
            type={mode === "time" ? "time" : "datetime-local"}
            aria-label={title}
            value={mode === "time" ? timeOfDay : value}
            min={mode === "time" ? minTimeOfDay : minWallTime}
            onChange={(event) => {
              const picked = event.target.value;
              if (!picked) return;
              onChange(mode === "time" ? `${date}T${picked.slice(0, 5)}` : picked.slice(0, 16));
            }}
            style={{
              height: 40,
              fontSize: 17,
              color: theme.text,
              // The browser draws the calendar icon and its popup for this scheme, not from color.
              colorScheme: isDark ? "dark" : "light",
              backgroundColor: "transparent",
              border: `1px solid ${theme.border}`,
              borderRadius: 8,
              padding: "0 8px",
            }}
          />
          <View style={{ alignItems: "flex-end" }}>
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
