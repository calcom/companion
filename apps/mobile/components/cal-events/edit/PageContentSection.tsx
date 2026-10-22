import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type {
  CalEventCategory,
  CalEventLineupPerson,
  CalEventSchedulePerson,
} from "@/services/types/cal-events.types";
import { formatSentenceDateTime } from "@/utils/cal-event-create";
import {
  type CalEventEditFormValues,
  type CalEventEditScheduleItem,
  MAX_LINEUP_LINKS_PER_PERSON,
  MAX_LINEUP_MEDIA_PER_PERSON,
  MAX_LINEUP_PEOPLE,
  MAX_SCHEDULE_ITEMS,
  MAX_SCHEDULE_LINKS_PER_PERSON,
  MAX_SCHEDULE_PEOPLE_PER_ITEM,
} from "@/utils/cal-event-edit";
import {
  addMillisecondsToWallTime,
  isSameWallDay,
  splitWallTimeParts,
  wallTimeDiffMs,
} from "@/utils/wall-time";
import { WallDateTimePicker } from "../WallDateTimePicker";
import {
  EditSection,
  EditSheet,
  EditTextField,
  ErrorText,
  FieldLabel,
  HintText,
  ListRow,
  moveItem,
  RowControls,
  TextButton,
  useEditTheme,
} from "./EditControls";
import { EMPTY_PERSON, PersonSheet } from "./PersonSheet";

type PageContentValues = Pick<
  CalEventEditFormValues,
  | "lineupTitle"
  | "lineupPeople"
  | "schedule"
  | "startWallTime"
  | "endWallTime"
  | "timeZone"
  | "category"
>;

/** The lineup's default heading per category, as the web shows it. */
const LINEUP_LABELS: Record<CalEventCategory, string> = {
  meetup: "Lineup",
  conference: "Speakers",
  music: "Performers",
  sports: "Players",
};

const DEFAULT_ITEM_DURATION_MS = 30 * 60 * 1000;
/** Like the web, an item ends at least a minute (the pickers' step) after it starts. */
const MIN_ITEM_DURATION_MS = 60 * 1000;

/**
 * Which list item a sheet edits (null index = a new one). `initial` stays set after closing so the
 * sheet can animate out; `key` remounts it per open so its draft starts from `initial`.
 */
function useListSheet<T>() {
  const [state, setState] = useState<{
    visible: boolean;
    index: number | null;
    initial: T | null;
    key: number;
  }>({ visible: false, index: null, initial: null, key: 0 });
  return {
    ...state,
    open: (index: number | null, initial: T) =>
      setState((current) => ({ visible: true, index, initial, key: current.key + 1 })),
    close: () => setState((current) => ({ ...current, visible: false })),
  };
}

/** Replaces `items[index]`, or appends when `index` is null. */
function putAt<T>(items: T[], index: number | null, item: T): T[] {
  return index === null
    ? [...items, item]
    : items.map((current, i) => (i === index ? item : current));
}

function rowControls<T>(items: T[], index: number, label: string, onChange: (next: T[]) => void) {
  return (
    <RowControls
      itemLabel={label}
      onMoveUp={index > 0 ? () => onChange(moveItem(items, index, -1)) : undefined}
      onMoveDown={index < items.length - 1 ? () => onChange(moveItem(items, index, 1)) : undefined}
      onRemove={() => onChange(items.filter((_, i) => i !== index))}
    />
  );
}

/** A schedule time as the web shows it: just the time within a single-day event, else the date too. */
function formatScheduleTime(wallTime: string, singleDay: boolean): string {
  return singleDay ? splitWallTimeParts(wallTime).timeOfDay : formatSentenceDateTime(wallTime);
}

/** "Nov 1 at 18:30 – 19:00" ("18:30 – 19:00" within a single-day event), or the item's label. */
function formatItemTime(item: CalEventEditScheduleItem, singleDay: boolean): string {
  if (!item.startWallTime) return item.timeLabel.trim();
  const start = formatScheduleTime(item.startWallTime, singleDay);
  if (!item.endWallTime) return start;
  const end = isSameWallDay(item.startWallTime, item.endWallTime)
    ? splitWallTimeParts(item.endWallTime).timeOfDay
    : formatSentenceDateTime(item.endWallTime);
  return `${start} – ${end}`;
}

