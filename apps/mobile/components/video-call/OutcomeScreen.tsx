import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RoomFailure, SessionEnd } from "@/services/cal-video/room-screen";

type Outcome = { kind: "ended"; status: SessionEnd } | { kind: "failure"; failure: RoomFailure };

function copyFor(outcome: Outcome, address: string): { title: string; body: string } {
  if (outcome.kind === "ended") {
    switch (outcome.status) {
      case "left":
        return { title: "You left the call", body: address };
      case "removed":
        return { title: "You were removed", body: "A host removed you from this call." };
      case "ended":
        return { title: "The call has ended", body: "The host ended the meeting for everyone." };
    }
  }
  switch (outcome.failure) {
    case "not-found":
      return {
        title: "This meeting isn't available",
        body: "The link may be wrong, or the meeting may not have started yet.",
      };
    case "full":
      return { title: "The room is full", body: "Try again once someone leaves." };
    case "rate-limited":
      return { title: "Slow down", body: "Too many attempts. Try again shortly." };
    case "disconnected":
      return { title: "You were disconnected", body: "The connection to the call was lost." };
    case "unsupported":
      return {
        title: "Can't join from the app",
        body: "This meeting uses a video provider this version of the app cannot join yet.",
      };
    default:
      return { title: "Something went wrong", body: "The call could not be joined." };
  }
}

/** What happened, and what you can do about it. */
export function OutcomeScreen({
  outcome,
  address,
  onRejoin,
  onAskToJoin,
  onOpenInBrowser,
  onClose,
}: {
  outcome: Outcome;
  address: string;
  onRejoin: () => void;
  onAskToJoin: () => void;
  onOpenInBrowser: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const copy = copyFor(outcome, address);
  const removed = outcome.kind === "ended" && outcome.status === "removed";
  const ended = outcome.kind === "ended" && outcome.status === "ended";
  const unsupported = outcome.kind === "failure" && outcome.failure === "unsupported";
  const notFound = outcome.kind === "failure" && outcome.failure === "not-found";
  const canRejoin = !ended && !unsupported;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.center}>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>
      <View style={styles.actions}>
        {unsupported && (
          <Pressable accessibilityRole="button" onPress={onOpenInBrowser} style={styles.primary}>
            <Text style={styles.primaryText}>Open in browser</Text>
          </Pressable>
        )}
        {canRejoin && (
          <Pressable
            accessibilityRole="button"
            onPress={removed ? onAskToJoin : onRejoin}
            style={styles.primary}
          >
            <Text style={styles.primaryText}>
              {removed ? "Ask to join again" : notFound ? "Try again" : "Rejoin"}
            </Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
          <Text style={styles.secondaryText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000", paddingHorizontal: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { color: "#FFFFFF", fontSize: 24, fontWeight: "700", textAlign: "center" },
  body: { color: "rgba(255,255,255,0.65)", fontSize: 15, textAlign: "center" },
  actions: { gap: 10 },
  primary: {
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#111111", fontSize: 17, fontWeight: "600" },
  secondary: { height: 52, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: "rgba(255,255,255,0.8)", fontSize: 17 },
});
