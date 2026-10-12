import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { EmptyScreen } from "@/components/EmptyScreen";
import { Skeleton } from "@/components/ui/skeleton";
import { getColors } from "@/constants/colors";
import {
  isForbiddenError,
  useCalEventGuests,
  useCheckInCalEventGuest,
  useUndoCalEventGuestCheckIn,
} from "@/hooks";
import type { CalEventGuest } from "@/services/calcom";
import { ApiRequestError } from "@/services/calcom/request";
import { showInfoAlert } from "@/utils/alerts";
import {
  filterCalEventGuests,
  getCalEventCheckInErrorMessage,
  getCalEventCheckInProgress,
  getCalEventGuestName,
  sortCalEventGuests,
} from "@/utils/cal-events";
import { offlineAwareRefresh } from "@/utils/network";

type Theme = ReturnType<typeof getColors>;

/** "6:05 PM" on the device's clock, which at the door is the venue's. */
const formatCheckInTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export default function CalEventCheckInScreen() {
  const { uuid, title } = useLocalSearchParams<{ uuid: string; title?: string }>();
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);
  const [searchQuery, setSearchQuery] = useState("");
  // Not isFetching: the list also refetches after every tap, and that shouldn't spin the control.
  const [pulling, setPulling] = useState(false);
  const { data: page, isLoading, isRefetchError, error, refetch } = useCalEventGuests(uuid);
  const { mutate: checkIn } = useCheckInCalEventGuest(uuid);
  const { mutate: undoCheckIn } = useUndoCalEventGuestCheckIn(uuid);

  const guests = useMemo(
    () => filterCalEventGuests(sortCalEventGuests(page?.guests ?? []), searchQuery),
    [page, searchQuery]
  );

  const onRefresh = async () => {
    setPulling(true);
    await offlineAwareRefresh(refetch);
    setPulling(false);
  };

  const onPressGuest = (guest: CalEventGuest) => {
    const name = getCalEventGuestName(guest);
    if (!guest.checkedInAt) {
      checkIn(guest.id, {
        onSuccess: (result) => {
          if (result.kind === "already_checked_in") {
            showInfoAlert(
              "Already checked in",
              `${name} was checked in at ${formatCheckInTime(result.checkedInAt)}.`
            );
          } else if (result.kind === "not_confirmed") {
            showInfoAlert("Not checked in", `${name} is no longer a confirmed guest.`);
          }
        },
        onError: (mutationError) =>
          showInfoAlert("Couldn't check in", getCalEventCheckInErrorMessage(mutationError)),
      });
      return;
    }
    Alert.alert(
      "Undo check-in?",
      `${name} was checked in at ${formatCheckInTime(guest.checkedInAt)}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Undo",
          style: "destructive",
          onPress: () =>
            undoCheckIn(guest.id, {
              onError: (mutationError) =>
                showInfoAlert(
                  "Couldn't undo check-in",
                  getCalEventCheckInErrorMessage(mutationError)
                ),
            }),
        },
      ]
    );
  };

  const screenOptions = <Stack.Screen options={{ title: "Check in", headerBackTitle: "Event" }} />;

  if (isLoading && !page) {
    return (
      <>
        {screenOptions}
        <View style={{ flex: 1, backgroundColor: theme.backgroundSecondary, padding: 16 }}>
          <Skeleton style={{ height: 28, width: 200, borderRadius: 6 }} />
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} style={{ height: 52, borderRadius: 10, marginTop: 16 }} />
          ))}
        </View>
      </>
    );
  }

  if (!page) {
    // A 404 is a deleted event, or one this user can't manage. A 403 is a sign-in without the
    // Events scopes, which no retry can fix. Any other failure may pass, so only it gets Retry.
    const forbidden = isForbiddenError(error);
    const notFound = error instanceof ApiRequestError && error.status === 404;
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
            backgroundColor: theme.backgroundSecondary,
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
      <View style={{ flex: 1, backgroundColor: theme.backgroundSecondary }}>
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
            {getCalEventCheckInProgress(page)}
          </Text>
          {page.guests.length > 0 ? (
            <SearchField theme={theme} value={searchQuery} onChangeText={setSearchQuery} />
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
                borderRadius: 12,
                backgroundColor: theme.background,
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
          renderItem={({ item }) => <GuestRow guest={item} theme={theme} onPress={onPressGuest} />}
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
          ListFooterComponent={
            page.hasMore && guests.length > 0 ? (
              <Text
                style={{
                  color: theme.textSecondary,
                  fontSize: 14,
                  textAlign: "center",
                  padding: 16,
                }}
              >
                Showing the first {page.guests.length} guests.
              </Text>
            ) : null
          }
        />
      </View>
    </>
  );
}

function SearchField({
  theme,
  value,
  onChangeText,
}: {
  theme: Theme;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 40,
        marginTop: 12,
        backgroundColor: theme.backgroundMuted,
      }}
    >
      <Ionicons name="search-outline" size={18} color={theme.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search guests"
        placeholderTextColor={theme.textMuted}
        style={{ flex: 1, marginLeft: 8, color: theme.text, fontSize: 16 }}
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
  theme,
  onPress,
}: {
  guest: CalEventGuest;
  theme: Theme;
  onPress: (guest: CalEventGuest) => void;
}) {
  const name = getCalEventGuestName(guest);
  // The email (or phone) tells namesakes apart; a guest listed by email shows only the phone.
  const detail = [guest.name.trim() ? guest.email : null, guest.phoneNumber]
    .filter(Boolean)
    .join(" · ");
  return (
    <TouchableOpacity
      onPress={() => onPress(guest)}
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
        backgroundColor: theme.background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
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
            {formatCheckInTime(guest.checkedInAt)}
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
          }}
        >
          <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>Check in</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