function PersonRows({
  people,
  onChange,
  onEdit,
}: {
  people: CalEventSchedulePerson[];
  onChange: (next: CalEventSchedulePerson[]) => void;
  onEdit: (index: number) => void;
}) {
  return people.map((person, index) => {
    const name = person.name.trim() || "Unnamed person";
    return (
      <ListRow
        // biome-ignore lint/suspicious/noArrayIndexKey: people have no ids; rows hold no state
        key={index}
        title={name}
        subtitle={person.role}
        avatarUrl={person.avatarUrl}
        showAvatar
        onPress={() => onEdit(index)}
        accessibilityHint="Edits this person"
        trailing={rowControls(people, index, name, onChange)}
      />
    );
  });
}

export function PageContentSection({
  uuid,
  values,
  onChange,
  errors,
}: {
  /** The event's uuid, for avatar uploads. */
  uuid: string;
  values: PageContentValues;
  onChange: (patch: Partial<CalEventEditFormValues>) => void;
  errors: { lineup?: string; schedule?: string };
}) {
  const personSheet = useListSheet<CalEventLineupPerson>();
  const itemSheet = useListSheet<CalEventEditScheduleItem>();
  const { lineupPeople: people, schedule } = values;
  const setPeople = (lineupPeople: CalEventLineupPerson[]) => onChange({ lineupPeople });
  const setSchedule = (next: CalEventEditScheduleItem[]) => onChange({ schedule: next });
  // Like the web, a single-day event's schedule picks only times; a longer one also picks dates.
  const singleDay =
    !!values.startWallTime &&
    !!values.endWallTime &&
    isSameWallDay(values.startWallTime, values.endWallTime);

  return (
    <>
      <EditSection
        title="Lineup"
        description="Add speakers, performers, or people to feature on the public event page."
      >
        <View style={{ gap: 10 }}>
          <EditTextField
            label="Title"
            value={values.lineupTitle}
            onChangeText={(lineupTitle) => onChange({ lineupTitle })}
            placeholder={`Default: ${LINEUP_LABELS[values.category]}`}
            accessibilityLabel="Lineup title"
          />
          <PersonRows
            people={people}
            onChange={setPeople}
            onEdit={(index) => personSheet.open(index, people[index])}
          />
          <HintText>{`Add up to ${MAX_LINEUP_PEOPLE} lineup people.`}</HintText>
          <TextButton
            icon="person-add-outline"
            label="Add lineup person"
            onPress={() => personSheet.open(null, EMPTY_PERSON)}
            disabled={people.length >= MAX_LINEUP_PEOPLE}
          />
          <ErrorText message={errors.lineup} />
        </View>
      </EditSection>

      <EditSection title="Schedule" description="Build the agenda and attach people to each item.">
        <View style={{ gap: 10 }}>
          {schedule.map((item, index) => {
            const title = item.content.trim() || "Untitled item";
            const names = item.people.map((person) => person.name.trim()).filter(Boolean);
            const subtitle = [formatItemTime(item, singleDay), names.join(", ")]
              .filter(Boolean)
              .join(" · ");
            return (
              <ListRow
                // biome-ignore lint/suspicious/noArrayIndexKey: items have no ids; rows hold no state
                key={index}
                title={title}
                subtitle={subtitle}
                onPress={() => itemSheet.open(index, item)}
                accessibilityHint="Edits this schedule item"
                trailing={rowControls(schedule, index, title, setSchedule)}
              />
            );
          })}
          <HintText>{`Add up to ${MAX_SCHEDULE_ITEMS} schedule items.`}</HintText>
          <TextButton
            icon="add"
            label="Add schedule item"
            onPress={() =>
              itemSheet.open(null, {
                startWallTime: null,
                endWallTime: null,
                timeLabel: "",
                content: "",
                people: [],
              })
            }
            disabled={schedule.length >= MAX_SCHEDULE_ITEMS}
          />
          <ErrorText message={errors.schedule} />
        </View>
      </EditSection>

      {/* The two sheets are siblings, so their keys are prefixed: each sheet's count starts at 1. */}
      {personSheet.initial ? (
        <PersonSheet
          key={`person-${personSheet.key}`}
          visible={personSheet.visible}
          uuid={uuid}
          initial={personSheet.initial}
          isNew={personSheet.index === null}
          maxLinks={MAX_LINEUP_LINKS_PER_PERSON}
          maxMedia={MAX_LINEUP_MEDIA_PER_PERSON}
          onCancel={personSheet.close}
          onDone={(person) => {
            setPeople(putAt(people, personSheet.index, person));
            personSheet.close();
          }}
        />
      ) : null}
      {itemSheet.initial ? (
        <ScheduleItemSheet
          key={`item-${itemSheet.key}`}
          visible={itemSheet.visible}
          uuid={uuid}
          initial={itemSheet.initial}
          isNew={itemSheet.index === null}
          eventStartWallTime={values.startWallTime}
          singleDay={singleDay}
          onCancel={itemSheet.close}
          onDone={(item) => {
            setSchedule(putAt(schedule, itemSheet.index, item));
            itemSheet.close();
          }}
        />
      ) : null}
    </>
  );
}

