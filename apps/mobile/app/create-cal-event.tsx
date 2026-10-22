import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CreateCalEventScreen } from "@/components/cal-events/CreateCalEventScreen";
import { getColors, getGroupedSurfaces } from "@/constants/colors";
import { useUserProfile } from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import { showSilentSuccessAlert } from "@/utils/alerts";
import { getDeviceTimeZone } from "@/utils/wall-time";

/** The create screen, as a modal over the Events tab. `teamId` creates the event on that team. */
export default function CreateCalEvent() {
  const router = useRouter();
  const { teamId, teamName } = useLocalSearchParams<{ teamId?: string; teamName?: string }>();
  const { data: userProfile, isLoading: isProfileLoading, failureCount } = useUserProfile();
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
  // fetching it). Only the first attempt is waited for; after a failure the device's timezone
  // stands in rather than holding the form through the retries. Once shown, the form stays: a
  // later refetch mustn't unmount it and lose the draft.
  const waiting = isProfileLoading && failureCount === 0;
  const [ready, setReady] = useState(!waiting);
  if (!waiting && !ready) setReady(true);

  if (!ready) return <CreateCalEventLoading onClose={() => router.back()} />;

  return (
    <CreateCalEventScreen
      team={team}
      defaultTimeZone={userProfile?.timeZone || getDeviceTimeZone()}
      onClose={() => router.back()}
      onCreated={handleCreated}
    />
  );
}

/** The wait for the profile: the form's close button, so the modal never looks stuck. */
function CreateCalEventLoading({ onClose }: { onClose: () => void }) {
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);
  const surfaces = getGroupedSurfaces(isDark);
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: surfaces.screen }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          paddingHorizontal: 24,
          // Matches CreateCalEventScreen's header, so the close button doesn't move.
          paddingTop: Platform.OS === "ios" ? 20 : insets.top + 12,
          paddingBottom: 8,
        }}
      >
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Back to events"
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    </View>
  );
}
