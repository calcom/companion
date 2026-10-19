import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { CreateCalEventScreen } from "@/components/cal-events/CreateCalEventScreen";
import { useUserProfile } from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import { showSilentSuccessAlert } from "@/utils/alerts";
import { getDeviceTimeZone } from "@/utils/wall-time";

/** The create screen, as a modal over the Events tab. `teamId` creates the event on that team. */
export default function CreateCalEvent() {
  const router = useRouter();
  const { teamId, teamName } = useLocalSearchParams<{ teamId?: string; teamName?: string }>();
  const { data: userProfile, isLoading: isProfileLoading } = useUserProfile();
  const team = teamId ? { id: Number(teamId), name: teamName ?? "" } : null;

  const handleCreated = useCallback(
    (event: CalEvent) => {
      showSilentSuccessAlert("Event created", `${event.title} created`);
      // Like the web, which opens the new draft in its editor: land on the draft's detail.
      router.dismiss();
      router.push({ pathname: "/event-detail", params: { uuid: event.uuid, title: event.title } });
    },
    [router]
  );

  // The form takes its timezone once, on mount: wait for the profile's (a fresh login can still be
  // fetching it). A failed fetch stops loading, and the device's timezone stands in.
  if (isProfileLoading) return null;

  return (
    <CreateCalEventScreen
      team={team}
      defaultTimeZone={userProfile?.timeZone || getDeviceTimeZone()}
      onClose={() => router.back()}
      onCreated={handleCreated}
    />
  );
}
