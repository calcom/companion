/**
 * Cal Video's provider-neutral contract, mirrored from the web app's `@calcom/video` adapter.
 *
 * The room API hands the client a `JoinGrant` that names a transport and, for an SFU, a provider
 * and that provider's session credentials. The UI never touches a vendor SDK: it talks to a
 * `CallDriver` built from the grant, so swapping Cloudflare RealtimeKit for Daily (or the next
 * provider) is one driver file and one arm in `createCallDriver`.
 */
import type { ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";

/** Adding a provider means adding one key here; every exhaustive switch stops compiling until wired. */
export interface SessionByProvider {
  daily: { roomUrl: string; meetingToken: string };
  realtimekit: {
    baseUrl: string;
    meetingId: string;
    authToken: string;
    hostPresetName: string;
    videoQuality?: "qvga" | "vga" | "hd" | "fhd" | "uhd";
  };
}

export type VideoProvider = keyof SessionByProvider;
export type ParticipantRole = "host" | "participant";
export type TransportKind = "sfu" | "loopback";

export interface GrantedCapabilities {
  canRecord: boolean;
  canTranscribe: boolean;
  canScreenShare: boolean;
  canPublishVideo: boolean;
  canChat: boolean;
  canAdmit: boolean;
  canEndForEveryone: boolean;
  canRemoveParticipant: boolean;
  maxParticipants: number;
}

export interface JoinGrantCommon {
  sessionId: string;
  roomId: string;
  participantId: string;
  displayName: string;
  avatarUrl: string | null;
  role: ParticipantRole;
  capabilities: GrantedCapabilities;
  /** Epoch seconds; bounds joining, not staying. */
  expiresAt: number;
  /** Epoch seconds of the hard stop for everyone. */
  sessionEndsAt: number;
  /** Signed proof of `role`, sent back for host actions and the leave beacon. */
  controlToken: string;
  /** Which chat this session runs: the provider's, or Cal Video's own durable one. */
  chat?: "provider" | "cal";
}

export type SfuJoinGrant = {
  [P in VideoProvider]: JoinGrantCommon & {
    transport: "sfu";
    provider: P;
    session: SessionByProvider[P];
  };
}[VideoProvider];

export type LoopbackJoinGrant = JoinGrantCommon & { transport: "loopback" };

export type JoinGrant = SfuJoinGrant | LoopbackJoinGrant;

// ---------------------------------------------------------------------------------------------
// Call driver
// ---------------------------------------------------------------------------------------------

/** `left`, `removed` and `ended` are siblings: three different things that happened to you. */
export type CallStatus =
  | "idle"
  | "joining"
  | "joined"
  | "reconnecting"
  | "left"
  | "removed"
  | "ended"
  | "error";

const OVER: ReadonlySet<CallStatus> = new Set<CallStatus>(["left", "removed", "ended"]);

export function isCallOver(status: CallStatus): boolean {
  return OVER.has(status);
}

export type ParticipantConnection = "connected" | "interrupted";
export type LocalConnectionQuality = "good" | "poor" | "bad";
export type CameraFacing = "front" | "back";

export interface CallParticipant {
  /** The connection; a provider may mint a fresh one on reconnect. */
  id: string;
  /** Who this is across connections, or `null` when the driver cannot tell. */
  identityId: string | null;
  displayName: string;
  /** Published by the participant's own client, so untrusted: only render Cal-hosted URLs. */
  avatarUrl: string | null;
  isLocal: boolean;
  role: ParticipantRole;
  hasAudio: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  /** `null` means this driver cannot measure, which is not the same as silent. */
  isSpeaking: boolean | null;
  connection: ParticipantConnection | null;
  /** When they raised their hand, epoch ms, or `null` while it is down or without `signals.handRaise`. */
  handRaisedAt: number | null;
  /** When their current share started, epoch ms, or `null` while not sharing or unknown. */
  screenShareStartedAt: number | null;
}

export interface CallError {
  code: string;
  message: string;
  transient: boolean;
  providerReason?: string;
}

/**
 * One line of in-meeting chat, as this device holds it. `senderName` is resolved from the roster
 * when the message arrives, never taken from the payload.
 */
export interface ChatMessage {
  /** Local to this device; a received id is prefixed with the sender's connection id. */
  id: string;
  /** `CallParticipant.id` at the moment the message arrived. */
  senderId: string;
  senderName: string;
  isLocal: boolean;
  text: string;
  /** Epoch ms on this device's clock. */
  at: number;
}

/** UTF-16 units, the same cap as the web so a message legible there is legible here. */
export const CHAT_MESSAGE_MAX_LENGTH = 1000;

/** The six reactions a participant can send; the same set chat message reactions use. */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🎉"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export function isReactionEmoji(value: string): value is ReactionEmoji {
  return (REACTION_EMOJIS as readonly string[]).includes(value);
}

