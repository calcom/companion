import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Platform, Text, TextInput, TouchableOpacity, useColorScheme, View } from "react-native";
import { CalEventsList } from "@/components/cal-events/CalEventsList";
import { useCreateCalEventFlow } from "@/components/cal-events/useCreateCalEventFlow";
import { Header } from "@/components/Header";
import { getColors } from "@/constants/colors";

export default function Events() {
  const [searchQuery, setSearchQuery] = useState("");
  // Search only covers the selected chip's events, so the placeholder names it.
  const [profileName, setProfileName] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);
  const { startCreate: handleCreate, picker } = useCreateCalEventFlow();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header />
      {/* The search and New bar of Links and Availability. */}
      <View
        style={{
          backgroundColor: isDark ? "#000000" : "#f3f4f6",
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
        className="flex-row items-center gap-3 px-4 py-2"
      >
        <View style={{ flex: 1, position: "relative", justifyContent: "center" }}>
          <TextInput
            style={{
              backgroundColor: isDark ? "#171717" : "#FFFFFF",
              borderColor: theme.border,
              color: theme.text,
              paddingRight: searchQuery.length > 0 ? 32 : 12,
            }}
            className="rounded-lg border px-3 py-2 text-[17px]"
            placeholder={profileName ? `Search ${profileName} events` : "Search events"}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {/* iOS draws its own (clearButtonMode); Android and the web need this one. */}
          {searchQuery.length > 0 && Platform.OS !== "ios" && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={{ position: "absolute", right: 8 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          className="min-w-[60px] flex-row items-center justify-center gap-1 rounded-lg bg-black px-2.5 py-2 dark:bg-white"
          onPress={handleCreate}
          accessibilityRole="button"
          accessibilityLabel="New event"
        >
          <Ionicons name="add" size={18} color={isDark ? "#000" : "#fff"} />
          <Text className="text-base font-semibold text-white dark:text-black">New</Text>
        </TouchableOpacity>
      </View>
      <CalEventsList
        searchQuery={searchQuery}
        onCreate={handleCreate}
        onProfileNameChange={setProfileName}
      />
      {picker}
    </View>
  );
}
