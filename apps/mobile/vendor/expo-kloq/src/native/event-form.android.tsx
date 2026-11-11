import {
  DatePickerDialog,
  Host,
  OutlinedButton,
  Switch,
  Text,
  TextButton,
  TextField,
  TimePickerDialog,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import { semantics } from "@expo/ui/jetpack-compose/modifiers";
import { type ReactNode, useState } from "react";
import { Text as RNText, ScrollView, StyleSheet, View } from "react-native";
import { customFrom, ruleFrom, withAllDay, withEndDate, withStart } from "../editor/draft.ts";
import { describeRRule, presetIdFor, presetsFor, type RRuleFreq, WEEKDAY_CODES } from "../model.ts";
import { usePalette } from "../theme.ts";
import { ComposeMenu } from "./compose-menu.android.tsx";
import {
  ALERT_LIMIT,
  alertChoices,
  alertLabel,
  FREQ_LABELS,
  FREQ_UNITS,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
  withAddedAlert,
  withoutAlert,
  withReplacedAlert,
} from "./form-shared.ts";
import type { EventFormProps } from "./types.ts";

type Picking = { which: "start" | "end"; part: "date" | "time" } | null;

const dateLabel = (d: Date) =>
  d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const timeLabel = (d: Date, hour12?: boolean) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: hour12 ?? true });

/** Merge the picked calendar day (or clock time) into `base`. */
function merge(base: Date, picked: Date, part: "date" | "time"): Date {
  const out = new Date(base);
  if (part === "date") out.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  else out.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return out;
}

