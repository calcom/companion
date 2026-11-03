import * as Clipboard from "expo-clipboard";
import { useKeepAwake } from "expo-keep-awake";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useCalChat } from "@/hooks/useCalChat";
import { useCallDriver } from "@/hooks/useCallDriver";
import { useCalVideoRoom } from "@/hooks/useCalVideoRoom";
import { useChatMutedIds } from "@/hooks/useChatMutedIds";
import { useInviteLink } from "@/hooks/useInviteLink";
import { useProviderChat } from "@/hooks/useProviderChat";
import { useRoomAccess } from "@/hooks/useRoomAccess";
import { useWaitingList } from "@/hooks/useWaitingList";
import { type RoomRef, setRecording } from "@/services/cal-video/api";
import { toCalChatParticipantId } from "@/services/cal-video/cal-chat/participant-id";
import { type LayoutChoice, resolveStage } from "@/services/cal-video/layout";
import { NativeCallSession } from "@/services/cal-video/native-call";
import { resolveRoomScreen } from "@/services/cal-video/room-screen";
import {
  type ParticipantAction,
  participantActions,
  type RosterPerson,
  rosterHere,
} from "@/services/cal-video/roster";
import {
  type CallDriverOptions,
  type CallParticipant,
  isCallOver,
} from "@/services/cal-video/types";
import { showActionSheet } from "@/utils/action-sheet";
import { openInDefaultBrowser } from "@/utils/browser";
import { type CalVideoRoomLink, roomAddress } from "@/utils/cal-video-links";
import { safeLogWarn } from "@/utils/safeLogger";
import { CallScreen } from "./CallScreen";
import { ChatSheet } from "./ChatSheet";
import { KnockScreen } from "./KnockScreen";
import { OutcomeScreen } from "./OutcomeScreen";
import { PeopleSheet } from "./PeopleSheet";
import { PreJoinScreen } from "./PreJoinScreen";

const ACTION_LABEL: Record<ParticipantAction, string> = {
  "lower-hand": "Lower hand",
  "pin-for-everyone": "Pin for everyone",
  "unpin-for-everyone": "Unpin for everyone",
  "pin-for-me": "Pin",
  "unpin-for-me": "Unpin",
  mute: "Mute",
  "stop-screen-share": "Stop their screen share",
  "chat-mute": "Mute in chat",
  "chat-unmute": "Unmute in chat",
  remove: "Remove from meeting",
};

const failedToast = (title: string) => Alert.alert(title, "Try again in a moment.");

/** Avatars from these origins are rendered; a peer's own URL anywhere else is initials. */
const CAL_AVATAR_ORIGINS = ["https://app.cal.com", "https://cal.com", "https://app.cal.eu"];

/**
 * A Cal Video room, end to end: pre-join, the door, the call, and how it ended.
 *
 * Three things are kept apart on purpose. The room hook talks to the Cal Video API and owns the
 * grant. The driver hook turns a grant into media through whichever provider the grant names.
 * The native call session tells the OS a call is happening. This component only wires them,
 * and the in-call panels: chat, people, the host's door and the "more" menu.
 */
