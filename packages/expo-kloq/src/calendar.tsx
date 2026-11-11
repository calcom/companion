import { GlassContainer, GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatViewTitle, viewKind } from "./model.ts";
import { NavControls, ViewSwitcher } from "./native/controls";
import { EventSheet } from "./sheets/event-sheet.tsx";
import { QuickAddSheet } from "./sheets/quick-add-sheet.tsx";
import { SettingsSheet } from "./sheets/settings-sheet.tsx";
import { usePalette } from "./theme.ts";
import { type EditTarget, type KloqControllerOptions, useKloq } from "./use-kloq.ts";
import { AgendaView } from "./views/agenda-view.tsx";
import { MonthView } from "./views/month-view.tsx";
import { TimeGrid } from "./views/time-grid.tsx";
import { TimelineView } from "./views/timeline-view.tsx";
import { YearView } from "./views/year-view.tsx";

/** Zones the settings sheet offers for the gutter when the host passes none. */
const GLASS = isLiquidGlassAvailable();
const ACCENT = "#0a84ff";

export const DEFAULT_ZONE_CHOICES = [
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export interface KloqCalendarProps extends KloqControllerOptions {
  /** extra zones drawn in the day/week gutter at first (the user can change them) */
  timeZones?: string[];
  /** zones the settings sheet offers */
  zoneChoices?: string[];
  /** 12-hour clock; defaults to what the device's locale uses */
  hour12?: boolean;
}

/**
 * kloq for React Native: the same store, projection and recurrence rules as `<Kloq>`, drawn with
 * native controls (SwiftUI through `@expo/ui` on iOS, Jetpack Compose on Android).
 */
export function KloqCalendar(props: KloqCalendarProps) {
  const k = useKloq(props);
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [settings, setSettings] = useState(false);
  const [zones, setZones] = useState<string[]>(props.timeZones ?? []);
  const [hour12, setHour12] = useState(() => props.hour12 ?? localeUses12Hour());
  const kind = viewKind(k.view);
  const zoneChoices = props.zoneChoices ?? DEFAULT_ZONE_CHOICES;

  const newEvent = (start?: Date, end?: Date, allDay = false, calendarId?: string) => {
    const from = start ?? nextHalfHour(k.anchor);
    setEditing({
      kind: "new",
      start: from,
      end: end ?? new Date(from.getTime() + 60 * 60_000),
      allDay,
      calendarId,
    });
  };
  const callbacks = {
    onOpen: setEditing,
    onCreate: newEvent,
    onShowDay: k.showDay,
  };
  const stepWord =
    kind === "days"
      ? `${k.descriptor.dayCount} days`
      : kind === "agenda"
        ? "30 days"
        : kind === "timeline"
          ? "day"
          : kind;

  return (
    <View style={[styles.root, { backgroundColor: p.background, paddingTop: insets.top }]}>
      <View style={styles.toolbar}>
        <Pressable onPress={k.goToday} style={styles.titleBox} accessibilityRole="header">
          <Text style={[styles.title, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatViewTitle(k.descriptor, undefined, { short: kind !== "year" })}
          </Text>
        </Pressable>
        <NavControls
          onPrev={() => k.step(-1)}
          onNext={() => k.step(1)}
          onToday={k.goToday}
          onQuickAdd={() => setQuickAdd(true)}
          onSettings={() => setSettings(true)}
          onReset={k.reset}
          view={k.view}
          onView={k.setView}
          prevLabel={`Previous ${stepWord}`}
          nextLabel={`Next ${stepWord}`}
        />
      </View>
      <View style={styles.switcher}>
        <ViewSwitcher view={k.view} onView={k.setView} />
      </View>

      <View
        style={[
          styles.body,
          kind === "month" && { paddingBottom: 60 + Math.max(insets.bottom, 12) },
        ]}
      >
        {kind === "month" ? (
          <MonthView descriptor={k.descriptor} events={k.visibleEvents} {...callbacks} />
        ) : kind === "agenda" ? (
          <AgendaView
            descriptor={k.descriptor}
            events={k.visibleEvents}
            hour12={hour12}
            {...callbacks}
          />
        ) : kind === "year" ? (
          <YearView
            year={k.anchor.getFullYear()}
            events={k.visibleEvents}
            weekStartsOn={k.weekStartsOn}
            onShowDay={k.showDay}
          />
        ) : kind === "timeline" ? (
          <TimelineView
            anchor={k.anchor}
            events={k.visibleEvents}
            calendars={k.sources}
            hour12={hour12}
            {...callbacks}
          />
        ) : (
          <TimeGrid
            key={kind}
            descriptor={k.descriptor}
            events={k.visibleEvents}
            zones={zones}
            hour12={hour12}
            {...callbacks}
          />
        )}
      </View>

      <View
        pointerEvents="box-none"
        style={[styles.fabRow, { bottom: Math.max(insets.bottom, 12) + 4 }]}
      >
        <GlassContainer spacing={10} style={styles.fabs}>
          <Pressable
            onPress={() => newEvent()}
            accessibilityRole="button"
            accessibilityLabel="New event"
          >
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              tintColor={ACCENT}
              style={[styles.fab, !GLASS && { backgroundColor: ACCENT }]}
            >
              <Text style={[styles.fabText, { color: "#ffffff" }]}>＋ New event</Text>
            </GlassView>
          </Pressable>
          <Pressable
            onPress={() => setQuickAdd(true)}
            accessibilityRole="button"
            accessibilityLabel="Quick add"
          >
            <GlassView
              glassEffectStyle="regular"
              isInteractive
              style={[styles.fab, !GLASS && { backgroundColor: p.surface }]}
            >
              <Text style={[styles.fabText, { color: p.text }]}>Quick add</Text>
              <Text style={[styles.fabHint, { color: p.muted }]} numberOfLines={1}>
                “Lunch tomorrow 1pm”
              </Text>
            </GlassView>
          </Pressable>
        </GlassContainer>
      </View>

      <EventSheet
        target={editing}
        calendars={k.sources}
        hour12={hour12}
        onClose={() => setEditing(null)}
        onSave={k.save}
        onDelete={k.remove}
      />
      <QuickAddSheet
        visible={quickAdd}
        onClose={() => setQuickAdd(false)}
        onAdd={(event, day) => {
          k.add(event);
          if (kind === "year" || kind === "timeline") k.setView("week");
          k.setAnchor(day);
        }}
      />
      <SettingsSheet
        visible={settings}
        onClose={() => setSettings(false)}
        calendars={k.sources}
        zones={zoneChoices}
        selectedZones={zones}
        onZones={setZones}
        hour12={hour12}
        onHour12={setHour12}
      />
    </View>
  );
}

function localeUses12Hour(): boolean {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12 ?? true;
}

function nextHalfHour(anchor: Date): Date {
  const now = new Date();
  const d = new Date(anchor);
  d.setHours(now.getHours(), now.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  titleBox: { flex: 1, minWidth: 0 },
  title: { fontSize: 24, fontWeight: "700" },
  switcher: { paddingHorizontal: 12, paddingBottom: 8 },
  body: { flex: 1 },
  fabRow: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  fabs: { flexDirection: "row", gap: 10 },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    overflow: "hidden",
  },
  fabText: { fontSize: 15, fontWeight: "600" },
  fabHint: { fontSize: 13 },
});
