import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type BookingLinkResolution, resolveBookingLink } from "@/services/cal-video/booking-link";
import { openInAppBrowser } from "@/utils/browser";
import { type CalVideoBookingLink, linkAddress } from "@/utils/cal-video-links";
import { safeLogWarn } from "@/utils/safeLogger";

type Phase =
  | { kind: "resolving" }
  | { kind: "failed" }
  | { kind: "opened-web"; url: string }
  | Exclude<BookingLinkResolution, { kind: "room" } | { kind: "web" }>;

/** The web's copy for each outcome page, so a link reads the same in the app and the browser. */
function copyFor(phase: Phase, address: string): { title: string; body: string } {
  switch (phase.kind) {
    case "resolving":
      return { title: "Finding your meeting…", body: address };
    case "not-started":
      return {
        title: "This meeting has not started yet",
        body: "Come back when it's time. The booking has the details.",
      };
    case "ended":
      return { title: "Meeting unavailable", body: "This meeting is in the past." };
    case "not-found":
      return {
        title: "No meeting found",
        body: "This meeting does not exist. Contact the meeting owner for an updated link.",
      };
    case "opened-web":
      return {
        title: "Opened in your browser",
        body: "This meeting runs on a provider the app cannot host yet, so it opened on the web.",
      };
    case "failed":
      return {
        title: "Couldn't check this meeting",
        body: "Make sure you're online and try again.",
      };
  }
}

/**
 * A booking's `/video/<uid>` link: ask the web page what the meeting is right now, then join the
 * room it names, show the same outcome the browser would, or hand a legacy room to the browser.
 */
export function BookingLinkScreen({
  link,
  onRoom,
  onClose,
}: {
  link: CalVideoBookingLink;
  /** The page resolved to a Cal Video room; the caller joins it natively. */
  onRoom: (roomUrl: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>({ kind: "resolving" });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is the retry trigger
  useEffect(() => {
    let cancelled = false;
    setPhase({ kind: "resolving" });
    resolveBookingLink(link)
      .then((resolution) => {
        if (cancelled) return;
        safeLogWarn("[CalVideo] booking link", { uid: link.bookingUid, ...resolution });
        if (resolution.kind === "room") {
          onRoom(resolution.url);
          return;
        }
        if (resolution.kind === "web") {
          setPhase({ kind: "opened-web", url: resolution.url });
          void openInAppBrowser(resolution.url, "meeting link");
          return;
        }
        setPhase(resolution);
      })
      .catch(() => {
        if (!cancelled) setPhase({ kind: "failed" });
      });
    return () => {
      cancelled = true;
    };
  }, [link, onRoom, attempt]);

  const retry = () => setAttempt((count) => count + 1);
  const openWeb = () => {
    const url = phase.kind === "opened-web" ? phase.url : link.url;
    void openInAppBrowser(url, "meeting link");
  };

  const copy = copyFor(phase, linkAddress(link));
  const resolving = phase.kind === "resolving";

  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.center}>
        {resolving && <ActivityIndicator color="#FFFFFF" style={styles.spinner} />}
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>
      {!resolving && (
        <View style={styles.actions}>
          {(phase.kind === "not-started" || phase.kind === "failed") && (
            <Pressable accessibilityRole="button" onPress={retry} style={styles.primary}>
              <Text style={styles.primaryText}>Try again</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={openWeb} style={styles.secondary}>
            <Text style={styles.secondaryText}>
              {phase.kind === "opened-web" ? "Open again" : "Open in browser"}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
            <Text style={styles.secondaryText}>Close</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000", paddingHorizontal: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  spinner: { marginBottom: 8 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "600", textAlign: "center" },
  body: { color: "rgba(255,255,255,0.65)", fontSize: 15, textAlign: "center", lineHeight: 21 },
  actions: { gap: 10 },
  primary: {
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#111111", fontSize: 17, fontWeight: "600" },
  secondary: { height: 48, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "rgba(255,255,255,0.8)", fontSize: 16, fontWeight: "500" },
});
