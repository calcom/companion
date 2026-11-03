import { RTCView } from "@cloudflare/react-native-webrtc";
import { Mic, MicOff, Video, VideoOff, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalPreview } from "@/hooks/useLocalPreview";
import type { PreviewStatus } from "@/services/cal-video/local-preview";
import { CallAvatar } from "./Avatar";
import { GlassSurface } from "./GlassSurface";
import { TrayButton } from "./TrayButton";

const MAX_NAME_LENGTH = 80;

function previewHint(status: PreviewStatus, cameraOn: boolean): string | null {
  if (!cameraOn) return "Camera is off";
  if (status === "denied") return "Allow camera access in Settings to show your video";
  if (status === "unavailable") return "No camera available";
  return null;
}

/**
 * The moment before the call: see yourself, set your name, choose what starts on. The camera is
 * held only here and released the instant a grant arrives.
 */
export function PreJoinScreen({
  address,
  viewerName,
  viewerAvatarUrl,
  microphoneOn,
  cameraOn,
  onMicrophoneChange,
  onCameraChange,
  onJoin,
  onClose,
  onSignIn,
  joining,
  onPreviewRelease,
}: {
  address: string;
  viewerName: string | null;
  viewerAvatarUrl: string | null;
  microphoneOn: boolean;
  cameraOn: boolean;
  onMicrophoneChange: (on: boolean) => void;
  onCameraChange: (on: boolean) => void;
  onJoin: (displayName: string) => void;
  onClose: () => void;
  /** Offered to a guest: the room's owner signs in to host it. Absent while signed in. */
  onSignIn?: () => void;
  joining: boolean;
  /** Receives the preview's release function so the room hook can call it before a grant. */
  onPreviewRelease: (release: () => void) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(viewerName?.trim() ?? "");
  const preview = useLocalPreview({ active: true, cameraOn });
  useEffect(() => {
    onPreviewRelease(preview.release);
  }, [onPreviewRelease, preview.release]);

  const trimmed = name.trim();
  const canJoin = trimmed.length > 0 && !joining;
  const hint = previewHint(preview.status, cameraOn);
  const showVideo = cameraOn && preview.status === "ready" && preview.streamUrl;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={10}
          >
            <GlassSurface interactive style={styles.closeButton}>
              <X size={18} color="#FFFFFF" />
            </GlassSurface>
          </Pressable>
        </View>

        <Text style={styles.title}>Ready to join?</Text>
        <Text style={styles.address} numberOfLines={1}>
          {address}
        </Text>

        <View style={styles.viewfinder}>
          {showVideo ? (
            <RTCView
              streamURL={preview.streamUrl ?? undefined}
              mirror
              objectFit="cover"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.viewfinderEmpty}>
              {cameraOn && preview.status === "starting" ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <CallAvatar name={trimmed || "?"} url={viewerAvatarUrl} size={96} />
              )}
              {hint && <Text style={styles.hint}>{hint}</Text>}
            </View>
          )}
          <View style={styles.viewfinderControls}>
            <TrayButton
              icon={microphoneOn ? Mic : MicOff}
              label={microphoneOn ? "Mute microphone" : "Unmute microphone"}
              active={!microphoneOn}
              size={48}
              onPress={() => onMicrophoneChange(!microphoneOn)}
            />
            <TrayButton
              icon={cameraOn ? Video : VideoOff}
              label={cameraOn ? "Turn camera off" : "Turn camera on"}
              active={!cameraOn}
              size={48}
              onPress={() => onCameraChange(!cameraOn)}
            />
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Your name</Text>
          <GlassSurface style={styles.inputSurface}>
            <TextInput
              accessibilityLabel="Your name"
              autoCapitalize="words"
              autoComplete="name"
              autoCorrect={false}
              editable={!joining}
              maxLength={MAX_NAME_LENGTH}
              onChangeText={setName}
              onSubmitEditing={() => canJoin && onJoin(trimmed)}
              placeholder="How should people see you?"
              placeholderTextColor="rgba(255,255,255,0.45)"
              returnKeyType="join"
              style={styles.input}
              value={name}
            />
          </GlassSurface>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={joining ? "Joining" : "Join"}
            accessibilityState={{ disabled: !canJoin }}
            disabled={!canJoin}
            onPress={() => onJoin(trimmed)}
            style={styles.joinPressable}
          >
            {/* Visuals on an inner View: the NativeWind JSX runtime drops function-form `style`. */}
            <View style={[styles.joinButton, !canJoin && styles.joinDisabled]}>
              {joining ? (
                <ActivityIndicator color="#111111" />
              ) : (
                <Text style={styles.joinText}>Join</Text>
              )}
            </View>
          </Pressable>
          {onSignIn && (
            <Pressable
              accessibilityRole="button"
              onPress={onSignIn}
              style={styles.signIn}
              hitSlop={8}
            >
              <Text style={styles.signInText}>Hosting this meeting? Sign in with Cal.com</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  content: { paddingHorizontal: 20, gap: 6 },
  header: { flexDirection: "row", justifyContent: "flex-end", marginBottom: 8 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "700", letterSpacing: -0.4 },
  address: { color: "rgba(255,255,255,0.6)", fontSize: 15, marginBottom: 16 },
  viewfinder: {
    aspectRatio: 3 / 4,
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#1C1C1E",
  },
  viewfinderEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
  },
  hint: { color: "rgba(255,255,255,0.6)", fontSize: 13, textAlign: "center" },
  viewfinderControls: {
    position: "absolute",
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 14,
  },
  form: { marginTop: 20, gap: 10 },
  label: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "500" },
  inputSurface: { borderRadius: 14, overflow: "hidden" },
  input: { color: "#FFFFFF", fontSize: 17, paddingHorizontal: 16, paddingVertical: 14 },
  joinPressable: { marginTop: 8 },
  joinButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  joinDisabled: { opacity: 0.45 },
  signIn: { alignItems: "center", paddingVertical: 12 },
  signInText: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
  joinText: { color: "#111111", fontSize: 17, fontWeight: "600" },
});
