import { ArrowUp, Lock, LockOpen, Pin, Reply, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ChatController, ChatRow } from "@/services/cal-video/chat-controller";
import { REACTION_EMOJIS } from "@/services/cal-video/types";
import { showActionSheet } from "@/utils/action-sheet";

function timeOf(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function SystemRow({ row }: { row: ChatRow }) {
  const verb = row.kind === "pin" ? "pinned a message" : "unpinned a message";
  return (
    <View style={styles.system}>
      <Pin size={12} color="rgba(255,255,255,0.5)" />
      <Text style={styles.systemText} numberOfLines={2}>
        {row.isLocal ? "You" : row.senderName} {verb}
        {row.replyTo?.excerpt ? `: “${row.replyTo.excerpt}”` : ""}
      </Text>
    </View>
  );
}

function MessageRow({
  row,
  chat,
  seenBy,
  onLongPress,
}: {
  row: ChatRow;
  chat: ChatController;
  seenBy: string | null;
  onLongPress: (row: ChatRow) => void;
}) {
  if (row.kind !== "text") return <SystemRow row={row} />;
  const failed = row.status === "failed";
  const canReact = chat.capabilities.react && !row.deleted && row.status === "sent" && !chat.muted;
  return (
    <View style={[styles.row, row.isLocal && styles.rowLocal]}>
      {!row.isLocal && (
        <Text style={styles.sender}>
          {row.senderName}
          {row.isHost ? " · Host" : ""}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${row.senderName}: ${row.deleted ? "message deleted" : row.text}`}
        accessibilityHint="Double tap and hold for options"
        onLongPress={() => onLongPress(row)}
        delayLongPress={250}
        style={[styles.bubble, row.isLocal ? styles.bubbleLocal : styles.bubbleRemote]}
      >
        {row.replyTo && (
          <View style={styles.quote}>
            <Text style={styles.quoteName} numberOfLines={1}>
              {row.replyTo.speakerName ?? "Guest"}
            </Text>
            <Text style={styles.quoteText} numberOfLines={2}>
              {row.replyTo.deleted ? "Message deleted" : row.replyTo.excerpt}
            </Text>
          </View>
        )}
        <Text
          style={[
            styles.body,
            row.isLocal && styles.bodyLocal,
            row.deleted && styles.deleted,
            row.deleted && row.isLocal && styles.deletedLocal,
          ]}
        >
          {row.deleted ? "Message deleted" : row.text}
        </Text>
      </Pressable>
      {row.reactions.length > 0 && (
        <View style={[styles.reactions, row.isLocal && styles.reactionsLocal]}>
          {row.reactions.map((reaction) => (
            <Pressable
              key={reaction.emoji}
              accessibilityRole="button"
              accessibilityLabel={`${reaction.emoji} ${reaction.count}${reaction.mine ? ", yours" : ""}`}
              disabled={!canReact}
              onPress={() => chat.react?.(row.id, reaction.emoji)}
              style={[styles.reaction, reaction.mine && styles.reactionMine]}
            >
              <Text style={styles.reactionText}>
                {reaction.emoji} {reaction.count}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.meta}>
        {failed ? (
          <Pressable accessibilityRole="button" onPress={() => chat.retry(row.id)} hitSlop={8}>
            <Text style={styles.failed}>Not sent. Tap to retry.</Text>
          </Pressable>
        ) : (
          <Text style={styles.time}>
            {row.status === "sending"
              ? "Sending…"
              : seenBy
                ? `${timeOf(row.at)} · ${seenBy}`
                : timeOf(row.at)}
          </Text>
        )}
      </View>
    </View>
  );
}

/**
 * In-meeting chat as a sheet over the call. The same sheet draws the provider's chat and Cal
 * Video's own: what each can do is read from the controller, so a message only offers
 * reactions, replies, pinning or deletion where that chat carries them.
 */
export function ChatSheet({
  visible,
  chat,
  retentionDays,
  onClose,
}: {
  visible: boolean;
  chat: ChatController | null;
  /** Provider-side retention, where the provider keeps the history. */
  retentionDays?: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");
  const list = useRef<FlatList<ChatRow>>(null);
  const input = useRef<TextInput>(null);
  const rows = chat?.rows ?? [];

  // Everything on screen counts as read while the sheet is open, so each arrival re-marks.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `rows.length` is the arrival trigger
  useEffect(() => {
    if (visible) chat?.markSeen();
  }, [visible, chat, rows.length]);

  // Closing the sheet mid-sentence must not leave "typing…" on everyone else's screen.
  useEffect(() => {
    if (!visible) chat?.stopTyping?.();
  }, [visible, chat]);

  // A reply pulls the keyboard up: the quote is what the person is answering.
  const replyingToId = chat?.replyingTo?.rowId ?? null;
  useEffect(() => {
    if (replyingToId) input.current?.focus();
  }, [replyingToId]);

  const maxLength = chat?.maxBodyLength ?? 1000;
  const trimmed = draft.trim();
  const cannotWrite = chat !== null && (chat.locked || chat.muted || chat.connection === "denied");
  const canSend =
    trimmed.length > 0 && trimmed.length <= maxLength && chat !== null && !cannotWrite;
  const send = () => {
    if (!canSend || !chat) return;
    chat.send(trimmed);
    setDraft("");
  };
  const onChangeDraft = (text: string) => {
    setDraft(text);
    if (text.trim().length > 0) chat?.noteTyping?.();
    else chat?.stopTyping?.();
  };

  const showRowActions = (row: ChatRow) => {
    if (!chat) return;
    const items = [];
    if (chat.capabilities.reply && !row.deleted && row.status === "sent" && !cannotWrite) {
      items.push({ label: "Reply", onPress: () => chat.startReply?.(row.id) });
    }
    if (
      chat.capabilities.react &&
      !row.deleted &&
      row.status === "sent" &&
      !chat.muted &&
      !chat.locked
    ) {
      for (const emoji of REACTION_EMOJIS) {
        items.push({ label: `React ${emoji}`, onPress: () => chat.react?.(row.id, emoji) });
      }
    }
    if (chat.capabilities.pin && !row.deleted && row.status === "sent") {
      const pinned = chat.pin?.messageId === row.id;
      items.push({
        label: pinned ? "Unpin message" : "Pin message",
        onPress: () =>
          void (pinned ? chat.unpin?.() : chat.pinMessage?.(row.id))?.catch(() => undefined),
      });
    }
    if (chat.capabilities.deleteOwn && row.isLocal && !row.deleted && row.status === "sent") {
      items.push({
        label: "Delete message",
        destructive: true,
        onPress: () => void chat.deleteMessage?.(row.id).catch(() => undefined),
      });
    }
    if (items.length === 0) return;
    showActionSheet({ title: row.deleted ? undefined : row.text, items });
  };

  const notice = !chat
    ? "Chat is loading…"
    : chat.connection === "denied"
      ? "You can no longer read this chat."
      : chat.locked
        ? chat.canModerate
          ? "Chat is turned off for everyone."
          : "A host turned chat off."
        : chat.muted
          ? "A host muted you in chat. You can still read."
          : chat.connection === "reconnecting" || chat.connection === "connecting"
            ? "Reconnecting to chat…"
            : chat.typingLabel;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Chat</Text>
          <View style={styles.headerActions}>
            {chat?.capabilities.lock && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={chat.locked ? "Turn chat on" : "Turn chat off"}
                onPress={() => void chat.setLocked?.(!chat.locked).catch(() => undefined)}
                hitSlop={10}
                style={styles.close}
              >
                {chat.locked ? (
                  <LockOpen size={16} color="#FFFFFF" />
                ) : (
                  <Lock size={16} color="#FFFFFF" />
                )}
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close chat"
              onPress={onClose}
              hitSlop={10}
              style={styles.close}
            >
              <X size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
        {chat?.pin && (
          <View style={styles.pinned}>
            <Pin size={14} color="#FFD60A" />
            <View style={styles.pinnedText}>
              <Text style={styles.pinnedName} numberOfLines={1}>
                {chat.pin.speakerName ?? "Guest"}
              </Text>
              <Text style={styles.pinnedBody} numberOfLines={2}>
                {chat.pin.body}
              </Text>
            </View>
          </View>
        )}
        {retentionDays !== undefined && chat?.kind === "provider" && (
          <Text style={styles.retention}>
            Messages are kept by the video provider for {retentionDays} days.
          </Text>
        )}
        <FlatList
          ref={list}
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) =>
            chat ? (
              <MessageRow
                row={item}
                chat={chat}
                seenBy={chat.seenBy?.rowId === item.id ? chat.seenBy.label : null}
                onLongPress={showRowActions}
              />
            ) : null
          }
          contentContainerStyle={styles.list}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          onScroll={(event) => {
            if (event.nativeEvent.contentOffset.y < 40 && chat?.hasOlder) chat.loadOlder?.();
          }}
          scrollEventThrottle={200}
          ListEmptyComponent={
            <Text style={styles.empty}>No messages yet. Say hello to everyone in the call.</Text>
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />
        {notice && <Text style={styles.notice}>{notice}</Text>}
        {chat?.replyingTo && (
          <View style={styles.replyBar}>
            <Reply size={14} color="rgba(255,255,255,0.6)" />
            <View style={styles.replyText}>
              <Text style={styles.replyName} numberOfLines={1}>
                Replying to {chat.replyingTo.senderName}
              </Text>
              <Text style={styles.replyBody} numberOfLines={1}>
                {chat.replyingTo.text}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
              onPress={() => chat.cancelReply?.()}
              hitSlop={10}
            >
              <X size={16} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
        )}
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            ref={input}
            accessibilityLabel="Message"
            style={[styles.input, cannotWrite && styles.inputDisabled]}
            value={draft}
            onChangeText={onChangeDraft}
            onBlur={() => chat?.stopTyping?.()}
            placeholder={cannotWrite ? "You can't send messages right now" : "Message"}
            placeholderTextColor="rgba(255,255,255,0.45)"
            maxLength={maxLength}
            editable={!cannotWrite}
            multiline
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={send}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={send}
            style={[styles.send, !canSend && styles.sendDisabled]}
          >
            <ArrowUp size={18} color="#111111" strokeWidth={2.5} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#111113" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  headerActions: { flexDirection: "row", gap: 8 },
  title: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  pinned: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 214, 10, 0.12)",
  },
  pinnedText: { flex: 1 },
  pinnedName: { color: "#FFD60A", fontSize: 12, fontWeight: "600" },
  pinnedBody: { color: "#FFFFFF", fontSize: 14 },
  retention: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  list: { paddingHorizontal: 16, paddingBottom: 12, gap: 10, flexGrow: 1 },
  empty: { color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 48, fontSize: 15 },
  system: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 2,
  },
  systemText: { color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center" },
  row: { alignItems: "flex-start", maxWidth: "82%" },
  rowLocal: { alignSelf: "flex-end", alignItems: "flex-end" },
  sender: { color: "rgba(255,255,255,0.6)", fontSize: 12, marginBottom: 3, marginLeft: 12 },
  bubble: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, gap: 6 },
  bubbleRemote: { backgroundColor: "#2C2C2E", borderBottomLeftRadius: 6 },
  bubbleLocal: { backgroundColor: "#FFFFFF", borderBottomRightRadius: 6 },
  quote: {
    borderLeftWidth: 2,
    borderLeftColor: "rgba(128,128,128,0.6)",
    paddingLeft: 8,
    gap: 1,
  },
  quoteName: { color: "rgba(128,128,128,0.9)", fontSize: 12, fontWeight: "600" },
  quoteText: { color: "rgba(128,128,128,0.9)", fontSize: 13 },
  body: { color: "#FFFFFF", fontSize: 16, lineHeight: 21 },
  bodyLocal: { color: "#111111" },
  deleted: { fontStyle: "italic", color: "rgba(255,255,255,0.5)" },
  deletedLocal: { color: "rgba(17,17,17,0.5)" },
  reactions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4, marginLeft: 8 },
  reactionsLocal: { marginLeft: 0, marginRight: 8, justifyContent: "flex-end" },
  reaction: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "transparent",
  },
  reactionMine: { borderColor: "#FFFFFF" },
  reactionText: { color: "#FFFFFF", fontSize: 12 },
  meta: { marginTop: 3, paddingHorizontal: 12 },
  time: { color: "rgba(255,255,255,0.4)", fontSize: 11 },
  failed: { color: "#FF453A", fontSize: 12 },
  notice: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 20,
    paddingBottom: 6,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  replyText: { flex: 1 },
  replyName: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "600" },
  replyBody: { color: "#FFFFFF", fontSize: 13 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    color: "#FFFFFF",
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#1C1C1E",
  },
  inputDisabled: { opacity: 0.5 },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.35 },
});
