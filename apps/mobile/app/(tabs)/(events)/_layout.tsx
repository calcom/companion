import { Stack } from "expo-router";
import { Platform } from "react-native";

// Deep links to an event open with the list as the stack's parent.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function EventsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: Platform.OS === "ios" }} />
      <Stack.Screen name="event-detail" />
    </Stack>
  );
}
