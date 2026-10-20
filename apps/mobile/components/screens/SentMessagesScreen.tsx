/**
 * SentMessagesScreen Component
 *
 * The web's "Sent messages" sheet: what was sent to an event's guests, newest first, with each
 * message's status and delivery counts. Used by the cal-event-sent-messages route.
 */

import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HintText, useEditTheme } from "@/components/cal-events/edit/EditControls";
import { useCalEventMessages } from "@/hooks";
import type { CalEventMessage } from "@/services/calcom";
import {
  formatGuestDateTime,
  formatMessageCounts,
  formatMessageSender,
  formatMessageStatus,
  MESSAGE_SEGMENT_LABELS,
} from "@/utils/cal-event-guests";
import { offlineAwareRefresh } from "@/utils/network";

export function SentMessagesScreen({ uuid }: { uuid: string }) {
  const theme = useEditTheme();
  const insets = useSafeAreaInsets();
  const {
    data: messages,
    isPending,
    isError,
    isRefetchError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useCalEventMessages(uuid);
  // Only a pull shows the spinner. isRefetching is also true for the 3 s poll while a message
  // sends, and each poll would pull the list down to show it.
  const [pulling, setPulling] = useState(false);
  const onRefresh = () => {
    setPulling(true);
    offlineAwareRefresh(refetch).finally(() => setPulling(false));
  };
  // Retry shows its own progress, and a second tap waits for the first.
  const [retrying, setRetrying] = useState(false);
  const retry = () => {
    if (retrying) return;
    setRetrying(true);
    refetch().finally(() => setRetrying(false));
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} />}
    >
      <HintText>Messages sent to this event's guests, newest first.</HintText>
      {/* Like the Events listing: the loaded messages stay, marked out of date. */}
      {isRefetchError ? (
        <ErrorNotice
          message="Couldn't refresh. These messages may be out of date."
          onRetry={retry}
          busy={retrying}
        />
      ) : null}
      {isPending ? (
        <ActivityIndicator style={{ paddingVertical: 32 }} />
      ) : isError && !messages ? (
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 32 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
            Couldn't load sent messages.
          </Text>
          <OutlineButton label="Retry" busy={retrying} onPress={retry} />
        </View>
      ) : messages.length === 0 ? (
        <View
          style={{
            alignItems: "center",
            gap: 8,
            paddingVertical: 40,
            paddingHorizontal: 24,
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: theme.border,
          }}
        >
          <Ionicons name="paper-plane-outline" size={32} color={theme.textSecondary} />
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>
            No messages sent yet
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 14, textAlign: "center" }}>
            Messages you send with Message guests show up here.
          </Text>
        </View>
      ) : (
        <>
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.background,
              overflow: "hidden",
            }}
          >
            {messages.map((message, index) => (
              <MessageRow key={message.id} message={message} first={index === 0} />
            ))}
          </View>
          {hasNextPage && isFetchNextPageError && !isFetchingNextPage ? (
            <ErrorNotice message="Couldn't load more messages." onRetry={() => fetchNextPage()} />
          ) : hasNextPage ? (
            <View style={{ alignItems: "center" }}>
              <OutlineButton
                label="Load more"
                busy={isFetchingNextPage}
                onPress={() => fetchNextPage()}
              />
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function MessageRow({ message, first }: { message: CalEventMessage; first: boolean }) {
  const theme = useEditTheme();
  const counts = formatMessageCounts(message.counts);
  const failed = message.status === "NOT_SENT" || message.status === "NOT_SENT_EVENT_UNSENDABLE";
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 12,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: theme.border,
      }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }} numberOfLines={1}>
          {formatMessageSender(message.sender)}
        </Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
          {formatGuestDateTime(message.createdAt)}
        </Text>
        <Text style={{ color: failed ? theme.error : theme.text, fontSize: 14 }}>
          {formatMessageStatus(message)}
        </Text>
        {counts ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13, fontVariant: ["tabular-nums"] }}>
            {counts}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          alignSelf: "flex-start",
          borderRadius: 6,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: 6,
          paddingVertical: 2,
        }}
      >
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: "600" }}>
          {MESSAGE_SEGMENT_LABELS[message.segment] ?? message.segment}
        </Text>
      </View>
    </View>
  );
}

/** A problem loading messages, and Retry. */
function ErrorNotice({
  message,
  onRetry,
  busy = false,
}: {
  message: string;
  onRetry: () => void;
  busy?: boolean;
}) {
  const theme = useEditTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name="alert-circle-outline" size={18} color={theme.textSecondary} />
      <Text accessibilityRole="alert" style={{ flex: 1, color: theme.textSecondary, fontSize: 14 }}>
        {message}
      </Text>
      <OutlineButton label="Retry" busy={busy} onPress={onRetry} />
    </View>
  );
}

function OutlineButton({
  label,
  onPress,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  const theme = useEditTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityState={{ busy }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 36,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.background,
      }}
    >
      {busy ? <ActivityIndicator size="small" /> : null}
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}
