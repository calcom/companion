import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  type CalEvent,
  continuesAfter,
  continuesBefore,
  eventTitle,
  formatMinutes,
  formatRange,
  hourLabel,
  layoutDay,
  localZone,
  minutesOfDate,
  type PlacedOccurrence,
  parseInstant,
  projectEvents,
  sameDay,
  type ViewDescriptor,
  wallClockIn,
  wallMinutesBetween,
  zoneCityLabel,
} from "../model.ts";
import { type Palette, usePalette } from "../theme.ts";
import { EventChip, openTarget, type ViewCallbacks } from "./shared.tsx";

/** The hours of a day, as values (they double as stable keys). */
const HOURS = Array.from({ length: 24 }, (_, h) => h);
export const HOUR_HEIGHT = 56;
const GUTTER = 52;
const ZONE_GUTTER = 44;
const SNAP = 30;
const MIN_BLOCK = 22;
const ALL_DAY_ROW = 22;
const ALL_DAY_ROWS = 3;
/** where the grid opens: the start of a working day */
const SCROLL_TO_HOUR = 8;

export interface TimeGridProps extends ViewCallbacks {
  descriptor: ViewDescriptor;
  events: readonly CalEvent[];
  /** extra IANA zones, drawn as gutter columns left of the local one */
  zones: readonly string[];
  hour12: boolean;
}