/** A schedule time field, like the web's: a clock and the time, or a placeholder until it has one. */
function TimeToken({
  label,
  placeholder,
  accessibilityLabel,
  onPress,
}: {
  label: string | null;
  placeholder: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const theme = useEditTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        height: 40,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
      <Text style={{ color: label ? theme.text : theme.textSecondary, fontSize: 16 }}>
        {label ?? placeholder}
      </Text>
    </Pressable>
  );
}

/**
 * Edits one schedule item on a local copy. Its person sheet and date picker render inside this
 * sheet: iOS presents a modal only from the topmost one, so a sibling of this sheet couldn't open.
 * Like the web, an item needs a start time; one that already has a time label (from the API) keeps
 * editing its label instead. Staying inside the event's window is checked at save time, with the
 * rest of the form.
 */
function ScheduleItemSheet({
  visible,
  uuid,
  initial,
  isNew,
  eventStartWallTime,
  singleDay,
  onCancel,
  onDone,
}: {
  visible: boolean;
  uuid: string;
  initial: CalEventEditScheduleItem;
  isNew: boolean;
  eventStartWallTime: string;
  singleDay: boolean;
  onCancel: () => void;
  onDone: (item: CalEventEditScheduleItem) => void;
}) {
  const theme = useEditTheme();
  const [draft, setDraft] = useState(initial);
  // The picker keeps its target while closed, so it doesn't swap values as it fades out.
  const [picker, setPicker] = useState<{ target: "start" | "end"; open: boolean }>({
    target: "start",
    open: false,
  });
  // Decided on open, so clearing the label doesn't swap the field away mid-edit.
  const [hasLabel] = useState(!initial.startWallTime && !!initial.timeLabel.trim());
  const personSheet = useListSheet<CalEventSchedulePerson>();
  const update = (patch: Partial<CalEventEditScheduleItem>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const { startWallTime: start, endWallTime: end } = draft;
  const canSave = !!draft.content.trim() && (hasLabel ? !!draft.timeLabel.trim() : !!start);

  // Moving the start keeps the item's length, like the event's own start does.
  const changeStart = (next: string) =>
    setDraft((current) => ({
      ...current,
      startWallTime: next,
      endWallTime:
        current.startWallTime && current.endWallTime
          ? addMillisecondsToWallTime(
              next,
              wallTimeDiffMs(current.startWallTime, current.endWallTime)
            )
          : current.endWallTime,
    }));

  // An empty time takes the picker's first value right away, so closing it without scrolling
  // keeps what it showed. An end needs a start, as in the API: opening End first sets the start
  // too, and the end picker's minimum follows from it.
  const openPicker = (target: "start" | "end") => {
    if (target === "start" && !start && eventStartWallTime) changeStart(eventStartWallTime);
    if (target === "end" && !end) {
      const from = start ?? eventStartWallTime;
      if (from) {
        update({
          startWallTime: from,
          endWallTime: addMillisecondsToWallTime(from, DEFAULT_ITEM_DURATION_MS),
        });
      }
    }
    setPicker({ target, open: true });
  };
  const picked = picker.target === "end" ? (end ?? start) : start;
  // Within a single-day event the picker only picks a time, on the event's day like the web.
  const pickerValue =
    picked && singleDay && eventStartWallTime
      ? `${splitWallTimeParts(eventStartWallTime).date}T${splitWallTimeParts(picked).timeOfDay}`
      : picked;

  return (
    <EditSheet
      visible={visible}
      title={isNew ? "Add schedule item" : "Edit schedule item"}
      doneLabel={isNew ? "Add" : "Save"}
      onCancel={onCancel}
      onDone={() => onDone(draft)}
      doneDisabled={!canSave}
    >
      {hasLabel ? (
        <EditTextField
          label="Time"
          value={draft.timeLabel}
          onChangeText={(timeLabel) => update({ timeLabel })}
          placeholder="Time"
          accessibilityLabel="Time label"
        />
      ) : (
        <View style={{ gap: 8 }}>
          <FieldLabel label="Time" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <TimeToken
              label={start ? formatScheduleTime(start, singleDay) : null}
              placeholder="Start"
              accessibilityLabel={
                start ? `Starts ${formatSentenceDateTime(start)}. Change start` : "Set start"
              }
              onPress={() => openPicker("start")}
            />
            <Text style={{ color: theme.textSecondary, fontSize: 16 }}>–</Text>
            <TimeToken
              label={
                end
                  ? start && isSameWallDay(start, end)
                    ? splitWallTimeParts(end).timeOfDay
                    : formatScheduleTime(end, singleDay)
                  : null
              }
              placeholder="End"
              accessibilityLabel={
                end ? `Ends ${formatSentenceDateTime(end)}. Change end` : "Set end (optional)"
              }
              onPress={() => openPicker("end")}
            />
          </View>
          {end ? (
            <TextButton
              label="Clear end"
              destructive
              onPress={() => update({ endWallTime: null })}
            />
          ) : null}
          {pickerValue ? (
            <WallDateTimePicker
              visible={picker.open}
              title={picker.target === "end" ? "End" : "Start"}
              value={pickerValue}
              mode={singleDay ? "time" : "datetime"}
              minWallTime={
                picker.target === "end"
                  ? start
                    ? addMillisecondsToWallTime(start, MIN_ITEM_DURATION_MS)
                    : undefined
                  : eventStartWallTime || undefined
              }
              onChange={
                picker.target === "end" ? (next) => update({ endWallTime: next }) : changeStart
              }
              onClose={() => setPicker((current) => ({ ...current, open: false }))}
            />
          ) : null}
        </View>
      )}
      <EditTextField
        label="What happens"
        value={draft.content}
        onChangeText={(content) => update({ content })}
        placeholder="What happens"
        multiline
      />

      <View style={{ gap: 10 }}>
        <FieldLabel
          label="People"
          hint={`Add up to ${MAX_SCHEDULE_PEOPLE_PER_ITEM} people per schedule item.`}
        />
        <PersonRows
          people={draft.people}
          onChange={(people) => update({ people })}
          onEdit={(index) => personSheet.open(index, draft.people[index])}
        />
        <TextButton
          icon="add"
          label="Add person"
          onPress={() => personSheet.open(null, EMPTY_PERSON)}
          disabled={draft.people.length >= MAX_SCHEDULE_PEOPLE_PER_ITEM}
        />
      </View>

      {personSheet.initial ? (
        <PersonSheet
          key={personSheet.key}
          visible={personSheet.visible}
          uuid={uuid}
          initial={personSheet.initial}
          isNew={personSheet.index === null}
          maxLinks={MAX_SCHEDULE_LINKS_PER_PERSON}
          onCancel={personSheet.close}
          onDone={(person) => {
            update({ people: putAt(draft.people, personSheet.index, person) });
            personSheet.close();
          }}
        />
      ) : null}
    </EditSheet>
  );
}
