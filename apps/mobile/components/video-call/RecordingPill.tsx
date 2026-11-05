import { Disc } from "lucide-react-native";
import { StyleSheet, Text } from "react-native";
import type { ToggleStatus } from "@/services/cal-video/types";
import { GlassSurface } from "./GlassSurface";

/**
 * Tells everyone in the call that it is being recorded. Shown to every participant, not only the
 * host who pressed the button: the state comes from the provider's own event, so nobody is
 * recorded without a visible sign of it.
 */
export function RecordingPill({ status }: { status: ToggleStatus }) {
  if (status === "off" || status === "stopping") return null;
  return (
    <GlassSurface style={styles.pill}>
      <Disc size={12} color="#FF453A" />
      <Text style={styles.text}>{status === "on" ? "Recording" : "Starting…"}</Text>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    overflow: "hidden",
  },
  text: { color: "#FFFFFF", fontSize: 12, fontWeight: "600" },
});
