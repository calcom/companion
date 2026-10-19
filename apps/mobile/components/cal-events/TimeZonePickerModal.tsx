import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getColors } from "@/constants/colors";
import { TIMEZONES } from "@/constants/timezones";
import { timeZoneSummary } from "@/utils/wall-time";

interface TimeZonePickerModalProps {
  visible: boolean;
  value: string;
  onSelect: (timeZone: string) => void;
  onClose: () => void;
}

/** The web's timezone combobox: a searchable list showing each zone's current offset. */
export function TimeZonePickerModal({
  visible,
  value,
  onSelect,
  onClose,
}: TimeZonePickerModalProps) {
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  // The selected zone may be missing from the list (a device zone Cal.com doesn't list).
  const zones = useMemo<readonly string[]>(
    () => ((TIMEZONES as readonly string[]).includes(value) ? TIMEZONES : [value, ...TIMEZONES]),
    [value]
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, "_");
    return needle ? zones.filter((zone) => zone.toLowerCase().includes(needle)) : zones;
  }, [zones, query]);

  const close = () => {
    setQuery("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
      onRequestClose={close}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: theme.background,
          paddingTop: Platform.OS === "ios" ? 16 : insets.top + 8,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingBottom: 12,
            gap: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              height: 40,
              borderRadius: 10,
              paddingHorizontal: 10,
              backgroundColor: theme.backgroundMuted,
            }}
          >
            <Ionicons name="search-outline" size={18} color={theme.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search timezones"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search timezones"
              style={{ flex: 1, marginLeft: 8, color: theme.text, fontSize: 16 }}
            />
          </View>
          <Pressable onPress={close} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}>Cancel</Text>
          </Pressable>
        </View>
        <FlatList
          data={filtered}
          keyExtractor={(zone) => zone}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={30}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          renderItem={({ item: zone }) => {
            const summary = timeZoneSummary(zone);
            const selected = zone === value;
            return (
              <Pressable
                onPress={() => {
                  setQuery("");
                  onSelect(zone);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  gap: 12,
                }}
              >
                <Text style={{ flex: 1, color: theme.text, fontSize: 16 }} numberOfLines={1}>
                  {zone.replace(/_/g, " ")}
                </Text>
                <Text style={{ color: theme.textSecondary, fontSize: 15 }}>{summary.offset}</Text>
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={selected ? theme.text : "transparent"}
                />
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
}
