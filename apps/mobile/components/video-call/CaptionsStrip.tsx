import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CAPTION_LINGER_MS, visibleCaptions } from "@/services/cal-video/captions";
import type { CaptionLine } from "@/services/cal-video/types";
import { GlassSurface } from "./GlassSurface";

/**
 * Live captions over the call: the newest few lines, each named, finals fading out after a
 * silence. Re-renders on a timer only while something could still go stale.
 */
export function CaptionsStrip({ lines }: { lines: readonly CaptionLine[] }) {
  const [now, setNow] = useState(() => Date.now());
  const newest = lines.at(-1)?.at ?? 0;
  useEffect(() => {
    setNow(Date.now());
    if (newest === 0) return;
    const timer = setTimeout(() => setNow(Date.now()), CAPTION_LINGER_MS + 50);
    return () => clearTimeout(timer);
  }, [newest]);
  const shown = visibleCaptions(lines, now);
  if (shown.length === 0) return null;
  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityLiveRegion="polite">
      <GlassSurface style={styles.strip}>
        {shown.map((line) => (
          <Text
            key={line.id}
            style={[styles.line, !line.final && styles.interim]}
            numberOfLines={2}
          >
            <Text style={styles.name}>{line.participantName}: </Text>
            {line.text}
          </Text>
        ))}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  strip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, gap: 4, maxWidth: "100%" },
  line: { color: "#FFFFFF", fontSize: 14, lineHeight: 19 },
  interim: { color: "rgba(255,255,255,0.75)" },
  name: { color: "rgba(255,255,255,0.6)", fontWeight: "600" },
});
