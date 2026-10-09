import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
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
import {
  isForbiddenError,
  useCalEvents,
  useRestartCalEvents,
  useTeams,
  useUserProfile,
} from "@/hooks";
import type { CalEvent, Team } from "@/services/calcom";
import {
  CAL_EVENTS_GROUP_LABELS,
  type CalEventsGroupKind,
  filterCalEventsByTitle,
  getCalEventsProfileTeams,
  groupCalEvents,
  needsSignInAgainForCalEvents,
  refreshCalEventStatuses,
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

/** A group's label (or the spacer that stands in for it), or one event card. */
type CalEventsListRow =
  | { type: "group"; kind: CalEventsGroupKind; labelled: boolean }
  | { type: "event"; event: CalEvent };

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
  const needsReauth = needsSignInAgainForCalEvents({ isWebSession, oauthScope });

  const { data: userProfile } = useUserProfile();
  const {
    data: teams = [],
    isLoadingError: teamsLoadError,
    error: teamsQueryError,
    refetch: refetchTeams,
  } = useTeams({ enabled: !needsReauth });
  const profileTeams = getCalEventsProfileTeams(teams);
  // A refresh can drop the selected team (the user left or was removed): show Personal instead.
  const selectedTeamId = profileTeams.some((team) => team.id === teamId) ? teamId : null;
  const {
    data: events = [],
    isLoading,
    isFetching,
    isRefetching,
    isLoadingError,
    isRefetchError,
    error: queryError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useCalEvents(selectedTeamId, { enabled: !needsReauth });
  const restartEvents = useRestartCalEvents(selectedTeamId);
  const actions = useCalEventActions();

  // Not while a page loads at the end of the list: that has its own spinner there.
  const refreshing = isRefetching;
  const teamForbidden = selectedTeamId !== null && isForbiddenError(queryError);
  // The sign-in prompt wins over any error: a 403 from a stale fetch must not hide it.
  const error = needsReauth || teamForbidden ? null : getDisplayError(queryError, "events");
  // Teams that never loaded would pass for having none: the chips would just be missing.
  const teamsError =
    needsReauth || !teamsLoadError ? null : getDisplayError(teamsQueryError, "teams");
  const staleEvents = !!error && isRefetchError;
  const notice =
    staleEvents && teamsError
      ? "Couldn't refresh or load your teams. These events may be out of date."
      : staleEvents
        ? "Couldn't refresh. These events may be out of date."
        : teamsError
          ? "Couldn't load your teams."
          : null;
  // Teams never go stale on their own: a pull refreshes the profile chips with the events.
  const onRefresh = () => offlineAwareRefresh(() => Promise.all([restartEvents(), refetchTeams()]));

  // The API has no title search, so a search matches the loaded events and keeps loading pages
  // until every event has been searched. Scrolling to the end loads the next page too. Either
  // waits for a refetch in flight: it re-walks the loaded pages, and a page load would cancel it.
  const searching = searchQuery.trim() !== "";
  const [endReached, setEndReached] = useState(false);
  const wantsNextPage = (searching || endReached) && hasNextPage && !isFetchNextPageError;
  useEffect(() => {
    if (!wantsNextPage || isFetching) return;
    setEndReached(false);
    fetchNextPage();
  }, [wantsNextPage, isFetching, fetchNextPage]);
  const selectProfile = (id: number | null) => {
    setEndReached(false);
    setTeamId(id);
  };

  // Read at `now`, not at fetch time: an event that ends while the list is open, or cached since
  // an earlier launch, moves to Past and loses Cancel without waiting for a refetch.
  const now = useNow();
  const groups = useMemo(
    () =>
      groupCalEvents(
        refreshCalEventStatuses(filterCalEventsByTitle(events, searchQuery), now),
        now
      ),
    [events, searchQuery, now]
  );
  const rows = useMemo(
    () =>
      groups.flatMap((group): CalEventsListRow[] => [
        {
          type: "group",
          kind: group.kind,
          labelled: groups.length > 1 || group.kind !== "upcoming",
        },
        ...group.events.map((event): CalEventsListRow => ({ type: "event", event })),
      ]),
    [groups]
  );

  const chips = (
    <ProfileChips
      teams={profileTeams}
      selectedTeamId={selectedTeamId}
      onSelect={selectProfile}
      personalName={userProfile?.name || userProfile?.username || "Personal"}
      personalAvatarUrl={userProfile?.avatarUrl}
    />
  );

  // What shows instead of the cards. The states before `groups` win even over cached events.
  const listState = needsReauth ? (
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
  ) : error && isLoadingError ? (
    <View style={{ padding: 20 }}>
      <EmptyScreen
        icon="alert-circle-outline"
        headline="Unable to load events"
        description={error}
        buttonText="Retry"
        onButtonPress={() => refetch()}
      />
    </View>
  ) : groups.length > 0 || (searching && hasNextPage) ? null : (
    // A search with pages left to load isn't over: the footer's spinner or Retry says so.
    <View style={{ padding: 20 }}>
      {searching ? (
        <EmptyScreen
          icon="search-outline"
          headline="No events found"
          description={`No event title matches "${searchQuery.trim()}".`}
        />
      ) : isRefetchError ? (
        // The cached list may be missing a new event: don't prompt a duplicate.
        <EmptyScreen
          icon="ticket-outline"
          headline="No events to show"
          description="Any new events will appear once a refresh succeeds."
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
  );
  const showingEvents = !needsReauth && !teamForbidden && !isLoading && !(error && isLoadingError);

  const renderRow = ({ item }: { item: CalEventsListRow }) =>
    item.type === "event" ? (
      <CalEventListItem event={item.event} viewerId={userProfile?.id} {...actions} />
    ) : item.labelled ? (
      <Text
        style={{
          color: theme.textSecondary,
          fontSize: 15,
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 12,
        }}
      >
        {CAL_EVENTS_GROUP_LABELS[item.kind]}
      </Text>
    ) : (
      <View style={{ height: 8 }} />
    );

  return (
    <FlatList
      data={showingEvents ? rows : []}
      keyExtractor={(row) => (row.type === "event" ? row.event.uuid : `group-${row.kind}`)}
      renderItem={renderRow}
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
      // Ignored while a page loads: its spinner growing the list would ask for one more.
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) setEndReached(true);
      }}
      ListHeaderComponent={
        <>
          {renderHeader?.()}
          {profileTeams.length > 0 ? chips : <View style={{ height: 8 }} />}
          {/* Cached events after a failed refetch, or teams that never loaded: say so, with Retry. */}
          {notice && !refreshing ? <ListNotice message={notice} onRetry={onRefresh} /> : null}
        </>
      }
      ListEmptyComponent={listState}
      ListFooterComponent={
        !showingEvents ? null : isFetchNextPageError ? (
          <ListNotice message="Couldn't load more events." onRetry={() => fetchNextPage()} />
        ) : isFetchingNextPage || wantsNextPage ? (
          <ActivityIndicator color={theme.textMuted} style={{ paddingVertical: 16 }} />
        ) : null
      }
    />
  );
}

/** A one-line problem with the list, and Retry. */
function ListNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  const colorScheme = useColorScheme();
  const theme = getColors(colorScheme === "dark");
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginHorizontal: 16,
        marginBottom: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: theme.background,
      }}
    >
      <Ionicons name="alert-circle-outline" size={18} color={theme.textSecondary} />
      <Text style={{ flex: 1, marginHorizontal: 8, color: theme.textSecondary, fontSize: 15 }}>
        {message}
      </Text>
      <TouchableOpacity onPress={onRetry} accessibilityRole="button" hitSlop={8}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

/**
 * The time the list reads statuses and groups at. Nothing in the cached events changes as time
 * passes, so it ticks every minute, and at once when the app is back in the foreground.
 */
function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const interval = setInterval(tick, 60_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") tick();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);
  return now;
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
