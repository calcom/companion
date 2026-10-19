import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { EditCalEventScreen } from "@/components/cal-events/EditCalEventScreen";
import { useOpenCalEventEditor } from "@/components/cal-events/useCalEventActions";
import { EmptyScreen } from "@/components/EmptyScreen";
import { getColors } from "@/constants/colors";
import { isForbiddenError, useCalEvent, useUserProfile } from "@/hooks";
import { showSilentSuccessAlert } from "@/utils/alerts";
import { canEditCalEvent } from "@/utils/cal-event-edit";
import { getCalEventEditorUrl } from "@/utils/cal-events";

/** The edit screen, pushed over the event's detail like the web editor's own page. */
export default function EditCalEvent() {
  const router = useRouter();
  const theme = getColors(useColorScheme() === "dark");
  const { uuid } = useLocalSearchParams<{ uuid: string }>();
  const { data: event, isLoading, isPlaceholderData, error, refetch } = useCalEvent(uuid);

  const {
    data: me,
    isLoading: isProfileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useUserProfile();
  const openEditor = useOpenCalEventEditor();

  // The form prefills once, so wait for the full single-event response: a listing placeholder
  // lacks the lineup, schedule and registration questions. Wait for the profile too, since it
  // decides who may edit natively.
  if (((isLoading || isPlaceholderData) && !error) || isProfileLoading) {
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

  // Without the profile we can't tell an owner or host from a co-host, so don't send them to the
  // web editor over a failed request.
  if (!me && profileError) {
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
          headline="Unable to load your profile"
          description="Check your connection and try again."
          buttonText="Retry"
          onButtonPress={() => refetchProfile()}
        />
      </View>
    );
  }

  // The list and detail screens only open this route for owners and hosts, but a deep link can
  // reach it too. Co-hosts get the web editor there, as both entry points offer them.
  if (!canEditCalEvent(event, me?.id)) {
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
          headline="Edit this event on the web"
          description="Only the event's owner and hosts can edit it in the app. Co-hosts can change some details in the web editor."
          buttonText="Edit on web"
          onButtonPress={() => openEditor(getCalEventEditorUrl(event.uuid), "event editor")}
        />
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }}>Close</Text>
        </TouchableOpacity>
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
