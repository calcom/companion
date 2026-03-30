import { Ionicons } from "@expo/vector-icons";
import Daily, {
  DailyMediaView,
  type DailyCall,
  type DailyEventObjectFatalError,
  type DailyEventObjectParticipant,
  type DailyEventObjectParticipantLeft,
  type DailyParticipant,
} from "@daily-co/react-native-daily-js";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type CallState = "idle" | "joining" | "joined" | "leaving" | "error";

interface ParticipantInfo {
  sessionId: string;
  userName: string;
  videoTrack: DailyParticipant["tracks"]["video"];
  audioTrack: DailyParticipant["tracks"]["audio"];
  local: boolean;
}

function extractParticipantInfo(p: DailyParticipant): ParticipantInfo {
  return {
    sessionId: p.session_id,
    userName: p.user_name || (p.local ? "You" : "Participant"),
    videoTrack: p.tracks.video,
    audioTrack: p.tracks.audio,
    local: p.local,
  };
}

export default function VideoCallScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const callObjectRef = useRef<DailyCall | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localParticipant, setLocalParticipant] = useState<ParticipantInfo | null>(null);
  const [remoteParticipants, setRemoteParticipants] = useState<ParticipantInfo[]>([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);

  const updateParticipants = useCallback((callObject: DailyCall) => {
    const participants = callObject.participants();
    if (participants.local) {
      setLocalParticipant(extractParticipantInfo(participants.local));
    }

    const remotes: ParticipantInfo[] = [];
    for (const [id, participant] of Object.entries(participants)) {
      if (id !== "local") {
        remotes.push(extractParticipantInfo(participant));
      }
    }
    setRemoteParticipants(remotes);
  }, []);

  const leaveCall = useCallback(async () => {
    setCallState("leaving");
    const callObject = callObjectRef.current;
    if (callObject) {
      await callObject.leave();
      callObject.destroy();
      callObjectRef.current = null;
    }
    if (router.canGoBack()) {
      router.back();
    }
  }, [router]);

  // Join the call on mount
  useEffect(() => {
    if (!url) {
      setCallState("error");
      setErrorMessage("No meeting URL provided");
      return;
    }

    const callObject = Daily.createCallObject({
      subscribeToTracksAutomatically: true,
      reactNativeConfig: {
        androidInCallNotification: {
          title: "Cal.com Video",
          subtitle: "In a video call",
        },
      },
    });
    callObjectRef.current = callObject;

    const handleJoinedMeeting = () => {
      setCallState("joined");
      updateParticipants(callObject);
    };

    const handleParticipantJoined = (_event: DailyEventObjectParticipant) => {
      updateParticipants(callObject);
    };

    const handleParticipantUpdated = (_event: DailyEventObjectParticipant) => {
      updateParticipants(callObject);
    };

    const handleParticipantLeft = (_event: DailyEventObjectParticipantLeft) => {
      updateParticipants(callObject);
    };

    const handleLeftMeeting = () => {
      setCallState("idle");
    };

    const handleError = (event: DailyEventObjectFatalError) => {
      setCallState("error");
      setErrorMessage(event.errorMsg || "An error occurred during the call");
    };

    callObject.on("joined-meeting", handleJoinedMeeting);
    callObject.on("participant-joined", handleParticipantJoined);
    callObject.on("participant-updated", handleParticipantUpdated);
    callObject.on("participant-left", handleParticipantLeft);
    callObject.on("left-meeting", handleLeftMeeting);
    callObject.on("error", handleError);

    setCallState("joining");
    callObject.join({ url }).catch((err: Error) => {
      setCallState("error");
      setErrorMessage(err.message || "Failed to join meeting");
    });

    return () => {
      callObject.off("joined-meeting", handleJoinedMeeting);
      callObject.off("participant-joined", handleParticipantJoined);
      callObject.off("participant-updated", handleParticipantUpdated);
      callObject.off("participant-left", handleParticipantLeft);
      callObject.off("left-meeting", handleLeftMeeting);
      callObject.off("error", handleError);

      if (callObject.meetingState() === "joined-meeting") {
        callObject.leave().then(() => callObject.destroy());
      } else {
        callObject.destroy();
      }
      callObjectRef.current = null;
    };
  }, [url, updateParticipants]);

  const toggleMic = useCallback(() => {
    const callObject = callObjectRef.current;
    if (!callObject) return;
    const newState = !isMicOn;
    callObject.setLocalAudio(newState);
    setIsMicOn(newState);
  }, [isMicOn]);

  const toggleCamera = useCallback(() => {
    const callObject = callObjectRef.current;
    if (!callObject) return;
    const newState = !isCameraOn;
    callObject.setLocalVideo(newState);
    setIsCameraOn(newState);
  }, [isCameraOn]);

  const flipCamera = useCallback(() => {
    const callObject = callObjectRef.current;
    if (!callObject) return;
    callObject.cycleCamera();
  }, []);

  // Determine the main video participant (first remote, or local if alone)
  const mainParticipant = remoteParticipants[0] ?? localParticipant;
  const showPip = remoteParticipants.length > 0 && localParticipant;

  if (callState === "error") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View
          style={{
            flex: 1,
            backgroundColor: "#000",
            justifyContent: "center",
            alignItems: "center",
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          <Ionicons name="alert-circle" size={64} color="#EF4444" />
          <Text style={{ color: "#FFF", fontSize: 18, fontWeight: "600", marginTop: 16 }}>
            Unable to Join Call
          </Text>
          <Text
            style={{
              color: "#A3A3A3",
              fontSize: 14,
              marginTop: 8,
              textAlign: "center",
              paddingHorizontal: 32,
            }}
          >
            {errorMessage}
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              marginTop: 24,
              backgroundColor: "#FFF",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 100,
            }}
          >
            <Text style={{ color: "#000", fontSize: 16, fontWeight: "600" }}>Go Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
        }}
      >
        {/* Main video area */}
        <View style={{ flex: 1 }}>
          {callState === "joining" && (
            <View
              style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
            >
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 16, marginTop: 16 }}>
                Joining call...
              </Text>
            </View>
          )}

          {callState === "joined" && mainParticipant && (
            <View style={{ flex: 1 }}>
              {/* Main participant video */}
              {mainParticipant.videoTrack.state === "playable" &&
              mainParticipant.videoTrack.track ? (
                <DailyMediaView
                  videoTrack={mainParticipant.videoTrack.track}
                  audioTrack={
                    !mainParticipant.local && mainParticipant.audioTrack.state === "playable"
                      ? (mainParticipant.audioTrack.track ?? null)
                      : null
                  }
                  mirror={mainParticipant.local}
                  objectFit="cover"
                  style={{ flex: 1 }}
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    backgroundColor: "#1A1A1A",
                  }}
                >
                  <View
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 40,
                      backgroundColor: "#333",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="person" size={40} color="#666" />
                  </View>
                  <Text style={{ color: "#A3A3A3", fontSize: 16, marginTop: 12 }}>
                    {mainParticipant.userName}
                  </Text>
                </View>
              )}

              {/* PiP local video (when remote participants are present) */}
              {showPip && (
                <View
                  style={{
                    position: "absolute",
                    top: insets.top + 16,
                    right: 16,
                    width: 120,
                    height: 160,
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: "#1A1A1A",
                    borderWidth: 1,
                    borderColor: "#333",
                  }}
                >
                  {localParticipant.videoTrack.state === "playable" &&
                  localParticipant.videoTrack.track ? (
                    <DailyMediaView
                      videoTrack={localParticipant.videoTrack.track}
                      audioTrack={null}
                      mirror
                      objectFit="cover"
                      style={{ flex: 1 }}
                    />
                  ) : (
                    <View
                      style={{
                        flex: 1,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Ionicons name="person" size={24} color="#666" />
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {callState === "leaving" && (
            <View
              style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
            >
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={{ color: "#FFF", fontSize: 16, marginTop: 16 }}>
                Leaving call...
              </Text>
            </View>
          )}
        </View>

        {/* Controls bar */}
        {callState === "joined" && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              gap: 20,
              paddingVertical: 16,
              paddingBottom: Math.max(insets.bottom, 16),
              backgroundColor: "rgba(0, 0, 0, 0.8)",
            }}
          >
            {/* Flip camera */}
            <Pressable
              onPress={flipCamera}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: "#333",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="camera-reverse-outline" size={24} color="#FFF" />
            </Pressable>

            {/* Toggle camera */}
            <Pressable
              onPress={toggleCamera}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: isCameraOn ? "#333" : "#EF4444",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name={isCameraOn ? "videocam-outline" : "videocam-off-outline"}
                size={24}
                color="#FFF"
              />
            </Pressable>

            {/* Toggle mic */}
            <Pressable
              onPress={toggleMic}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: isMicOn ? "#333" : "#EF4444",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons
                name={isMicOn ? "mic-outline" : "mic-off-outline"}
                size={24}
                color="#FFF"
              />
            </Pressable>

            {/* Leave call */}
            <Pressable
              onPress={leaveCall}
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: "#EF4444",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Ionicons name="call" size={24} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
          </View>
        )}
      </View>
    </>
  );
}
