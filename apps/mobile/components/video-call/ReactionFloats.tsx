import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  admitReactionFloats,
  REACTION_FLOAT_MS,
  type ReactionFloat,
} from "@/services/cal-video/reactions";
import type { CallParticipant, Reaction } from "@/services/cal-video/types";

/**
 * Reactions rising from the bottom right of the call, as on the web, each swaying and leaning its
 * own way with the reactor's name under it. The tile badge stays as the lasting cue.
 */
export function ReactionFloats({
  reactions,
  participants,
  bottom,
}: {
  reactions: readonly Reaction[];
  participants: readonly CallParticipant[];
  bottom: number;
}) {
  const reducedMotion = useReducedMotion();
  const { height } = useWindowDimensions();
  const [floats, setFloats] = useState<ReactionFloat[]>([]);
  const lastSeenId = useRef<string | null>(null);

  useEffect(() => {
    const seen = lastSeenId.current;
    lastSeenId.current = reactions.at(-1)?.id ?? seen;
    if (reducedMotion) return;
    setFloats((active) =>
      admitReactionFloats({ active, reactions, lastSeenId: seen, now: Date.now() })
    );
  }, [reactions, reducedMotion]);

  useEffect(() => {
    if (floats.length === 0) return;
    const retireAt = Math.min(...floats.map((float) => float.startedAt)) + REACTION_FLOAT_MS;
    const timer = setTimeout(() => {
      const now = Math.max(Date.now(), retireAt);
      setFloats((active) => active.filter((float) => float.startedAt + REACTION_FLOAT_MS > now));
    }, retireAt - Date.now());
    return () => clearTimeout(timer);
  }, [floats]);

  if (floats.length === 0) return null;
  return (
    <View style={[styles.zone, { bottom }]} pointerEvents="none" aria-hidden>
      {floats.map((float) => (
        <Float
          key={float.id}
          float={float}
          risePx={height * 0.45 * float.riseScale}
          label={participants.find((p) => p.id === float.participantId)?.displayName ?? null}
        />
      ))}
    </View>
  );
}

function Float({
  float,
  risePx,
  label,
}: {
  float: ReactionFloat;
  risePx: number;
  label: string | null;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withTiming(1, { duration: REACTION_FLOAT_MS, easing: Easing.out(Easing.quad) }));
  }, [progress]);
  const { offsetPx, swayPx, tiltDeg } = float;
  const animatedStyle = useAnimatedStyle(() => {
    const t = progress.get();
    return {
      opacity: interpolate(t, [0, 0.1, 0.7, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: offsetPx + Math.sin(t * Math.PI * 3) * swayPx },
        { translateY: -t * risePx },
        { rotate: `${tiltDeg * Math.min(1, t * 3)}deg` },
        { scale: interpolate(t, [0, 0.15, 1], [0.5, 1, 0.9]) },
      ],
    };
  });
  return (
    <Animated.View style={[styles.float, animatedStyle]}>
      <Text style={styles.emoji}>{float.emoji}</Text>
      {label && (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  zone: { position: "absolute", right: 24, width: 96, height: 0 },
  float: { position: "absolute", right: 0, bottom: 0, width: 96, alignItems: "center", gap: 2 },
  emoji: { fontSize: 36 },
  label: {
    maxWidth: 96,
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});