/** One emoji reaction as this device saw it arrive: shown for a few seconds, never stored. */
export interface Reaction {
  id: string;
  participantId: string;
  emoji: ReactionEmoji;
  count: number;
  at: number;
}

/** A control the provider confirms asynchronously. */
export type ToggleStatus = "off" | "starting" | "on" | "stopping";

export interface CaptionLine {
  id: string;
  participantId: string;
  participantName: string;
  text: string;
  final: boolean;
  at: number;
}

export interface CallState {
  status: CallStatus;
  /** Includes the local participant, so the UI has one list to render. */
  participants: CallParticipant[];
  capabilities: GrantedCapabilities;
  /** The one participant the SFU nominates to feature, or `null`. */
  dominantSpeakerId: string | null;
  localConnection: LocalConnectionQuality | null;
  cameraFacing: CameraFacing | null;
  error: CallError | null;
  /** Everything seen since joining, oldest first, bounded. Empty forever without `signals.chat`. */
  messages: ChatMessage[];
  /** Provider-side retention, independent of the bounded local buffer. */
  chatRetentionDays?: number;
  /** As the provider reports it to everyone in the call. Always `off` without `signals.recording`. */
  recording: { status: ToggleStatus; error: CallError | null };
  /** Live transcription, when the driver carries it. */
  captions: { status: ToggleStatus; lines: CaptionLine[] };
  /** The connections a host pinned for everyone. Empty without `signals.participantControls`. */
  sharedPinIds: readonly string[];
  /** Recent reactions, yours included, oldest first. Empty without `signals.reactions`. */
  reactions: Reaction[];
  /** When a host last lowered your raised hand, or `null`. */
  handLoweredByHostAt: number | null;
}

export interface JoinOptions {
  startAudioMuted: boolean;
  startVideoMuted: boolean;
}

export type MediaKind = "video" | "screen";

export interface CallVideoViewProps {
  participantId: string;
  kind: MediaKind;
  mirror?: boolean;
  objectFit?: "cover" | "contain";
  style?: StyleProp<ViewStyle>;
}

/** What the transport can physically observe or do; not an entitlement. */
export interface CallDriverSignals {
  readonly localSpeaking: boolean;
  readonly remoteSpeaking: boolean;
  readonly dominantSpeaker: boolean;
  readonly cameraFlip: boolean;
  readonly localConnectionQuality: boolean;
  readonly participantConnection: boolean;
  readonly speakerToggle: boolean;
  /** Whether `sendChatMessage` exists and `CallState.messages` can ever be non-empty. */
  readonly chat: boolean;
  /** Whether `startRecording`/`stopRecording` exist and `CallState.recording` ever leaves `off`. */
  readonly recording: boolean;
  /** Whether `startTranscription`/`stopTranscription` exist. */
  readonly transcription: boolean;
  /** Whether `setScreenShareEnabled` can publish this device's screen. */
  readonly screenShare: boolean;
  /** Whether `muteParticipant`, `stopParticipantScreenShare` and `setSharedPin` exist. */
  readonly participantControls: boolean;
  /** Whether `sendReaction` exists. */
  readonly reactions: boolean;
  /** Whether `setHandRaised` and `lowerHand` exist. */
  readonly handRaise: boolean;
  /** Whether `getInputDevices` and `setInputDevice` switch hardware. */
  readonly inputDeviceSwitching: boolean;
}