export function TimeGrid({
  descriptor,
  events,
  zones,
  hour12,
  onOpen,
  onCreate,
  onShowDay,
}: TimeGridProps) {
  const p = usePalette();
  const { timed, allDay } = useMemo(() => projectEvents(events, descriptor), [events, descriptor]);
  const gutter = GUTTER + zones.length * ZONE_GUTTER;
  const scroll = useRef<ScrollView>(null);
  const now = useNow();
  const [colWidth, setColWidth] = useState(0);

  useEffect(() => {
    // `contentOffset` covers iOS's first frame; this covers Android and later remounts
    const id = setTimeout(
      () => scroll.current?.scrollTo({ y: SCROLL_TO_HOUR * HOUR_HEIGHT - 8, animated: false }),
      0,
    );
    return () => clearTimeout(id);
  }, []);

  const byColumn = useMemo(() => {
    const cols: PlacedOccurrence[][] = descriptor.days.map(() => []);
    for (const e of timed)
      if (e.laneIndex >= 0 && e.laneIndex < cols.length) cols[e.laneIndex].push(e);
    return cols;
  }, [timed, descriptor.days]);

  return (
    <View style={styles.fill}>
      {/* day headers */}
      <View style={[styles.headerRow, { borderColor: p.rule }]}>
        <View style={[styles.captions, { width: gutter }]}>
          {zones.length
            ? [...zones, localZone()].map((zone, i) => (
                <Text
                  key={zone}
                  style={[
                    styles.zoneCaption,
                    { width: i < zones.length ? ZONE_GUTTER : GUTTER, color: p.muted },
                  ]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                >
                  {zoneCityLabel(zone)}
                </Text>
              ))
            : null}
        </View>
        {descriptor.days.map((day, i) => {
          const today = i === descriptor.todayIndex;
          return (
            <Pressable
              key={day.toISOString()}
              style={styles.headerCell}
              onPress={() => onShowDay(day)}
              accessibilityRole="button"
              accessibilityLabel={day.toDateString()}
            >
              <Text
                style={[styles.weekday, { color: today ? p.today : p.muted }]}
                numberOfLines={1}
              >
                {descriptor.namesShort[i]}
              </Text>
              <View style={[styles.dateBubble, today && { backgroundColor: p.today }]}>
                <Text style={[styles.dateNum, { color: today ? p.todayInk : p.text }]}>
                  {day.getDate()}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <AllDayLane
        descriptor={descriptor}
        placements={allDay}
        gutter={gutter}
        palette={p}
        onOpen={onOpen}
      />

      <ScrollView
        ref={scroll}
        style={styles.fill}
        contentOffset={{ x: 0, y: SCROLL_TO_HOUR * HOUR_HEIGHT - 8 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[styles.grid, { height: 24 * HOUR_HEIGHT }]}
          onLayout={(e) => setColWidth((e.nativeEvent.layout.width - gutter) / descriptor.dayCount)}
        >
          <Gutter zones={zones} day={descriptor.days[0]} hour12={hour12} palette={p} />
          {descriptor.days.map((day, col) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              dayName={descriptor.namesLong[col]}
              placements={byColumn[col]}
              palette={p}
              hour12={hour12}
              colWidth={colWidth}
              now={sameDay(day, now) ? now : null}
              onOpen={onOpen}
              onCreate={onCreate}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Gutter({
  zones,
  day,
  hour12,
  palette: p,
}: {
  zones: readonly string[];
  day: Date;
  hour12: boolean;
  palette: Palette;
}) {
  const hours = HOURS;
  const at = (h: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h);
  return (
    <View style={styles.gutterRow}>
      {zones.map((zone) => (
        <View key={zone} style={[styles.gutterCol, { width: ZONE_GUTTER }]}>
          {hours.map((h) => {
            const w = wallClockIn(at(h), zone);
            return h === 0 ? null : (
              <Text key={h} style={[styles.hour, { top: h * HOUR_HEIGHT - 7, color: p.faint }]}>
                {hourLabel(w.hour, w.minute, hour12)}
              </Text>
            );
          })}
        </View>
      ))}
      <View style={[styles.gutterCol, { width: GUTTER }]}>
        {hours.map((h) =>
          h === 0 ? null : (
            <Text key={h} style={[styles.hour, { top: h * HOUR_HEIGHT - 7, color: p.muted }]}>
              {formatMinutes(h * 60, { hour12 })}
            </Text>
          ),
        )}
      </View>
    </View>
  );
}

/** kloq's reading of a block: title, time, day. A piece of a cross-midnight event reads its whole span. */
function blockLabel(e: PlacedOccurrence, dayName: string, hour12: boolean): string {
  const split = e.segment.n > 1;
  const start = split ? minutesOfDate(new Date(parseInstant(e.start))) : e.startMin;
  const end = split ? start + wallMinutesBetween(e.start, e.end) : e.endMin;
  return (
    `${eventTitle(e)}, ${formatRange(start, end, { hour12 })}, ${dayName}` +
    (continuesBefore(e) ? ", continued from the previous day" : "") +
    (continuesAfter(e) ? ", continues" : "")
  );
}

function DayColumn({
  day,
  dayName,
  placements,
  palette: p,
  hour12,
  colWidth,
  now,
  onOpen,
  onCreate,
}: {
  colWidth: number;
  day: Date;
  dayName: string;
  placements: PlacedOccurrence[];
  palette: Palette;
  hour12: boolean;
  now: Date | null;
  onOpen: ViewCallbacks["onOpen"];
  onCreate: ViewCallbacks["onCreate"];
}) {
  const layout = useMemo(
    () =>
      layoutDay(
        placements.map((e) => ({
          id: e.id,
          startMin: e.startMin,
          endMin: Math.max(e.endMin, e.startMin + 15),
        })),
      ),
    [placements],
  );
  return (
    <Pressable
      style={[styles.column, { borderColor: p.rule }]}
      onPress={(e) => {
        const min = Math.floor(((e.nativeEvent.locationY / HOUR_HEIGHT) * 60) / SNAP) * SNAP;
        const start = new Date(day);
        start.setMinutes(min);
        onCreate(start, new Date(start.getTime() + 60 * 60_000), false);
      }}
      accessible={false}
    >
      {HOURS.map((h) => (
        <View
          key={h}
          pointerEvents="none"
          style={[
            styles.hourLine,
            { top: h * HOUR_HEIGHT, borderColor: p.rule },
            (h < 8 || h >= 18) && { backgroundColor: p.offHours },
          ]}
        />
      ))}
      {placements.map((e) => {
        const slot = layout.get(e.id) ?? { col: 0, cols: 1 };
        const top = (e.startMin / 60) * HOUR_HEIGHT;
        const height = Math.max(MIN_BLOCK, ((e.endMin - e.startMin) / 60) * HOUR_HEIGHT - 2);
        const tint = p.event(e.color);
        // a block narrower than a few letters gets one truncated line, never a column of letters
        const narrow = colWidth > 0 && colWidth / slot.cols < 44;
        const short = height < 40 || narrow;
        return (
          <Pressable
            key={e.id}
            onPress={() => onOpen(openTarget(e))}
            accessibilityRole="button"
            accessibilityLabel={blockLabel(e, dayName, hour12)}
            style={[
              styles.block,
              {
                top,
                height,
                left: `${(slot.col / slot.cols) * 100}%`,
                width: `${100 / slot.cols}%`,
                backgroundColor: tint.fill,
                borderLeftColor: tint.solid,
              },
            ]}
          >
            <Text
              style={[styles.blockTitle, narrow && styles.blockTitleNarrow, { color: tint.ink }]}
              numberOfLines={short ? 1 : 2}
              ellipsizeMode={narrow ? "clip" : "tail"}
            >
              {eventTitle(e)}
            </Text>
            {short ? null : (
              <Text style={[styles.blockTime, { color: tint.ink }]} numberOfLines={1}>
                {formatMinutes(e.startMin, { hour12 })}
              </Text>
            )}
          </Pressable>
        );
      })}
      {now ? (
        <View
          pointerEvents="none"
          style={[
            styles.now,
            {
              top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT,
              backgroundColor: p.now,
            },
          ]}
        />
      ) : null}
    </Pressable>
  );
}

/** All-day and multi-day bars above the grid, packed into at most three rows. */
function AllDayLane({
  descriptor,
  placements,
  gutter,
  palette: p,
  onOpen,
}: {
  descriptor: ViewDescriptor;
  placements: PlacedOccurrence[];
  gutter: number;
  palette: Palette;
  onOpen: ViewCallbacks["onOpen"];
}) {
  const rows = useMemo(() => {
    const ends: number[] = [];
    return placements
      .slice()
      .sort((a, b) => a.laneIndex - b.laneIndex || b.endLaneIndex - a.endLaneIndex)
      .map((e) => {
        let row = ends.findIndex((end) => end < e.laneIndex);
        if (row === -1) row = ends.length;
        ends[row] = e.endLaneIndex;
        return { e, row };
      });
  }, [placements]);
  if (!rows.length) return null;
  const count = Math.min(ALL_DAY_ROWS, Math.max(...rows.map((r) => r.row)) + 1);
  const n = descriptor.dayCount;
  return (
    <View style={[styles.allDay, { borderColor: p.rule, height: count * ALL_DAY_ROW + 6 }]}>
      <Text style={[styles.allDayLabel, { width: gutter, color: p.muted }]}>all-day</Text>
      <View style={styles.fill}>
        {rows
          .filter((r) => r.row < ALL_DAY_ROWS)
          .map(({ e, row }) => (
            <EventChip
              key={e.id}
              event={e}
              filled
              onPress={() => onOpen(openTarget(e))}
              style={{
                position: "absolute",
                top: row * ALL_DAY_ROW + 3,
                left: `${(e.laneIndex / n) * 100}%`,
                width: `${((e.endLaneIndex - e.laneIndex + 1) / n) * 100}%`,
              }}
            />
          ))}
      </View>
    </View>
  );
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 6,
  },
  headerCell: { flex: 1, alignItems: "center", gap: 2, minWidth: 0 },
  weekday: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  dateBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dateNum: { fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
  allDay: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  allDayLabel: { fontSize: 10, textAlign: "right", paddingRight: 6, paddingTop: 6 },
  grid: { flexDirection: "row" },
  scrollContent: { paddingBottom: 80 },
  gutterRow: { flexDirection: "row" },
  gutterCol: { position: "relative" },
  captions: { flexDirection: "row", alignItems: "flex-end", paddingBottom: 6 },
  zoneCaption: { textAlign: "center", fontSize: 9, fontWeight: "700" },
  hour: { position: "absolute", right: 6, fontSize: 10, fontVariant: ["tabular-nums"] },
  column: { flex: 1, minWidth: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  hourLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: HOUR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  block: {
    position: "absolute",
    borderRadius: 5,
    borderLeftWidth: 3,
    paddingHorizontal: 3,
    paddingVertical: 2,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
  },
  blockTitle: { fontSize: 11, fontWeight: "600" },
  blockTitleNarrow: { fontSize: 10 },
  blockTime: { fontSize: 10, opacity: 0.8, fontVariant: ["tabular-nums"] },
  now: { position: "absolute", left: 0, right: 0, height: 2 },
});
