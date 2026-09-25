import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack } from "expo-router";
import { useState } from "react";
import { useColorScheme } from "react-native";
import { CalEventsList } from "@/components/cal-events/CalEventsList";
import { showErrorAlert } from "@/utils/alerts";
import { openInAppBrowser } from "@/utils/browser";
import { getCalAppUrl } from "@/utils/region";

export default function EventsIOS() {
  const [searchQuery, setSearchQuery] = useState("");
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Events are created in the web editor; the app lists and manages them.
  const handleCreate = async () => {
    try {
      await openInAppBrowser(`${getCalAppUrl()}/events/new`, "new event");
    } catch {
      showErrorAlert("Error", "Failed to open the event editor. Please try again.");
    }
  };

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
    </>
  );
}
