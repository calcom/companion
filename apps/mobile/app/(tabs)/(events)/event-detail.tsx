import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Linking, ScrollView, Text, TouchableOpacity, useColorScheme, View } from "react-native";
import { CalEventListItemSkeleton } from "@/components/cal-event-list-item/CalEventListItemSkeleton";
import { useCalEventActions } from "@/components/cal-events/useCalEventActions";
import { useCalEventHeaderOptions } from "@/components/cal-events/useCalEventHeaderOptions";
import { EmptyScreen } from "@/components/EmptyScreen";
import { SectionHeader } from "@/components/event-type-detail/SettingsUI";
import { getColors, getGroupedSurfaces } from "@/constants/colors";
import { isForbiddenError, useCalEvent, useHour12, useUserProfile } from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import { showErrorAlert } from "@/utils/alerts";
import { canEditCalEvent } from "@/utils/cal-event-edit";
import {
  CAL_EVENT_STATUS_LABELS,
  canCheckInCalEventGuests,
  canDeleteCalEvent,
  canManageCalEventLifecycle,
  formatCalEventDate,
  formatCalEventPublicPrice,
  formatCalEventTimeRange,
  getCalEventGoingLabel,
  getCalEventLinkActions,
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
  const surfaces = getGroupedSurfaces(isDark);
  const { data: event, isLoading, error, refetch } = useCalEvent(uuid);
  const { data: me } = useUserProfile();
  const hour12 = useHour12();
  const actions = useCalEventActions({ afterDelete: () => router.back() });

  const headerTitle = truncateCalEventTitle(event?.title ?? title ?? "Event");
  // Edit sits in the header, as on the other detail pages. Co-hosts can't edit natively, but the
  // web still lets them change some fields; a cancelled event can't change.
  const canEdit = event ? canEditCalEvent(event, me?.id) : false;
  const headerOptions = useCalEventHeaderOptions(
    "Events",
    event && event.status !== "cancelled"
      ? {
          label: canEdit ? "Edit" : "Edit on web",
          onPress: () => (canEdit ? actions.onEdit(event) : actions.onEditOnWeb(event)),
        }
      : null
  );

  if (isLoading && !event) {
    return (
      <>
        <Stack.Screen options={{ ...headerOptions, title: headerTitle }} />
        <ScrollView
          style={{ flex: 1, backgroundColor: surfaces.screen }}
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
        <Stack.Screen options={{ ...headerOptions, title: headerTitle }} />
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
  const canCheckIn = canCheckInCalEventGuests(event, me?.id);
  const canPreviewDraft = canManage && event.status === "draft";
  const { canViewPage, canShare } = getCalEventLinkActions(event.status);
  const inPerson = isCalEventInPerson(event);
  const price = formatCalEventPublicPrice(event);
  const link =
    event.locations.find(
      (location): location is Extract<CalEvent["locations"][number], { type: "link" }> =>
        location.type === "link"
    )?.link ?? null;
  const goingLabel = getCalEventGoingLabel(event);

  return (
    <>
      {/* The page leads with the title, so the header doesn't repeat it. */}
      <Stack.Screen options={{ ...headerOptions, title: "" }} />
      <ScrollView
        style={{ flex: 1, backgroundColor: surfaces.screen }}
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

          <Card isDark={isDark}>
            <Row
              theme={theme}
              icon="calendar-outline"
              title={formatCalEventDate(event.startTime, event.endTime, event.timeZone)}
              subtitle={`${formatCalEventTimeRange(event.startTime, event.endTime, event.timeZone, hour12)} · ${event.timeZone}`}
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
            {price ? (
              <Row theme={theme} icon="pricetag-outline" title={price} subtitle="per ticket" />
            ) : null}
          </Card>

          {event.description ? (
            <Card isDark={isDark} header="About the event">
              <Text style={{ color: theme.text, fontSize: 16, lineHeight: 22 }}>
                {event.description}
              </Text>
            </Card>
          ) : null}

          <Card
            isDark={isDark}
            header={event.hosts.length === 1 ? "Host" : "Hosts"}
            paddingVertical={0}
          >
            {event.hosts.map((host, index) => (
              // Rows reach the card's edges so the divider between hosts runs its full width.
              <View
                key={host.userId}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginHorizontal: -14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  borderTopWidth: index > 0 ? 1 : 0,
                  borderTopColor: isDark ? "#4D4D4D" : "#E5E5E5",
                }}
              >
                <Image
                  source={{ uri: getAvatarUrl(host.avatarUrl) }}
                  // Outlined like the dividers, so a missing or white avatar still reads as one.
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    marginRight: 10,
                    borderWidth: 1,
                    borderColor: isDark ? "#4D4D4D" : "#E5E5E5",
                  }}
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

          {/* Opens a screen of its own, so a row with a chevron rather than a quick action. */}
          {canCheckIn ? (
            <NavigationRow
              isDark={isDark}
              icon="checkmark-done-outline"
              label="Check in guests"
              onPress={() =>
                router.push({
                  pathname: "/event-check-in",
                  params: { uuid: event.uuid, title: event.title },
                })
              }
            />
          ) : null}

          {/* The page as guests see it; a draft's renders only for its owner and hosts. */}
          {canViewPage ? (
            <PageButton
              isDark={isDark}
              icon="open-outline"
              label="Open event page"
              onPress={() => actions.onOpenPage(event)}
            />
          ) : canPreviewDraft ? (
            <>
              <PageButton
                isDark={isDark}
                icon="eye-outline"
                label="Preview"
                onPress={() => actions.onPreview(event)}
              />
              {/* A draft's next step, so the one filled button. */}
              <PageButton
                isDark={isDark}
                icon="rocket-outline"
                label="Publish"
                primary
                onPress={() => actions.onPublish(event)}
              />
            </>
          ) : null}

          {/* The rest as the link editor's quick actions, then its danger zone. */}
          <ActionGroup
            isDark={isDark}
            header="Quick actions"
            actions={[
              // The address Preview and Open event page open, as the link editor's Copy link. A
              // cancelled event's page can be opened, but its link isn't handed out, as on the web.
              canShare || canPreviewDraft
                ? {
                    label: "Copy link",
                    icon: "link-outline",
                    onPress: () => actions.onCopyLink(event),
                  }
                : null,
              canShare
                ? { label: "Share", icon: "share-outline", onPress: () => actions.onShare(event) }
                : null,
            ]}
          />
          <ActionGroup
            isDark={isDark}
            destructive
            actions={[
              canManage && event.status === "published"
                ? {
                    label: "Cancel event",
                    icon: "ban-outline",
                    onPress: () => actions.onCancel(event),
                  }
                : null,
              canManage && canDeleteCalEvent(event)
                ? {
                    label: "Delete event",
                    icon: "trash-outline",
                    onPress: () => actions.onDelete(event),
                  }
                : null,
            ]}
          />
        </View>
      </ScrollView>
    </>
  );
}

type Theme = ReturnType<typeof getColors>;

/** A card with the link editor's corners on the booking and availability detail colors. */
function Card({
  isDark,
  header,
  paddingVertical = 14,
  children,
}: {
  isDark: boolean;
  /** The link editor's small heading above the card. */
  header?: string;
  /** For rows that space themselves, such as hosts split by dividers. */
  paddingVertical?: number;
  children: ReactNode;
}) {
  return (
    <View style={{ marginTop: header ? 24 : 16 }}>
      {header ? <SectionHeader title={header} /> : null}
      <View
        style={{
          backgroundColor: getGroupedSurfaces(isDark).card,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical,
        }}
      >
        {children}
      </View>
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
              // A link reads as one by its underline, in the app's neutral colors.
              color: onPress ? theme.text : theme.textSecondary,
              textDecorationLine: onPress ? "underline" : "none",
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

/**
 * A full-width button under the hosts: outlined for the event page, so it doesn't outweigh the
 * rest of the page, and filled (`primary`) for a draft's Publish.
 */
function PageButton({
  isDark,
  icon,
  label,
  primary = false,
  onPress,
}: {
  isDark: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const theme = getColors(isDark);
  const fill = isDark ? "#FFFFFF" : "#000000";
  const color = primary ? (isDark ? "#000000" : "#FFFFFF") : theme.text;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        height: 44,
        marginTop: primary ? 12 : 24,
        borderRadius: 14,
        borderWidth: 1,
        // The filled one in the editor Save pill's black (white in dark mode).
        borderColor: primary ? fill : isDark ? "#4D4D4D" : "#E5E5E5",
        backgroundColor: primary ? fill : getGroupedSurfaces(isDark).card,
      }}
    >
      <Ionicons name={icon} size={18} color={color} style={{ marginRight: 8 }} />
      <Text style={{ color, fontSize: 16, fontWeight: primary ? "600" : "500" }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** A grouped row that opens another screen: icon, label and a chevron. */
function NavigationRow({
  isDark,
  icon,
  label,
  onPress,
}: {
  isDark: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = getColors(isDark);
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      activeOpacity={0.5}
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: 44,
        marginTop: 16,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: getGroupedSurfaces(isDark).card,
      }}
    >
      <Ionicons name={icon} size={20} color={theme.textSecondary} style={{ marginRight: 10 }} />
      <Text style={{ flex: 1, color: theme.text, fontSize: 17 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
    </TouchableOpacity>
  );
}

interface Action {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}

/**
 * The link editor's grouped action rows: the label on the left, its icon on the right, red for
 * the danger zone. Left out when none of its actions apply.
 */
function ActionGroup({
  isDark,
  header,
  destructive = false,
  actions,
}: {
  isDark: boolean;
  header?: string;
  destructive?: boolean;
  actions: (Action | null)[];
}) {
  const theme = getColors(isDark);
  const shown = actions.filter((action): action is Action => action !== null);
  if (shown.length === 0) return null;
  const color = destructive ? theme.destructive : theme.text;
  return (
    <View style={{ marginTop: 24 }}>
      {header ? <SectionHeader title={header} /> : null}
      <View
        style={{
          backgroundColor: getGroupedSurfaces(isDark).card,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {shown.map((action, index) => (
          <TouchableOpacity
            key={action.label}
            onPress={action.onPress}
            accessibilityRole="button"
            activeOpacity={0.5}
          >
            {/* The divider runs the card's full width, as between hosts. */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                height: 44,
                paddingHorizontal: 16,
                borderBottomWidth: index < shown.length - 1 ? 1 : 0,
                borderBottomColor: isDark ? "#4D4D4D" : "#E5E5E5",
              }}
            >
              <Text style={{ color, fontSize: 17 }}>{action.label}</Text>
              <Ionicons
                name={action.icon}
                size={18}
                color={destructive ? theme.destructive : "#C7C7CC"}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export type { CalEvent };
