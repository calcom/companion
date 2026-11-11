import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  type CalEvent,
  fullDate,
  layoutMonth,
  type PlacedOccurrence,
  plural,
  projectEvents,
  type ViewDescriptor,
} from "../model.ts";
import { usePalette } from "../theme.ts";
import { EventChip, openTarget, type ViewCallbacks } from "./shared.tsx";

const CHIP = 19;
const DATE_ROW = 24;

export interface MonthViewProps extends ViewCallbacks {
  descriptor: ViewDescriptor;
  events: readonly CalEvent[];
}

/** Six week rows of seven equal columns; each day lists what fits and a "+N" for the rest. */
export function MonthView({ descriptor, events, onOpen, onCreate, onShowDay }: MonthViewProps) {
  const p = usePalette();
  const [rowHeight, setRowHeight] = useState(0);
  const slots = Math.max(1, Math.floor((rowHeight - DATE_ROW - 2) / CHIP));
  const layout = useMemo(() => {
    const { all } = projectEvents(events, descriptor);
    return layoutMonth(all, { dayCount: descriptor.dayCount, slots });
  }, [events, descriptor, slots]);
  const month = descriptor.month?.getMonth();

  const weeks = Array.from({ length: descriptor.dayCount / 7 }, (_, w) =>
    descriptor.days.slice(w * 7, w * 7 + 7),
  );

  return (
    <View style={styles.fill}>
      <View style={[styles.weekdays, { borderColor: p.rule }]}>
        {descriptor.namesShort.slice(0, 7).map((name) => (
          <Text key={name} style={[styles.weekday, { color: p.muted }]}>
            {name}
          </Text>
        ))}
      </View>
      <View
        style={styles.fill}
        onLayout={(e) => setRowHeight(e.nativeEvent.layout.height / weeks.length)}
      >
        {weeks.map((week, w) => (
          <View key={week[0].toISOString()} style={[styles.week, { borderColor: p.rule }]}>
            {week.map((day, c) => {
              const index = w * 7 + c;
              const today = index === descriptor.todayIndex;
              const outside = day.getMonth() !== month;
              const list = (layout.byDay[index] ?? []) as PlacedOccurrence[];
              const shown = list.length > slots ? list.slice(0, slots - 1) : list;
              const hidden = list.length - shown.length;
              const showDay = () => onShowDay(day);
              const createAllDay = () => {
                const start = new Date(day);
                onCreate(start, start, true);
              };
              return (
                <Pressable
                  key={day.toISOString()}
                  accessible={false}
                  style={[
                    styles.cell,
                    { borderColor: p.rule },
                    outside && { backgroundColor: p.offHours },
                  ]}
                  onPress={showDay}
                  onLongPress={createAllDay}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${fullDate(day)}, ${plural(list.length, "event")}`}
                    style={[styles.date, today && { backgroundColor: p.today }]}
                    onPress={showDay}
                    onLongPress={createAllDay}
                  >
                    <Text
                      style={[
                        styles.dateText,
                        { color: today ? p.todayInk : outside ? p.faint : p.text },
                      ]}
                    >
                      {day.getDate()}
                    </Text>
                  </Pressable>
                  {shown.map((e) => (
                    <EventChip
                      key={e.id}
                      event={e}
                      filled={e.allDay}
                      onPress={() => onOpen(openTarget(e))}
                    />
                  ))}
                  {hidden > 0 ? (
                    <Text style={[styles.more, { color: p.muted }]} numberOfLines={1}>
                      +{hidden} more
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  weekdays: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 4,
  },
  weekday: {
    flex: 1,
    flexBasis: 0,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  week: { flex: 1, flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  cell: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    overflow: "hidden",
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 1,
    gap: 1,
  },
  date: {
    alignSelf: "center",
    height: 22,
    minWidth: 22,
    marginTop: 2,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  more: { fontSize: 10, paddingHorizontal: 3 },
});
