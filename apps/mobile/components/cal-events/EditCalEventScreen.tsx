import { Ionicons } from "@expo/vector-icons";
import { usePreventRemove } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Stack, useNavigation } from "expo-router";
import { type ComponentProps, type ReactNode, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  HEADER_ICON_BUTTON_CLASS,
  HEADER_PILL_CLASS,
  HeaderBackButton,
  HeaderSaveButton,
} from "@/components/HeaderButtons";
import { RichTextEditor } from "@/components/RichTextEditor";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Text as MenuText } from "@/components/ui/text";
import {
  refetchCalEventRoster,
  useCalEventCoverImage,
  useCalEventLocations,
  useHour12,
  useUpdateCalEvent,
  useUpdateCalEventLocation,
} from "@/hooks";
import type { CalEvent } from "@/services/calcom";
import {
  showConfirmAlert,
  showInfoAlert,
  showNotAvailableAlert,
  showSuccessAlert,
} from "@/utils/alerts";
import { CAL_EVENT_NAME_MAX_LENGTH, minEndWallTime, moveStart } from "@/utils/cal-event-create";
import {
  buildCalEventLocationPriceUpdates,
  buildCalEventUpdateInput,
  buildEditFormValues,
  CAL_EVENT_CATEGORIES,
  CAL_EVENT_GUEST_LISTS,
  CAL_EVENT_MAX_CAPACITY,
  CAL_EVENT_SLUG_MAX_LENGTH,
  type CalEventEditErrorKey,
  type CalEventEditFormValues,
  getEditCalEventErrors,
  hasCalEventPrice,
} from "@/utils/cal-event-edit";
import {
  CAL_EVENT_STATUS_LABELS,
  getCalEventEditorUrl,
  getCalEventPublicUrl,
  getCalEventStatusColors,
  isPaidCalEvent,
  truncateCalEventTitle,
} from "@/utils/cal-events";
import { formatWallDateTime } from "@/utils/date-time-format";
import { offlineAwareRefresh } from "@/utils/network";
import {
  preserveWallTimeOnTimezoneChange,
  todayStartWallTime,
  wallTimeDiffMs,
} from "@/utils/wall-time";
import { getCalEventHeaderMenu } from "./calEventHeaderMenu";
import {
  EditSection,
  EditTextField,
  ErrorText,
  FieldLabel,
  HintText,
  SwitchRow,
  useEditSurfaces,
  useEditTheme,
  useFieldBackground,
} from "./edit/EditControls";
import { GuestsSection } from "./edit/GuestsSection";
import { LocationsSection } from "./edit/LocationsSection";
import { PageContentSection } from "./edit/PageContentSection";
import { PaymentSection } from "./edit/PaymentSection";
import { CoHostsField, HostsField } from "./edit/PeopleFields";
import { RegistrationQuestionsField } from "./edit/RegistrationQuestionsField";
import { SelectField } from "./edit/SelectField";
import { BackgroundField, type CoverChange, CoverField, ThemeField } from "./edit/SetupFields";
import { TimeZonePickerModal } from "./TimeZonePickerModal";
import {
  getUserFacingApiReason,
  useCalEventActions,
  useOpenCalEventEditor,
} from "./useCalEventActions";
import { WallDateTimePicker } from "./WallDateTimePicker";

type TabId =
  | "basics"
  | "appearance"
  | "location"
  | "page-content"
  | "hosts"
  | "capacity"
  | "guests"
  | "registration-form"
  | "payment"
  | "privacy-security"
  | "other";

/**
 * The web editor's tabs, in its order. Guests is the roster, not fields of the event: its actions
 * apply at once, outside Save. Workflows and Webhooks are only on the web, so "Other" links to
 * them like the event type editor's tab of the same name.
 */
