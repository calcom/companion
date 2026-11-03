import {
  MediaStream,
  type MediaStreamTrack as NativeTrack,
  RTCView,
} from "@cloudflare/react-native-webrtc";
import type RealtimeKitClient from "@cloudflare/realtimekit";
import type {
  ChatUpdateParams,
  LeaveRoomState,
  RecordingState,
  RTKParticipant,
  RTKSelf,
  SocketConnectionState,
} from "@cloudflare/realtimekit";

/** What `meeting.ai` emits per line; the core SDK does not export the type. */
type TranscriptionData = {
  id: string;
  name: string;
  peerId: string;
  transcript: string;
  isPartialTranscript: boolean;
};

import Constants from "expo-constants";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { Platform, StyleSheet } from "react-native";
import { z } from "zod";
import { safeLogWarn } from "@/utils/safeLogger";
import { appendCaption } from "../captions";
import { appendChatMessage, outgoingChatText } from "../chat-message";
import { appendReaction } from "../reactions";
import {
  decodeSignal,
  encodeSignal,
  type OutgoingSignal,
  RTK_SIGNAL_TYPE,
  type RtkSignal,
} from "../rtk-signals";
import { canPublishScreen } from "../screen-share-support";
import type {
  CallDriver,
  CallDriverOptions,
  CallDriverSignals,
  CallParticipant,
  CallState,
  CallStatus,
  CallVideoViewProps,
  InputDevice,
  InputDeviceKind,
  JoinOptions,
  ReactionEmoji,
  SfuJoinGrant,
  ToggleStatus,
} from "../types";
import { CHAT_MESSAGE_MAX_LENGTH, initialCallState, isCallOver } from "../types";

type RealtimeKitGrant = Extract<SfuJoinGrant, { provider: "realtimekit" }>;
type Peer = RTKSelf | RTKParticipant;

/** The only API host a grant may point at; anything else is a forged or stale grant. */
const REALTIMEKIT_API = "https://api.realtime.cloudflare.com";

/** A device as React Native WebRTC enumerates it: the browser shape plus which way it faces. */
type NativeDevice = MediaDeviceInfo & { facing?: "front" | "environment" };

const textMessageSchema = z.object({
  type: z.literal("text"),
  id: z.string().min(1).max(200),
  userId: z.string().min(1),
  message: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
});

const RECORDING_STATUS: Record<RecordingState, ToggleStatus> = {
  IDLE: "off",
  STARTING: "starting",
  RECORDING: "on",
  PAUSED: "on",
  STOPPING: "stopping",
};

/**
 * The core SDK types tracks as the DOM `MediaStreamTrack`; on React Native they are the fork's
 * class, which is what `MediaStream` and `RTCView` accept. One cast, here, for both facts.
 */
function liveTrack(track: { readyState: string } | undefined | null): NativeTrack | null {
  return track && track.readyState === "live" ? (track as unknown as NativeTrack) : null;
}

function statusForLeave(state: LeaveRoomState): CallStatus {
  if (state === "kicked") return "removed";
  if (state === "ended") return "ended";
  if (state === "left") return "left";
  return "error";
}

/**
 * Cloudflare RealtimeKit over the SDK's own React Native fork of `react-native-webrtc`.
 *
 * The RN package is imported for its side effects as much as its export: loading it registers
 * the WebRTC globals and the native media handler the core client looks for on `navigator`.
 * The core client (`@cloudflare/realtimekit`) is only ever reached through that default export.
 *
 * Signals mirror the web driver's: chat and recording are real; reactions, hands and shared pins
 * ride the broadcast channel with the sender named in the payload (see `rtk-signals`), since the
 * SDK delivers a broadcast without one. Shared pins and host mutes are the SDK's own. Screen
 * share publishing needs the app's broadcast extension; viewing a share always works.
 */
export class RealtimeKitCallDriver implements CallDriver {
  readonly provider = "realtimekit";
  readonly VideoView: (props: CallVideoViewProps) => React.JSX.Element | null;

