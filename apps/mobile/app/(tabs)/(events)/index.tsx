import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
import { CalEventsList } from "@/components/cal-events/CalEventsList";
import { Header } from "@/components/Header";
import { getColors } from "@/constants/colors";
import { showErrorAlert } from "@/utils/alerts";
import { openInAppBrowser } from "@/utils/browser";
import { getCalAppUrl } from "@/utils/region";

export default function Events() {
  const [searchQuery, setSearchQuery] = useState("");
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);

  // Events are created in the web editor; the app lists and manages them.
  const handleCreate = async () => {
    try {
      await openInAppBrowser(`${getCalAppUrl()}/events/new`, "new event");
    } catch {
      showErrorAlert("Error", "Failed to open the event editor. Please try again.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundSecondary }}>
      <Header />
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 12,
          gap: 8,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            borderRadius: 10,
            paddingHorizontal: 10,
            height: 40,
            backgroundColor: theme.backgroundMuted,
          }}
        >
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search events"
            placeholderTextColor={theme.textMuted}
            style={{ flex: 1, marginLeft: 8, color: theme.text, fontSize: 16 }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search events"
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={handleCreate}
          accessibilityRole="button"
          accessibilityLabel="New event"
          style={{
            height: 40,
            paddingHorizontal: 14,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isDark ? "#FFFFFF" : "#111827",
          }}
        >
          <Text style={{ color: isDark ? "#000000" : "#FFFFFF", fontWeight: "600" }}>New</Text>
        </TouchableOpacity>
      </View>
      <CalEventsList searchQuery={searchQuery} onCreate={handleCreate} />
    </View>
  );
}
