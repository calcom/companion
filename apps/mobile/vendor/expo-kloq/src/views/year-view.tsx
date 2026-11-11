import { useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import {
  buildYearGrid,
  type CalEvent,
  densityByDay,
  loadOn,
  sameDay,
  weekdayColumns,
} from "../model.ts";
import { usePalette } from "../theme.ts";

export interface YearViewProps {
  year: number;
  events: readonly CalEvent[];
  weekStartsOn: number;
  onShowDay: (day: Date) => void;
}

const PAD = 12;
const GAP = 14;

/** Twelve mini-months; every day is a button into the day view, shaded by how busy it is. */
export function YearView({ year, events, weekStartsOn, onShowDay }: YearViewProps) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 3 : 2;
  const monthWidth = (width - PAD * 2 - GAP * (columns - 1)) / columns;
  const cell = Math.floor(monthWidth / 7);
  const months = useMemo(() => buildYearGrid(year, weekStartsOn), [year, weekStartsOn]);
  const density = useMemo(
    () => densityByDay(events, { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) }),
    [events, year],
  );
  const heads = weekdayColumns(weekStartsOn).map((d) => ({
    key: d.getDay(),
    label: d.toLocaleDateString("en-US", { weekday: "narrow" }),
  }));
  const today = new Date();
  const scroll = useRef<ScrollView>(null);
  const scrolled = useRef(false);

  return (
    <ScrollView ref={scroll} contentContainerStyle={[styles.grid, { padding: PAD, gap: GAP }]}>
      {months.map((m) => (
        <View
          key={m.index}
          style={{ width: monthWidth }}
          onLayout={(e) => {
            // open on the row holding the current month
            if (scrolled.current || year !== today.getFullYear() || m.index !== today.getMonth())
              return;
            scrolled.current = true;
            scroll.current?.scrollTo({
              y: Math.max(0, e.nativeEvent.layout.y - PAD),
              animated: false,
            });
          }}
        >
          <Text
            style={[
              styles.month,
              {
                color:
                  m.first.getMonth() === today.getMonth() && year === today.getFullYear()
                    ? p.today
                    : p.text,
              },
            ]}
          >
            {m.first.toLocaleDateString("en-US", { month: "long" })}
          </Text>
          <View style={styles.row}>
            {heads.map((h) => (
              <Text key={h.key} style={[styles.head, { width: cell, color: p.faint }]}>
                {h.label}
              </Text>
            ))}
          </View>
          {m.weeks.map((week, w) => (
            // a fixed 6×7 grid: a row's position is its identity
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <View key={w} style={styles.row}>
              {week.map((day, c) => {
                // biome-ignore lint/suspicious/noArrayIndexKey: a pad cell has no date of its own
                if (!day) return <View key={`pad-${c}`} style={{ width: cell, height: cell }} />;
                const isToday = sameDay(day, today);
                const load = loadOn(density, day).bucket;
                return (
                  <Pressable
                    key={day.getDate()}
                    onPress={() => onShowDay(day)}
                    accessibilityRole="button"
                    accessibilityLabel={day.toDateString()}
                    style={[
                      styles.day,
                      { width: cell, height: cell, borderRadius: cell / 2 },
                      isToday
                        ? { backgroundColor: p.today }
                        : load > 0 && {
                            backgroundColor: `rgba(59, 130, 246, ${0.12 + load * 0.12})`,
                          },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: isToday ? p.todayInk : p.text }]}>
                      {day.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", paddingBottom: 96 },
  month: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  row: { flexDirection: "row" },
  head: { textAlign: "center", fontSize: 10, fontWeight: "600" },
  day: { alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 11, fontVariant: ["tabular-nums"] },
});
