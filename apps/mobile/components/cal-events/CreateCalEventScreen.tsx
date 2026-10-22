import { Ionicons } from "@expo/vector-icons";
import { Fragment, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getColors } from "@/constants/colors";
import { useCreateCalEvent } from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import { showInfoAlert } from "@/utils/alerts";
import {
  buildCreateCalEventDefaults,
  buildCreateCalEventInput,
  CAL_EVENT_NAME_MAX_LENGTH,
  type CreateCalEventFormValues,
  formatSentenceDateTime,
  formatSentenceEnd,
  getCreateCalEventError,
  isMultiDay,
  minEndWallTime,
  moveStart,
  sentenceLocationDisplay,
} from "@/utils/cal-event-create";
import {
  preserveWallTimeOnTimezoneChange,
  timeZoneSummary,
  todayStartWallTime,
  wallTimeDiffMs,
} from "@/utils/wall-time";
import { TimeZonePickerModal } from "./TimeZonePickerModal";
import { getUserFacingApiReason } from "./useCalEventActions";
import { WallDateTimePicker } from "./WallDateTimePicker";

interface CreateCalEventScreenProps {
  /** Null creates a personal event. */
  team: { id: number; name: string } | null;
  /** The profile's timezone, else the device's. */
  defaultTimeZone: string;
  onClose: () => void;
  onCreated: (event: CalEvent) => void;
}

const SENTENCE_SIZE = 30;
const SENTENCE_LINE_HEIGHT = 40;

/**
 * The web's create step (app.cal.com/events/new): "I'm hosting [my event] on [start] until [end]
 * [somewhere]." plus Public / Private, Require approval and the timezone. Creating makes a draft.
 */
