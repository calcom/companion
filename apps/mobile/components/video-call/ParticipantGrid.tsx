import { MonitorUp } from "lucide-react-native";
import { useEffect, useState } from "react";
import { type LayoutChangeEvent, ScrollView, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import type { StageLayout } from "@/services/cal-video/layout";
import { nextBadgeExpiry, reactionBadges } from "@/services/cal-video/reactions";
import type { CallDriver, CallParticipant, CallState } from "@/services/cal-video/types";
import { DraggablePip } from "./DraggablePip";
import { GlassSurface } from "./GlassSurface";
import { ParticipantTile } from "./ParticipantTile";

const GAP = 8;
const PIP_WIDTH = 110;
const PIP_HEIGHT = PIP_WIDTH * 1.4;
const PIP_MARGIN = 16;
const STRIP_TILE_WIDTH = 96;
const STRIP_TILE_HEIGHT = 128;

/**
 * Who is on screen and how big.
 *
 * With a stage (a shared screen, a pin, the followed speaker): the stage fills the surface and
 * everyone else rides in a strip above the tray. Without one: alone, you, full-bleed; two, them
 * full-bleed and you in a floating corner you can drag to any of the four, a phone call rather
 * than a meeting; three to six, a
 * two-column grid that fills the height; more, the grid scrolls, so no tile ever shrinks past the
 * point where a face is legible.
 */
export function ParticipantGrid({
  state,
  driver,
  layout,
  pinnedIds,
  localAvatarUrl,
  bottomInset,
  topInset,
  onTilePress,
}: {
  state: CallState;
  driver: CallDriver | null;
  layout: StageLayout;
  pinnedIds: readonly string[];
  localAvatarUrl: string | null;
  /** Height of the control tray, so the last row is never hidden behind it. */
  bottomInset: number;
  /** Depth of the header over the stage, which the floating self-view parks below. */
  topInset: number;
  onTilePress?: (participant: CallParticipant) => void;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) setSize({ width, height });
  };

  const local = state.participants.find((p) => p.isLocal) ?? null;
  const remote = state.participants.filter((p) => !p.isLocal);
  const featuredId = state.dominantSpeakerId;
  const badges = useReactionBadges(state.reactions);

  const tile = (participant: CallParticipant, style: object, compact = false) => (
    <ParticipantTile
      key={participant.id}
      participant={participant}
      driver={driver}
      avatarUrl={participant.isLocal ? localAvatarUrl : null}
      featured={featuredId === participant.id && remote.length > 1}
      pinned={pinnedIds.includes(participant.id)}
      reaction={badges.get(participant.id) ?? null}
      compact={compact}
      style={style}
      onPress={onTilePress}
    />
  );

  const { staged } = layout;
  if (staged) {
    const VideoView = driver?.VideoView;
    const stripBottom = bottomInset + GAP;
    const stageBottom = stripBottom + STRIP_TILE_HEIGHT + GAP;
    return (
      <View style={styles.fill} onLayout={onLayout}>
        <View style={[styles.stage, { bottom: stageBottom }]}>
          {staged.kind === "screen" ? (
            <View style={styles.screen}>
              {VideoView && (
                <VideoView
                  participantId={staged.participant.id}
                  kind="screen"
                  objectFit="contain"
                  mirror={false}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <GlassSurface style={styles.screenPill}>
                <MonitorUp size={13} color="#FFFFFF" />
                <Text style={styles.screenLabel} numberOfLines={1}>
                  {staged.participant.isLocal
                    ? "Your screen"
                    : `${staged.participant.displayName}'s screen`}
                </Text>
              </GlassSurface>
            </View>
          ) : (
            tile(staged.participant, [StyleSheet.absoluteFill, styles.fullBleed])
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.strip, { bottom: stripBottom }]}
          contentContainerStyle={styles.stripContent}
        >
          {layout.strip.map((participant) =>
            tile(participant, { width: STRIP_TILE_WIDTH, height: STRIP_TILE_HEIGHT }, true)
          )}
        </ScrollView>
      </View>
    );
  }

  if (remote.length <= 1) {
    const main = remote[0] ?? local;
    return (
      <GestureHandlerRootView style={styles.fill} onLayout={onLayout}>
        {main && tile(main, [StyleSheet.absoluteFill, styles.fullBleed])}
        {remote.length === 1 && local && size.width > 0 && (
          <DraggablePip
            style={styles.pip}
            bounds={{
              width: size.width,
              height: size.height,
              pipWidth: PIP_WIDTH,
              pipHeight: PIP_HEIGHT,
              top: topInset,
              bottom: bottomInset + PIP_MARGIN,
              side: PIP_MARGIN,
            }}
          >
            {tile(local, styles.pipTile, true)}
          </DraggablePip>
        )}
      </GestureHandlerRootView>
    );
  }

  const everyone = local ? [...remote, local] : remote;
  const columns = 2;
  const rows = Math.ceil(everyone.length / columns);
  const usableHeight = Math.max(0, size.height - bottomInset);
  const tileWidth = (size.width - GAP * (columns - 1)) / columns;
  const fitHeight = (usableHeight - GAP * (rows - 1)) / rows;
  // Below a 4:5 portrait tile the grid scrolls instead of squeezing.
  const minHeight = tileWidth * 1.25;
  const tileHeight = Math.max(fitHeight, minHeight);
  const scrolls = fitHeight < minHeight;

  const grid = (
    <View style={[styles.grid, { gap: GAP, paddingBottom: scrolls ? bottomInset + GAP : 0 }]}>
      {everyone.map((participant) =>
        tile(participant, { width: tileWidth, height: tileHeight }, everyone.length > 4)
      )}
    </View>
  );

  return (
    <View style={styles.fill} onLayout={onLayout}>
      {size.width > 0 &&
        (scrolls ? <ScrollView showsVerticalScrollIndicator={false}>{grid}</ScrollView> : grid)}
    </View>
  );
}

/** Each participant's fresh reaction; re-renders once when the next badge is due to go. */
function useReactionBadges(reactions: CallState["reactions"]) {
  const [now, setNow] = useState(() => Date.now());
  const badges = reactionBadges(reactions, now);
  const expiry = nextBadgeExpiry(badges);
  useEffect(() => {
    setNow(Date.now());
  }, [reactions]);
  useEffect(() => {
    if (expiry === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, expiry - Date.now()) + 20);
    return () => clearTimeout(timer);
  }, [expiry]);
  return badges;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  fullBleed: { borderRadius: 0, borderWidth: 0 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  pip: {
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  pipTile: { flex: 1, borderRadius: 16 },
  stage: { position: "absolute", top: 0, left: 0, right: 0 },
  screen: { ...StyleSheet.absoluteFillObject, backgroundColor: "#000000" },
  screenPill: {
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
  screenLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "500" },
  strip: { position: "absolute", left: 0, right: 0, height: STRIP_TILE_HEIGHT },
  stripContent: { paddingHorizontal: 12, gap: GAP },
});