export type InputDeviceKind = "audioinput" | "videoinput";
export interface InputDevice {
  deviceId: string;
  label: string;
  /** Which way a camera faces, where the platform says. */
  facing?: "front" | "environment";
}

/** What a driver may need from outside the SDK: the room API, which the UI already knows. */
export interface CallDriverOptions {
  /** Host-only recording, which the server starts and stops on the provider's behalf. */
  recordingControls?: { start(): Promise<void>; stop(): Promise<void> };
}

export interface CallDriver {
  readonly provider: string;
  readonly signals: CallDriverSignals;

  join(options: JoinOptions): Promise<void>;
  leave(): Promise<void>;

  setMicrophoneEnabled(enabled: boolean): Promise<void>;
  /** MUST reject turning the camera on when the grant has `canPublishVideo: false`. */
  setCameraEnabled(enabled: boolean): Promise<void>;
  /** Present exactly when `signals.cameraFlip` is true. */
  flipCamera?(): Promise<void>;
  /** Present exactly when `signals.speakerToggle` is true: loudspeaker vs earpiece. */
  setSpeakerphoneEnabled?(enabled: boolean): Promise<void>;
  /** Present exactly when `signals.screenShare` is true. */
  setScreenShareEnabled?(enabled: boolean): Promise<void>;

  /**
   * Present exactly when `signals.chat` is true. MUST reject an empty or over-length message and
   * MUST land the sender's own copy in `CallState.messages`.
   */
  sendChatMessage?(text: string): Promise<void>;

  /** Present as a pair exactly when `signals.recording` is true. */
  startRecording?(): Promise<void>;
  stopRecording?(): Promise<void>;

  /** Present as a pair exactly when `signals.transcription` is true. */
  startTranscription?(): Promise<void>;
  stopTranscription?(): Promise<void>;

  /** Present as a trio exactly when `signals.participantControls` is true. Host only. */
  muteParticipant?(participantId: string): Promise<void>;
  stopParticipantScreenShare?(participantId: string): Promise<void>;
  setSharedPin?(participantId: string, pinned: boolean): Promise<void>;

  /** Present exactly when `signals.reactions` is true. */
  sendReaction?(emoji: ReactionEmoji): Promise<void>;

  /** Present as a pair exactly when `signals.handRaise` is true. */
  setHandRaised?(raised: boolean): Promise<void>;
  lowerHand?(participantId: string | "all"): Promise<void>;

  /** Present as a pair exactly when `signals.inputDeviceSwitching` is true. */
  getInputDevices?(kind: InputDeviceKind): Promise<InputDevice[]>;
  setInputDevice?(kind: InputDeviceKind, deviceId: string): Promise<void>;

  /**
   * Renders one participant's video. A component rather than a track getter, because track
   * lifecycle is what differs most between vendors: each driver owns its own view.
   */
  readonly VideoView: ComponentType<CallVideoViewProps>;

  /** Exactly the `useSyncExternalStore` contract. */
  getState(): CallState;
  subscribe(listener: (state: CallState) => void): () => void;

  /** After this every method rejects. Separate from `leave` so an unmount can tear down. */
  destroy(): void;
}

/** The state every driver starts from, so the UI never special-cases "no driver yet". */
export function initialCallState(capabilities: GrantedCapabilities): CallState {
  return {
    status: "idle",
    participants: [],
    capabilities,
    dominantSpeakerId: null,
    localConnection: null,
    cameraFacing: "front",
    error: null,
    messages: [],
    recording: { status: "off", error: null },
    captions: { status: "off", lines: [] },
    sharedPinIds: [],
    reactions: [],
    handLoweredByHostAt: null,
  };
}

export class CalVideoError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CalVideoError";
    this.code = code;
  }
}
