import { useEffect, useMemo, useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  type CalEvent,
  type CalendarSource,
  eventTitle,
  formatMinutes,
  type Lane,
  type LaneAdapter,
  layoutDay,
  type PlacedOccurrence,
  projectTimeline,
  resolveWindow,
} from "../model.ts";
import { usePalette } from "../theme.ts";
import { openTarget, type ViewCallbacks } from "./shared.tsx";

/** The hours of a day, as values (they double as stable keys). */
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HOUR_WIDTH = 72;
const LANE_HEIGHT = 64;
const LABEL_WIDTH = 92;
const HEADER = 28;

export interface TimelineViewProps extends ViewCallbacks {
  anchor: Date;
  events: readonly CalEvent[];
  calendars: CalendarSource[];
  hour12: boolean;
}

/** kloq's timeline: one lane per visible calendar, the anchor day's hours running across. */
export function TimelineView({
  anchor,
  events,
  calendars,
  hour12,
  onOpen,
  onCreate,
}: TimelineViewProps) {
  const p = usePalette();
  const scroll = useRef<ScrollView>(null);
  const window = useMemo(
    () =>
      resolveWindow(
        { startOffsetMinutes: 0, spanMinutes: 24 * 60, slotMinutes: 60, pxPerSlot: HOUR_WIDTH },
        anchor,
      ),
    [anchor],
  );
  const lanes: Lane[] = useMemo(
    () =>
      calendars
        .filter((c) => c.visible !== false)
        .map((c) => ({ id: c.id, label: c.name, height: LANE_HEIGHT })),
    [calendars],
  );
  const adapter: LaneAdapter = useMemo(
    () => ({
      laneOf: (e) => e.calendarId ?? lanes[0]?.id ?? "",
      assign: (_e, laneId) => ({ calendarId: laneId }),
    }),
    [lanes],
  );
  const placed = useMemo(
    () => projectTimeline(events, lanes, window, adapter).all,
    [events, lanes, window, adapter],
  );

  useEffect(() => {
    const id = setTimeout(
      () => scroll.current?.scrollTo({ x: 8 * HOUR_WIDTH, animated: false }),
      0,
    );
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={styles.fill}>
      <View style={styles.row}>
        <View style={{ width: LABEL_WIDTH, paddingTop: HEADER }}>
          {lanes.map((lane) => {
            const color = calendars.find((c) => c.id === lane.id)?.color ?? "blue";
            return (
              <View key={lane.id} style={[styles.label, { borderColor: p.rule }]}>
                <View style={[styles.dot, { backgroundColor: p.event(color).solid }]} />
                <Text style={[styles.labelText, { color: p.text }]} numberOfLines={2}>
                  {lane.label}
                </Text>
              </View>
            );
          })}
        </View>
        <ScrollView
          ref={scroll}
          horizontal
          contentOffset={{ x: 8 * HOUR_WIDTH, y: 0 }}
          showsHorizontalScrollIndicator={false}
        >
          <View style={{ width: 24 * HOUR_WIDTH }}>
            <View style={[styles.ticks, { borderColor: p.rule }]}>
              {HOURS.map((h) => (
                <Text key={h} style={[styles.tick, { left: h * HOUR_WIDTH, color: p.muted }]}>
                  {formatMinutes(h * 60, { hour12 })}
                </Text>
              ))}
            </View>
            {lanes.map((lane, i) => (
              <LaneRow
                key={lane.id}
                bars={placed.filter((e) => e.laneIndex === i)}
                onOpen={onOpen}
                onCreateAt={
                  calendars.find((c) => c.id === lane.id)?.readOnly
                    ? undefined
                    : (min) => {
                        const start = new Date(window.start.getTime() + min * 60_000);
                        onCreate(start, new Date(start.getTime() + 60 * 60_000), false, lane.id);
                      }
                }
              />
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

function LaneRow({
  bars,
  onOpen,
  onCreateAt,
}: {
  bars: PlacedOccurrence[];
  onOpen: ViewCallbacks["onOpen"];
  /** absent on a read-only lane: its events still open, but a tap creates nothing */
  onCreateAt?: (minute: number) => void;
}) {
  const p = usePalette();
  const rows = useMemo(
    () =>
      layoutDay(
        bars.map((b) => ({
          id: b.id,
          startMin: b.startMin,
          endMin: Math.max(b.endMin, b.startMin + 15),
        })),
      ),
    [bars],
  );
  return (
    <Pressable
      accessible={false}
      disabled={!onCreateAt}
      style={[styles.lane, { borderColor: p.rule }]}
      onPress={(e) => onCreateAt?.(Math.floor((e.nativeEvent.locationX / HOUR_WIDTH) * 2) * 30)}
    >
      {HOURS.map((h) => (
        <View
          key={h}
          pointerEvents="none"
          style={[styles.hourRule, { left: h * HOUR_WIDTH, borderColor: p.rule }]}
        />
      ))}
      {bars.map((b) => {
        const slot = rows.get(b.id) ?? { col: 0, cols: 1 };
        const height = (LANE_HEIGHT - 8) / slot.cols;
        const tint = p.event(b.color);
        const title = eventTitle(b);
        return (
          <Pressable
            key={b.id}
            onPress={() => onOpen(openTarget(b))}
            accessibilityRole="button"
            accessibilityLabel={title}
            style={[
              styles.bar,
              {
                left: (b.startMin / 60) * HOUR_WIDTH,
                width: Math.max(24, ((b.endMin - b.startMin) / 60) * HOUR_WIDTH - 2),
                top: 4 + slot.col * height,
                height: height - 2,
                backgroundColor: tint.fill,
                borderLeftColor: tint.solid,
              },
            ]}
          >
            <Text style={[styles.barText, { color: tint.ink }]} numberOfLines={1}>
              {title}
            </Text>
          </Pressable>
        );
      })}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: "row" },
  label: {
    height: LANE_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  labelText: { flex: 1, fontSize: 13, fontWeight: "600" },
  ticks: { height: HEADER, borderBottomWidth: StyleSheet.hairlineWidth },
  tick: {
    position: "absolute",
    top: 8,
    paddingLeft: 4,
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
  lane: { height: LANE_HEIGHT, borderBottomWidth: StyleSheet.hairlineWidth },
  hourRule: { position: "absolute", top: 0, bottom: 0, borderLeftWidth: StyleSheet.hairlineWidth },
  bar: {
    position: "absolute",
    borderRadius: 5,
    borderLeftWidth: 3,
    paddingHorizontal: 4,
    justifyContent: "center",
    overflow: "hidden",
  },
  barText: { fontSize: 11, fontWeight: "600" },
});
