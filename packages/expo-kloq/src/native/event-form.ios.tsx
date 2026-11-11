import {
  Button,
  DatePicker,
  Form,
  Host,
  HStack,
  Picker,
  Section,
  Stepper,
  Text,
  TextField,
  Toggle,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  accessibilityIdentifier,
  accessibilityLabel,
  buttonStyle,
  controlSize,
  datePickerStyle,
  disabled,
  labelStyle,
  lineLimit,
  pickerStyle,
  tag,
  toggleStyle,
} from "@expo/ui/swift-ui/modifiers";
import { useState } from "react";
import { StyleSheet } from "react-native";
import {
  type CustomRule,
  customFrom,
  ruleFrom,
  withAllDay,
  withEndDate,
  withStart,
} from "../editor/draft.ts";
import {
  describeRRule,
  presetIdFor,
  presetsFor,
  type RRuleFreq,
  type RRuleWeekday,
  WEEKDAY_CODES,
} from "../model.ts";
import {
  ALERT_LIMIT,
  alertChoices,
  FREQ_LABELS,
  FREQ_UNITS,
  WEEKDAY_LETTERS,
  WEEKDAY_NAMES,
  withAddedAlert,
  withoutAlert,
  withReplacedAlert,
} from "./form-shared.ts";
import type { EventFormProps } from "./types.ts";

export function EventForm({ draft, onChange, calendars, readOnly, onDelete }: EventFormProps) {
  const title = useNativeState(draft.title);
  const location = useNativeState(draft.location);
  const notes = useNativeState(draft.description);
  const presets = presetsFor(draft.start);
  const presetId = presetIdFor(draft.rrule, draft.start);
  // the builder stays open once chosen, even while the rule it writes happens to match a preset
  const [customOpen, setCustomOpen] = useState(presetId === "custom" && draft.rrule !== null);
  const custom = customFrom(draft.rrule, draft.start);
  const setCustom = (next: Partial<CustomRule>) =>
    onChange({ ...draft, rrule: ruleFrom({ ...custom, ...next }, draft.start) });

  const components = draft.allDay ? (["date"] as const) : (["date", "hourAndMinute"] as const);
  const repeatTag = customOpen ? "custom" : presetId;

  return (
    <Host style={styles.host} useViewportSizeMeasurement>
      <Form modifiers={readOnly ? [disabled(true)] : []}>
        <Section>
          <TextField
            text={title}
            placeholder="Title"
            onTextChange={(t) => onChange({ ...draft, title: t })}
            modifiers={[accessibilityIdentifier("kloq-title")]}
          />
          <TextField
            text={location}
            placeholder="Location"
            onTextChange={(t) => onChange({ ...draft, location: t })}
          />
        </Section>

        <Section>
          <Toggle
            label="All-day"
            isOn={draft.allDay}
            onIsOnChange={(on) => onChange(withAllDay(draft, on))}
          />
          <DatePicker
            title="Starts"
            selection={draft.start}
            displayedComponents={[...components]}
            onDateChange={(d) => onChange(withStart(draft, d))}
            modifiers={[datePickerStyle("compact")]}
          />
          <DatePicker
            title="Ends"
            selection={draft.end}
            displayedComponents={[...components]}
            range={{ start: draft.start }}
            onDateChange={(d) => onChange(withEndDate(draft, d))}
            modifiers={[datePickerStyle("compact")]}
          />
        </Section>

        <Section footer={draft.rrule ? <Text>{describeRRule(draft.rrule)}</Text> : undefined}>
          <Picker
            label="Repeat"
            selection={repeatTag}
            onSelectionChange={(id: string) => {
              if (id === "custom") {
                setCustomOpen(true);
                onChange({ ...draft, rrule: ruleFrom(custom, draft.start) });
                return;
              }
              setCustomOpen(false);
              onChange({ ...draft, rrule: presets.find((p) => p.id === id)?.rule ?? null });
            }}
            modifiers={[pickerStyle("menu")]}
          >
            {presets.map((p) => (
              <Text key={p.id} modifiers={[tag(p.id)]}>
                {p.label}
              </Text>
            ))}
          </Picker>
          {customOpen && draft.rrule ? (
            <CustomRuleRows custom={custom} start={draft.start} onChange={setCustom} />
          ) : null}
        </Section>

        {calendars.length > 0 ? (
          <Section>
            <Picker
              label="Calendar"
              selection={draft.calendarId ?? calendars[0]?.id ?? ""}
              onSelectionChange={(id: string) => onChange({ ...draft, calendarId: id })}
              modifiers={[pickerStyle("menu")]}
            >
              {calendars.map((c) => (
                <Text key={c.id} modifiers={[tag(c.id)]}>
                  {c.readOnly ? `${c.name} (read-only)` : c.name}
                </Text>
              ))}
            </Picker>
          </Section>
        ) : null}

        <Section title="Alerts">
          {draft.reminders.map((r, i) => (
            <HStack key={`${r.minutesBefore}-${r.method ?? "popup"}`}>
              <Picker
                label={i === 0 ? "Alert" : `Alert ${i + 1}`}
                selection={r.minutesBefore}
                onSelectionChange={(m: number) =>
                  onChange({ ...draft, reminders: withReplacedAlert(draft.reminders, i, m) })
                }
                modifiers={[pickerStyle("menu")]}
              >
                {alertChoices(r).map((choice) => (
                  <Text key={choice.minutesBefore} modifiers={[tag(choice.minutesBefore)]}>
                    {choice.label}
                  </Text>
                ))}
              </Picker>
              <Button
                label="Remove alert"
                systemImage="minus.circle.fill"
                role="destructive"
                onPress={() => onChange({ ...draft, reminders: withoutAlert(draft.reminders, r) })}
                modifiers={[buttonStyle("borderless"), labelStyle("iconOnly")]}
              />
            </HStack>
          ))}
          {draft.reminders.length < ALERT_LIMIT ? (
            <Button
              label="Add alert"
              systemImage="bell.badge"
              onPress={() => onChange({ ...draft, reminders: withAddedAlert(draft.reminders) })}
              modifiers={[accessibilityIdentifier("kloq-add-alert")]}
            />
          ) : null}
        </Section>

        <Section>
          <TextField
            text={notes}
            placeholder="Notes"
            axis="vertical"
            onTextChange={(t) => onChange({ ...draft, description: t })}
            modifiers={[lineLimit(3, { reservesSpace: true })]}
          />
        </Section>

        {onDelete ? (
          <Section>
            <Button
              label="Delete event"
              role="destructive"
              onPress={onDelete}
              modifiers={[accessibilityIdentifier("kloq-delete")]}
            />
          </Section>
        ) : null}
      </Form>
    </Host>
  );
}

