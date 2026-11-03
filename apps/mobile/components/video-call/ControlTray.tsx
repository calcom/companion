import {
  MessageCircle,
  Mic,
  MicOff,
  MoreHorizontal,
  PhoneOff,
  Video,
  VideoOff,
} from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import type { CallDriver, CallState } from "@/services/cal-video/types";
import { TrayButton } from "./TrayButton";

/**
 * The controls that are always within thumb's reach: microphone, camera, chat, everything else,
 * leave. Every control is gated the same way as on the web: the grant says whether it may be
 * offered here, the driver says whether the transport can carry it, the state says what it is
 * set to. Leave is deliberately outside the `disabled` guard: while stuck reconnecting, leaving is
 * the one thing you certainly still want to do.
 */
export function ControlTray({
  driver,
  state,
  chat,
  onToggleMicrophone,
  onToggleCamera,
  onMore,
  onLeave,
}: {
  driver: CallDriver | null;
  state: CallState;
  /** `null` where chat is not on offer, decided by the shell from the grant and the driver. */
  chat: { unread: number; onPress: () => void } | null;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onMore: () => void;
  onLeave: () => void;
}) {
  const local = state.participants.find((p) => p.isLocal);
  const inCall = driver !== null && (state.status === "joined" || state.status === "reconnecting");
  const microphoneOn = Boolean(local?.hasAudio);
  const cameraOn = Boolean(local?.hasVideo);

  return (
    <View style={styles.tray}>
      <TrayButton
        icon={microphoneOn ? Mic : MicOff}
        label={microphoneOn ? "Mute" : "Unmute"}
        active={!microphoneOn}
        disabled={!inCall}
        onPress={onToggleMicrophone}
      />
      {state.capabilities.canPublishVideo && (
        <TrayButton
          icon={cameraOn ? Video : VideoOff}
          label={cameraOn ? "Turn camera off" : "Turn camera on"}
          active={!cameraOn}
          disabled={!inCall}
          onPress={onToggleCamera}
        />
      )}
      {chat && (
        <TrayButton
          icon={MessageCircle}
          label="Chat"
          badge={chat.unread}
          disabled={!inCall}
          onPress={chat.onPress}
        />
      )}
      <TrayButton icon={MoreHorizontal} label="More options" disabled={!inCall} onPress={onMore} />
      <TrayButton icon={PhoneOff} label="Leave" tone="destructive" onPress={onLeave} />
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
  },
});
