import { Hand } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/services/cal-video/types";
import { GlassSurface } from "./GlassSurface";

const EMOJI_LABEL: Record<ReactionEmoji, string> = {
  "👍": "Thumbs up",
  "❤️": "Heart",
  "😂": "Laughing",
  "😮": "Surprised",
  "😢": "Sad",
  "🎉": "Celebrate",
};

/**
 * The six reactions and the hand, one tap each, floating above the tray while the React button
 * is pressed. Raising a hand stays until you lower it or a host does; a reaction is gone in a
 * few seconds, so the bar closes itself after one.
 */
export function ReactionBar({
  onReact,
  hand,
}: {
  onReact: (emoji: ReactionEmoji) => void;
  /** Absent where the call cannot carry hands. */
  hand: { raised: boolean; onToggle: () => void } | null;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="toolbar" accessibilityLabel="Reactions">
      <GlassSurface style={styles.bar}>
        {REACTION_EMOJIS.map((emoji) => (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={EMOJI_LABEL[emoji]}
            onPress={() => onReact(emoji)}
            hitSlop={4}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        ))}
        {hand && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Raise hand"
            accessibilityState={{ selected: hand.raised }}
            onPress={hand.onToggle}
            hitSlop={4}
            style={({ pressed }) => [
              styles.item,
              styles.hand,
              hand.raised && styles.handRaised,
              pressed && styles.pressed,
            ]}
          >
            <Hand size={22} color={hand.raised ? "#111111" : "#FFD60A"} />
          </Pressable>
        )}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 28,
    overflow: "hidden",
  },
  item: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: "rgba(255,255,255,0.18)" },
  emoji: { fontSize: 26 },
  hand: { marginLeft: 4 },
  handRaised: { backgroundColor: "#FFD60A" },
});
