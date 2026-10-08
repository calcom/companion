import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Text as MenuText } from "@/components/ui/text";
import { getColors } from "@/constants/colors";
import { useUserProfile } from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import {
  CAL_EVENT_STATUS_LABELS,
  canManageCalEventLifecycle,
  formatCalEventDate,
  formatCalEventTime,
  getCalEventFacts,
  getCalEventLocationLabel,
  getCalEventStatusColors,
  isCalEventInPerson,
} from "@/utils/cal-events";
import { getAvatarUrl } from "@/utils/getAvatarUrl";

export interface CalEventActions {
  onPress: (event: CalEvent) => void;
  onOpenPage: (event: CalEvent) => void;
  onEditOnWeb: (event: CalEvent) => void;
  onCopyLink: (event: CalEvent) => void;
  onShare: (event: CalEvent) => void;
  onPublish: (event: CalEvent) => void;
  onCancel: (event: CalEvent) => void;
  onDelete: (event: CalEvent) => void;
}

interface CalEventListItemProps extends CalEventActions {
  event: CalEvent;
}

/** Card for one event on the Events tab: cover, title, when, where + facts, hosts, status. */
export function CalEventListItem({ event, onPress, ...actions }: CalEventListItemProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getColors(isDark);
  const insets = useSafeAreaInsets();
  const status = getCalEventStatusColors(event.status, isDark);
  const facts = [getCalEventLocationLabel(event), ...getCalEventFacts(event)];
  const host = event.hosts[0];
  const extraHosts = event.hosts.length - 1;
  const { data: me } = useUserProfile();
  const canManage = canManageCalEventLifecycle(event, me?.id);
  const menuIconColor = isDark ? "#E5E5EA" : "#374151";

  return (
    <View
      style={{
        backgroundColor: theme.background,
        borderColor: theme.border,
        borderWidth: 1,
        borderRadius: 20,
        marginHorizontal: 16,
        marginBottom: 16,
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

        <View style={{ padding: 16 }}>
          <Text
            style={{ color: theme.text, fontSize: 18, fontWeight: "600", lineHeight: 24 }}
            numberOfLines={2}
          >
            {event.title}
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
            <Text style={{ color: theme.text, fontSize: 15, fontWeight: "500" }}>
              {formatCalEventDate(event.startTime, event.endTime, event.timeZone)}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
              {"  ·  "}
              {formatCalEventTime(event.startTime, event.timeZone)}
            </Text>
          </View>

          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}
          >
            <Ionicons
              name={isCalEventInPerson(event) ? "location-outline" : "videocam-outline"}
              size={15}
              color={theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text style={{ color: theme.textSecondary, fontSize: 15 }} numberOfLines={1}>
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
                {host.name ?? "Host"}
                {extraHosts > 0 ? ` +${extraHosts}` : ""}
              </Text>
            </View>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 12,
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`More actions for ${event.title}`}
                  hitSlop={8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: isDark ? "#171717" : "#FFFFFF",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={theme.text} />
                </Pressable>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                insets={{ top: insets.top, bottom: insets.bottom, left: 12, right: 12 }}
                sideOffset={8}
                className="w-48"
                align="end"
              >
                <DropdownMenuItem onPress={() => actions.onOpenPage(event)}>
                  <Ionicons
                    name="open-outline"
                    size={18}
                    color={menuIconColor}
                    style={{ marginRight: 8 }}
                  />
                  <MenuText>Open event page</MenuText>
                </DropdownMenuItem>
                <DropdownMenuItem onPress={() => actions.onEditOnWeb(event)}>
                  <Ionicons
                    name="pencil-outline"
                    size={18}
                    color={menuIconColor}
                    style={{ marginRight: 8 }}
                  />
                  <MenuText>Edit on web</MenuText>
                </DropdownMenuItem>
                <DropdownMenuItem onPress={() => actions.onCopyLink(event)}>
                  <Ionicons
                    name="link-outline"
                    size={18}
                    color={menuIconColor}
                    style={{ marginRight: 8 }}
                  />
                  <MenuText>Copy link</MenuText>
                </DropdownMenuItem>
                <DropdownMenuItem onPress={() => actions.onShare(event)}>
                  <Ionicons
                    name="share-outline"
                    size={18}
                    color={menuIconColor}
                    style={{ marginRight: 8 }}
                  />
                  <MenuText>Share</MenuText>
                </DropdownMenuItem>

                {canManage ? (
                  <>
                    <DropdownMenuSeparator />
                    {event.status === "draft" ? (
                      <DropdownMenuItem onPress={() => actions.onPublish(event)}>
                        <Ionicons
                          name="rocket-outline"
                          size={18}
                          color={menuIconColor}
                          style={{ marginRight: 8 }}
                        />
                        <MenuText>Publish</MenuText>
                      </DropdownMenuItem>
                    ) : null}
                    {event.status === "published" ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onPress={() => actions.onCancel(event)}
                      >
                        <Ionicons
                          name="ban-outline"
                          size={18}
                          color={theme.destructive}
                          style={{ marginRight: 8 }}
                        />
                        <MenuText style={{ color: theme.destructive }}>Cancel event</MenuText>
                      </DropdownMenuItem>
                    ) : null}
                    {event.status !== "published" ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onPress={() => actions.onDelete(event)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color={theme.destructive}
                          style={{ marginRight: 8 }}
                        />
                        <MenuText style={{ color: theme.destructive }}>Delete</MenuText>
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </View>
        </View>
      </Pressable>
    </View>
  );
}
