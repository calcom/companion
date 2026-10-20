import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import {
  ActionSheetIOS,
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useTeams, useUserProfile } from "@/hooks";
import type { Team } from "@/services/calcom";
import {
  canCreateTeamCalEvents,
  getCalEventsProfileTeams,
  needsSignInAgainForCalEvents,
} from "@/utils/cal-events";
import { getAvatarUrl } from "@/utils/getAvatarUrl";

const PICKER_TITLE = "Create event on";

/**
 * "+" / "New event": like the web's New button, asks which profile the event is for (personal or
 * a team) when the user has teams, then opens the create screen. Render `picker` once on screen;
 * iOS uses a native action sheet instead.
 */
export function useCreateCalEventFlow(): { startCreate: () => void; picker: ReactNode } {
  const router = useRouter();
  const [pickerVisible, setPickerVisible] = useState(false);
  const { isWebSession, oauthScope, logout } = useAuth();
  const needsReauth = needsSignInAgainForCalEvents({ isWebSession, oauthScope });
  const { data: userProfile } = useUserProfile();
  const {
    data: teamsData,
    isLoadingError: teamsLoadError,
    refetch: refetchTeams,
  } = useTeams({ enabled: !needsReauth });
  const profileTeams = getCalEventsProfileTeams(teamsData ?? []);
  const personalName = userProfile?.name || userProfile?.username || "Personal";

  const openCreate = (team: Team | null) => {
    if (team && !canCreateTeamCalEvents({ isWebSession, oauthScope })) {
      Alert.alert(
        "Sign in again to create team events",
        "Creating team events needs a permission your current sign-in doesn't include. Sign out and sign back in to grant it.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign in again", onPress: logout },
        ]
      );
      return;
    }
    router.push({
      pathname: "/create-cal-event",
      params: team ? { teamId: String(team.id), teamName: team.name } : {},
    });
  };

  const startCreate = () => {
    // A sign-in from before Events gets the list's sign-in-again prompt, not a form whose save
    // 403s. Its teams query is off, so it would also pass for having no teams.
    if (needsReauth) {
      Alert.alert(
        "Sign in again to create events",
        "Events need permissions your current sign-in doesn't include. Sign out and sign back in to grant them.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign in again", onPress: logout },
        ]
      );
      return;
    }
    // Teams that haven't loaded would pass for having none, landing a team event as a personal
    // draft with no cue: say so, and let the user retry or knowingly create a personal one.
    if (teamsData === undefined) {
      const createPersonal = { text: "Create personal event", onPress: () => openCreate(null) };
      if (teamsLoadError) {
        Alert.alert("Couldn't load your teams", "Retry to create the event on a team.", [
          { text: "Cancel", style: "cancel" },
          { text: "Retry", onPress: () => void refetchTeams() },
          createPersonal,
        ]);
      } else {
        Alert.alert(
          "Still loading your teams",
          "To create the event on a team, try again once they load.",
          [{ text: "Cancel", style: "cancel" }, createPersonal]
        );
      }
      return;
    }
    if (profileTeams.length === 0) {
      openCreate(null);
      return;
    }
    if (Platform.OS === "ios") {
      const options = [personalName, ...profileTeams.map((team) => team.name), "Cancel"];
      ActionSheetIOS.showActionSheetWithOptions(
        { title: PICKER_TITLE, options, cancelButtonIndex: options.length - 1 },
        (index) => {
          if (index === 0) openCreate(null);
          else if (index < options.length - 1) openCreate(profileTeams[index - 1]);
        }
      );
      return;
    }
    setPickerVisible(true);
  };

  const pick = (team: Team | null) => {
    setPickerVisible(false);
    openCreate(team);
  };

  const picker =
    Platform.OS === "ios" ? null : (
      <ProfilePickerSheet
        visible={pickerVisible}
        personalName={personalName}
        personalAvatarUrl={userProfile?.avatarUrl}
        teams={profileTeams}
        onPick={pick}
        onClose={() => setPickerVisible(false)}
      />
    );

  return { startCreate, picker };
}

interface ProfilePickerSheetProps {
  visible: boolean;
  personalName: string;
  personalAvatarUrl?: string | null;
  teams: Team[];
  onPick: (team: Team | null) => void;
  onClose: () => void;
}

/** Android and web: the web's profile dropdown as a bottom sheet, with each profile's avatar. */
function ProfilePickerSheet({
  visible,
  personalName,
  personalAvatarUrl,
  teams,
  onPick,
  onClose,
}: ProfilePickerSheetProps) {
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);
  const insets = useSafeAreaInsets();

  const row = (key: string, label: string, avatar: ReactNode, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
      }}
    >
      {avatar}
      <Text style={{ color: theme.text, fontSize: 17 }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.4)" }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            paddingTop: 16,
            paddingBottom: insets.bottom + 16,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            backgroundColor: theme.background,
          }}
        >
          <Text
            style={{
              color: theme.textSecondary,
              fontSize: 15,
              paddingHorizontal: 20,
              paddingBottom: 8,
            }}
          >
            {PICKER_TITLE}
          </Text>
          {row(
            "personal",
            personalName,
            <Image
              source={{ uri: getAvatarUrl(personalAvatarUrl) }}
              style={{ width: 28, height: 28, borderRadius: 14 }}
              accessibilityIgnoresInvertColors
            />,
            () => onPick(null)
          )}
          {teams.map((team) =>
            row(
              `team-${team.id}`,
              team.name,
              team.logoUrl ? (
                <Image
                  source={{ uri: getAvatarUrl(team.logoUrl) }}
                  style={{ width: 28, height: 28, borderRadius: 14 }}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: isDark ? "#404040" : "#262626",
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>
                    {team.name.trim().charAt(0).toUpperCase() || "T"}
                  </Text>
                </View>
              ),
              () => onPick(team)
            )
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
