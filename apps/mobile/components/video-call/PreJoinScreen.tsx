import { RTCView } from "@cloudflare/react-native-webrtc";
import { Check, Mic, MicOff, Video, VideoOff, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
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
import type { GuestSpeechConsent, SpeechConsentRefusal } from "@/services/cal-video/booking-api";
import type { BookingSpeechConsent } from "@/services/cal-video/booking-link";
import type { PreviewStatus } from "@/services/cal-video/local-preview";
import { openInAppBrowser } from "@/utils/browser";
import { getCalPrivacyPolicyUrl } from "@/utils/region";
import { CallAvatar } from "./Avatar";
import { GlassSurface } from "./GlassSurface";
import { TrayButton } from "./TrayButton";

const MAX_NAME_LENGTH = 80;
const MAX_EMAIL_LENGTH = 320;
/** Enough to catch a typo before the server does; the server checks the address itself. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The web pre-join's wording (`pre_join_speech_consent_*` in cal.com's `cal_video.json`). */
function speechConsentLabel(prompt: BookingSpeechConsent): string {
  return prompt.captionsOn
    ? "This call uses captions and transcription, processed by ElevenLabs."
    : "The host can turn on captions and transcription, processed by ElevenLabs.";
}

/**
 * The web's messages for a refused tick (`pre_join_speech_consent_reload` / `_retry`), with "the
 * page" made "this screen": reopening the call loads the booking page afresh.
 */
const SPEECH_CONSENT_REFUSAL_MESSAGE: Record<SpeechConsentRefusal, string> = {
  reload:
    "Something about this call changed since this screen opened. Close it and open the call again to join.",
  retry: "We couldn’t save your agreement. Try joining again.",
};

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
  emailRequired = false,
  speechConsent = null,
  speechConsentRefusal = null,
}: {
  address: string;
  viewerName: string | null;
  viewerAvatarUrl: string | null;
  microphoneOn: boolean;
  cameraOn: boolean;
  onMicrophoneChange: (on: boolean) => void;
  onCameraChange: (on: boolean) => void;
  onJoin: (
    displayName: string,
    email: string | null,
    speechConsent: GuestSpeechConsent | null
  ) => void;
  onClose: () => void;
  /** Offered to a guest: the room's owner signs in to host it. Absent while signed in. */
  onSignIn?: () => void;
  joining: boolean;
  /** Receives the preview's release function so the room hook can call it before a grant. */
  onPreviewRelease: (release: () => void) => void;
  /** A booking call whose event type asks guests for their email. */
  emailRequired?: boolean;
  /** The speech-processing checkbox this guest must tick before joining; null for none. */
  speechConsent?: BookingSpeechConsent | null;
  /** Why the last tick was refused, shown under Join. */
  speechConsentRefusal?: SpeechConsentRefusal | null;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(viewerName?.trim() ?? "");
  // A remembered name arrives after mount; it fills an untouched field and never overwrites typing.
  useEffect(() => {
    if (viewerName) setName((current) => current || viewerName.trim());
  }, [viewerName]);
  const preview = useLocalPreview({ active: true, cameraOn });
  useEffect(() => {
    onPreviewRelease(preview.release);
  }, [onPreviewRelease, preview.release]);

  const [email, setEmail] = useState("");
  const trimmed = name.trim();
  const trimmedEmail = email.trim();
  const emailReady = !emailRequired || EMAIL_SHAPE.test(trimmedEmail);
  // Not remembered anywhere: like the web, every visit to this screen asks again.
  const [consentTicked, setConsentTicked] = useState(false);
  const consentReady = !speechConsent || consentTicked;
  const canJoin = trimmed.length > 0 && emailReady && consentReady && !joining;
  const submit = () => {
    if (!canJoin) return;
    onJoin(
      trimmed,
      emailRequired ? trimmedEmail : null,
      speechConsent ? { agreed: true, version: speechConsent.version } : null
    );
  };
  // The camera preview fills most of the screen, so a checkbox or refusal that appears after
  // Join lands below the fold, and Join just turns grey with no visible reason. Scroll so both
  // are on screen whenever either appears or changes; a checkbox present from the start is
  // already in reading order above Join.
  const scrollRef = useRef<ScrollView>(null);
  const consentNotice = speechConsentRefusal ?? (speechConsent ? "checkbox" : null);
  const [shownNotice, setShownNotice] = useState(consentNotice);
  const [revealCount, setRevealCount] = useState(0);
  if (consentNotice !== shownNotice) {
    setShownNotice(consentNotice);
    if (consentNotice) setRevealCount((count) => count + 1);
  }
  useEffect(() => {
    if (revealCount === 0) return;
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(frame);
  }, [revealCount]);

  const hint = previewHint(preview.status, cameraOn);
  const showVideo = cameraOn && preview.status === "ready" && preview.streamUrl;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={scrollRef}
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
              onSubmitEditing={submit}
              placeholder="How should people see you?"
              placeholderTextColor="rgba(255,255,255,0.45)"
              returnKeyType={emailRequired ? "next" : "join"}
              style={styles.input}
              value={name}
            />
          </GlassSurface>

          {emailRequired && (
            <>
              <Text style={styles.label}>Your email</Text>
              <GlassSurface style={styles.inputSurface}>
                <TextInput
                  accessibilityLabel="Your email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!joining}
                  inputMode="email"
                  keyboardType="email-address"
                  maxLength={MAX_EMAIL_LENGTH}
                  onChangeText={setEmail}
                  onSubmitEditing={submit}
                  placeholder="The email you booked with"
                  placeholderTextColor="rgba(255,255,255,0.45)"
                  returnKeyType="join"
                  style={styles.input}
                  value={email}
                />
              </GlassSurface>
              <Text style={styles.hint}>This meeting asks guests for their email.</Text>
            </>
          )}

          {speechConsent && (
            <View style={styles.consent}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentTicked, disabled: joining }}
                accessibilityLabel={speechConsentLabel(speechConsent)}
                disabled={joining}
                hitSlop={6}
                onPress={() => setConsentTicked((ticked) => !ticked)}
                style={styles.consentRow}
              >
                <View style={[styles.checkbox, consentTicked && styles.checkboxTicked]}>
                  {consentTicked && <Check size={14} color="#111111" strokeWidth={3} />}
                </View>
                <Text style={styles.consentLabel}>{speechConsentLabel(speechConsent)}</Text>
              </Pressable>
              <View style={styles.consentLinks}>
                <Pressable
                  accessibilityRole="link"
                  hitSlop={6}
                  onPress={() => void openInAppBrowser(speechConsent.helpUrl, "ElevenLabs details")}
                >
                  <Text style={styles.consentLink}>Details</Text>
                </Pressable>
                <Text style={styles.consentDot}>·</Text>
                <Pressable
                  accessibilityRole="link"
                  hitSlop={6}
                  onPress={() => void openInAppBrowser(getCalPrivacyPolicyUrl(), "Privacy policy")}
                >
                  <Text style={styles.consentLink}>Privacy policy</Text>
                </Pressable>
              </View>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={joining ? "Joining" : "Join"}
            accessibilityState={{ disabled: !canJoin }}
            disabled={!canJoin}
            onPress={submit}
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
          {speechConsentRefusal && (
            <Text accessibilityRole="alert" style={styles.refusal}>
              {SPEECH_CONSENT_REFUSAL_MESSAGE[speechConsentRefusal]}
            </Text>
          )}
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
      {/* Scrolled content passes under the status bar; keep the clock on a solid ground. */}
      <View pointerEvents="none" style={[styles.statusBarGround, { height: insets.top }]} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  statusBarGround: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    backgroundColor: "#000000",
  },
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
    ...StyleSheet.absoluteFill,
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
  consent: { marginTop: 4, gap: 6 },
  refusal: { color: "#FF6961", fontSize: 13, textAlign: "center" },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxTicked: { backgroundColor: "#FFFFFF", borderColor: "#FFFFFF" },
  consentLabel: { flex: 1, color: "#FFFFFF", fontSize: 15, lineHeight: 21 },
  consentLinks: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 34 },
  consentLink: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  consentDot: { color: "rgba(255,255,255,0.6)", fontSize: 13 },
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
