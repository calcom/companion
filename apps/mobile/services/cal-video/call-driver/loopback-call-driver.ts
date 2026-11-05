import { appendChatMessage, outgoingChatText } from "../chat-message";
import type {
  CallDriver,
  CallDriverSignals,
  CallState,
  CallVideoViewProps,
  JoinOptions,
  LoopbackJoinGrant,
} from "../types";
import { initialCallState, isCallOver } from "../types";

const SIGNALS: CallDriverSignals = {
  localSpeaking: false,
  remoteSpeaking: false,
  dominantSpeaker: false,
  cameraFlip: false,
  localConnectionQuality: false,
  participantConnection: false,
  speakerToggle: false,
  // Chat echoes locally, so the panel can be exercised without a vendor.
  chat: true,
  recording: false,
  transcription: false,
  screenShare: false,
  participantControls: false,
  reactions: false,
  handRaise: false,
  inputDeviceSwitching: false,
};

function NoVideo(_props: CallVideoViewProps): null {
  return null;
}

/**
 * No vendor, no session, no network. A control plane that issues no real media must be able to
 * say so, and this is what the app shows for it: one tile, your own name, working buttons.
 */
export class LoopbackCallDriver implements CallDriver {
  readonly provider = "loopback";
  readonly signals = SIGNALS;
  readonly VideoView = NoVideo;

  private state: CallState;
  private readonly listeners = new Set<(state: CallState) => void>();
  private destroyed = false;
  private sent = 0;

  constructor(private readonly grant: LoopbackJoinGrant) {
    this.state = { ...initialCallState(grant.capabilities), cameraFacing: null };
  }

  private set(patch: Partial<CallState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.state);
  }

  private guard(): void {
    if (this.destroyed) throw new Error("Call driver destroyed");
  }

  async join(options: JoinOptions): Promise<void> {
    this.guard();
    this.set({
      status: "joined",
      participants: [
        {
          id: this.grant.participantId,
          identityId: this.grant.participantId,
          displayName: this.grant.displayName,
          avatarUrl: this.grant.avatarUrl,
          isLocal: true,
          role: this.grant.role,
          hasAudio: !options.startAudioMuted,
          hasVideo: !options.startVideoMuted && this.grant.capabilities.canPublishVideo,
          isScreenSharing: false,
          isSpeaking: null,
          connection: null,
          handRaisedAt: null,
          screenShareStartedAt: null,
        },
      ],
    });
  }

  async leave(): Promise<void> {
    this.guard();
    if (isCallOver(this.state.status)) return;
    this.set({ status: "left", participants: [] });
  }

  private updateLocal(patch: { hasAudio?: boolean; hasVideo?: boolean }): void {
    this.set({
      participants: this.state.participants.map((p) => (p.isLocal ? { ...p, ...patch } : p)),
    });
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    this.guard();
    this.updateLocal({ hasAudio: enabled });
  }

  async setCameraEnabled(enabled: boolean): Promise<void> {
    this.guard();
    if (enabled && !this.grant.capabilities.canPublishVideo) {
      throw new Error("This participant may not publish video");
    }
    this.updateLocal({ hasVideo: enabled });
  }

  async sendChatMessage(text: string): Promise<void> {
    this.guard();
    if (!this.grant.capabilities.canChat) throw new Error("Chat is unavailable");
    const body = outgoingChatText(text);
    this.sent += 1;
    this.set({
      messages: appendChatMessage(this.state.messages, {
        id: `local:${this.sent}`,
        senderId: this.grant.participantId,
        senderName: this.grant.displayName,
        isLocal: true,
        text: body,
        at: Date.now(),
      }),
    });
  }

  getState(): CallState {
    return this.state;
  }

  subscribe(listener: (state: CallState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }
}
