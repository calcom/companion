import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { useState } from "react";
import { useColorScheme } from "react-native";
import { CalEventsList } from "@/components/cal-events/CalEventsList";
import { useCreateCalEventFlow } from "@/components/cal-events/useCreateCalEventFlow";

export default function EventsIOS() {
  const [searchQuery, setSearchQuery] = useState("");
  // Search only covers the selected chip's events, so the placeholder names it.
  const [profileName, setProfileName] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { startCreate: handleCreate, picker } = useCreateCalEventFlow();

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: profileName ? `Search ${profileName} events` : "Search events",
            onChangeText: (e) => setSearchQuery(e.nativeEvent.text),
            onCancelButtonPress: () => setSearchQuery(""),
            // Hiding it on scroll also starts it hidden: it showed only after a pull down.
            hideWhenScrolling: false,
          },
        }}
      />
      <Stack.Header
        style={{ backgroundColor: "transparent", shadowColor: "transparent" }}
        blurEffect={isLiquidGlassAvailable() ? undefined : isDark ? "dark" : "light"}
      />
      <Stack.Title large>Events</Stack.Title>
      {/* New event: iOS puts "add" in the navigation bar, not in a floating button */}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="New event" onPress={handleCreate} />
      </Stack.Toolbar>

      <CalEventsList
        searchQuery={searchQuery}
        onCreate={handleCreate}
        onProfileNameChange={setProfileName}
        contentInsetAdjustmentBehavior="automatic"
      />
      {picker}
    </>
  );
}
