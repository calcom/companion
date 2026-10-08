import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { CalEventListItem } from "@/components/cal-event-list-item/CalEventListItem";
import { CalEventListSkeleton } from "@/components/cal-event-list-item/CalEventListItemSkeleton";
import { EmptyScreen } from "@/components/EmptyScreen";
import { getColors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { isForbiddenError, useCalEvents, useTeams, useUserProfile } from "@/hooks";
import type { Team } from "@/services/calcom";
import {
  CAL_EVENTS_GROUP_LABELS,
  canReadCalEvents,
  filterCalEventsByTitle,
  getCalEventsProfileTeams,
  groupCalEvents,
} from "@/utils/cal-events";
import { getDisplayError } from "@/utils/error";
import { getAvatarUrl } from "@/utils/getAvatarUrl";
import { offlineAwareRefresh } from "@/utils/network";
import { useCalEventActions } from "./useCalEventActions";

interface CalEventsListProps {
  searchQuery: string;
  /** Header rendered inside the scroll view (Android/web); iOS uses the native stack header. */
  renderHeader?: () => ReactNode;
  onCreate: () => void;
  /** iOS: let the large-title header collapse over the list. */
  contentInsetAdjustmentBehavior?: "automatic" | "never";
}

/** The Events tab body: profile chips (personal + teams), grouped event cards, states. */
export function CalEventsList({
  searchQuery,
  renderHeader,
  onCreate,
  contentInsetAdjustmentBehavior = "never",
}: CalEventsListProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);
  const [teamId, setTeamId] = useState<number | null>(null);

  const { isWebSession, oauthScope, logout } = useAuth();
  const needsReauth = !isWebSession && !canReadCalEvents(oauthScope);

  const { data: userProfile } = useUserProfile();
  const { data: teams = [] } = useTeams({ enabled: !needsReauth });
  const {
    data: events = [],
    isLoading,
    isFetching,
    error: queryError,
    refetch,
  } = useCalEvents(teamId, { enabled: !needsReauth });
  const actions = useCalEventActions();

  const profileTeams = getCalEventsProfileTeams(teams);
  const refreshing = isFetching && !isLoading;
  const teamForbidden = teamId !== null && isForbiddenError(queryError);
  const error = teamForbidden ? null : getDisplayError(queryError, "events");
  const onRefresh = () => offlineAwareRefresh(refetch);

  const groups = useMemo(
    () => groupCalEvents(filterCalEventsByTitle(events, searchQuery)),
    [events, searchQuery]
  );

  const chips = (
    <ProfileChips
      teams={profileTeams}
      selectedTeamId={teamId}
      onSelect={setTeamId}
      personalName={userProfile?.name || userProfile?.username || "Personal"}
      personalAvatarUrl={userProfile?.avatarUrl}
    />
  );

  if (error) {
    return (
      <View
        className="flex-1 items-center justify-center p-5"
        style={{ backgroundColor: theme.backgroundSecondary }}
      >
        <Ionicons name="alert-circle" size={64} color={theme.error} />
        <Text className="mb-2 mt-4 text-center text-xl font-bold" style={{ color: theme.text }}>
          Unable to load events
        </Text>
        <Text className="mb-6 text-center text-base" style={{ color: theme.textMuted }}>
          {error}
        </Text>
        <TouchableOpacity
          className="rounded-lg px-6 py-3"
          style={{ backgroundColor: isDark ? "white" : "black" }}
          onPress={() => refetch()}
        >
          <Text className="text-base font-semibold" style={{ color: isDark ? "black" : "white" }}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundSecondary }}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        needsReauth ? undefined : (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.textMuted}
          />
        )
      }
    >
      {renderHeader?.()}
      {profileTeams.length > 0 ? chips : <View style={{ height: 8 }} />}

      {needsReauth ? (
        <View style={{ padding: 20 }}>
          <EmptyScreen
            icon="key-outline"
            headline="Sign in again to see events"
            description="Events need permissions your current sign-in doesn't include. Sign out and sign back in to grant them."
            buttonText="Sign in again"
            onButtonPress={logout}
          />
        </View>
      ) : teamForbidden ? (
        <View style={{ padding: 20 }}>
          <EmptyScreen
            icon="lock-closed-outline"
            headline="You can't see this team's events"
            description="Your invitation to this team may still be pending, or your role doesn't include viewing its events."
          />
        </View>
      ) : isLoading ? (
        <CalEventListSkeleton />
      ) : groups.length === 0 ? (
        <View style={{ padding: 20 }}>
          {searchQuery.trim() ? (
            <EmptyScreen
              icon="search-outline"
              headline="No events found"
              description={`No event title matches "${searchQuery.trim()}".`}
            />
          ) : (
            <EmptyScreen
              icon="ticket-outline"
              headline="Host your first event"
              description="Meetups, parties, launches: create an event page, share the link and collect RSVPs."
              buttonText="New event"
              onButtonPress={onCreate}
            />
          )}
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.kind}>
            {groups.length > 1 || group.kind !== "upcoming" ? (
              <Text
                style={{
                  color: theme.textSecondary,
                  fontSize: 15,
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: 12,
                }}
              >
                {CAL_EVENTS_GROUP_LABELS[group.kind]}
              </Text>
            ) : (
              <View style={{ height: 8 }} />
            )}
            {group.events.map((event) => (
              <CalEventListItem key={event.uuid} event={event} {...actions} />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

interface ProfileChipsProps {
  teams: Team[];
  selectedTeamId: number | null;
  onSelect: (teamId: number | null) => void;
  personalName: string;
  personalAvatarUrl?: string | null;
}

/** The web listing's profile switcher: the user, then each team they belong to. */
function ProfileChips({
  teams,
  selectedTeamId,
  onSelect,
  personalName,
  personalAvatarUrl,
}: ProfileChipsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);

  const chip = (
    key: string,
    label: string,
    selected: boolean,
    onPress: () => void,
    avatar: ReactNode
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 8,
        paddingLeft: 8,
        paddingRight: 14,
        marginRight: 8,
        borderRadius: 999,
        backgroundColor: selected ? theme.backgroundEmphasis : "transparent",
      }}
    >
      {avatar}
      <Text
        style={{
          color: theme.text,
          fontSize: 17,
          fontWeight: selected ? "600" : "400",
          marginLeft: 8,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}
    >
      {chip(
        "personal",
        personalName,
        selectedTeamId === null,
        () => onSelect(null),
        <Image
          source={{ uri: getAvatarUrl(personalAvatarUrl) }}
          style={{ width: 28, height: 28, borderRadius: 14 }}
          accessibilityIgnoresInvertColors
        />
      )}
      {teams.map((team) =>
        chip(
          `team-${team.id}`,
          team.name,
          selectedTeamId === team.id,
          () => onSelect(team.id),
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
          )
        )
      )}
    </ScrollView>
  );
}
