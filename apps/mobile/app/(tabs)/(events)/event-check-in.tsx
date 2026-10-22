import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { useCalEventHeaderOptions } from "@/components/cal-events/useCalEventHeaderOptions";
import { EmptyScreen } from "@/components/EmptyScreen";
import { Skeleton } from "@/components/ui/skeleton";
import { getColors, getGroupedSurfaces } from "@/constants/colors";
import {
  isCalEventGuestPending,
  isForbiddenError,
  isNotFoundError,
  refetchCalEventGuestsIfIdle,
  useCalEvent,
  useCalEventCheckInAvailability,
  useCalEventGuests,
  useCheckInCalEventGuest,
  useHour12,
  usePendingCalEventGuestIds,
  useUndoCalEventGuestCheckIn,
} from "@/hooks";
import type { CalEventGuest } from "@/services/calcom";
import { showConfirmAlert, showInfoAlert } from "@/utils/alerts";
import {
  CAL_EVENT_CHECK_IN_WINDOW_DESCRIPTION,
  canTapCalEventGuest,
  filterCalEventGuests,
  formatCalEventCheckInTime,
  getCalEventCheckInErrorMessage,
  getCalEventCheckInProgress,
  getCalEventCheckInWindowNotice,
  getCalEventGuestName,
  sortCalEventGuests,
} from "@/utils/cal-events";
import { offlineAwareRefresh } from "@/utils/network";

type Theme = ReturnType<typeof getColors>;

