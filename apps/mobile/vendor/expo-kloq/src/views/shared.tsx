import { Pressable, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { eventTitle, type PlacedOccurrence } from "../model.ts";
import { usePalette } from "../theme.ts";
import type { EditTarget } from "../use-kloq.ts";

export interface ViewCallbacks {
  /** open the editor on an event (or one occurrence of a series) */
  onOpen: (target: EditTarget) => void;
  /** start a new event, on `calendarId` when the view knows it */
  onCreate: (start: Date, end: Date, allDay: boolean, calendarId?: string) => void;
  /** drill into one day */
  onShowDay: (day: Date) => void;
}

/** A placement back to what the editor needs: the master event, plus the occurrence for a series. */
export const openTarget = (placed: PlacedOccurrence): EditTarget => ({
  kind: "event",
  event: placed.source,
  occurrence: placed.occurrence,
});

/** One line per event: a filled bar for all-day ones, a dot + title for timed ones. Never wraps. */
export function EventChip({
  event,
  filled,
  label,
  onPress,
  style,
}: {
  event: PlacedOccurrence;
  filled?: boolean;
  label?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const p = usePalette();
  const tint = p.event(event.color);
  const title = eventTitle(event);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[styles.chip, filled && { backgroundColor: tint.fill }, style]}
    >
      {filled ? null : <View style={[styles.dot, { backgroundColor: tint.solid }]} />}
      <Text
        style={[styles.text, { color: filled ? tint.ink : p.text }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label ?? title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    height: 18,
    borderRadius: 4,
    paddingHorizontal: 3,
    gap: 3,
    overflow: "hidden",
    minWidth: 0,
  },
  dot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  text: { flex: 1, fontSize: 11, fontWeight: "500", minWidth: 0 },
});