export function EventForm({
  draft,
  onChange,
  calendars,
  readOnly,
  onDelete,
  hour12,
}: EventFormProps) {
  const p = usePalette();
  const title = useNativeState(draft.title);
  const location = useNativeState(draft.location);
  const notes = useNativeState(draft.description);
  const [picking, setPicking] = useState<Picking>(null);
  const presets = presetsFor(draft.start);
  const presetId = presetIdFor(draft.rrule, draft.start);
  const [customOpen, setCustomOpen] = useState(presetId === "custom" && draft.rrule !== null);
  const custom = customFrom(draft.rrule, draft.start);
  const setCustom = (next: Partial<typeof custom>) =>
    onChange({ ...draft, rrule: ruleFrom({ ...custom, ...next }, draft.start) });

  const row = (label: string, control: ReactNode) => (
    <View style={[styles.row, { borderColor: p.rule }]}>
      <RNText style={[styles.label, { color: p.text }]}>{label}</RNText>
      <Host matchContents>{control}</Host>
    </View>
  );

  const apply = (picked: Date) => {
    if (!picking) return;
    const base = picking.which === "start" ? draft.start : draft.end;
    const next = merge(base, picked, picking.part);
    onChange(picking.which === "start" ? withStart(draft, next) : withEndDate(draft, next));
    setPicking(null);
  };

  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.content}
      pointerEvents={readOnly ? "none" : "auto"}
    >
      <Host matchContents={{ vertical: true }}>
        <TextField value={title} singleLine onValueChange={(t) => onChange({ ...draft, title: t })}>
          <TextField.Label>
            <Text>Title</Text>
          </TextField.Label>
        </TextField>
      </Host>
      <Host matchContents={{ vertical: true }}>
        <TextField
          value={location}
          singleLine
          onValueChange={(t) => onChange({ ...draft, location: t })}
        >
          <TextField.Label>
            <Text>Location</Text>
          </TextField.Label>
        </TextField>
      </Host>

      {row(
        "All-day",
        <Switch value={draft.allDay} onCheckedChange={(on) => onChange(withAllDay(draft, on))} />,
      )}
      {(["start", "end"] as const).map((which) => {
        const value = which === "start" ? draft.start : draft.end;
        return (
          <View key={which} style={[styles.row, { borderColor: p.rule }]}>
            <RNText style={[styles.label, { color: p.text }]}>
              {which === "start" ? "Starts" : "Ends"}
            </RNText>
            <Host matchContents>
              <OutlinedButton onClick={() => setPicking({ which, part: "date" })}>
                <Text>{dateLabel(value)}</Text>
              </OutlinedButton>
            </Host>
            {draft.allDay ? null : (
              <Host matchContents>
                <OutlinedButton onClick={() => setPicking({ which, part: "time" })}>
                  <Text>{timeLabel(value, hour12)}</Text>
                </OutlinedButton>
              </Host>
            )}
          </View>
        );
      })}

      {row(
        "Repeat",
        <ComposeMenu
          label={
            customOpen ? "Custom" : (presets.find((x) => x.id === presetId)?.label ?? "Custom")
          }
          items={presets.map((preset) => ({
            key: preset.id,
            label: preset.label,
            selected: (customOpen ? "custom" : presetId) === preset.id,
            onSelect: () => {
              if (preset.id === "custom") {
                setCustomOpen(true);
                onChange({ ...draft, rrule: ruleFrom(custom, draft.start) });
              } else {
                setCustomOpen(false);
                onChange({ ...draft, rrule: preset.rule });
              }
            },
          }))}
        />,
      )}
      {customOpen && draft.rrule ? (
        <View style={styles.custom}>
          {row(
            "Frequency",
            <ComposeMenu
              label={FREQ_LABELS[custom.freq]}
              items={(Object.keys(FREQ_LABELS) as RRuleFreq[]).map((f) => ({
                key: f,
                label: FREQ_LABELS[f],
                selected: f === custom.freq,
                onSelect: () => setCustom({ freq: f }),
              }))}
            />,
          )}
          {row(
            `Every ${custom.interval} ${FREQ_UNITS[custom.freq]}${custom.interval === 1 ? "" : "s"}`,
            <>
              <TextButton onClick={() => setCustom({ interval: Math.max(1, custom.interval - 1) })}>
                <Text>−</Text>
              </TextButton>
              <TextButton onClick={() => setCustom({ interval: custom.interval + 1 })}>
                <Text>+</Text>
              </TextButton>
            </>,
          )}
          {custom.freq === "WEEKLY" ? (
            <View style={styles.weekdays}>
              {WEEKDAY_CODES.map((code, i) => {
                const on = custom.byDay.includes(code);
                return (
                  <Host key={code} matchContents>
                    <TextButton
                      modifiers={[semantics({ contentDescription: WEEKDAY_NAMES[i] })]}
                      onClick={() =>
                        setCustom({
                          byDay: on
                            ? custom.byDay.filter((d) => d !== code)
                            : [...custom.byDay, code],
                        })
                      }
                    >
                      <Text style={{ fontWeight: on ? "bold" : "normal" }}>
                        {WEEKDAY_LETTERS[i]}
                      </Text>
                    </TextButton>
                  </Host>
                );
              })}
            </View>
          ) : null}
          {row(
            "End repeat",
            <ComposeMenu
              label={
                custom.end === "never"
                  ? "Never"
                  : custom.end === "until"
                    ? "On date"
                    : `After ${custom.count} times`
              }
              items={[
                { key: "never", label: "Never", onSelect: () => setCustom({ end: "never" }) },
                { key: "until", label: "On date", onSelect: () => setCustom({ end: "until" }) },
                {
                  key: "count",
                  label: "After 10 times",
                  onSelect: () => setCustom({ end: "count", count: 10 }),
                },
              ]}
            />,
          )}
          <RNText style={[styles.footnote, { color: p.muted }]}>
            {describeRRule(draft.rrule)}
          </RNText>
        </View>
      ) : null}

      {calendars.length > 0
        ? row(
            "Calendar",
            <ComposeMenu
              label={
                calendars.find((c) => c.id === draft.calendarId)?.name ?? calendars[0]?.name ?? ""
              }
              items={calendars.map((c) => ({
                key: c.id,
                label: c.name,
                selected: c.id === draft.calendarId,
                onSelect: () => onChange({ ...draft, calendarId: c.id }),
              }))}
            />,
          )
        : null}

      {draft.reminders.map((r, i) =>
        row(
          i === 0 ? "Alert" : `Alert ${i + 1}`,
          <>
            <ComposeMenu
              label={alertLabel(r)}
              items={alertChoices(r).map((choice) => ({
                key: String(choice.minutesBefore),
                label: choice.label,
                selected: choice.minutesBefore === r.minutesBefore,
                onSelect: () =>
                  onChange({
                    ...draft,
                    reminders: withReplacedAlert(draft.reminders, i, choice.minutesBefore),
                  }),
              }))}
            />
            <TextButton
              onClick={() => onChange({ ...draft, reminders: withoutAlert(draft.reminders, r) })}
            >
              <Text>Remove</Text>
            </TextButton>
          </>,
        ),
      )}
      {draft.reminders.length < ALERT_LIMIT ? (
        <Host matchContents>
          <TextButton
            onClick={() => onChange({ ...draft, reminders: withAddedAlert(draft.reminders) })}
          >
            <Text>Add alert</Text>
          </TextButton>
        </Host>
      ) : null}

      <Host matchContents={{ vertical: true }}>
        <TextField
          value={notes}
          minLines={3}
          onValueChange={(t) => onChange({ ...draft, description: t })}
        >
          <TextField.Label>
            <Text>Notes</Text>
          </TextField.Label>
        </TextField>
      </Host>

      {onDelete ? (
        <Host matchContents>
          <TextButton onClick={onDelete}>
            <Text color="#dc2626">Delete event</Text>
          </TextButton>
        </Host>
      ) : null}

      {picking?.part === "date" ? (
        <DatePickerDialog
          initialDate={(picking.which === "start" ? draft.start : draft.end).toISOString()}
          onDateSelected={apply}
          onDismissRequest={() => setPicking(null)}
        />
      ) : null}
      {picking?.part === "time" ? (
        <TimePickerDialog
          initialDate={(picking.which === "start" ? draft.start : draft.end).toISOString()}
          is24Hour={hour12 === false}
          onDateSelected={apply}
          onDismissRequest={() => setPicking(null)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: 16, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1, fontSize: 16 },
  custom: { paddingLeft: 12 },
  weekdays: { flexDirection: "row", justifyContent: "space-between" },
  footnote: { fontSize: 13, paddingVertical: 6 },
});
