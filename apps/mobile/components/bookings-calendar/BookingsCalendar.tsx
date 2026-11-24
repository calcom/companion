import {
  AgendaView,
  type EditTarget,
  MonthView,
  TimeGrid,
  useKloq,
  usePalette,
  YearView,
} from "expo-kloq";
import { router } from "expo-router";
import { formatViewTitle } from "kloq/lib/navigation";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBookingsBetween, useUserProfile } from "@/hooks";
import { bookingsToCalendarEvents, calendarRange, weekStartIndex } from "@/utils/bookings-calendar";
import { CalendarNav, CalendarViewPicker } from "./CalendarControls";

const STEP_WORDS: Record<string, string> = {
  day: "day",
  week: "week",
  month: "month",
  year: "year",
  agenda: "30 days",
};

/**
 * kloq's scrolling views end in blank space for kloq's own floating buttons: 80 in the time grid
 * (time-grid.tsx), 96 in the year and schedule views (year-view.tsx, agenda-view.tsx). iOS draws
 * the tab bar over that space. Android puts the tab bar below the screen, where the space would
 * show as a gap, so the calendar hides it below its bottom edge.
 */
function kloqEndSpace(kind: string): number {
  if (Platform.OS !== "android" || kind === "month") return 0;
  return kind === "year" || kind === "agenda" ? 96 : 80;
}

export interface BookingsCalendarProps {
  /** Only this link's bookings, like the list's link filter. */
  eventTypeId?: number | null;
}

/**
 * The bookings in kloq's day, week, month, year and schedule views. Read-only: tapping a booking
 * opens its detail screen.
 */
export function BookingsCalendar({ eventTypeId }: BookingsCalendarProps) {
  const { data: profile } = useUserProfile();
  const k = useKloq({ initialView: "week", weekStartsOn: weekStartIndex(profile?.weekStart) });
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const {
    data: bookings = [],
    isFetching,
    isError,
  } = useBookingsBetween({
    ...calendarRange(k.descriptor),
    eventTypeId: eventTypeId ?? undefined,
  });
  const events = bookingsToCalendarEvents(bookings);
  const hour12 = profile?.timeFormat ? profile.timeFormat !== 24 : localeUses12Hour();
  const kind = k.descriptor.kind;
  const stepWord = STEP_WORDS[kind] ?? kind;

  const callbacks = {
    onOpen: (target: EditTarget) => {
      if (target.kind !== "event") return;
      router.push({
        pathname: "/(tabs)/(bookings)/booking-detail",
        params: { uid: target.event.id },
      });
    },
    // Read-only: an empty slot does nothing.
    onCreate: () => {},
    onShowDay: k.showDay,
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: p.background,
          // iOS draws the tab bar over the screen, and the bottom inset includes it. kloq's
          // scrolling views already end in blank space that clears it; the month grid doesn't scroll.
          paddingBottom: Platform.OS === "ios" && kind === "month" ? insets.bottom : 0,
        },
      ]}
    >
      <View style={styles.toolbar}>
        <View style={styles.titleBox}>
          <Text
            style={[styles.title, { color: p.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityRole="header"
          >
            {formatViewTitle(k.descriptor, undefined, { short: kind !== "year" })}
          </Text>
          {isFetching ? <ActivityIndicator size="small" color={p.muted} /> : null}
        </View>
        <CalendarNav
          view={k.view}
          onView={k.setView}
          onPrev={() => k.step(-1)}
          onToday={k.goToday}
          onNext={() => k.step(1)}
          prevLabel={`Previous ${stepWord}`}
          nextLabel={`Next ${stepWord}`}
        />
      </View>
      <View style={styles.picker}>
        <CalendarViewPicker view={k.view} onView={k.setView} />
      </View>
      {isError && bookings.length === 0 ? (
        <Text style={[styles.error, { color: p.muted }]}>Couldn't load bookings.</Text>
      ) : null}

      <View style={styles.body}>
        <View style={[styles.fill, { marginBottom: -kloqEndSpace(kind) }]}>
          {kind === "month" ? (
            <MonthView descriptor={k.descriptor} events={events} {...callbacks} />
          ) : kind === "agenda" ? (
            <AgendaView descriptor={k.descriptor} events={events} hour12={hour12} {...callbacks} />
          ) : kind === "year" ? (
            <YearView
              year={k.anchor.getFullYear()}
              events={events}
              weekStartsOn={k.weekStartsOn}
              onShowDay={k.showDay}
            />
          ) : (
            <TimeGrid
              key={kind}
              descriptor={k.descriptor}
              events={events}
              zones={[]}
              hour12={hour12}
              {...callbacks}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function localeUses12Hour(): boolean {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12 ?? true;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  titleBox: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flexShrink: 1, fontSize: 22, fontWeight: "700" },
  picker: { paddingHorizontal: 12, paddingBottom: 8 },
  error: { paddingHorizontal: 12, paddingBottom: 8, fontSize: 13 },
  body: { flex: 1, overflow: "hidden" },
  fill: { flex: 1 },
});
