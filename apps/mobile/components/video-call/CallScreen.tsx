import { Ellipsis, Hand, SwitchCamera, Volume2, Wifi, WifiOff } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { StageLayout } from "@/services/cal-video/layout";
import type {
  CallDriver,
  CallParticipant,
  CallState,
  ReactionEmoji,
} from "@/services/cal-video/types";
import { CaptionsStrip } from "./CaptionsStrip";
import { ControlTray } from "./ControlTray";
import { GlassSurface } from "./GlassSurface";
import { HeaderButton, HeaderButtonGroup } from "./HeaderButton";
import { ParticipantGrid } from "./ParticipantGrid";
import { ReactionBar } from "./ReactionBar";
import { RecordingPill } from "./RecordingPill";

const TRAY_HEIGHT = 56 + 24;
/** Stage padding plus the header buttons and a gap, so a floating tile parks under them. */
const HEADER_CLEARANCE = 4 + 40 + 8;

/**
 * The call itself: video edge to edge, a row of glass buttons at the top right (flip camera,
 * speaker, the meeting's details), the tray floating at the bottom.
 */
export function CallScreen({
  driver,
  state,
  layout,
  pinnedIds,
  localAvatarUrl,
  waitingCount,
  chat,
  reactions,
  notice = null,
  onFlipCamera,
  onSpeaker,
  onInfo,
  onMore,
  onTilePress,
  onToggleMicrophone,
  onToggleCamera,
  onLeave,
}: {
  driver: CallDriver | null;
  state: CallState;
  layout: StageLayout;
  pinnedIds: readonly string[];
  localAvatarUrl: string | null;
  /** People at the door, for a host; a badge on the details button says so. */
  waitingCount: number;
  chat: { unread: number; onPress: () => void } | null;
  /** Reactions and the hand, or `null` where the call cannot carry them. */
  reactions: {
    onReact: (emoji: ReactionEmoji) => void;
    hand: { raised: boolean; onToggle: () => void } | null;
  } | null;
  /** A short line worth a glance, such as a host lowering your hand. */
  notice?: string | null;
  onFlipCamera: () => void;
  onSpeaker: () => void;
  /** The meeting's details: link, people, who can join. */
  onInfo: () => void;
  onMore: () => void;
  onTilePress: (participant: CallParticipant) => void;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const local = state.participants.find((participant) => participant.isLocal);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const connecting = state.status === "joining" || state.status === "idle";
  const reconnecting = state.status === "reconnecting";
  const poorNetwork = state.localConnection === "poor" || state.localConnection === "bad";

  return (
    <View style={styles.root}>
      <View style={[styles.stage, { paddingTop: insets.top + 4 }]}>
        <ParticipantGrid
          state={state}
          driver={driver}
          layout={layout}
          pinnedIds={pinnedIds}
          localAvatarUrl={localAvatarUrl}
          bottomInset={TRAY_HEIGHT + insets.bottom}
          topInset={HEADER_CLEARANCE}
          onTilePress={onTilePress}
        />
      </View>

      <View style={[styles.header, { top: insets.top + 8 }]} pointerEvents="box-none">
        <RecordingPill status={state.recording.status} />
        <HeaderButtonGroup>
          <HeaderButton
            icon={SwitchCamera}
            label="Flip camera"
            disabled={!driver?.signals.cameraFlip || !local?.hasVideo}
            onPress={onFlipCamera}
          />
          <HeaderButton
            icon={Volume2}
            label="Speaker"
            disabled={!driver?.signals.speakerToggle}
            onPress={onSpeaker}
          />
          <HeaderButton
            icon={Ellipsis}
            label="Meeting details"
            badge={waitingCount}
            onPress={onInfo}
          />
        </HeaderButtonGroup>
      </View>

      {(connecting || reconnecting || poorNetwork || notice) && (
        <View style={[styles.banner, { top: insets.top + 56 }]} pointerEvents="none">
          <GlassSurface style={styles.bannerPill}>
            {connecting || reconnecting || poorNetwork ? (
              reconnecting || poorNetwork ? (
                <WifiOff size={13} color="#FFD60A" />
              ) : (
                <Wifi size={13} color="#FFFFFF" />
              )
            ) : (
              <Hand size={13} color="#FFD60A" />
            )}
            <Text style={styles.bannerText}>
              {connecting
                ? "Connecting…"
                : reconnecting
                  ? "Reconnecting… Your audio and video are paused."
                  : poorNetwork
                    ? "Poor connection"
                    : notice}
            </Text>
          </GlassSurface>
        </View>
      )}

      {state.captions.status !== "off" && (
        <View
          style={[styles.captions, { bottom: TRAY_HEIGHT + insets.bottom + 16 }]}
          pointerEvents="none"
        >
          <CaptionsStrip lines={state.captions.lines} />
        </View>
      )}

      {reactions && reactionsOpen && (
        <View style={[styles.reactions, { bottom: TRAY_HEIGHT + insets.bottom + 8 }]}>
          <ReactionBar
            onReact={(emoji) => {
              reactions.onReact(emoji);
              setReactionsOpen(false);
            }}
            hand={reactions.hand}
          />
        </View>
      )}

      <View style={[styles.trayWrap, { paddingBottom: insets.bottom + 12 }]}>
        <ControlTray
          driver={driver}
          state={state}
          chat={chat}
          reactions={
            reactions
              ? { open: reactionsOpen, onPress: () => setReactionsOpen((open) => !open) }
              : null
          }
          onToggleMicrophone={onToggleMicrophone}
          onToggleCamera={onToggleCamera}
          onMore={onMore}
          onLeave={onLeave}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  stage: { flex: 1 },
  header: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  banner: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  bannerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: "hidden",
  },
  bannerText: { color: "#FFFFFF", fontSize: 12, fontWeight: "500", flexShrink: 1 },
  captions: { position: "absolute", left: 0, right: 0 },
  reactions: { position: "absolute", left: 16, right: 16 },
  trayWrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 12 },
});