export function CreateCalEventScreen({
  team,
  defaultTimeZone,
  onClose,
  onCreated,
}: CreateCalEventScreenProps) {
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);
  const insets = useSafeAreaInsets();

  const [values, setValues] = useState<CreateCalEventFormValues>(() =>
    buildCreateCalEventDefaults(defaultTimeZone)
  );
  const [submitted, setSubmitted] = useState(false);
  const [openPicker, setOpenPicker] = useState<"start" | "end" | "timeZone" | null>(null);
  const [locationFocused, setLocationFocused] = useState(false);
  const [sentenceWidth, setSentenceWidth] = useState<number | null>(null);
  const { mutate: createEvent, isPending, isSuccess } = useCreateCalEvent();
  const pending = isPending || isSuccess;

  const update = (patch: Partial<CreateCalEventFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  // Like the web form: no messages until the first submit, then they follow every change.
  const errorMessage = submitted ? getCreateCalEventError(values) : null;
  const canSubmit = values.name.trim().length > 0;

  const submit = () => {
    if (pending) return;
    setSubmitted(true);
    if (getCreateCalEventError(values)) return;
    createEvent(
      { input: buildCreateCalEventInput(values), teamId: team?.id ?? null },
      {
        onSuccess: onCreated,
        onError: (error) =>
          showInfoAlert(
            "Error",
            getUserFacingApiReason(error) ?? "Failed to create the event. Please try again."
          ),
      }
    );
  };

  const location = sentenceLocationDisplay(values.location, locationFocused);
  const multiDay = isMultiDay(values);
  const zone = timeZoneSummary(values.timeZone);

  const muted = (text: string) => (
    <Text style={[sentenceText, { color: theme.textMuted }]}>{text}</Text>
  );
  // A phrase is a word per item, so the sentence wraps between words like text does.
  const words = (phrase: string) =>
    phrase.split(" ").map((word) => <Fragment key={`${phrase}-${word}`}>{muted(word)}</Fragment>);

  const token = (label: string, accessibilityLabel: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: label }}
      style={[underline, { borderBottomColor: theme.textMuted }]}
    >
      <Text style={[sentenceText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.backgroundSecondary }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 24,
          paddingTop: Platform.OS === "ios" ? 20 : insets.top + 12,
          paddingBottom: 8,
          gap: 8,
        }}
      >
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}>New event</Text>
        {team ? (
          <Text style={{ flex: 1, color: theme.textSecondary, fontSize: 15 }} numberOfLines={1}>
            for {team.name}
          </Text>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Back to events"
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
          gap: 32,
        }}
      >
        <View style={{ gap: 16 }}>
          <View
            style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: 9 }}
            onLayout={(event) => setSentenceWidth(event.nativeEvent.layout.width)}
          >
            {words("I'm hosting")}
            <InlineField
              value={values.name}
              onChangeText={(name) => update({ name })}
              placeholder="my event"
              accessibilityLabel="Event name"
              testID="create-event-name"
              maxWidth={sentenceWidth}
              autoFocus
              maxLength={CAL_EVENT_NAME_MAX_LENGTH}
              returnKeyType="next"
              onSubmitEditing={() => setOpenPicker("start")}
            />
            {muted(multiDay ? "from" : "on")}
            {token(formatSentenceDateTime(values.startWallTime), "Change start", () =>
              setOpenPicker("start")
            )}
            {muted("until")}
            {token(formatSentenceEnd(values), "Change end", () => setOpenPicker("end"))}
            {location.prefix ? words(location.prefix) : null}
            <InlineField
              value={location.text}
              onChangeText={(text) => update({ location: text })}
              placeholder="somewhere"
              accessibilityLabel="Change location"
              testID="create-event-location"
              maxWidth={sentenceWidth === null ? null : sentenceWidth - 12}
              autoCapitalize="none"
              onFocus={() => setLocationFocused(true)}
              onBlur={() => setLocationFocused(false)}
              trailing="."
            />
          </View>
          {errorMessage ? (
            <Text accessibilityRole="alert" style={{ color: theme.error, fontSize: 15 }}>
              {errorMessage}
            </Text>
          ) : (
            <Text style={{ color: theme.textSecondary, fontSize: 15 }}>
              Tap any underlined part to change it.
            </Text>
          )}
        </View>

        <View style={{ alignItems: "flex-start", gap: 16 }}>
          <View
            accessibilityRole="radiogroup"
            style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}
          >
            <OptionChip
              icon="globe-outline"
              label="Public"
              hint="Shown on your public profile"
              selected={!values.isPrivate}
              onPress={() => update({ isPrivate: false })}
            />
            <OptionChip
              icon="lock-closed-outline"
              label="Private"
              hint="Only people with the link can find it"
              selected={values.isPrivate}
              onPress={() => update({ isPrivate: true })}
            />
          </View>
          <Pressable
            onPress={() => update({ requiresApproval: !values.requiresApproval })}
            accessibilityRole="switch"
            accessibilityLabel="Require approval"
            accessibilityState={{ checked: values.requiresApproval }}
            accessibilityHint="Approve guests before they join"
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4 }}
          >
            <Switch
              value={values.requiresApproval}
              onValueChange={(requiresApproval) => update({ requiresApproval })}
              // The row is the one switch screen readers see, as in SwitchRow.
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: "500" }}>
              Require approval
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setOpenPicker("timeZone")}
            accessibilityRole="button"
            accessibilityLabel={`Timezone, ${values.timeZone}`}
            accessibilityHint="The event is held in this timezone"
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8 }}
          >
            <Ionicons name="time-outline" size={20} color={theme.text} />
            <Text style={{ color: theme.text, fontSize: 17, fontVariant: ["tabular-nums"] }}>
              {zone.offset}
            </Text>
            <Text style={{ color: theme.textSecondary, fontSize: 17 }}>{zone.city}</Text>
          </Pressable>
          <Pressable
            onPress={submit}
            disabled={!canSubmit || pending}
            testID="create-event-submit"
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit || pending, busy: pending }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              height: 48,
              paddingHorizontal: 20,
              borderRadius: 12,
              marginTop: 8,
              backgroundColor: theme.text,
              opacity: canSubmit ? 1 : 0.5,
            }}
          >
            {pending ? <ActivityIndicator size="small" color={theme.background} /> : null}
            <Text style={{ color: theme.background, fontSize: 17, fontWeight: "600" }}>
              Create event
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <WallDateTimePicker
        visible={openPicker === "start"}
        title="Change start"
        value={values.startWallTime}
        minWallTime={todayStartWallTime(values.timeZone)}
        onChange={(next) => setValues((current) => ({ ...current, ...moveStart(current, next) }))}
        onClose={() => setOpenPicker(null)}
      />
      <WallDateTimePicker
        visible={openPicker === "end"}
        title="Change end"
        value={values.endWallTime}
        minWallTime={minEndWallTime(values.startWallTime)}
        onChange={(next) =>
          setValues((current) => {
            // Android's time dialog has no minimum: hold the end 15 minutes after the start.
            const earliest = minEndWallTime(current.startWallTime);
            return {
              ...current,
              endWallTime: wallTimeDiffMs(earliest, next) < 0 ? earliest : next,
            };
          })
        }
        onClose={() => setOpenPicker(null)}
      />
      <TimeZonePickerModal
        visible={openPicker === "timeZone"}
        value={values.timeZone}
        onSelect={(timeZone) => {
          setValues((current) => ({
            ...current,
            timeZone,
            ...preserveWallTimeOnTimezoneChange(
              current.startWallTime,
              current.endWallTime,
              timeZone
            ),
          }));
          setOpenPicker(null);
        }}
        onClose={() => setOpenPicker(null)}
      />
    </KeyboardAvoidingView>
  );
}

