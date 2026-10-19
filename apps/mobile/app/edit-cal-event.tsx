import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, useColorScheme, View } from "react-native";
import { EditCalEventScreen } from "@/components/cal-events/EditCalEventScreen";
import { EmptyScreen } from "@/components/EmptyScreen";
import { getColors } from "@/constants/colors";
import { isForbiddenError, useCalEvent } from "@/hooks";
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
    // A 403 is a sign-in without the Events scope, which no retry can fix (as on the event's
    // detail screen), so only other load failures get Retry.
    const forbidden = !event && isForbiddenError(error);
    const canRetry = !event && !!error && !forbidden;
    const [headline, description] = event
      ? ["This event was cancelled", "A cancelled event can't be edited."]
      : forbidden
        ? [
            "Sign in again to edit this event",
            "Events need permissions your current sign-in doesn't include. Sign out and sign back in to grant them.",
          ]
        : error
          ? ["Unable to load event", "Check your connection and try again."]
          : ["Event not found", "This event was deleted, or you no longer manage it."];
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
          headline={headline}
          description={description}
          buttonText={canRetry ? "Retry" : "Close"}
          onButtonPress={() => (canRetry ? refetch() : router.back())}
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
