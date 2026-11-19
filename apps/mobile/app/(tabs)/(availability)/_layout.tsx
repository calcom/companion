import { Stack } from "expo-router";

// A schedule opened from a link gets the list underneath, so Back has somewhere to go.
export const unstable_settings = {
  initialRouteName: "index",
};

export default function AvailabilityLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="availability-detail" />
    </Stack>
  );
}