  private meeting: RealtimeKitClient | null = null;
  private state: CallState;
  private readonly listeners = new Set<(state: CallState) => void>();
  private readonly cleanup: Array<() => void> = [];
  private destroyed = false;
  private leaving: Promise<void> | null = null;
  /** Raised hands by peer id, as announced on the broadcast channel. */
  private hands = new Map<string, number>();
  private reactionSeq = 0;

  constructor(
    private readonly grant: RealtimeKitGrant,
    private readonly options: CallDriverOptions = {}
  ) {
    this.state = { ...initialCallState(grant.capabilities), chatRetentionDays: 7 };

    const driver = this;
    // Defined per instance so the component closes over this meeting and nothing else.
    this.VideoView = function RealtimeKitVideoView({
      participantId,
      kind,
      mirror,
      objectFit = "cover",
      style,
    }: CallVideoViewProps) {
      // Re-render on every state change: the SDK swaps track objects as a camera turns on and off.
      useSyncExternalStore(driver.subscribe, driver.getState, driver.getState);
      const peer = driver.peerById(participantId);
      const isLocal = peer ? driver.isSelf(peer) : false;
      const enabled = kind === "screen" ? peer?.screenShareEnabled : peer?.videoEnabled;
      const raw = kind === "screen" ? peer?.screenShareTracks?.video : peer?.videoTrack;
      const track = enabled ? liveTrack(raw) : null;
      // One stream per track: a new MediaStream for the same track every render would flicker.
      const stream = useMemo(() => (track ? new MediaStream([track]) : null), [track]);
      useEffect(() => {
        return () => {
          try {
            stream?.release?.(false);
          } catch {
            // Already released.
          }
        };
      }, [stream]);
      if (!stream) return null;
      return (
        <RTCView
          streamURL={stream.toURL()}
          mirror={mirror ?? (isLocal && kind === "video" && driver.state.cameraFacing === "front")}
          objectFit={objectFit}
          zOrder={isLocal ? 1 : 0}
          style={StyleSheet.flatten(style)}
        />
      );
    };
  }

  get signals(): CallDriverSignals {
    return {
      localSpeaking: false,
      remoteSpeaking: false,
      dominantSpeaker: true,
      cameraFlip: true,
      localConnectionQuality: false,
      participantConnection: false,
      speakerToggle: true,
      chat: true,
      recording: this.options.recordingControls !== undefined,
      // Transcripts are shown when the meeting carries them; starting them is the preset's call.
      transcription: false,
      // Android captures through the SDK's foreground service. iOS needs the Broadcast Upload
      // Extension (targets/screenshare), which the build declares in Info.plist.
      screenShare:
        this.grant.capabilities.canScreenShare &&
        canPublishScreen({
          platform: Platform.OS,
          infoPlist: Constants.expoConfig?.ios?.infoPlist,
        }),
      // Pins, mutes and removal are host preset rights; the SDK refuses them for anyone else.
      participantControls: this.grant.role === "host",
      reactions: true,
      handRaise: true,
      inputDeviceSwitching: true,
    };
  }

  // --- State -----------------------------------------------------------------------------------

