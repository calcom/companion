import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { useState } from "react";
import { useColorScheme } from "react-native";
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
        <Stack.Header.Right>
          <Stack.Header.Button onPress={handleCreate}>
            <Stack.Header.Icon sf="plus" />
          </Stack.Header.Button>
        </Stack.Header.Right>
      </Stack.Header>
      <CalEventsList
        searchQuery={searchQuery}
        onCreate={handleCreate}
        contentInsetAdjustmentBehavior="automatic"
      />
      {picker}
    </>
  );
}
