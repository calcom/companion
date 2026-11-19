import { Stack } from "expo-router";

// An event type opened from a link gets the list underneath, so Back has somewhere to go.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function EventTypesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{}} />
      <Stack.Screen name="event-type-detail" options={{}} />
    </Stack>
  );
}