export function VideoCallScreen({
  link,
  viewerName,
  viewerAvatarUrl,
  accessToken,
  onClose,
}: {
  link: CalVideoRoomLink;
  viewerName: string | null;
  viewerAvatarUrl: string | null;
  accessToken: string | null;
  onClose: () => void;
}) {
  useKeepAwake();
  const address = roomAddress(link);
  const roomRef = useMemo<RoomRef>(() => ({ origin: link.origin, slug: link.slug }), [link]);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [speakerphone, setSpeakerphone] = useState(true);
  const [layoutChoice, setLayoutChoice] = useState<LayoutChoice>("auto");
  const [ownPinIds, setOwnPinIds] = useState<string[]>([]);
  const [panel, setPanel] = useState<"chat" | "people" | null>(null);

  // The pre-join preview's release, called the instant a grant lands so the driver gets the camera.
  const releasePreviewRef = useRef<() => void>(() => undefined);
  const room = useCalVideoRoom({
    link,
    accessToken,
    beforeGrant: () => releasePreviewRef.current(),
  });
  const { leave: leaveRoom, end: endRoom, noteDriverEnd, setFailure } = room;
  const grant = room.grant;
  const controlToken = grant?.controlToken ?? null;
  const isHost = grant?.role === "host";

  const joinOptions = useMemo(
    () => ({ startAudioMuted: !microphoneOn, startVideoMuted: !cameraOn }),
    [microphoneOn, cameraOn]
  );
  // Recording is the server's to start and stop; the driver only reports what the provider says.
  const driverOptions = useMemo<CallDriverOptions>(
    () =>
      controlToken
        ? {
            recordingControls: {
              start: () => setRecording(roomRef, { controlToken, action: "start" }),
              stop: () => setRecording(roomRef, { controlToken, action: "stop" }),
            },
          }
        : {},
    [roomRef, controlToken]
  );
  const { driver, state } = useCallDriver({
    grant,
    joinOptions,
    driverOptions,
    onUnsupported: () => setFailure("unsupported"),
  });

  // --- The OS's view of the call -----------------------------------------------------------
  const nativeCallRef = useRef<NativeCallSession | null>(null);
  const leaveRef = useRef<() => void>(() => undefined);
  const muteRef = useRef<(muted: boolean) => void>(() => undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the call is the grant; the camera choice at that moment is only a label
  useEffect(() => {
    if (!grant) return;
    const session = new NativeCallSession({
      onEndCall: () => leaveRef.current(),
      onSetMuted: (muted) => muteRef.current(muted),
    });
    nativeCallRef.current = session;
    void session.start({ handle: address, displayName: address, hasVideo: cameraOn });
    return () => {
      session.end("local");
      if (nativeCallRef.current === session) nativeCallRef.current = null;
    };
  }, [grant, address]);

  useEffect(() => {
    if (state.status === "joined") nativeCallRef.current?.connected();
  }, [state.status]);

  // --- What the driver says happened, folded into the room's story --------------------------
  useEffect(() => {
    if (!grant) return;
    if (state.status === "removed" || state.status === "ended") {
      nativeCallRef.current?.end("remote");
      noteDriverEnd(state.status);
    } else if (state.status === "left") {
      noteDriverEnd("left");
    } else if (state.status === "error") {
      nativeCallRef.current?.end("failed");
      setFailure(state.error?.code === "full" ? "full" : "disconnected");
    }
  }, [state.status, state.error, grant, noteDriverEnd, setFailure]);

  // --- Host surfaces --------------------------------------------------------------------------
  const waitingList = useWaitingList({
    room: roomRef,
    controlToken,
    enabled: state.capabilities.canAdmit && state.status === "joined",
  });
  const access = useRoomAccess({ room: roomRef, controlToken });
  const invite = useInviteLink({ room: roomRef, controlToken });

  // --- Chat -----------------------------------------------------------------------------------
  // The session's chat comes with the grant: Cal Video's own durable chat is not carried by the
  // provider, so the provider panel is only offered when the session runs on the provider's.
  const calChatEnabled = grant?.chat === "cal";
  const calChatViewer = useMemo(
    () =>
      grant
        ? {
            displayName: grant.displayName,
            role: grant.role === "host" ? ("host" as const) : ("guest" as const),
          }
        : null,
    [grant]
  );
  const calChat = useCalChat({
    origin: link.origin,
    sessionId: calChatEnabled && grant ? grant.sessionId : null,
    viewer: calChatViewer,
    open: panel === "chat",
  });
  const providerChat = useProviderChat({
    driver: calChatEnabled ? null : driver,
    state,
    open: panel === "chat",
  });
  const chat = state.capabilities.canChat ? (calChat ?? providerChat) : null;
  // The Cal chat is offered as soon as the grant says so; its sheet says "loading" until it is.
  const chatOffered = state.capabilities.canChat && (calChatEnabled || providerChat !== null);

  // --- Layout ---------------------------------------------------------------------------------
  // Plain derivations: the compiler memoizes them, and a hand-written `useMemo` over a Set is
  // one it refuses to preserve.
  const presentIds = state.participants.map((participant) => participant.id);
  const pinnedIds = [...state.sharedPinIds, ...ownPinIds].filter(
    (id, index, all) => presentIds.includes(id) && all.indexOf(id) === index
  );
  const [lastSpeakerId, setLastSpeakerId] = useState<string | null>(null);
  const layout = resolveStage({
    choice: layoutChoice,
    participants: state.participants,
    pinnedIds,
    dominantSpeakerId: state.dominantSpeakerId,
    previousSpeakerId: lastSpeakerId,
  });
  const stagedSpeakerId = layout.staged?.kind === "speaker" ? layout.staged.participant.id : null;
  useEffect(() => {
    if (stagedSpeakerId !== null) setLastSpeakerId(stagedSpeakerId);
  }, [stagedSpeakerId]);

  const here = rosterHere(state.participants, CAL_AVATAR_ORIGINS);
  // Durable chat's mutes, mapped from chat ids onto the video identities the roster is keyed by.
  const chatMutedIds = useChatMutedIds({
    identityIds: here.flatMap((person) => (person.removalId === null ? [] : [person.removalId])),
    mutedChatIds: chat?.capabilities.mute && !chat.locked ? (chat.mutedChatIds ?? null) : null,
  });
  const actionsFor = useCallback(
    (person: RosterPerson) =>
      participantActions({
        person,
        canModerate: Boolean(isHost && driver?.signals.participantControls),
        canRemove: state.capabilities.canRemoveParticipant,
        sharedPinIds: state.sharedPinIds,
        localPinIds: ownPinIds,
        canPin: state.capabilities.canPublishVideo,
        chatMutedIds,
      }),
    [isHost, driver, state.capabilities, state.sharedPinIds, ownPinIds, chatMutedIds]
  );

  // --- Controls -----------------------------------------------------------------------------
  const setMicrophone = useCallback(
    (on: boolean) => {
      setMicrophoneOn(on);
      nativeCallRef.current?.setMuted(!on);
      if (driver && !isCallOver(state.status)) {
        driver.setMicrophoneEnabled(on).catch((error: unknown) => {
          safeLogWarn("[CalVideo] microphone toggle failed", { error: String(error) });
        });
      }
    },
    [driver, state.status]
  );
  useEffect(() => {
    muteRef.current = (muted) => setMicrophone(!muted);
  }, [setMicrophone]);

  const setCamera = useCallback(
    (on: boolean) => {
      setCameraOn(on);
      if (driver && !isCallOver(state.status)) {
        driver.setCameraEnabled(on).catch((error: unknown) => {
          safeLogWarn("[CalVideo] camera toggle failed", { error: String(error) });
          setCameraOn(false);
        });
      }
    },
    [driver, state.status]
  );

  const leave = useCallback(() => {
    nativeCallRef.current?.end("local");
    void driver?.leave();
    leaveRoom();
  }, [driver, leaveRoom]);
  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);

  const endForEveryone = useCallback(async () => {
    const ended = await endRoom().then(
      () => true,
      () => false
    );
    if (!ended) {
      Alert.alert("Couldn't end the meeting", "You are still in the call. Try again.");
      return;
    }
    nativeCallRef.current?.end("local");
    void driver?.leave();
  }, [driver, endRoom]);

  const confirmLeave = useCallback(() => {
    if (isHost && state.capabilities.canEndForEveryone) {
      Alert.alert("Leave the call?", undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", onPress: leave },
        { text: "End for everyone", style: "destructive", onPress: () => void endForEveryone() },
      ]);
      return;
    }
    leave();
  }, [isHost, state.capabilities.canEndForEveryone, leave, endForEveryone]);

  const runAction = useCallback(
    (person: RosterPerson, action: ParticipantAction) => {
      switch (action) {
        case "pin-for-me":
          setOwnPinIds((current) =>
            current.includes(person.id) ? current : [...current, person.id]
          );
          return;
        case "unpin-for-me":
          setOwnPinIds((current) => current.filter((id) => id !== person.id));
          return;
        case "pin-for-everyone":
        case "unpin-for-everyone":
          driver
            ?.setSharedPin?.(person.id, action === "pin-for-everyone")
            .catch(() => failedToast("Couldn't change the pin"));
          return;
        case "mute":
          driver?.muteParticipant?.(person.id).catch(() => failedToast("Couldn't mute"));
          return;
        case "stop-screen-share":
          driver
            ?.stopParticipantScreenShare?.(person.id)
            .catch(() => failedToast("Couldn't stop the share"));
          return;
        case "lower-hand":
          driver?.lowerHand?.(person.id).catch(() => failedToast("Couldn't lower the hand"));
          return;
        case "chat-mute":
        case "chat-unmute":
          if (person.removalId && chat?.setMemberMuted) {
            const setMemberMuted = chat.setMemberMuted;
            void toCalChatParticipantId(person.removalId)
              .then((chatId) => setMemberMuted(chatId, action === "chat-mute"))
              .catch(() => failedToast("Couldn't change the chat mute"));
          }
          return;
        case "remove":
          // Confirmed rather than done: removal cannot be taken back mid-meeting.
          Alert.alert(
            `Remove ${person.displayName}?`,
            "They leave the meeting now and cannot rejoin it with their current link.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Remove",
                style: "destructive",
                onPress: () => {
                  if (person.removalId) {
                    waitingList
                      .remove(person.removalId)
                      .catch(() => failedToast("Couldn't remove them"));
                  }
                },
              },
            ]
          );
          return;
      }
    },
    [driver, waitingList, chat]
  );

  const showParticipantActions = useCallback(
    (person: RosterPerson, actions: ParticipantAction[]) => {
      if (actions.length === 0) return;
      showActionSheet({
        title: person.isYou ? "You" : person.displayName,
        items: actions.map((action) => ({
          label: ACTION_LABEL[action],
          destructive: action === "remove",
          onPress: () => runAction(person, action),
        })),
      });
    },
    [runAction]
  );

  const onTilePress = useCallback(
    (participant: CallParticipant) => {
      const person = here.find((candidate) => candidate.id === participant.id);
      if (!person) return;
      // Your own tile drops "pin": pinning yourself on your own screen changes nothing worth a tap.
      const actions = actionsFor(person).filter(
        (action) => !(person.isYou && (action === "pin-for-me" || action === "unpin-for-me"))
      );
      showParticipantActions(person, actions);
    },
    [here, actionsFor, showParticipantActions]
  );

  const showAccessMenu = useCallback(() => {
    const mark = (option: boolean) => (access.requireApproval === option ? "  ✓" : "");
    showActionSheet({
      title: "Who can join",
      message: access.failed ? "The last change failed. Try again." : undefined,
      items: [
        { label: `People ask to join${mark(true)}`, onPress: () => access.set(true) },
        { label: `Anyone with the link${mark(false)}`, onPress: () => access.set(false) },
      ],
    });
  }, [access]);

  const showMoreMenu = useCallback(() => {
    const local = state.participants.find((participant) => participant.isLocal);
    const recordingBusy =
      state.recording.status === "starting" || state.recording.status === "stopping";
    const canRecord = state.capabilities.canRecord && Boolean(driver?.signals.recording);
    showActionSheet({
      items: [
        {
          label: local?.isScreenSharing ? "Stop sharing screen" : "Share screen",
          disabled: !driver?.signals.screenShare || !state.capabilities.canScreenShare,
          onPress: () =>
            void driver
              ?.setScreenShareEnabled?.(!local?.isScreenSharing)
              .catch(() => failedToast("Couldn't change screen sharing")),
        },
        {
          label: "Microphone…",
          disabled: !driver?.signals.inputDeviceSwitching,
          onPress: () => {
            void driver
              ?.getInputDevices?.("audioinput")
              .then((devices) => {
                if (!devices || devices.length === 0) return failedToast("No microphones found");
                showActionSheet({
                  title: "Microphone",
                  items: devices.map((device) => ({
                    label: device.label,
                    onPress: () =>
                      void driver
                        .setInputDevice?.("audioinput", device.deviceId)
                        .catch(() => failedToast("Couldn't switch the microphone")),
                  })),
                });
              })
              .catch(() => failedToast("Couldn't list microphones"));
          },
        },
        {
          label: layoutChoice === "auto" ? "Follow the speaker" : "Show everyone",
          disabled: !state.capabilities.canPublishVideo,
          onPress: () => setLayoutChoice(layoutChoice === "auto" ? "speaker" : "auto"),
        },
        {
          label: state.recording.status === "on" ? "Stop recording" : "Start recording",
          disabled: !canRecord || recordingBusy,
          onPress: () => {
            const request =
              state.recording.status === "on"
                ? driver?.stopRecording?.()
                : driver?.startRecording?.();
            request?.catch(() => failedToast("Recording could not be updated"));
          },
        },
      ],
    });
  }, [state, driver, layoutChoice]);

  // --- The header's buttons -----------------------------------------------------------------
  const flipCamera = useCallback(
    () => void driver?.flipCamera?.().catch(() => failedToast("Couldn't switch cameras")),
    [driver]
  );

  const showSpeakerMenu = useCallback(() => {
    const mark = (option: boolean) => (speakerphone === option ? "  ✓" : "");
    const route = (next: boolean) => {
      setSpeakerphone(next);
      driver
        ?.setSpeakerphoneEnabled?.(next)
        .catch(() => failedToast("Couldn't change the audio output"));
    };
    showActionSheet({
      title: "Audio output",
      items: [
        { label: `Speaker${mark(true)}`, onPress: () => route(true) },
        { label: `Earpiece${mark(false)}`, onPress: () => route(false) },
      ],
    });
  }, [driver, speakerphone]);

  const showInfoMenu = useCallback(() => {
    const count = state.participants.length;
    const waiting = waitingList.entries.length;
    const people = `${count} in the meeting${waiting > 0 ? `, ${waiting} waiting to join` : ""}`;
    showActionSheet({
      title: address,
      message: people,
      items: [
        {
          label: waiting > 0 ? `People (${waiting} waiting)` : `People (${count})`,
          onPress: () => setPanel("people"),
        },
        {
          label: "Copy meeting link",
          onPress: () =>
            void Clipboard.setStringAsync(`https://${address}`).catch(() =>
              failedToast("Couldn't copy the link")
            ),
        },
        {
          label: "Share invite link",
          disabled: !isHost || invite.busy,
          onPress: () =>
            void invite.share().catch(() => failedToast("Couldn't create an invite link")),
        },
        { label: "Who can join…", disabled: !isHost, onPress: showAccessMenu },
      ],
    });
  }, [
    state.participants.length,
    waitingList.entries.length,
    address,
    isHost,
    invite,
    showAccessMenu,
  ]);

  // --- Which surface ------------------------------------------------------------------------
  const screen = resolveRoomScreen({
    failure: room.failure,
    sessionEnd: room.sessionEnd,
    callStatus: state.status,
    hasGrant: grant !== null,
    knock: room.knock,
  });

  let content: React.ReactNode;
  switch (screen.kind) {
    case "prejoin":
      content = (
        <PreJoinScreen
          address={address}
          viewerName={viewerName}
          viewerAvatarUrl={viewerAvatarUrl}
          microphoneOn={microphoneOn}
          cameraOn={cameraOn}
          onMicrophoneChange={setMicrophoneOn}
          onCameraChange={setCameraOn}
          onJoin={(name) => void room.join(name)}
          onClose={onClose}
          onSignIn={viewerName === null && accessToken === null ? onClose : undefined}
          joining={room.joining}
          onPreviewRelease={(release) => {
            releasePreviewRef.current = release;
          }}
        />
      );
      break;
    case "knock":
      content = (
        <KnockScreen
          state={screen.state}
          onRetry={room.retryKnock}
          onCancel={() => {
            room.rejoin();
            onClose();
          }}
        />
      );
      break;
    case "call":
      content = (
        <>
          <CallScreen
            driver={driver}
            state={state}
            layout={layout}
            pinnedIds={pinnedIds}
            localAvatarUrl={grant?.avatarUrl ?? viewerAvatarUrl}
            waitingCount={waitingList.entries.length}
            chat={
              chatOffered ? { unread: chat?.unread ?? 0, onPress: () => setPanel("chat") } : null
            }
            onFlipCamera={flipCamera}
            onSpeaker={showSpeakerMenu}
            onInfo={showInfoMenu}
            onMore={showMoreMenu}
            onTilePress={onTilePress}
            onToggleMicrophone={() => setMicrophone(!microphoneOn)}
            onToggleCamera={() => setCamera(!cameraOn)}
            onLeave={confirmLeave}
          />
          <ChatSheet
            visible={panel === "chat"}
            chat={chat}
            retentionDays={state.chatRetentionDays}
            onClose={() => setPanel(null)}
          />
          <PeopleSheet
            visible={panel === "people"}
            here={here}
            waiting={waitingList.entries}
            failed={waitingList.failed}
            pinnedIds={pinnedIds}
            video={state.capabilities.canPublishVideo}
            actionsFor={actionsFor}
            onAction={showParticipantActions}
            onDecide={waitingList.decide}
            onClose={() => setPanel(null)}
          />
        </>
      );
      break;
    default:
      content = (
        <OutcomeScreen
          outcome={screen}
          address={address}
          onRejoin={room.rejoin}
          onAskToJoin={() => void room.joinAgain("removed")}
          onOpenInBrowser={() => void openInDefaultBrowser(link.url, "meeting link")}
          onClose={onClose}
        />
      );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
});
