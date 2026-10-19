import { Ionicons } from "@expo/vector-icons";
import { usePreventRemove } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useNavigation } from "expo-router";
import { type ReactNode, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Text as MenuText } from "@/components/ui/text";
import { queryKeys } from "@/config/cache.config";
import { useCalEventCoverImage, useUpdateCalEvent } from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import { showInfoAlert, showSuccessAlert } from "@/utils/alerts";
import { CAL_EVENT_NAME_MAX_LENGTH, minEndWallTime, moveStart } from "@/utils/cal-event-create";
import {
  buildCalEventUpdateInput,
  buildEditFormValues,
  CAL_EVENT_CATEGORIES,
  CAL_EVENT_DESCRIPTION_MAX_LENGTH,
  CAL_EVENT_GUEST_LISTS,
  CAL_EVENT_MAX_CAPACITY,
  CAL_EVENT_SLUG_MAX_LENGTH,
  type CalEventEditErrorKey,
  type CalEventEditFormValues,
  formatWallDateTime,
  getEditCalEventErrors,
} from "@/utils/cal-event-edit";
import {
  CAL_EVENT_STATUS_LABELS,
  getCalEventPublicUrl,
  getCalEventStatusColors,
  truncateCalEventTitle,
} from "@/utils/cal-events";
import {
  preserveWallTimeOnTimezoneChange,
  todayStartWallTime,
  wallTimeDiffMs,
} from "@/utils/wall-time";
import {
  ChoiceChips,
  EditSection,
  EditTextField,
  FieldLabel,
  HintText,
  SwitchRow,
  useEditTheme,
} from "./edit/EditControls";
import { LocationsSection } from "./edit/LocationsSection";
import { PageContentSection } from "./edit/PageContentSection";
import { CoHostsField, HostsField } from "./edit/PeopleFields";
import { RegistrationQuestionsField } from "./edit/RegistrationQuestionsField";
import { BackgroundField, type CoverChange, CoverField } from "./edit/SetupFields";
import { TimeZonePickerModal } from "./TimeZonePickerModal";
import { getUserFacingApiReason, useCalEventActions } from "./useCalEventActions";
import { WallDateTimePicker } from "./WallDateTimePicker";

type TabId =
  | "basics"
  | "appearance"
  | "location"
  | "page-content"
  | "hosts"
  | "capacity"
  | "registration-form"
  | "payment"
  | "privacy-security";

/**
 * The web editor's tabs, in its order. Guests (the roster), Workflows and Webhooks aren't here:
 * they're separate features, not fields of the event.
 */
const TABS: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "basics", label: "Basics", icon: "document-text-outline" },
  { id: "appearance", label: "Appearance", icon: "brush-outline" },
  { id: "location", label: "Locations", icon: "location-outline" },
  { id: "page-content", label: "Page content", icon: "grid-outline" },
  { id: "hosts", label: "Hosts", icon: "people-outline" },
  { id: "capacity", label: "Settings", icon: "settings-outline" },
  { id: "registration-form", label: "Registration form", icon: "clipboard-outline" },
  { id: "payment", label: "Payment", icon: "card-outline" },
  { id: "privacy-security", label: "Privacy & security", icon: "lock-closed-outline" },
];

/** Which tab shows each error, so a failed save can jump to it like the web does. */
const ERROR_TABS: Record<CalEventEditErrorKey, TabId> = {
  name: "basics",
  time: "basics",
  description: "basics",
  slug: "basics",
  background: "appearance",
  liveStreams: "location",
  lineup: "page-content",
  schedule: "page-content",
  capacity: "capacity",
  registrationFields: "registration-form",
  paymentTimeoutMinutes: "payment",
};

type MenuItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
};

interface EditCalEventScreenProps {
  /** The event as `GET /v2/events/{uuid}` returns it; the form prefills from it once. */
  event: CalEvent;
  onClose: () => void;
  onSaved: (event: CalEvent | null) => void;
}

type FormUpdate =
  | Partial<CalEventEditFormValues>
  | ((current: CalEventEditFormValues) => Partial<CalEventEditFormValues>);

/**
 * The web editor (app.cal.com/events/{uuid}) at phone width: the same header, tabs and fields.
 * One Save sends only what changed; locations and co-hosts have their own endpoints and apply as
 * soon as they're added.
 */