const sentenceText = {
  fontSize: SENTENCE_SIZE,
  lineHeight: SENTENCE_LINE_HEIGHT,
  fontWeight: "700" as const,
};

// Solid: iOS draws no dashed border on a single side, so the web's dashed underline can't carry over.
const underline = { borderBottomWidth: 2 };

interface InlineFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  testID: string;
  /** The sentence's width: past it the field wraps to its own line and scrolls. */
  maxWidth: number | null;
  autoFocus?: boolean;
  maxLength?: number;
  autoCapitalize?: "none" | "sentences";
  returnKeyType?: "next" | "done";
  onSubmitEditing?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Text glued to the field's end, such as the sentence's full stop. */
  trailing?: string;
}

/**
 * A text field that sits in the sentence like a word: it is as wide as its text (or placeholder),
 * measured from a hidden copy, and wraps to its own line once it outgrows the one it is on.
 */
function InlineField({ value, trailing, maxWidth, onSubmitEditing, ...props }: InlineFieldProps) {
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);
  const [textWidth, setTextWidth] = useState<number | null>(null);

  const onMeasure = (event: LayoutChangeEvent) => setTextWidth(event.nativeEvent.layout.width);
  const width =
    textWidth === null ? undefined : Math.min(textWidth + 2, maxWidth ?? Number.POSITIVE_INFINITY);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", maxWidth: "100%" }}>
      <View style={[underline, { borderBottomColor: theme.textMuted }]}>
        {/* Wide and invisible, so the copy measures its full text whatever the field's width. */}
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ position: "absolute", left: 0, top: 0, width: 10_000, opacity: 0 }}
        >
          <Text onLayout={onMeasure} style={[sentenceText, { alignSelf: "flex-start" }]}>
            {value || props.placeholder}
          </Text>
        </View>
        <TextInput
          {...props}
          value={value}
          onSubmitEditing={onSubmitEditing}
          submitBehavior={onSubmitEditing ? "blurAndSubmit" : undefined}
          placeholderTextColor={theme.textMuted}
          autoCorrect={false}
          style={[
            sentenceText,
            {
              color: theme.text,
              padding: 0,
              margin: 0,
              minWidth: 24,
              width,
            },
          ]}
        />
      </View>
      {trailing ? <Text style={[sentenceText, { color: theme.textMuted }]}>{trailing}</Text> : null}
    </View>
  );
}

interface OptionChipProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}

function OptionChip({ icon, label, hint, selected, onPress }: OptionChipProps) {
  const isDark = useColorScheme() === "dark";
  const theme = getColors(isDark);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityHint={hint}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        height: 44,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: selected ? theme.backgroundEmphasis : "transparent",
      }}
    >
      <Ionicons name={icon} size={20} color={theme.text} />
      <Text style={{ color: theme.text, fontSize: 17, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}
