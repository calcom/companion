import { useMemo } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import {
  type CalEvent,
  eventTitle,
  formatMinutes,
  groupAgenda,
  type PlacedOccurrence,
  projectEvents,
  type ViewDescriptor,
} from "../model.ts";
import { usePalette } from "../theme.ts";
import { openTarget, type ViewCallbacks } from "./shared.tsx";

export interface AgendaViewProps extends ViewCallbacks {
  descriptor: ViewDescriptor;
  events: readonly CalEvent[];
  hour12: boolean;
}

/** Thirty days from the anchor, grouped by day; empty days are skipped (kloq's `groupAgenda`). */
export function AgendaView({ descriptor, events, hour12, onOpen, onShowDay }: AgendaViewProps) {
  const p = usePalette();
  const agenda = useMemo(
    () => groupAgenda(projectEvents(events, descriptor).all, descriptor),
    [events, descriptor],
  );
  const sections = agenda.days.map((day) => ({ day, data: day.entries }));

  return (
    <SectionList
      sections={sections}
      keyExtractor={(entry, i) => `${entry.event.id}-${i}`}
      stickySectionHeadersEnabled
      contentContainerStyle={styles.content}
      ListEmptyComponent={
        <Text style={[styles.empty, { color: p.muted }]}>
          Nothing scheduled in the next 30 days.
        </Text>
      }
      renderSectionHeader={({ section: { day } }) => (
        <Pressable
          onPress={() => onShowDay(day.date)}
          style={[styles.header, { backgroundColor: p.background }]}
        >
          <Text style={[styles.headerText, { color: day.isToday ? p.today : p.text }]}>
            {day.isToday ? "Today · " : ""}
            {day.date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </Pressable>
      )}
      renderItem={({ item }) => {
        const e = item.event as PlacedOccurrence;
        const tint = p.event(e.color);
        const time = e.allDay
          ? "All day"
          : item.continuesBefore
            ? "Continues"
            : `${formatMinutes(e.startMin, { hour12 })} – ${formatMinutes(e.endMin, { hour12 })}`;
        return (
          <Pressable
            onPress={() => onOpen(openTarget(e))}
            accessibilityRole="button"
            style={[styles.row, { borderColor: p.rule }]}
          >
            <View style={[styles.bar, { backgroundColor: tint.solid }]} />
            <View style={styles.body}>
              <Text style={[styles.title, { color: p.text }]} numberOfLines={1}>
                {eventTitle(e)}
              </Text>
              <Text style={[styles.meta, { color: p.muted }]} numberOfLines={1}>
                {e.location ? `${time} · ${e.location}` : time}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 96 },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  headerText: { fontSize: 13, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13, fontVariant: ["tabular-nums"] },
  empty: { textAlign: "center", marginTop: 48, fontSize: 15 },
});
