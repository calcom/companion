import { Modal, Pressable, Text, useColorScheme, View } from "react-native";
import { getColors } from "@/constants/colors";
import { splitWallTimeParts } from "@/utils/wall-time";
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
          {/* Time mode keeps the value's day; the input's min would apply to every day, so it has none. */}
          <input
            type={mode === "time" ? "time" : "datetime-local"}
            aria-label={title}
            value={mode === "time" ? timeOfDay : value}
            min={mode === "time" ? undefined : minWallTime}
            onChange={(event) => {
              const picked = event.target.value;
              if (!picked) return;
              onChange(mode === "time" ? `${date}T${picked.slice(0, 5)}` : picked.slice(0, 16));
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
