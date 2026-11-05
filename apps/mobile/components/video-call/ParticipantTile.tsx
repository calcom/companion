import { Hand, MicOff, MonitorUp, Pin, WifiOff } from "lucide-react-native";
import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { ReactionBadge } from "@/services/cal-video/reactions";
import type { CallDriver, CallParticipant } from "@/services/cal-video/types";
import { CallAvatar } from "./Avatar";
import { GlassSurface } from "./GlassSurface";

/**
 * One person. Video when they send it, their avatar when they don't, their name and mute state
 * always. The ring is the SFU's dominant speaker, the one signal every provider can give. A tap
 * opens what can be done about them, which the shell decides.
 */
export function ParticipantTile({
  participant,
  driver,
  avatarUrl,
  featured,
  pinned = false,
  reaction = null,
  compact = false,
  labelBottom,
  style,
  onPress,
}: {
  participant: CallParticipant;
  driver: CallDriver | null;
  /** The local participant's avatar comes from the grant; remote avatars are never trusted. */
  avatarUrl: string | null;
  featured: boolean;
  pinned?: boolean;
  /** Their latest reaction while it is still fresh. */
  reaction?: ReactionBadge | null;
  compact?: boolean;
  /** Lifts the name clear of whatever floats over the tile's bottom edge. */
  labelBottom?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: (participant: CallParticipant) => void;
}) {
  const VideoView = driver?.VideoView;
  const showVideo = participant.hasVideo && VideoView;
  const label = participant.isLocal ? "You" : participant.displayName;
  const iconSize = compact ? 11 : 13;

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={participant.isLocal ? "You" : participant.displayName}
      disabled={!onPress}
      onPress={() => onPress?.(participant)}
      style={[styles.tile, featured && styles.featured, style]}
    >
      {showVideo ? (
        <VideoView participantId={participant.id} kind="video" style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.avatarWrap}>
          <CallAvatar name={participant.displayName} url={avatarUrl} size={compact ? 44 : 96} />
        </View>
      )}
      {participant.connection === "interrupted" && (
        <View style={styles.interrupted}>
          <WifiOff size={18} color="#FFFFFF" />
          <Text style={styles.interruptedText}>Reconnecting</Text>
        </View>
      )}
      {reaction && (
        <GlassSurface
          key={reaction.key}
          style={[styles.reaction, compact && styles.reactionCompact]}
        >
          <Text
            style={[styles.reactionEmoji, compact && styles.reactionEmojiCompact]}
            accessibilityLabel={`${label} reacted ${reaction.emoji}`}
          >
            {reaction.emoji}
          </Text>
          {reaction.count > 1 && <Text style={styles.reactionCount}>{reaction.count}</Text>}
        </GlassSurface>
      )}
      <GlassSurface
        style={[
          styles.pill,
          compact && styles.pillCompact,
          labelBottom !== undefined && { bottom: labelBottom },
        ]}
      >
        {participant.handRaisedAt !== null && <Hand size={iconSize} color="#FFD60A" />}
        {pinned && <Pin size={iconSize} color="#FFFFFF" />}
        {participant.isScreenSharing && <MonitorUp size={iconSize} color="#FFFFFF" />}
        {!participant.hasAudio && <MicOff size={iconSize} color="#FF453A" />}
        <Text numberOfLines={1} style={[styles.name, compact && styles.nameCompact]}>
          {label}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: "#1C1C1E",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  featured: { borderColor: "#34C759" },
  avatarWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  pill: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    maxWidth: "80%",
  },
  pillCompact: { left: 6, bottom: 6, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10 },
  reaction: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  reactionCompact: { top: 6, right: 6, paddingHorizontal: 6, paddingVertical: 2 },
  reactionEmoji: { fontSize: 20 },
  reactionEmojiCompact: { fontSize: 15 },
  reactionCount: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  name: { color: "#FFFFFF", fontSize: 13, fontWeight: "500" },
  nameCompact: { fontSize: 11 },
  interrupted: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  interruptedText: { color: "#FFFFFF", fontSize: 12 },
});
