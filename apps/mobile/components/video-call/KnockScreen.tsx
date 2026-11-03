import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ActiveKnock } from "@/services/cal-video/room-screen";

function copyFor(state: ActiveKnock): { title: string; body: string; retry: boolean } {
  switch (state.status) {
    case "waiting":
    case "admitted":
      return {
        title: "Asking to join…",
        body: "The host will let you in shortly.",
        retry: false,
      };
    case "denied":
      return { title: "Not admitted", body: "The host did not let you in.", retry: true };
    case "unanswered":
      return { title: "Nobody answered", body: "You can ask again.", retry: true };
    case "unavailable":
      return {
        title: "Can't ask to join",
        body: "This room cannot take requests right now.",
        retry: true,
      };
    case "lobby-full":
      return { title: "Too many waiting", body: "Try again in a moment.", retry: true };
    case "rate-limited":
      return { title: "Slow down", body: "Too many attempts. Try again shortly.", retry: true };
    default:
      return { title: "Something went wrong", body: "Try again.", retry: true };
  }
}

/** Standing at the door. */
export function KnockScreen({
  state,
  onRetry,
  onCancel,
}: {
  state: ActiveKnock;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const copy = copyFor(state);
  const waiting = state.status === "waiting" || state.status === "admitted";

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.center}>
        {waiting && <ActivityIndicator color="#FFFFFF" size="large" />}
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>
      <View style={styles.actions}>
        {copy.retry && (
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.primary}>
            <Text style={styles.primaryText}>Ask again</Text>
          </Pressable>
        )}
        <Pressable accessibilityRole="button" onPress={onCancel} style={styles.secondary}>
          <Text style={styles.secondaryText}>{waiting ? "Cancel" : "Close"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000", paddingHorizontal: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { color: "#FFFFFF", fontSize: 22, fontWeight: "600", textAlign: "center" },
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
