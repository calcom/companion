import { Modal, Pressable, Text, useColorScheme, View } from "react-native";
import { getColors } from "@/constants/colors";
import type { WallDateTimePickerProps } from "./WallDateTimePicker.types";

/** Web (the extension): the browser's own date-and-time input, which takes wall times as they are. */
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
          style={{ borderRadius: 16, padding: 16, gap: 12, backgroundColor: theme.background }}
        >
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}>{title}</Text>
          <input
            type="datetime-local"
            value={value}
            min={minWallTime}
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value.slice(0, 16));
            }}
            style={{
              height: 40,
              fontSize: 17,
              color: theme.text,
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
