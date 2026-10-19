import { useRef, useState } from "react";
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
  ChoiceChips,
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

/** "Nov 1 at 18:30 – 19:00", or the item's label. */
function formatItemTime(item: CalEventEditScheduleItem): string {
  if (!item.startWallTime) return item.timeLabel.trim();
  const start = formatSentenceDateTime(item.startWallTime);
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
            const subtitle = [formatItemTime(item), names.join(", ")].filter(Boolean).join(" · ");
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
                startWallTime: values.startWallTime || null,
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

      {personSheet.initial ? (
        <PersonSheet
          key={personSheet.key}
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
          key={itemSheet.key}
          visible={itemSheet.visible}
          uuid={uuid}
          initial={itemSheet.initial}
          isNew={itemSheet.index === null}
          eventStartWallTime={values.startWallTime}
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

function TimeToken({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
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
        justifyContent: "center",
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.background,
      }}
    >
      <Text style={{ color: theme.text, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

type ItemTimeMode = "time" | "label";

const TIME_MODES: { value: ItemTimeMode; label: string }[] = [
  { value: "time", label: "At a time" },
  { value: "label", label: "Time label" },
];

/**
 * Edits one schedule item on a local copy. Its person sheet and date picker render inside this
 * sheet: iOS presents a modal only from the topmost one, so a sibling of this sheet couldn't open.
 * Staying inside the event's window is checked at save time, with the rest of the form.
 */
function ScheduleItemSheet({
  visible,
  uuid,
  initial,
  isNew,
  eventStartWallTime,
  onCancel,
  onDone,
}: {
  visible: boolean;
  uuid: string;
  initial: CalEventEditScheduleItem;
  isNew: boolean;
  eventStartWallTime: string;
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
  // Switching to a label and back restores the times instead of resetting them.
  const stashedTimes = useRef<Pick<CalEventEditScheduleItem, "startWallTime" | "endWallTime">>({
    startWallTime: initial.startWallTime ?? (eventStartWallTime || null),
    endWallTime: initial.endWallTime,
  });
  const personSheet = useListSheet<CalEventSchedulePerson>();
  const update = (patch: Partial<CalEventEditScheduleItem>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const { startWallTime: start, endWallTime: end } = draft;
  const mode: ItemTimeMode = start ? "time" : "label";
  const canSave = !!draft.content.trim() && (!!start || !!draft.timeLabel.trim());

  const setMode = (next: ItemTimeMode) => {
    if (next === mode) return;
    if (next === "label") {
      stashedTimes.current = { startWallTime: start, endWallTime: end };
      update({ startWallTime: null, endWallTime: null });
    } else {
      update(stashedTimes.current);
    }
  };

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

  const openPicker = (target: "start" | "end") => setPicker({ target, open: true });

  return (
    <EditSheet
      visible={visible}
      title={isNew ? "Add schedule item" : "Edit schedule item"}
      doneLabel={isNew ? "Add" : "Save"}
      onCancel={onCancel}
      onDone={() => onDone(draft)}
      doneDisabled={!canSave}
    >
      <ChoiceChips label="When" options={TIME_MODES} value={mode} onChange={setMode} />

      {start ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <TimeToken
              label={formatSentenceDateTime(start)}
              accessibilityLabel={`Starts ${formatSentenceDateTime(start)}. Change start`}
              onPress={() => openPicker("start")}
            />
            {end ? (
              <>
                <Text style={{ color: theme.textSecondary, fontSize: 16 }}>–</Text>
                <TimeToken
                  label={
                    isSameWallDay(start, end)
                      ? splitWallTimeParts(end).timeOfDay
                      : formatSentenceDateTime(end)
                  }
                  accessibilityLabel={`Ends ${formatSentenceDateTime(end)}. Change end`}
                  onPress={() => openPicker("end")}
                />
              </>
            ) : null}
          </View>
          {end ? (
            <TextButton
              label="Clear end"
              destructive
              onPress={() => update({ endWallTime: null })}
            />
          ) : (
            <TextButton
              icon="add"
              label="Add end"
              onPress={() => {
                update({ endWallTime: addMillisecondsToWallTime(start, DEFAULT_ITEM_DURATION_MS) });
                openPicker("end");
              }}
            />
          )}
          <WallDateTimePicker
            visible={picker.open}
            title={picker.target === "end" ? "End" : "Start"}
            value={picker.target === "end" ? (end ?? start) : start}
            minWallTime={picker.target === "end" ? start : eventStartWallTime || undefined}
            onChange={
              picker.target === "end" ? (next) => update({ endWallTime: next }) : changeStart
            }
            onClose={() => setPicker((current) => ({ ...current, open: false }))}
          />
        </View>
      ) : (
        <EditTextField
          label="Label"
          value={draft.timeLabel}
          onChangeText={(timeLabel) => update({ timeLabel })}
          placeholder="Doors open"
          accessibilityLabel="Time label"
        />
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