export default function CalEventCheckInScreen() {
  const { uuid, title } = useLocalSearchParams<{ uuid: string; title?: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);
  const surfaces = getGroupedSurfaces(isDark);
  const [searchQuery, setSearchQuery] = useState("");
  // Not isFetching: the list also refetches after every tap, and that shouldn't spin the control.
  const [pulling, setPulling] = useState(false);
  const { data: list, isLoading, isRefetchError, error, refetch } = useCalEventGuests(uuid);
  // Usually cached from the event's detail; until it loads, there's no window to show a scanner in.
  const { data: event } = useCalEvent(uuid);
  const availability = useCalEventCheckInAvailability(event);
  const hour12 = useHour12();
  const windowNotice =
    event && availability
      ? getCalEventCheckInWindowNotice(availability, event.timeZone, hour12)
      : null;
  const queryClient = useQueryClient();
  const { mutateAsync: checkIn } = useCheckInCalEventGuest(uuid);
  const { mutateAsync: undoCheckIn } = useUndoCalEventGuestCheckIn(uuid);
  const pendingGuestIds = usePendingCalEventGuestIds(uuid);

  const guests = useMemo(
    () => filterCalEventGuests(sortCalEventGuests(list?.guests ?? []), searchQuery),
    [list, searchQuery]
  );

  const onRefresh = async () => {
    setPulling(true);
    // Not refetch: it would run during a tap in flight too, and could bring its guest back unflipped.
    await offlineAwareRefresh(() => refetchCalEventGuestsIfIdle(queryClient, uuid));
    setPulling(false);
  };

  // One mutateAsync call per tap, so every tap reports its own outcome, even when the host taps
  // several guests before the first answer comes back.
  const onCheckIn = async (guest: CalEventGuest) => {
    const name = getCalEventGuestName(guest);
    try {
      const result = await checkIn(guest.id);
      if (result.kind === "already_checked_in") {
        showInfoAlert(
          "Already checked in",
          `${name} was checked in at ${formatCalEventCheckInTime(result.checkedInAt, hour12)}.`
        );
      } else if (result.kind === "not_confirmed") {
        showInfoAlert("Not checked in", `${name} is no longer a confirmed guest.`);
      }
    } catch (mutationError) {
      showInfoAlert("Couldn't check in", getCalEventCheckInErrorMessage(mutationError));
    }
  };

  const onUndoCheckIn = async (guest: CalEventGuest) => {
    try {
      await undoCheckIn(guest.id);
    } catch (mutationError) {
      showInfoAlert("Couldn't undo check-in", getCalEventCheckInErrorMessage(mutationError));
    }
  };

  const onPressGuest = (guest: CalEventGuest) => {
    // A guest takes one call at a time: an undo sent while the check-in is still on its way could
    // reach the server first, and the check-in would then win.
    if (isCalEventGuestPending(queryClient, uuid, guest.id)) return;
    // Outside the window only undo goes through.
    if (!canTapCalEventGuest(guest, availability)) return;
    if (!guest.checkedInAt) {
      onCheckIn(guest);
      return;
    }
    showConfirmAlert(
      "Undo check-in?",
      `${getCalEventGuestName(guest)} was checked in at ${formatCalEventCheckInTime(guest.checkedInAt, hour12)}.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Undo", style: "destructive", onPress: () => onUndoCheckIn(guest) },
      ]
    );
  };

  const headerOptions = useCalEventHeaderOptions("Event");
  const screenOptions = <Stack.Screen options={{ ...headerOptions, title: "Check in" }} />;

  if (isLoading && !list) {
    return (
      <>
        {screenOptions}
        <View style={{ flex: 1, backgroundColor: surfaces.screen, padding: 16 }}>
          <Skeleton style={{ height: 28, width: 200, borderRadius: 6 }} />
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} style={{ height: 52, borderRadius: 8, marginTop: 16 }} />
          ))}
        </View>
      </>
    );
  }

  if (!list) {
    // A 404 is a deleted event, or one this user can't manage. A 403 is a sign-in without the
    // Events scopes, which no retry can fix. Any other failure may pass, so only it gets Retry.
    const forbidden = isForbiddenError(error);
    const notFound = isNotFoundError(error);
    const canRetry = !forbidden && !notFound;
    const [headline, description] = forbidden
      ? [
          "Sign in again to check guests in",
          "Events need permissions your current sign-in doesn't include. Sign out and sign back in to grant them.",
        ]
      : notFound
        ? ["Event not found", "This event was deleted, or you no longer manage it."]
        : ["Unable to load guests", "Check your connection and try again."];
    return (
      <>
        {screenOptions}
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            backgroundColor: surfaces.screen,
          }}
        >
          <EmptyScreen
            icon="people-outline"
            headline={headline}
            description={description}
            buttonText={canRetry ? "Retry" : "Back to event"}
            onButtonPress={() => (canRetry ? refetch() : router.back())}
          />
        </View>
      </>
    );
  }

  return (
    <>
      {screenOptions}
      <View style={{ flex: 1, backgroundColor: surfaces.screen }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          {title ? (
            <Text style={{ color: theme.textSecondary, fontSize: 15 }} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          <Text
            style={{ color: theme.text, fontSize: 24, fontWeight: "700", marginTop: 2 }}
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
          >
            {getCalEventCheckInProgress(list)}
          </Text>
          {availability?.kind === "open" ? (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/event-check-in-scanner", params: { uuid } })}
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                height: 44,
                marginTop: 12,
                borderRadius: 8,
                backgroundColor: theme.text,
              }}
            >
              <Ionicons name="qr-code-outline" size={18} color={theme.background} />
              <Text
                style={{ color: theme.background, fontSize: 16, fontWeight: "600", marginLeft: 8 }}
              >
                Scan ticket
              </Text>
            </TouchableOpacity>
          ) : windowNotice ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>
                {windowNotice}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 2 }}>
                {CAL_EVENT_CHECK_IN_WINDOW_DESCRIPTION}
              </Text>
            </View>
          ) : null}
          {list.guests.length > 0 || searchQuery ? (
            <SearchField
              theme={theme}
              background={surfaces.card}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          ) : null}
          {/* Cached guests after a failed refetch: say so, with Retry. */}
          {isRefetchError && !pulling ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 12,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 8,
                backgroundColor: surfaces.card,
              }}
            >
              <Ionicons name="alert-circle-outline" size={18} color={theme.textSecondary} />
              <Text
                style={{ flex: 1, marginHorizontal: 8, color: theme.textSecondary, fontSize: 15 }}
              >
                Couldn't refresh. This list may be out of date.
              </Text>
              <TouchableOpacity onPress={onRefresh} accessibilityRole="button" hitSlop={8}>
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
        <FlatList
          data={guests}
          keyExtractor={(guest) => guest.id}
          renderItem={({ item }) => (
            <GuestRow
              guest={item}
              pending={pendingGuestIds.has(item.id)}
              canTap={canTapCalEventGuest(item, availability)}
              theme={theme}
              background={surfaces.card}
              hour12={hour12}
              onPress={onPressGuest}
            />
          )}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={
            <RefreshControl
              refreshing={pulling}
              onRefresh={onRefresh}
              tintColor={theme.textMuted}
            />
          }
          ListEmptyComponent={
            <View style={{ padding: 20 }}>
              {searchQuery.trim() ? (
                <EmptyScreen
                  icon="search-outline"
                  headline="No guests found"
                  description={`No guest name or email matches "${searchQuery.trim()}".`}
                />
              ) : (
                <EmptyScreen
                  icon="people-outline"
                  headline="No guests yet"
                  description="Confirmed guests show up here to check in."
                />
              )}
            </View>
          }
        />
      </View>
    </>
  );
}

function SearchField({
  theme,
  background,
  value,
  onChangeText,
}: {
  theme: Theme;
  background: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
        marginTop: 12,
        backgroundColor: background,
      }}
    >
      <Ionicons name="search-outline" size={18} color={theme.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search guests"
        placeholderTextColor={theme.textMuted}
        // Fill the field's height: sized to its text, iOS can draw the placeholder low and clip it.
        style={{
          flex: 1,
          alignSelf: "stretch",
          paddingVertical: 0,
          marginLeft: 8,
          color: theme.text,
          fontSize: 16,
        }}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search guests"
      />
      {value ? (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={8}
        >
          <Ionicons name="close-circle" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** One guest: tap to check in, or, once checked in, tap to undo behind a confirmation. */
function GuestRow({
  guest,
  pending,
  canTap,
  theme,
  background,
  hour12,
  onPress,
}: {
  guest: CalEventGuest;
  /** A check-in or undo for this guest is on its way: the row waits for it. */
  pending: boolean;
  /** False for a guest not yet in while the door is shut. */
  canTap: boolean;
  theme: Theme;
  background: string;
  hour12: boolean;
  onPress: (guest: CalEventGuest) => void;
}) {
  const name = getCalEventGuestName(guest);
  // The email (or phone) tells namesakes apart; a guest listed by email shows only the phone.
  const detail = [guest.name.trim() ? guest.email : null, guest.phoneNumber]
    .filter(Boolean)
    .join(" · ");
  const disabled = pending || !canTap;
  return (
    <TouchableOpacity
      onPress={() => onPress(guest)}
      disabled={disabled}
      accessibilityState={{ busy: pending, disabled }}
      accessibilityRole="button"
      accessibilityLabel={
        guest.checkedInAt ? `${name}, checked in. Undo check-in` : `Check in ${name}`
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 64,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
        opacity: pending ? 0.5 : 1,
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: "500" }} numberOfLines={1}>
          {name}
        </Text>
        {detail ? (
          <Text
            style={{ color: theme.textSecondary, fontSize: 14, marginTop: 2 }}
            numberOfLines={1}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {guest.checkedInAt ? (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name="checkmark-circle" size={24} color={theme.success} />
          <Text style={{ color: theme.textSecondary, fontSize: 14, marginLeft: 6 }}>
            {formatCalEventCheckInTime(guest.checkedInAt, hour12)}
          </Text>
        </View>
      ) : (
        <View
          style={{
            borderRadius: 8,
            borderWidth: 1,
            borderColor: theme.border,
            paddingHorizontal: 12,
            paddingVertical: 6,
            opacity: canTap ? 1 : 0.4,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>Check in</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