function CustomRuleRows({
  custom,
  start,
  onChange,
}: {
  custom: CustomRule;
  start: Date;
  onChange: (next: Partial<CustomRule>) => void;
}) {
  const unit = FREQ_UNITS[custom.freq];
  return (
    <>
      <Picker
        selection={custom.freq}
        onSelectionChange={(f: string) => onChange({ freq: f as RRuleFreq })}
        modifiers={[pickerStyle("segmented")]}
      >
        {(Object.keys(FREQ_LABELS) as RRuleFreq[]).map((f) => (
          <Text key={f} modifiers={[tag(f)]}>
            {FREQ_LABELS[f]}
          </Text>
        ))}
      </Picker>
      <Stepper
        label={custom.interval === 1 ? `Every ${unit}` : `Every ${custom.interval} ${unit}s`}
        value={custom.interval}
        min={1}
        max={99}
        onValueChange={(n) => onChange({ interval: n })}
      />
      {custom.freq === "WEEKLY" ? (
        <HStack spacing={4}>
          {WEEKDAY_CODES.map((code: RRuleWeekday, i) => (
            <Toggle
              key={code}
              label={WEEKDAY_LETTERS[i]}
              isOn={custom.byDay.includes(code)}
              onIsOnChange={(on) =>
                onChange({
                  byDay: on ? [...custom.byDay, code] : custom.byDay.filter((d) => d !== code),
                })
              }
              modifiers={[
                toggleStyle("button"),
                controlSize("small"),
                accessibilityLabel(WEEKDAY_NAMES[i]),
              ]}
            />
          ))}
        </HStack>
      ) : null}
      <Picker
        label="End repeat"
        selection={custom.end}
        onSelectionChange={(e: string) => onChange({ end: e as CustomRule["end"] })}
        modifiers={[pickerStyle("menu")]}
      >
        <Text modifiers={[tag("never")]}>Never</Text>
        <Text modifiers={[tag("until")]}>On date</Text>
        <Text modifiers={[tag("count")]}>After a number of times</Text>
      </Picker>
      {custom.end === "until" ? (
        <DatePicker
          title="End date"
          selection={custom.until}
          range={{ start }}
          displayedComponents={["date"]}
          onDateChange={(d) => onChange({ until: d })}
        />
      ) : null}
      {custom.end === "count" ? (
        <Stepper
          label={`After ${custom.count} times`}
          value={custom.count}
          min={1}
          max={999}
          onValueChange={(n) => onChange({ count: n })}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
});
