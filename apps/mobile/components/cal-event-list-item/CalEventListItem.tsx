import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, useColorScheme, View } from "react-native";
import { getColors } from "@/constants/colors";
import { useHour12 } from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import { canEditCalEvent } from "@/utils/cal-event-edit";
import {
  CAL_EVENT_STATUS_LABELS,
  canDeleteCalEvent,
  canManageCalEventLifecycle,
  formatCalEventCardTime,
  formatCalEventDate,
  getCalEventFacts,
  getCalEventLinkActions,
  getCalEventLocationLabel,
  getCalEventStatusColors,
  isCalEventInPerson,
} from "@/utils/cal-events";
import { getAvatarUrl } from "@/utils/getAvatarUrl";
import { CalEventMenu } from "./CalEventMenu";
import type { CalEventMenuItem } from "./CalEventMenu.types";

export interface CalEventActions {
  onPress: (event: CalEvent) => void;
  onOpenPage: (event: CalEvent) => void;
  onPreview: (event: CalEvent) => void;
  onEdit: (event: CalEvent) => void;
  onEditOnWeb: (event: CalEvent) => void;
  onCopyLink: (event: CalEvent) => void;
  onShare: (event: CalEvent) => void;
  onPublish: (event: CalEvent) => void;
  onCancel: (event: CalEvent) => void;
  onDelete: (event: CalEvent) => void;
}

interface CalEventListItemProps extends CalEventActions {
  event: CalEvent;
  /** The signed-in user's id; unknown (profile not loaded) hides publish, cancel and delete. */
  viewerId: number | undefined;
}

/** Card for one event on the Events tab: cover, title, when, where + facts, hosts, status. */
export function CalEventListItem({ event, viewerId, onPress, ...actions }: CalEventListItemProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);
  const hour12 = useHour12();
  const status = getCalEventStatusColors(event.status, isDark);
  const facts = [getCalEventLocationLabel(event), ...getCalEventFacts(event)];
  const host = event.hosts[0];
  const extraHosts = event.hosts.length - 1;
  const menuGroups = getCalEventMenuGroups(event, viewerId, actions);

  return (
    <View
      style={{
        backgroundColor: theme.background,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 8,
        marginHorizontal: 8,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => onPress(event)}
        android_ripple={{ color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
        accessibilityRole="button"
        accessibilityLabel={event.title}
      >
        {event.coverImageUrl ? (
          <Image
            source={{ uri: event.coverImageUrl }}
            style={{ width: "100%", aspectRatio: 2 }}
            contentFit="cover"
            transition={150}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={{
              width: "100%",
              aspectRatio: 3,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.backgroundMuted,
            }}
          >
            <Ionicons name="ticket-outline" size={36} color={theme.textMuted} />
          </View>
        )}

        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
          <Text
            style={{ color: theme.text, fontSize: 18, fontWeight: "600", lineHeight: 24 }}
            numberOfLines={2}
          >
            {event.title}
          </Text>

          {/* One paragraph so a long date wraps instead of pushing the time off the card; the
              no-break spaces keep "·" off the start of a line and the times in one piece. */}
          <Text style={{ color: theme.textSecondary, fontSize: 15, marginTop: 6 }}>
            <Text style={{ color: theme.text, fontWeight: "500" }}>
              {formatCalEventDate(event.startTime, event.endTime, event.timeZone)}
            </Text>
            {"\u00A0\u00A0·  "}
            {formatCalEventCardTime(event.startTime, event.endTime, event.timeZone, hour12).replace(
              / /g,
              "\u00A0"
            )}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
            <Ionicons
              name={isCalEventInPerson(event) ? "location-outline" : "videocam-outline"}
              size={15}
              color={theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={{ color: theme.textSecondary, fontSize: 15, flexShrink: 1 }}
              numberOfLines={1}
            >
              {facts.join("  ·  ")}
            </Text>
          </View>

          {host ? (
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
              <Image
                source={{ uri: getAvatarUrl(host.avatarUrl) }}
                style={{ width: 20, height: 20, borderRadius: 10, marginRight: 8 }}
                accessibilityIgnoresInvertColors
              />
              <Text style={{ color: theme.textSecondary, fontSize: 15 }} numberOfLines={1}>
                {host.name || "Host"}
                {extraHosts > 0 ? ` +${extraHosts}` : ""}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* Outside the card's Pressable so VoiceOver can reach the menu button. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingBottom: 16,
        }}
      >
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

        <CalEventMenu groups={menuGroups} accessibilityLabel={`More actions for ${event.title}`} />
      </View>
    </View>
  );
}

/**
 * The card's menu in the Links card's order: look at it, change it, then remove it. Preview opens
 * the event's page, through the web sign-in for a draft, which only its owner and hosts can see.
 */
function getCalEventMenuGroups(
  event: CalEvent,
  viewerId: number | undefined,
  actions: Omit<CalEventActions, "onPress">
): CalEventMenuItem[][] {
  const canManage = canManageCalEventLifecycle(event, viewerId);
  const canEdit = canEditCalEvent(event, viewerId);
  const { canViewPage, canShare } = getCalEventLinkActions(event.status);
  const view: CalEventMenuItem[] = [];
  const change: CalEventMenuItem[] = [];
  const remove: CalEventMenuItem[] = [];

  // A draft's page is there for its owner and hosts (Preview), so they can copy its link too.
  const canPreviewDraft = canManage && event.status === "draft";
  if (canViewPage || canPreviewDraft) {
    view.push({
      label: "Preview",
      icon: "open-outline",
      systemImage: "safari",
      onPress: () => (canViewPage ? actions.onOpenPage(event) : actions.onPreview(event)),
    });
  }
  // A cancelled event's page can be opened, but its link isn't handed out, as on the web.
  if (canShare || canPreviewDraft) {
    view.push({
      label: "Copy link",
      icon: "link-outline",
      systemImage: "link",
      onPress: () => actions.onCopyLink(event),
    });
  }
  if (canShare) {
    view.push({
      label: "Share",
      icon: "share-outline",
      systemImage: "square.and.arrow.up",
      onPress: () => actions.onShare(event),
    });
  }
  // Co-hosts can't edit natively, but the web still lets them change some fields.
  if (event.status !== "cancelled") {
    change.push({
      label: canEdit ? "Edit" : "Edit on web",
      icon: "pencil-outline",
      systemImage: "pencil",
      onPress: () => (canEdit ? actions.onEdit(event) : actions.onEditOnWeb(event)),
    });
  }
  if (canManage && event.status === "draft") {
    change.push({
      label: "Publish",
      icon: "rocket-outline",
      systemImage: "paperplane",
      onPress: () => actions.onPublish(event),
    });
  }
  if (canManage && event.status === "published") {
    remove.push({
      label: "Cancel event",
      icon: "ban-outline",
      systemImage: "xmark.circle",
      destructive: true,
      onPress: () => actions.onCancel(event),
    });
  }
  if (canManage && canDeleteCalEvent(event)) {
    remove.push({
      label: "Delete",
      icon: "trash-outline",
      systemImage: "trash",
      destructive: true,
      onPress: () => actions.onDelete(event),
    });
  }
  return [view, change, remove];
}
