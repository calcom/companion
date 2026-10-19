import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { EditCalEventScreen } from "@/components/cal-events/EditCalEventScreen";
import { EmptyScreen } from "@/components/EmptyScreen";
import { getColors } from "@/constants/colors";
import { useCalEvent } from "@/hooks";
import { showSilentSuccessAlert } from "@/utils/alerts";

/** The edit screen, pushed over the event's detail like the web editor's own page. */
export default function EditCalEvent() {
  const router = useRouter();
  const theme = getColors(useColorScheme() === "dark");
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { data: event, isLoading, isPlaceholderData, error, refetch } = useCalEvent(uuid);

  // The form prefills once, so wait for the full single-event response: a listing placeholder
  // lacks the lineup, schedule and registration questions.
  if ((isLoading || isPlaceholderData) && !error) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.backgroundSecondary,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  if (!event || event.status === "cancelled") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          backgroundColor: theme.backgroundSecondary,
        }}
      >
        <EmptyScreen
          icon="ticket-outline"
          headline={
            event ? "This event was cancelled" : error ? "Unable to load event" : "Event not found"
          }
          description={
            event
              ? "A cancelled event can't be edited."
              : error
                ? "Check your connection and try again."
                : "This event was deleted, or you no longer manage it."
          }
          buttonText={error ? "Retry" : "Close"}
          onButtonPress={() => (error ? refetch() : router.back())}
        />
      </View>
    );
  }

  return (
    <EditCalEventScreen
      event={event}
      onClose={() => router.back()}
      onSaved={() => {
        showSilentSuccessAlert("Event updated", "Your changes were saved");
        router.back();
      }}
    />
  );
}