const TABS: {
  id: TabId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** The iOS header menu's icon. */
  sf: SFSymbol;
}[] = [
  { id: "basics", label: "Basics", icon: "document-text-outline", sf: "doc.text" },
  { id: "appearance", label: "Appearance", icon: "brush-outline", sf: "paintbrush" },
  { id: "location", label: "Locations", icon: "location-outline", sf: "location" },
  { id: "page-content", label: "Page content", icon: "grid-outline", sf: "square.grid.2x2" },
  { id: "hosts", label: "Hosts", icon: "people-outline", sf: "person.2" },
  { id: "capacity", label: "Settings", icon: "settings-outline", sf: "gearshape" },
  { id: "guests", label: "Guests", icon: "people-circle-outline", sf: "person.3" },
  {
    id: "registration-form",
    label: "Registration form",
    icon: "clipboard-outline",
    sf: "list.clipboard",
  },
  { id: "payment", label: "Payment", icon: "card-outline", sf: "creditcard" },
  { id: "privacy-security", label: "Privacy & security", icon: "lock-closed-outline", sf: "lock" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal", sf: "ellipsis" },
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
  price: "payment",
  locationPrices: "payment",
  requiresApproval: "privacy-security",
};

type SFSymbol = Extract<ComponentProps<typeof Stack.Header.MenuAction>["icon"], string>;

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
  const surfaces = useEditSurfaces();
  const isDark = useColorScheme() === "dark";
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const actions = useCalEventActions();
  const openEditor = useOpenCalEventEditor();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);

  // Prefilled once: a refetch while editing must not reset what the user typed.
  const [initial, setInitial] = useState(() => buildEditFormValues(event));
  const [values, setValues] = useState(initial);
  const [cover, setCover] = useState<CoverChange>({ kind: "keep" });
  const [tab, setTab] = useState<TabId>("basics");
  const [openPicker, setOpenPicker] = useState<"start" | "end" | "timeZone" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pullingGuests, setPullingGuests] = useState(false);
  const { mutateAsync: saveEvent } = useUpdateCalEvent();
  const { mutateAsync: saveCover } = useCalEventCoverImage();
  const { mutateAsync: saveLocation } = useUpdateCalEventLocation();
  // Locations change outside the form (the Locations tab applies them at once), so prices and
  // rules follow the latest list.
  const { data: fetchedLocations } = useCalEventLocations(event.uuid);
  const locations = fetchedLocations ?? event.locations;
  // Like the web, which hides the Payment tab when payments aren't available. A server that
  // predates the flag doesn't send it.
  const paymentsEnabled = event.paymentsEnabled !== false;

  const update = (patch: FormUpdate) =>
    setValues((current) => ({
      ...current,
      ...(typeof patch === "function" ? patch(current) : patch),
    }));

  // A price set in the Locations tab makes the event paid. The Payment tab then shows it as if
  // the form had opened paid, rather than hiding the price behind a "Paid event" that's off.
  // Removing the last one there makes it free again, so the toggle goes off too: left on, every
  // save would ask for a price, which a published event's locked Payment tab can't give. Unless
  // the form still holds one: typed in the Payment tab, or a stream-only event's own.
  // Follows location prices only (the API folds an old event-level price into them): a price set
  // on the web for an event without locations would turn this on with an empty price field.
  const locationsPaid = isPaidCalEvent({ price: null, locations });
  const [wasLocationsPaid, setWasLocationsPaid] = useState(locationsPaid);
  if (locationsPaid !== wasLocationsPaid) {
    setWasLocationsPaid(locationsPaid);
    if (locationsPaid) {
      setInitial((current) => ({ ...current, paymentEnabled: true }));
      update({ paymentEnabled: true });
    } else if (values.paymentEnabled && !hasCalEventPrice(values, locations)) {
      setInitial((current) => ({ ...current, paymentEnabled: false }));
      update({ paymentEnabled: false });
    }
  }

  const published = event.publishedAt !== null;
  const input = useMemo(
    () => buildCalEventUpdateInput(initial, values, { ...event, locations }),
    [initial, values, event, locations]
  );
  const locationPrices = useMemo(
    () => buildCalEventLocationPriceUpdates(initial, values, locations),
    [initial, values, locations]
  );
  // A toggle turned on without a price sends nothing yet, but Save must still offer to check it.
  const dirty =
    Object.keys(input).length > 0 ||
    locationPrices.length > 0 ||
    values.paymentEnabled !== initial.paymentEnabled ||
    cover.kind !== "keep";
  const allErrors = getEditCalEventErrors(values, initial, {
    ...event,
    locations,
    paymentsEnabled,
  });
  // Like the web form: no messages until the first save, then they follow every change.
  const errors = submitted ? allErrors : {};

  // Set once a save succeeds, so the close that follows gets past the guard below.
  const saved = useRef(false);
  // Held while saving too: leaving mid-save would make the close after it pop the screen under
  // the editor instead. That attempt is ignored without the discard prompt.
  usePreventRemove(dirty || saving, ({ data }) => {
    if (saved.current) {
      navigation.dispatch(data.action);
      return;
    }
    if (saving) return;
    showConfirmAlert(
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

  // The Guests tab can be pulled to refresh: guests register and pay outside the app, and a paid
  // event's Approve all runs on in the background. The form tabs have nothing to fetch.
  const refreshGuests = () => {
    setPullingGuests(true);
    offlineAwareRefresh(() => refetchCalEventRoster(queryClient, event.uuid)).finally(() =>
      setPullingGuests(false)
    );
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
    persist().then(
      (updated) => {
        saved.current = true;
        onSaved(updated);
      },
      (error) => {
        setSaving(false);
        showInfoAlert(
          "Error",
          getUserFacingApiReason(error) ?? "Failed to save the event. Please try again."
        );
      }
    );
  };

  const persist = async (): Promise<CalEvent | null> => {
    // The cover first: a failed upload then leaves the rest unsaved and the form open.
    if (cover.kind !== "keep") {
      await saveCover({ uuid: event.uuid, file: cover.kind === "replace" ? cover.file : null });
      // Saved: a retry after the PATCH below fails must not upload it again.
      setCover({ kind: "keep" });
    }
    // Locations first, so the event is paid before a payment deadline is set on it. Each saved
    // price then matches the form, so a retry skips it.
    for (const { locationId, patch } of locationPrices) {
      await saveLocation({ uuid: event.uuid, locationId, patch });
    }
    if (Object.keys(input).length > 0) return saveEvent({ uuid: event.uuid, input });
    return null;
  };

  const publish = () => {
    if (dirty) {
      showInfoAlert("Save your changes first", "Save your edits before publishing the event.");
      return;
    }
    actions.onPublish(event);
  };

  // The page shows what is saved, so unsaved edits would be missing from the preview.
  const preview = () => {
    if (dirty) {
      showInfoAlert("Save your changes first", "Save your edits before previewing the event.");
      return;
    }
    actions.onPreview(event);
  };

  // Like the web: a paid event can't have both a waitlist and approval, so each locks the other.
  const waitlistBlocked = values.paymentEnabled && values.requiresApproval;
  const approvalBlocked = values.paymentEnabled && values.waitlistEnabled;
  // A live event's start may have passed: the picker then still offers its own day.
  const today = todayStartWallTime(values.timeZone);
  const minStart =
    wallTimeDiffMs(today, initial.startWallTime) < 0
      ? `${initial.startWallTime.slice(0, 10)}T00:00`
      : today;
  const publicUrl = getCalEventPublicUrl(values.slug.trim() || event.slug);
  const urlPrefix = getCalEventPublicUrl("").replace(/^https?:\/\//, "");
  const category = CAL_EVENT_CATEGORIES.find((option) => option.value === values.category);
  const tabs = paymentsEnabled ? TABS : TABS.filter((item) => item.id !== "payment");
  // The tab on screen: a refetch can turn payments off while the Payment tab is open.
  const currentTab = tabs.find((item) => item.id === tab) ?? tabs[0];
  const tabsWithErrors = new Set(
    (Object.keys(errors) as CalEventEditErrorKey[]).map((key) => ERROR_TABS[key])
  );
  const otherTabHasErrors = [...tabsWithErrors].some((id) => id !== currentTab.id);

  // As in the event type editor: iOS only says it's on the web; elsewhere the web editor opens on
  // that tab.
  const openOnWeb = (tabName: "workflows" | "webhooks", label: string) => {
    if (Platform.OS === "ios") {
      showNotAvailableAlert();
      return;
    }
    openEditor(getCalEventEditorUrl(event.uuid, tabName), label);
  };

  // The editor opens only for the event's owner and hosts, so every step is theirs.
  const menuItems = getCalEventHeaderMenu(event, true, {
    onOpenPage: () => actions.onOpenPage(event),
    onPreview: preview,
    onPublish: publish,
    onCopyLink: () => actions.onCopyLink(event),
    onShare: () => actions.onShare(event),
    onCancel: () => actions.onCancel(event),
  });

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
          <View style={{ gap: 6 }}>
            <FieldLabel label="About the event" />
            <RichTextEditor
              value={values.description}
              onChangeText={(description) => update({ description })}
              placeholder="Tell guests what your event is about"
              accessibilityLabel="About the event"
            />
            <ErrorText message={errors.description} />
          </View>
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
                      () => showSuccessAlert("Link copied", "Link copied!"),
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
        <SelectField
          label="Category"
          options={CAL_EVENT_CATEGORIES}
          value={values.category}
          onChange={(next) => update({ category: next })}
          helper={category?.hint}
        />
        <ThemeField value={values.theme} onChange={(next) => update({ theme: next })} />
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
            waitlistBlocked
              ? "Turn off approval before enabling a waitlist for this paid event."
              : values.capacityEnabled
                ? "Let guests join a waitlist once the event is full."
                : "Waitlist requires a capacity limit"
          }
          value={values.waitlistEnabled}
          disabled={!values.capacityEnabled || waitlistBlocked}
          onValueChange={(waitlistEnabled) => update({ waitlistEnabled })}
        />
      </EditSection>
    ),
    guests: (
      <GuestsSection
        event={event}
        locations={locations}
        onPageChange={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
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
      <PaymentSection
        event={event}
        locations={locations}
        values={values}
        onChange={update}
        errors={errors}
        showErrors={submitted}
      />
    ),
    "privacy-security": (
      <EditSection title="Privacy & security">
        <View style={{ gap: 6 }}>
          <SwitchRow
            label="Requires confirmation"
            hint={
              approvalBlocked
                ? "Paid waitlists cannot require approval."
                : "Bookings wait for your approval before they're confirmed."
            }
            value={values.requiresApproval}
            disabled={approvalBlocked && !values.requiresApproval}
            onValueChange={(requiresApproval) => update({ requiresApproval })}
          />
          <ErrorText message={errors.requiresApproval} />
        </View>
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
              This choice is locked once the event is published, so guests always see what they were
              told when they signed up.
            </HintText>
          ) : null}
        </View>
      </EditSection>
    ),
    other: (
      <EditSection title="Configure on web">
        <WebSettingRow
          label="Workflows"
          hint="Automated actions"
          icon="flash"
          onPress={() => openOnWeb("workflows", "Workflows settings")}
        />
        <WebSettingRow
          label="Webhooks"
          hint="Event notifications"
          icon="code"
          onPress={() => openOnWeb("webhooks", "Webhooks settings")}
        />
      </EditSection>
    ),
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: surfaces.screen }}
    >
      {Platform.OS === "ios" ? (
        <>
          {/* The link editor's native header: the tabs as a menu, then Save. */}
          <Stack.Screen
            options={{
              headerShown: true,
              title: truncateCalEventTitle(values.name.trim() || "Untitled event"),
              headerBackButtonDisplayMode: "minimal",
              headerTransparent: true,
            }}
          />
          <Stack.Header
            blurEffect={isLiquidGlassAvailable() ? undefined : isDark ? "dark" : "light"}
          >
            <Stack.Header.Right>
              {/* Publish and Cancel mutate the event too, so they wait for the save to settle. */}
              <Stack.Header.Menu disabled={saving} accessibilityLabel="More actions">
                <Stack.Header.Icon sf="ellipsis" />
                {menuItems.map((item) => (
                  <Stack.Header.MenuAction
                    key={item.label}
                    icon={item.systemImage}
                    destructive={item.destructive}
                    onPress={item.onPress}
                  >
                    {item.label}
                  </Stack.Header.MenuAction>
                ))}
              </Stack.Header.Menu>
              <Stack.Header.Menu
                accessibilityLabel={`Tab, ${currentTab.label}`}
                accessibilityHint={
                  otherTabHasErrors ? "Other tabs have errors" : "Shows the editor's tabs"
                }
              >
                <Stack.Header.Label>{currentTab.label}</Stack.Header.Label>
                {tabs.map((item) => (
                  <Stack.Header.MenuAction
                    key={item.id}
                    icon={item.id === currentTab.id ? "checkmark.circle.fill" : item.sf}
                    subtitle={tabsWithErrors.has(item.id) ? "Has errors" : undefined}
                    onPress={() => showTab(item.id)}
                  >
                    {item.label}
                  </Stack.Header.MenuAction>
                ))}
              </Stack.Header.Menu>
              <Stack.Header.Button
                onPress={save}
                disabled={!dirty || saving}
                variant="prominent"
                tintColor={isDark ? "#FFF" : "#000"}
              >
                Save
              </Stack.Header.Button>
            </Stack.Header.Right>
          </Stack.Header>
        </>
      ) : (
        // The link editor's round header buttons; the title gets its own row below them.
        <View style={{ paddingTop: insets.top, backgroundColor: theme.background }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              height: 64,
              gap: 8,
            }}
          >
            {/* Disabled while saving, which closes the editor itself when it's done. */}
            <HeaderBackButton onPress={onClose} disabled={saving} />
            <View style={{ flex: 1 }} />
            <DropdownMenu>
              {/* Publish and Cancel mutate the event too, so they wait for the save to settle. */}
              <DropdownMenuTrigger asChild disabled={saving}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More actions"
                  accessibilityState={{ disabled: saving }}
                  hitSlop={8}
                  className={HEADER_ICON_BUTTON_CLASS}
                  style={{ opacity: saving ? 0.4 : 1 }}
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
            {/* The tabs as one menu, like the link editor's. Its root view is the row's item,
                so it's what shrinks on a narrow screen: the label truncates and Save stays whole. */}
            <DropdownMenu style={{ flexShrink: 1 }}>
              <DropdownMenuTrigger asChild>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Tab, ${currentTab.label}`}
                  accessibilityHint={
                    otherTabHasErrors ? "Other tabs have errors" : "Shows the editor's tabs"
                  }
                  hitSlop={8}
                  className={HEADER_PILL_CLASS}
                  style={{ maxWidth: 170 }}
                >
                  <Text
                    className="text-[15px] font-medium text-[#000000] dark:text-white"
                    style={{ flexShrink: 1 }}
                    numberOfLines={1}
                  >
                    {currentTab.label}
                  </Text>
                  {otherTabHasErrors ? <ErrorDot /> : null}
                </Pressable>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                insets={{ top: insets.top, bottom: insets.bottom, left: 12, right: 12 }}
                sideOffset={8}
                className="w-56"
                align="end"
              >
                {tabs.map((item) => {
                  const selected = item.id === currentTab.id;
                  const hasErrors = tabsWithErrors.has(item.id);
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onPress={() => showTab(item.id)}
                      // The checkmark and the error dot are only drawn, so the label says them:
                      // the web drops accessibilityState and hints.
                      accessibilityLabel={`${item.label}${selected ? ", selected" : ""}${hasErrors ? ", has errors" : ""}`}
                    >
                      <Ionicons
                        name={selected ? "checkmark-circle" : item.icon}
                        size={18}
                        color={selected ? theme.text : theme.textSecondary}
                        style={{ marginRight: 8 }}
                      />
                      <MenuText style={selected ? { fontWeight: "600" } : undefined}>
                        {item.label}
                      </MenuText>
                      {hasErrors ? (
                        <View style={{ marginLeft: 8 }}>
                          <ErrorDot />
                        </View>
                      ) : null}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <HeaderSaveButton
              onPress={save}
              saving={saving}
              dirty={dirty}
              testID="edit-event-save"
            />
          </View>

          {/* The title has its own row so the header's buttons leave it room. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 16,
              paddingBottom: 12,
            }}
          >
            <Text
              style={{ flexShrink: 1, color: theme.text, fontSize: 20, fontWeight: "700" }}
              numberOfLines={1}
            >
              {values.name.trim() || "Untitled event"}
            </Text>
            <StatusBadge status={event.status} />
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 48 }}
        refreshControl={
          currentTab.id === "guests" ? (
            <RefreshControl refreshing={pullingGuests} onRefresh={refreshGuests} />
          ) : undefined
        }
      >
        {/* Read-only while saving; the list itself still scrolls. */}
        <View pointerEvents={saving ? "none" : "auto"} style={{ gap: 24 }}>
          {/* iOS has the title in its header, so only the status is left to show. */}
          {Platform.OS === "ios" ? <StatusBadge status={event.status} /> : null}
          {tabContent[currentTab.id]}
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

function StatusBadge({ status }: { status: CalEvent["status"] }) {
  const isDark = useColorScheme() === "dark";
  const colors = getCalEventStatusColors(status, isDark);
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors.background,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
        {CAL_EVENT_STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

function ErrorDot() {
  const theme = useEditTheme();
  return <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.error }} />;
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
  const hour12 = useHour12();
  const text = value ? formatWallDateTime(value, { hour12 }) : "Select date";
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

/** A row that leads to a setting only the web editor has. */
function WebSettingRow({
  label,
  hint,
  icon,
  onPress,
}: {
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const theme = useEditTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={`${hint}. Configured on the web.`}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.backgroundEmphasis,
        }}
      >
        <Ionicons name={icon} size={18} color={theme.textSecondary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }}>{label}</Text>
        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{hint}</Text>
      </View>
      <Ionicons name="open-outline" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

/** A select or date trigger, filled like the text fields. */
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
  const fieldBackground = useFieldBackground();
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
        borderRadius: 8,
        borderWidth: 1,
        borderColor: error ? theme.error : "transparent",
        backgroundColor: fieldBackground,
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
