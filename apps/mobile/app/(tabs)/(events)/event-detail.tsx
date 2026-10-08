import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Linking, ScrollView, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { CalEventListItemSkeleton } from "@/components/cal-event-list-item/CalEventListItemSkeleton";
import { useCalEventActions } from "@/components/cal-events/useCalEventActions";
import { EmptyScreen } from "@/components/EmptyScreen";
import { getColors } from "@/constants/colors";
import { isForbiddenError, useCalEvent, useUserProfile } from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import { showErrorAlert } from "@/utils/alerts";
import {
  CAL_EVENT_STATUS_LABELS,
  canDeleteCalEvent,
  canManageCalEventLifecycle,
  formatCalEventDate,
  formatCalEventPrice,
  formatCalEventTimeRange,
  getCalEventLocationLabel,
  getCalEventStatusColors,
  isCalEventInPerson,
  truncateCalEventTitle,
} from "@/utils/cal-events";
import { getAvatarUrl } from "@/utils/getAvatarUrl";

export default function CalEventDetailScreen() {
  const { uuid, title } = useLocalSearchParams<{
    uuid: string;
    title?: string;
  }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);
  const { data: event, isLoading, error, refetch } = useCalEvent(uuid);
  const { data: me } = useUserProfile();
  const actions = useCalEventActions({ afterDelete: () => router.back() });

  const headerTitle = truncateCalEventTitle(event?.title ?? title ?? "Event");

  if (isLoading && !event) {
    return (
      <>
        <Stack.Screen options={{ title: headerTitle }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: theme.backgroundSecondary }}
          contentContainerStyle={{ paddingTop: 16 }}
        >
          <CalEventListItemSkeleton />
        </ScrollView>
      </>
    );
  }

  if (!event) {
    // null is a 404: deleted, or not this user's to manage. A 403 is a sign-in without the Events
    // scope, which no retry can fix. Any other failure may pass, so only it gets Retry.
    const forbidden = isForbiddenError(error);
    const canRetry = !!error && !forbidden;
    const [headline, description] = forbidden
      ? [
          "Sign in again to see this event",
          "Events need permissions your current sign-in doesn't include. Sign out and sign back in to grant them.",
        ]
      : error
        ? ["Unable to load event", "Check your connection and try again."]
        : ["Event not found", "This event was deleted, or you no longer manage it."];
    return (
      <>
        <Stack.Screen options={{ title: headerTitle }} />
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
            buttonText={canRetry ? "Retry" : "Back to events"}
            onButtonPress={() => (canRetry ? refetch() : router.back())}
          />
          {canRetry ? (
            <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" hitSlop={12}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }}>
                Back to events
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </>
    );
  }

  const status = getCalEventStatusColors(event.status, isDark);
  const canManage = canManageCalEventLifecycle(event, me?.id);
  const inPerson = isCalEventInPerson(event);
  const link =
    event.locations.find(
      (location): location is Extract<CalEvent["locations"][number], { type: "link" }> =>
        location.type === "link"
    )?.link ?? null;
  const goingLabel =
    event.confirmedCount === undefined
      ? null
      : event.capacity === null
        ? `${event.confirmedCount} going`
        : `${event.confirmedCount} of ${event.capacity} going`;

  return (
    <>
      <Stack.Screen options={{ title: headerTitle, headerBackTitle: "Events" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundSecondary }}
        contentContainerStyle={{ paddingBottom: 120 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {event.coverImageUrl ? (
          <Image
            source={{ uri: event.coverImageUrl }}
            style={{ width: "100%", aspectRatio: 2 }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : null}

        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <View
              style={{
                backgroundColor: status.background,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: status.text, fontSize: 13, fontWeight: "600" }}>
                {CAL_EVENT_STATUS_LABELS[event.status]}
              </Text>
            </View>
            {event.visibility === "UNLISTED" ? (
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginLeft: 10 }}>
                Unlisted · link only
              </Text>
            ) : null}
          </View>

          <Text style={{ color: theme.text, fontSize: 24, fontWeight: "700", lineHeight: 30 }}>
            {event.title}
          </Text>

          {event.status === "cancelled" && event.cancellationReason ? (
            <Text style={{ color: theme.textSecondary, fontSize: 15, marginTop: 8 }}>
              Cancelled: {event.cancellationReason}
            </Text>
          ) : null}

          <Card theme={theme}>
            <Row
              theme={theme}
              icon="calendar-outline"
              title={formatCalEventDate(event.startTime, event.endTime, event.timeZone)}
              subtitle={`${formatCalEventTimeRange(event.startTime, event.endTime, event.timeZone)} · ${event.timeZone}`}
            />
            <Row
              theme={theme}
              icon={inPerson ? "location-outline" : "videocam-outline"}
              title={getCalEventLocationLabel(event)}
              subtitle={link ?? undefined}
              onPress={
                link
                  ? () =>
                      Linking.openURL(link).catch(() =>
                        showErrorAlert("Error", "Failed to open the link. Please try again.")
                      )
                  : undefined
              }
            />
            {goingLabel ? (
              <Row
                theme={theme}
                icon="people-outline"
                title={goingLabel}
                subtitle={[
                  event.requiresApproval ? "Approval required" : null,
                  event.waitlistEnabled ? "Waitlist on" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ) : null}
            {event.price ? (
              <Row
                theme={theme}
                icon="pricetag-outline"
                title={formatCalEventPrice(event.price, event.currency)}
                subtitle="per ticket"
              />
            ) : null}
          </Card>

          {event.description ? (
            <Card theme={theme}>
              <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 6 }}>
                About the event
              </Text>
              <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22 }}>
                {event.description}
              </Text>
            </Card>
          ) : null}

          <Card theme={theme}>
            <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 8 }}>
              {event.hosts.length === 1 ? "Host" : "Hosts"}
            </Text>
            {event.hosts.map((host) => (
              <View
                key={host.userId}
                style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}
              >
                <Image
                  source={{ uri: getAvatarUrl(host.avatarUrl) }}
                  style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }}
                  accessibilityIgnoresInvertColors
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.text, fontSize: 16 }}>{host.name || "Host"}</Text>
                  {host.username ? (
                    <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                      @{host.username}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </Card>

          <View style={{ marginTop: 16, gap: 10 }}>
            <ActionButton
              theme={theme}
              isDark={isDark}
              primary
              icon="open-outline"
              label="Open event page"
              onPress={() => actions.onOpenPage(event)}
            />
            <ActionButton
              theme={theme}
              isDark={isDark}
              icon="pencil-outline"
              label="Edit on web"
              onPress={() => actions.onEditOnWeb(event)}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ActionButton
                theme={theme}
                isDark={isDark}
                icon="link-outline"
                label="Copy link"
                onPress={() => actions.onCopyLink(event)}
                grow
              />
              <ActionButton
                theme={theme}
                isDark={isDark}
                icon="share-outline"
                label="Share"
                onPress={() => actions.onShare(event)}
                grow
              />
            </View>
            {canManage && event.status === "draft" ? (
              <ActionButton
                theme={theme}
                isDark={isDark}
                icon="rocket-outline"
                label="Publish"
                onPress={() => actions.onPublish(event)}
              />
            ) : null}
            {canManage && event.status === "published" ? (
              <ActionButton
                theme={theme}
                isDark={isDark}
                icon="ban-outline"
                label="Cancel event"
                destructive
                onPress={() => actions.onCancel(event)}
              />
            ) : null}
            {canManage && canDeleteCalEvent(event) ? (
              <ActionButton
                theme={theme}
                isDark={isDark}
                icon="trash-outline"
                label="Delete event"
                destructive
                onPress={() => actions.onDelete(event)}
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

type Theme = ReturnType<typeof getColors>;

function Card({ theme, children }: { theme: Theme; children: ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: theme.background,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginTop: 16,
      }}
    >
      {children}
    </View>
  );
}

function Row({
  theme,
  icon,
  title,
  subtitle,
  onPress,
}: {
  theme: Theme;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  const content = (
    <View style={{ flexDirection: "row", alignItems: "flex-start", paddingVertical: 6 }}>
      <Ionicons name={icon} size={20} color={theme.textSecondary} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }}>{title}</Text>
        {subtitle ? (
          <Text
            style={{
              color: onPress ? theme.accent : theme.textSecondary,
              fontSize: 14,
              marginTop: 2,
            }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
  if (!onPress) return content;
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="link">
      {content}
    </TouchableOpacity>
  );
}

function ActionButton({
  theme,
  isDark,
  icon,
  label,
  onPress,
  primary = false,
  destructive = false,
  grow = false,
}: {
  theme: Theme;
  isDark: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
  grow?: boolean;
}) {
  const background = primary ? (isDark ? "#FFFFFF" : "#111827") : theme.background;
  const color = primary
    ? isDark
      ? "#000000"
      : "#FFFFFF"
    : destructive
      ? theme.destructive
      : theme.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={{
        flex: grow ? 1 : undefined,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 48,
        borderRadius: 12,
        borderWidth: primary ? 0 : 1,
        borderColor: theme.border,
        backgroundColor: background,
      }}
    >
      <Ionicons name={icon} size={18} color={color} style={{ marginRight: 8 }} />
      <Text style={{ color, fontSize: 16, fontWeight: "600" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export type { CalEvent };