export function EditCalEventScreen({ event, onClose, onSaved }: EditCalEventScreenProps) {
  const theme = useEditTheme();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const actions = useCalEventActions();
  const scrollRef = useRef<ScrollView>(null);

  // Prefilled once: a refetch while editing must not reset what the user typed.
  const [initial] = useState(() => buildEditFormValues(event));
  const [values, setValues] = useState(initial);
  const [cover, setCover] = useState<CoverChange>({ kind: "keep" });
  const [tab, setTab] = useState<TabId>("basics");
  const [openPicker, setOpenPicker] = useState<"start" | "end" | "timeZone" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const { mutateAsync: saveEvent } = useUpdateCalEvent();
  const { mutateAsync: saveCover } = useCalEventCoverImage();

  const update = (patch: FormUpdate) =>
    setValues((current) => ({
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    }));

  const published = event.publishedAt !== null;
  const input = useMemo(
    () => buildCalEventUpdateInput(initial, values, event),
    [initial, values, event]
  );
  const dirty = Object.keys(input).length > 0 || cover.kind !== "keep";
  const allErrors = getEditCalEventErrors(values, initial, event);
  // Like the web form: no messages until the first save, then they follow every change.
  const errors = submitted ? allErrors : {};

  usePreventRemove(dirty && !saving, ({ data }) => {
    Alert.alert(
      "Unsaved changes",
      "You have unsaved changes to this event. If you leave now, they will be lost.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave without saving",
          style: "destructive",
          onPress: () => navigation.dispatch(data.action),
        },
      ]
    );
  });

  const showTab = (next: TabId) => {
    setTab(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const save = () => {
    if (saving) return;
    setSubmitted(true);
    const firstError = (Object.keys(allErrors) as CalEventEditErrorKey[])[0];
    if (firstError) {
      showTab(ERROR_TABS[firstError]);
      showInfoAlert("Error", "Please fix the form errors before saving.");
      return;
    }
    // The save sends what the form holds now and closes on success, so later edits would be lost.
    Keyboard.dismiss();
    setSaving(true);
    // A promise chain, not try/catch: the React Compiler can't compile conditionals in a try.
    persist().then(onSaved, (error) => {
      setSaving(false);
      showInfoAlert(
        "Error",
        getUserFacingApiReason(error) ?? "Failed to save the event. Please try again."
      );
    });
  };

  const persist = async (): Promise<CalEvent | null> => {
    // The cover first: a failed upload then leaves the rest unsaved and the form open.
    if (cover.kind !== "keep") {
      await saveCover({ uuid: event.uuid, file: cover.kind === "replace" ? cover.file : null });
      // Saved: a retry after the PATCH below fails must not upload it again.
      setCover({ kind: "keep" });
    }
    if (Object.keys(input).length > 0) return saveEvent({ uuid: event.uuid, input });
    queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.detail(event.uuid) });
    queryClient.invalidateQueries({ queryKey: queryKeys.calEvents.lists() });
    return null;
  };

  const publish = () => {
    if (dirty) {
      showInfoAlert("Save your changes first", "Save your edits before publishing the event.");
      return;
    }
    actions.onPublish(event);
  };

  const status = getCalEventStatusColors(event.status, isDark);
  // A live event's start may have passed: the picker then still offers its own day.
  const today = todayStartWallTime(values.timeZone);
  const minStart =
    wallTimeDiffMs(today, initial.startWallTime) < 0
      ? `${initial.startWallTime.slice(0, 10)}T00:00`
      : today;
  const publicUrl = getCalEventPublicUrl(values.slug.trim() || event.slug);
  const urlPrefix = getCalEventPublicUrl("").replace(/^https?:\/\//, "");
  const category = CAL_EVENT_CATEGORIES.find((option) => option.value === values.category);

  const viewPage: MenuItem = {
    label: "View event page",
    icon: "open-outline",
    onPress: () => actions.onOpenPage(event),
  };
  // No "Preview" for a draft: its public page 404s until published (see getCalEventLinkActions).
  const menuItems: MenuItem[] =
    event.status === "draft"
      ? [{ label: "Publish", icon: "rocket-outline", onPress: publish }]
      : event.status === "published"
        ? [
            viewPage,
            { label: "Copy link", icon: "link-outline", onPress: () => actions.onCopyLink(event) },
            { label: "Share event", icon: "share-outline", onPress: () => actions.onShare(event) },
            {
              label: "Cancel event",
              icon: "ban-outline",
              destructive: true,
              onPress: () => actions.onCancel(event),
            },
          ]
        : [viewPage];

  const tabContent: Record<TabId, ReactNode> = {
    basics: (
      <>
        <EditSection title="Basics">
          <EditTextField
            label="Title"
            value={values.name}
            onChangeText={(name) => update({ name })}
            maxLength={CAL_EVENT_NAME_MAX_LENGTH}
            error={errors.name}
          />
          <SwitchRow
            label="Private event"
            hint="Unlisted: only people with the link can find it"
            value={values.isPrivate}
            onValueChange={(isPrivate) => update({ isPrivate })}
          />
          <EditTextField
            label="About the event"
            hint="Markdown works: **bold**, _italic_, [links](https://cal.com)."
            value={values.description}
            onChangeText={(description) => update({ description })}
            placeholder="Tell guests what your event is about"
            multiline
            maxLength={CAL_EVENT_DESCRIPTION_MAX_LENGTH}
            error={errors.description}
          />
          <View style={{ gap: 6 }}>
            <EditTextField
              label="URL"
              prefix={urlPrefix}
              value={values.slug}
              onChangeText={(slug) =>
                update({ slug: slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })
              }
              autoCapitalize="none"
              editable={!published}
              maxLength={CAL_EVENT_SLUG_MAX_LENGTH}
              error={errors.slug}
              accessibilityLabel="URL"
              trailing={
                <Pressable
                  onPress={() =>
                    Clipboard.setStringAsync(publicUrl).then(
                      () => showSuccessAlert("Link Copied", "Link copied!"),
                      () => showInfoAlert("Error", "Failed to copy link. Please try again.")
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Copy to clipboard"
                  hitSlop={8}
                >
                  <Ionicons name="clipboard-outline" size={20} color={theme.textSecondary} />
                </Pressable>
              }
            />
            {published ? (
              <HintText>
                The event URL can't change after the event is published, so links you already shared
                keep working
              </HintText>
            ) : null}
          </View>
        </EditSection>

        <EditSection title="Date and time">
          <DateTimeField
            label="Starts"
            value={values.startWallTime}
            onPress={() => setOpenPicker("start")}
          />
          <DateTimeField
            label="Ends"
            value={values.endWallTime}
            onPress={() => setOpenPicker("end")}
            error={errors.time}
          />
          <View style={{ gap: 6 }}>
            <FieldLabel label="Timezone" />
            <SelectButton
              label={values.timeZone}
              accessibilityLabel={`Timezone, ${values.timeZone}`}
              onPress={() => setOpenPicker("timeZone")}
              icon="chevron-expand-outline"
            />
          </View>
        </EditSection>
      </>
    ),
    appearance: (
      <EditSection title="Appearance">
        <ChoiceChips
          label="Category"
          hint={category?.hint}
          options={CAL_EVENT_CATEGORIES}
          value={values.category}
          onChange={(next) => update({ category: next })}
        />
        <ChoiceChips
          label="Theme"
          options={[
            { value: null, label: "System default" },
            { value: "light" as const, label: "Light" },
            { value: "dark" as const, label: "Dark" },
          ]}
          value={values.theme}
          onChange={(next) => update({ theme: next })}
        />
        <CoverField
          currentUrl={event.coverImageUrl}
          change={cover}
          onChange={setCover}
          category={values.category}
        />
        <BackgroundField
          value={values.background}
          onChange={(background) => update({ background })}
          error={errors.background}
        />
      </EditSection>
    ),
    location: (
      <LocationsSection
        event={event}
        liveStreams={values.liveStreams}
        onLiveStreamsChange={(liveStreams) => update({ liveStreams })}
        liveStreamsError={errors.liveStreams}
      />
    ),
    "page-content": (
      <PageContentSection
        uuid={event.uuid}
        values={values}
        onChange={update}
        errors={{ lineup: errors.lineup, schedule: errors.schedule }}
      />
    ),
    hosts: (
      <EditSection title="Hosts">
        <HostsField
          event={event}
          hostUserIds={values.hostUserIds}
          onChange={(hostUserIds) => update({ hostUserIds })}
        />
        <CoHostsField uuid={event.uuid} />
        {event.teamId !== null ? (
          <SwitchRow
            label="Show who's presenting"
            hint={`Show your team or organization under "Presented by" on the event page. When off, a sole host is shown there instead.`}
            value={values.showPresentedBy}
            onValueChange={(showPresentedBy) => update({ showPresentedBy })}
          />
        ) : null}
      </EditSection>
    ),
    capacity: (
      <EditSection title="Settings">
        <SwitchRow
          label="Capacity"
          hint="Limit how many people can attend this event."
          value={values.capacityEnabled}
          onValueChange={(capacityEnabled) =>
            update((current) => ({
              capacityEnabled,
              // The waitlist only opens once a capacity fills, so it goes with it.
              waitlistEnabled: capacityEnabled ? current.waitlistEnabled : false,
            }))
          }
        />
        {values.capacityEnabled ? (
          <EditTextField
            value={values.capacity}
            onChangeText={(capacity) => update({ capacity: capacity.replace(/\D/g, "") })}
            placeholder="50"
            keyboardType="number-pad"
            maxLength={String(CAL_EVENT_MAX_CAPACITY).length}
            error={errors.capacity}
            accessibilityLabel="Capacity"
          />
        ) : null}
        <SwitchRow
          label="Waitlist"
          hint={
            values.capacityEnabled
              ? "Let guests join a waitlist once the event is full."
              : "Waitlist requires a capacity limit"
          }
          value={values.waitlistEnabled}
          disabled={!values.capacityEnabled}
          onValueChange={(waitlistEnabled) => update({ waitlistEnabled })}
        />
      </EditSection>
    ),
    "registration-form": (
      <EditSection title="Registration form">
        <RegistrationQuestionsField
          fields={values.registrationFields}
          onChange={(registrationFields) => update({ registrationFields })}
          error={errors.registrationFields}
        />
      </EditSection>
    ),
    payment: (
      <EditSection title="Payment">
        <HintText>
          Prices are set per location: add a priced location in the Locations tab. An existing
          location's price can't be changed.
        </HintText>
        <EditTextField
          label="Payment deadline (minutes)"
          hint="How long a guest's spot is held while they complete payment. After the deadline the spot is released. Leave empty to use the default (10 minutes)."
          value={values.paymentTimeoutMinutes}
          onChangeText={(text) => update({ paymentTimeoutMinutes: text.replace(/\D/g, "") })}
          placeholder="10"
          keyboardType="number-pad"
          maxLength={5}
          error={errors.paymentTimeoutMinutes}
        />
        <HintText>
          Payments are processed with Cal Pay. If approval is required, guests pay only after the
          host approves them.
        </HintText>
      </EditSection>
    ),
    "privacy-security": (
      <EditSection title="Privacy & security">
        <SwitchRow
          label="Requires confirmation"
          hint="Bookings wait for your approval before they're confirmed."
          value={values.requiresApproval}
          onValueChange={(requiresApproval) => update({ requiresApproval })}
        />
        <SwitchRow
          label="Hide host's email"
          hint="Hide host's email address from event detail screen, email notifications, and calendar events."
          value={!values.showOrganizerEmail}
          onValueChange={(hide) => update({ showOrganizerEmail: !hide })}
        />
        <View style={{ gap: 8 }}>
          <FieldLabel
            label="Public guests"
            hint="Choose how visitors see who's coming. If you show names, guests are told their attendance will be public and can hide themselves when they register."
          />
          <RadioList
            options={CAL_EVENT_GUEST_LISTS}
            value={values.guestList}
            disabled={published}
            onChange={(guestList) => update({ guestList })}
          />
          {published ? (
            <HintText>
              This choice is locked because guests have already registered under it. They were told
              what would be public when they signed up, so it can’t change on a published event.
            </HintText>
          ) : null}
        </View>
      </EditSection>
    ),
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.backgroundSecondary }}
    >
      <View style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            height: 56,
            gap: 10,
          }}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={10}
            style={{ padding: 4 }}
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <Text
            style={{ flexShrink: 1, color: theme.text, fontSize: 18, fontWeight: "700" }}
            numberOfLines={1}
          >
            {truncateCalEventTitle(values.name.trim() || "Untitled event")}
          </Text>
          <View
            style={{
              backgroundColor: status.background,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: status.text, fontSize: 13, fontWeight: "600" }}>
              {CAL_EVENT_STATUS_LABELS[event.status]}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More actions"
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: theme.border,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={theme.text} />
              </Pressable>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              insets={{ top: insets.top, bottom: insets.bottom, left: 12, right: 12 }}
              sideOffset={8}
              className="w-48"
              align="end"
            >
              {menuItems.map((item) => (
                <DropdownMenuItem key={item.label} onPress={item.onPress}>
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={item.destructive ? theme.destructive : theme.textSecondary}
                    style={{ marginRight: 8 }}
                  />
                  <MenuText style={item.destructive ? { color: theme.destructive } : undefined}>
                    {item.label}
                  </MenuText>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Pressable
            onPress={save}
            disabled={!dirty || saving}
            testID="edit-event-save"
            accessibilityRole="button"
            accessibilityState={{ disabled: !dirty || saving, busy: saving }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 36,
              paddingHorizontal: 16,
              borderRadius: 10,
              backgroundColor: theme.text,
              opacity: dirty ? 1 : 0.4,
            }}
          >
            {saving ? <ActivityIndicator size="small" color={theme.background} /> : null}
            <Text style={{ color: theme.background, fontSize: 16, fontWeight: "600" }}>Save</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8, gap: 4 }}
          style={{ borderBottomWidth: 1, borderBottomColor: theme.border, flexGrow: 0 }}
        >
          {TABS.map((item) => {
            const selected = item.id === tab;
            const hasError = (Object.keys(errors) as CalEventEditErrorKey[]).some(
              (key) => ERROR_TABS[key] === item.id
            );
            return (
              <Pressable
                key={item.id}
                onPress={() => showTab(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityHint={hasError ? "Has errors" : undefined}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  height: 38,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  backgroundColor: selected ? theme.backgroundEmphasis : "transparent",
                }}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={selected ? theme.text : theme.textSecondary}
                />
                <Text
                  style={{
                    color: selected ? theme.text : theme.textSecondary,
                    fontSize: 15,
                    fontWeight: selected ? "600" : "500",
                  }}
                >
                  {item.label}
                </Text>
                {hasError ? (
                  <View
                    style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.error }}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48 }}
      >
        {/* Read-only while saving; the list itself still scrolls. */}
        <View pointerEvents={saving ? "none" : "auto"} style={{ gap: 24 }}>
          {tabContent[tab]}
        </View>
      </ScrollView>

      <WallDateTimePicker
        visible={openPicker === "start"}
        title="Starts"
        value={values.startWallTime}
        minWallTime={minStart}
        onChange={(next) => update((current) => moveStart(current, next))}
        onClose={() => setOpenPicker(null)}
      />
      <WallDateTimePicker
        visible={openPicker === "end"}
        title="Ends"
        value={values.endWallTime}
        minWallTime={minEndWallTime(values.startWallTime)}
        onChange={(next) =>
          update((current) => {
            // Android's time dialog has no minimum: hold the end 15 minutes after the start.
            const earliest = minEndWallTime(current.startWallTime);
            return { endWallTime: wallTimeDiffMs(earliest, next) < 0 ? earliest : next };
          })
        }
        onClose={() => setOpenPicker(null)}
      />
      <TimeZonePickerModal
        visible={openPicker === "timeZone"}
        value={values.timeZone}
        onSelect={(timeZone) => {
          // As on the web: the wall times stay put unless the start would then be past.
          update((current) => ({
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

function DateTimeField({
  label,
  value,
  onPress,
  error,
}: {
  label: string;
  value: string;
  onPress: () => void;
  error?: string;
}) {
  const theme = useEditTheme();
  const text = value ? formatWallDateTime(value) : "Select date";
  return (
    <View style={{ gap: 6 }}>
      <FieldLabel label={label} />
      <SelectButton
        label={text}
        accessibilityLabel={`${label}, ${text}`}
        onPress={onPress}
        leadingIcon="calendar-outline"
        error={!!error}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.error, fontSize: 14 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** A bordered button that looks like the web's select and date triggers. */
function SelectButton({
  label,
  accessibilityLabel,
  onPress,
  leadingIcon,
  icon,
  error = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: boolean;
}) {
  const theme = useEditTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: error ? theme.error : theme.border,
        backgroundColor: theme.background,
      }}
    >
      {leadingIcon ? <Ionicons name={leadingIcon} size={18} color={theme.textSecondary} /> : null}
      <Text style={{ flex: 1, color: theme.text, fontSize: 16 }} numberOfLines={1}>
        {label}
      </Text>
      {icon ? <Ionicons name={icon} size={18} color={theme.textSecondary} /> : null}
    </Pressable>
  );
}

/** Radio rows with a description each, like the web's "Public guests" choice. */
function RadioList<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const theme = useEditTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 4, opacity: disabled ? 0.5 : 1 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            accessibilityHint={option.hint}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 }}
          >
            <Ionicons
              name={selected ? "radio-button-on" : "radio-button-off"}
              size={22}
              color={selected ? theme.text : theme.textMuted}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }}>
                {option.label}
              </Text>
              <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{option.hint}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
