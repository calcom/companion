import { Ionicons } from "@expo/vector-icons";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { useState } from "react";
import { TouchableOpacity, useColorScheme, View } from "react-native";
import { CalEventsList } from "@/components/cal-events/CalEventsList";
import { useCreateCalEventFlow } from "@/components/cal-events/useCreateCalEventFlow";

export default function EventsIOS() {
  const [searchQuery, setSearchQuery] = useState("");
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { startCreate: handleCreate, picker } = useCreateCalEventFlow();

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Search events",
            onChangeText: (e) => setSearchQuery(e.nativeEvent.text),
            onCancelButtonPress: () => setSearchQuery(""),
            hideWhenScrolling: true,
          },
        }}
      />
      <Stack.Header
        style={{ backgroundColor: "transparent", shadowColor: "transparent" }}
        blurEffect={isLiquidGlassAvailable() ? undefined : isDark ? "dark" : "light"}
      >
        <Stack.Header.Title large>Events</Stack.Header.Title>
      </Stack.Header>
      <CalEventsList
        searchQuery={searchQuery}
        onCreate={handleCreate}
        contentInsetAdjustmentBehavior="automatic"
      />
      {/* The floating "+" the Links tab has, for a new event. */}
      <View className="absolute right-6" style={{ bottom: 100 }}>
        <TouchableOpacity
          onPress={handleCreate}
          accessibilityRole="button"
          accessibilityLabel="New event"
          className="h-14 w-14 items-center justify-center rounded-full bg-black shadow-lg shadow-black/20 dark:bg-white"
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={30} color={isDark ? "#000000" : "#FFFFFF"} />
        </TouchableOpacity>
      </View>
      {picker}
    </>
  );
}