  private set(patch: Partial<CallState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  private guard(): RealtimeKitClient {
    if (this.destroyed) throw new Error("Call driver destroyed");
    if (!this.meeting) throw new Error("Not in a call");
    return this.meeting;
  }

  private isSelf(peer: Peer): boolean {
    return peer.id === this.meeting?.self.id;
  }

  private peers(): Peer[] {
    const meeting = this.meeting;
    if (!meeting) return [];
    const self = meeting.self;
    return [self, ...meeting.participants.joined.toArray().filter((p) => p.id !== self.id)];
  }

  private peerById(id: string): Peer | undefined {
    return this.peers().find((peer) => peer.id === id);
  }

  private toParticipant(peer: Peer): CallParticipant {
    const isLocal = this.isSelf(peer);
    const role = isLocal
      ? this.grant.role
      : peer.presetName === this.grant.session.hostPresetName
        ? "host"
        : "participant";
    const isScreenSharing = Boolean(
      peer.screenShareEnabled && liveTrack(peer.screenShareTracks?.video)
    );
    const previous = this.state.participants.find((p) => p.id === peer.id);
    return {
      id: peer.id,
      identityId: peer.customParticipantId || null,
      displayName: peer.name || "Guest",
      // Published by the peer's own client; the tile only renders Cal-hosted URLs.
      avatarUrl: peer.picture || null,
      isLocal,
      role,
      // Coerced: a remote peer answers `undefined` for a flag it has never set.
      hasAudio: Boolean(peer.audioEnabled && liveTrack(peer.audioTrack)),
      hasVideo: Boolean(peer.videoEnabled && liveTrack(peer.videoTrack)),
      isScreenSharing,
      isSpeaking: null,
      connection: null,
      handRaisedAt: this.hands.get(peer.id) ?? null,
      // Dated when this device first saw the share: the SDK publishes no start of its own.
      screenShareStartedAt: isScreenSharing ? (previous?.screenShareStartedAt ?? Date.now()) : null,
    };
  }

  private syncParticipants = (): void => {
    if (!this.meeting || this.destroyed) return;
    const peers = this.peers();
    const ids = new Set(peers.map((peer) => peer.id));
    // A hand leaves with its owner; the channel never says so itself.
    for (const id of [...this.hands.keys()]) if (!ids.has(id)) this.hands.delete(id);
    const participants = peers.map((peer) => this.toParticipant(peer));
    this.set({
      participants,
      sharedPinIds: peers.filter((peer) => peer.isPinned).map((peer) => peer.id),
      dominantSpeakerId: ids.has(this.state.dominantSpeakerId ?? "")
        ? this.state.dominantSpeakerId
        : null,
    });
  };

  // --- SDK events -------------------------------------------------------------------------------

  private bindEvents(meeting: RealtimeKitClient): void {
    const joined = meeting.participants.joined;
    for (const event of [
      "participantJoined",
      "participantLeft",
      "participantsCleared",
      "participantsUpdate",
      "audioUpdate",
      "videoUpdate",
      "screenShareUpdate",
      "pinned",
      "unpinned",
    ] as const) {
      joined.on(event, this.syncParticipants);
      this.cleanup.push(() => joined.off(event, this.syncParticipants));
    }
    for (const event of [
      "audioUpdate",
      "videoUpdate",
      "screenShareUpdate",
      "deviceUpdate",
      "pinned",
      "unpinned",
    ] as const) {
      meeting.self.on(event, this.syncParticipants);
      this.cleanup.push(() => meeting.self.off(event, this.syncParticipants));
    }
    meeting.self.on("roomLeft", this.onRoomLeft);
    meeting.self.on("roomJoined", this.onRoomJoined);
    meeting.meta.on("socketConnectionUpdate", this.onSocketState);
    meeting.participants.on("activeSpeaker", this.onActiveSpeaker);
    meeting.participants.on("broadcastedMessage", this.onBroadcast);
    meeting.chat.on("chatUpdate", this.onChatUpdate);
    meeting.recording.on("recordingUpdate", this.onRecordingUpdate);
    meeting.ai.on("transcript", this.onTranscript);
    this.cleanup.push(
      () => meeting.ai.off("transcript", this.onTranscript),
      () => meeting.self.off("roomLeft", this.onRoomLeft),
      () => meeting.self.off("roomJoined", this.onRoomJoined),
      () => meeting.meta.off("socketConnectionUpdate", this.onSocketState),
      () => meeting.participants.off("activeSpeaker", this.onActiveSpeaker),
      () => meeting.participants.off("broadcastedMessage", this.onBroadcast),
      () => meeting.chat.off("chatUpdate", this.onChatUpdate),
      () => meeting.recording.off("recordingUpdate", this.onRecordingUpdate)
    );
  }

  private unbindEvents(): void {
    for (const off of this.cleanup.splice(0)) {
      try {
        off();
      } catch {
        // Listener already gone.
      }
    }
  }

  private onRoomLeft = ({ state }: { state: LeaveRoomState }): void => {
    if (this.destroyed || isCallOver(this.state.status)) return;
    // The SDK's recoverable drop: it rejoins on its own and says so with `roomJoined`.
    if (state === "disconnected") {
      if (this.state.status === "joined") this.set({ status: "reconnecting" });
      return;
    }
    const status = statusForLeave(state);
    this.unbindEvents();
    this.meeting?.self.cleanUpTracks();
    this.set({
      status,
      participants: [],
      dominantSpeakerId: null,
      error:
        status === "error"
          ? {
              code: "connection-failed",
              message: "The connection to the meeting was lost.",
              transient: true,
              providerReason: `roomLeft:${state}`,
            }
          : null,
    });
  };

  private onRoomJoined = ({ reconnected }: { reconnected: boolean }): void => {
    if (this.destroyed || !reconnected) return;
    this.set({ status: "joined" });
    this.syncParticipants();
  };

  private onSocketState = ({ state }: SocketConnectionState): void => {
    if (this.destroyed) return;
    if (state === "connected" && this.state.status === "reconnecting")
      this.set({ status: "joined" });
    if ((state === "reconnecting" || state === "disconnected") && this.state.status === "joined") {
      this.set({ status: "reconnecting" });
    }
    if (state === "failed") this.onRoomLeft({ state: "failed" });
  };

  private onActiveSpeaker = ({ peerId }: { peerId: string }): void => {
    if (this.destroyed) return;
    this.set({
      dominantSpeakerId: this.state.participants.some((p) => p.id === peerId) ? peerId : null,
    });
  };

  // --- Hands and reactions over the broadcast channel ----------------------------------------

  private broadcast(signal: OutgoingSignal): Promise<void> {
    const meeting = this.meeting;
    if (!meeting) return Promise.reject(new Error("Not in a call"));
    const payload = encodeSignal({ ...signal, from: meeting.self.id } as RtkSignal);
    return meeting.participants.broadcastMessage(RTK_SIGNAL_TYPE, payload).catch((error) => {
      safeLogWarn("[CalVideo] broadcast failed", { kind: signal.kind, error: String(error) });
      throw error;
    });
  }

  private onBroadcast = ({ type, payload }: { type: string; payload: unknown }): void => {
    const meeting = this.meeting;
    if (!meeting || this.destroyed) return;
    const knownIds = new Set(this.peers().map((peer) => peer.id));
    const signal = decodeSignal({ type, payload, knownIds });
    if (!signal) return;
    switch (signal.kind) {
      case "hand":
        if (signal.raisedAt === null) this.hands.delete(signal.from);
        else this.hands.set(signal.from, signal.raisedAt);
        this.syncParticipants();
        return;
      case "reaction":
        this.reactionSeq += 1;
        this.set({
          reactions: appendReaction(this.state.reactions, {
            id: `${signal.from}:${this.reactionSeq}`,
            participantId: signal.from,
            emoji: signal.emoji,
            count: signal.count,
            at: Date.now(),
          }),
        });
        return;
      case "lower-hand": {
        // Only a host's word lowers hands; anyone can claim to be one, so the roster decides.
        const sender = this.state.participants.find((p) => p.id === signal.from);
        if (sender?.role !== "host" || sender.isLocal) return;
        const selfId = meeting.self.id;
        const mine = signal.target === "all" || signal.target === selfId;
        if (mine && this.hands.has(selfId)) {
          this.hands.delete(selfId);
          this.set({ handLoweredByHostAt: Date.now() });
          void this.broadcast({ kind: "hand", raisedAt: null }).catch(() => undefined);
        } else if (signal.target !== "all") {
          this.hands.delete(signal.target);
        } else {
          this.hands.clear();
        }
        this.syncParticipants();
        return;
      }
      case "sync": {
        // A newcomer asks; those with a hand up say so again.
        const raisedAt = this.hands.get(meeting.self.id);
        if (raisedAt !== undefined) {
          void this.broadcast({ kind: "hand", raisedAt }).catch(() => undefined);
        }
        return;
      }
    }
  };

  async sendReaction(emoji: ReactionEmoji): Promise<void> {
    const meeting = this.meeting;
    if (!meeting) throw new Error("Not in a call");
    this.reactionSeq += 1;
    this.set({
      reactions: appendReaction(this.state.reactions, {
        id: `${meeting.self.id}:${this.reactionSeq}`,
        participantId: meeting.self.id,
        emoji,
        count: 1,
        at: Date.now(),
      }),
    });
    await this.broadcast({ kind: "reaction", emoji, count: 1 });
  }

  async setHandRaised(raised: boolean): Promise<void> {
    const meeting = this.meeting;
    if (!meeting) throw new Error("Not in a call");
    const selfId = meeting.self.id;
    const previous = this.hands.get(selfId);
    const raisedAt = raised ? Date.now() : null;
    if (raisedAt === null) this.hands.delete(selfId);
    else this.hands.set(selfId, raisedAt);
    this.syncParticipants();
    try {
      await this.broadcast({ kind: "hand", raisedAt });
    } catch (error) {
      // Nobody heard it, so the tile must not claim otherwise.
      if (previous === undefined) this.hands.delete(selfId);
      else this.hands.set(selfId, previous);
      this.syncParticipants();
      throw error;
    }
  }

  async lowerHand(participantId: string | "all"): Promise<void> {
    const meeting = this.meeting;
    if (!meeting) throw new Error("Not in a call");
    if (participantId === "all") this.hands.clear();
    else this.hands.delete(participantId);
    this.syncParticipants();
    await this.broadcast({ kind: "lower-hand", target: participantId });
  }

  async setSharedPin(participantId: string, pinned: boolean): Promise<void> {
    const peer = this.peerById(participantId);
    if (!peer) throw new Error("No such participant");
    if (pinned) await peer.pin();
    else await peer.unpin();
    this.syncParticipants();
  }

  async muteParticipant(participantId: string): Promise<void> {
    const meeting = this.meeting;
    if (!meeting) throw new Error("Not in a call");
    await meeting.participants.disableAudio(participantId);
  }

  private onChatUpdate = (event: ChatUpdateParams): void => {
    const meeting = this.meeting;
    if (!meeting || this.destroyed) return;
    // The SDK keeps every message; this driver keeps its own bounded copy.
    meeting.chat.messages.splice(0, Math.max(0, meeting.chat.messages.length - 200));
    if (!this.grant.capabilities.canChat || event.action !== "add") return;
    const parsed = textMessageSchema.safeParse(event.message);
    if (!parsed.success) return;
    const message = parsed.data;
    const id = `${message.userId}:${message.id}`;
    if (this.state.messages.some((existing) => existing.id === id)) return;
    const sender = this.peers().find((p) => p.userId === message.userId || p.id === message.userId);
    if (!sender) return;
    this.set({
      messages: appendChatMessage(this.state.messages, {
        id,
        senderId: sender.id,
        senderName: sender.name || "Guest",
        isLocal: sender.id === meeting.self.id,
        text: message.message,
        at: Date.now(),
      }),
    });
  };

  /** A live transcript line; its interim form is replaced in place until it is final. */
  private onTranscript = (transcript: TranscriptionData): void => {
    if (this.destroyed || !transcript.transcript) return;
    const peer = this.peerById(transcript.peerId);
    const lines = appendCaption(this.state.captions.lines, {
      id: `${transcript.peerId}:${transcript.id}`,
      participantId: transcript.peerId,
      participantName: peer?.name || transcript.name || "Guest",
      text: transcript.transcript,
      final: !transcript.isPartialTranscript,
      at: Date.now(),
    });
    this.set({ captions: { status: "on", lines } });
  };

  private onRecordingUpdate = (state: RecordingState): void => {
    if (this.destroyed) return;
    this.set({ recording: { status: RECORDING_STATUS[state] ?? "off", error: null } });
  };

  // --- CallDriver -------------------------------------------------------------------------------

  async join(options: JoinOptions): Promise<void> {
    if (this.destroyed) throw new Error("Call driver destroyed");
    if (this.meeting) return;
    this.set({ status: "joining", error: null });

    let meeting: RealtimeKitClient | null = null;
    try {
      if (
        this.grant.expiresAt <= Date.now() / 1000 ||
        this.grant.session.baseUrl !== REALTIMEKIT_API
      ) {
        throw new Error("Meeting admission is invalid or expired");
      }
      // The RN package, not the core: importing it installs the native media handler.
      const { default: Client } = await import("@cloudflare/realtimekit-react-native");
      if (this.destroyed) return;
      meeting = await Client.init({
        authToken: this.grant.session.authToken,
        // No `baseURI`: the grant's host is pinned above and the SDK's default is that same API.
        // Devices come on below, after the client exists, so a muted join never flashes the camera.
        defaults: { audio: false, video: false },
        onError: (clientError) => {
          safeLogWarn("[CalVideo] RealtimeKit client error", { error: String(clientError) });
        },
      });
      if (this.destroyed) {
        await meeting.leave().catch(() => undefined);
        return;
      }
      if (
        meeting.meta.meetingId !== this.grant.session.meetingId ||
        meeting.self.customParticipantId !== this.grant.participantId
      ) {
        throw new Error("Meeting credential does not match the grant");
      }
      this.meeting = meeting;
      this.bindEvents(meeting);

      const media: Array<Promise<void>> = [];
      if (!options.startAudioMuted) media.push(meeting.self.enableAudio());
      if (!options.startVideoMuted && this.grant.capabilities.canPublishVideo) {
        media.push(meeting.self.enableVideo());
      }
      // Settled, not raced: a failed microphone must not abort while the camera is still opening.
      const failed = (await Promise.allSettled(media)).find((r) => r.status === "rejected");
      if (failed) {
        safeLogWarn("[CalVideo] RealtimeKit device failed", { error: String(failed.reason) });
      }
      if (this.destroyed) return;
      this.syncParticipants();

      await meeting.join();
      if (this.destroyed) return;
      // A terminal `roomLeft` during join() has already set its status.
      if (this.state.status === "joining") this.set({ status: "joined" });
      this.syncParticipants();
      this.onRecordingUpdate(meeting.recording.recordingState);
      void this.broadcast({ kind: "sync" }).catch(() => undefined);
    } catch (error) {
      safeLogWarn("[CalVideo] RealtimeKit join failed", {
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
      this.unbindEvents();
      this.meeting = null;
      if (meeting) {
        meeting.self.cleanUpTracks();
        await meeting.leave().catch(() => undefined);
      }
      if (this.destroyed) return;
      this.set({
        status: "error",
        participants: [],
        error: {
          code: "join-failed",
          message: error instanceof Error ? error.message : "Could not join the call.",
          transient: false,
        },
      });
    }
  }

  async leave(): Promise<void> {
    if (this.destroyed || isCallOver(this.state.status)) return;
    if (this.leaving) return this.leaving;
    const meeting = this.meeting;
    this.leaving = (async () => {
      this.set({ status: "left", participants: [], dominantSpeakerId: null });
      this.unbindEvents();
      this.meeting = null;
      if (!meeting) return;
      try {
        await meeting.leave();
      } catch (error) {
        safeLogWarn("[CalVideo] RealtimeKit leave failed", { error: String(error) });
      } finally {
        meeting.self.cleanUpTracks();
      }
    })();
    try {
      await this.leaving;
    } finally {
      this.leaving = null;
    }
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    const meeting = this.guard();
    if (enabled) await meeting.self.enableAudio();
    else await meeting.self.disableAudio();
    this.syncParticipants();
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    if (enabled && !this.grant.capabilities.canPublishVideo) {
      throw new Error("This participant may not publish video");
    }
    const meeting = this.guard();
    if (enabled) await meeting.self.enableVideo();
    else await meeting.self.disableVideo();
    this.syncParticipants();
  }

  async flipCamera(): Promise<void> {
    const meeting = this.guard();
    const wanted = this.state.cameraFacing === "front" ? "environment" : "front";
    const devices = (await meeting.self.getVideoDevices()) as NativeDevice[];
    const next = devices.find((device) => device.facing === wanted);
    if (next) {
      await meeting.self.setDevice(next);
    } else {
      // No facing metadata: fall back to the fork's in-place switch on the live track.
      const track = liveTrack(meeting.self.videoTrack) as
        | (NativeTrack & { _switchCamera?: () => void })
        | null;
      track?._switchCamera?.();
    }
    this.set({ cameraFacing: wanted === "front" ? "front" : "back" });
    this.syncParticipants();
  }

  /**
   * The SDK's React Native media handler lists the audio routes as "speaker" devices: the
   * loudspeaker, the earpiece, a wired or Bluetooth headset. Loudspeaker on, else the best
   * non-loudspeaker route it offers.
   */
  async setSpeakerphoneEnabled(enabled: boolean): Promise<void> {
    const meeting = this.guard();
    const devices = (await meeting.self.getSpeakerDevices()) as MediaDeviceInfo[];
    const byId = (id: string) => devices.find((device) => device.deviceId === id);
    const target = enabled
      ? byId("speaker")
      : (byId("bluetooth") ?? byId("wired") ?? byId("earpiece") ?? byId("default"));
    if (!target) throw new Error("No such audio route");
    await meeting.self.setDevice(target);
  }

  /**
   * Publishes this device's screen. Android captures through the SDK's foreground service; iOS
   * raises the system broadcast picker, which needs the app's Broadcast Upload Extension.
   */
  async setScreenShareEnabled(enabled: boolean): Promise<void> {
    if (enabled && !this.grant.capabilities.canScreenShare) {
      throw new Error("Screen sharing is unavailable in this meeting");
    }
    const meeting = this.guard();
    if (enabled) await meeting.self.enableScreenShare();
    else await meeting.self.disableScreenShare();
    this.syncParticipants();
  }

  async getInputDevices(kind: InputDeviceKind): Promise<InputDevice[]> {
    const meeting = this.guard();
    const devices = (await (kind === "audioinput"
      ? meeting.self.getAudioDevices()
      : meeting.self.getVideoDevices())) as NativeDevice[];
    return devices.map((device) => ({
      deviceId: device.deviceId,
      label: device.label || (kind === "audioinput" ? "Microphone" : "Camera"),
      facing: device.facing,
    }));
  }

  async setInputDevice(kind: InputDeviceKind, deviceId: string): Promise<void> {
    const meeting = this.guard();
    const devices = (await (kind === "audioinput"
      ? meeting.self.getAudioDevices()
      : meeting.self.getVideoDevices())) as NativeDevice[];
    const device = devices.find((candidate) => candidate.deviceId === deviceId);
    if (!device) throw new Error("Selected media device is unavailable");
    await meeting.self.setDevice(device);
    if (kind === "videoinput" && device.facing) {
      this.set({ cameraFacing: device.facing === "front" ? "front" : "back" });
    }
    this.syncParticipants();
  }

  async sendChatMessage(text: string): Promise<void> {
    const meeting = this.guard();
    if (!this.grant.capabilities.canChat) throw new Error("Chat is unavailable");
    const body = outgoingChatText(text);
    // RealtimeKit echoes the sender's own message through `chatUpdate` with its server id.
    await meeting.chat.sendTextMessage(body);
  }

  async startRecording(): Promise<void> {
    await this.controlRecording("start");
  }

  async stopRecording(): Promise<void> {
    await this.controlRecording("stop");
  }

  private async controlRecording(action: "start" | "stop"): Promise<void> {
    this.guard();
    const controls = this.options.recordingControls;
    if (!controls || !this.grant.capabilities.canRecord)
      throw new Error("Recording is unavailable");
    const previous = this.state.recording;
    this.set({ recording: { status: action === "start" ? "starting" : "stopping", error: null } });
    const pending = this.state.recording;
    try {
      await controls[action]();
    } catch (error) {
      if (!this.destroyed) {
        this.set({
          recording: {
            ...(this.state.recording === pending ? previous : this.state.recording),
            error: {
              code: "recording-failed",
              message: "Recording could not be updated",
              transient: true,
            },
          },
        });
      }
      throw error;
    }
  }

  getState = (): CallState => this.state;

  subscribe = (listener: (state: CallState) => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.listeners.clear();
    this.unbindEvents();
    const meeting = this.meeting;
    this.meeting = null;
    if (!meeting || this.leaving) return;
    meeting.self.cleanUpTracks();
    void meeting.leave().catch((error: unknown) => {
      safeLogWarn("[CalVideo] RealtimeKit destroy failed", { error: String(error) });
    });
  }
}
