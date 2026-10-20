import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { getUserFacingApiReason } from "@/components/cal-events/useCalEventActions";
import {
  useAddCalEventLocation,
  useCalEventLocations,
  useRemoveCalEventLocation,
  useUpdateCalEventLocation,
} from "@/hooks";
import type { CalEvent, CalEventLocation } from "@/services/calcom";
import { showInfoAlert, showSilentSuccessAlert } from "@/utils/alerts";
import {
  type AddCalEventLocationFormValues,
  buildAddCalEventLocationInput,
  buildUpdateCalEventLocationInput,
  CAL_EVENT_CURRENCIES,
  CAL_EVENT_LOCATION_LABEL_MAX_LENGTH,
  type CalEventLocationFormValues,
  calEventLocationFormValues,
  describeCalEventLocation,
  type EditableCalEventLocation,
  getCalEventLocationError,
  isCalEventLocationRemovalLocked,
} from "@/utils/cal-event-edit";
import { formatCalEventPrice } from "@/utils/cal-events";
import {
  ChoiceChips,
  EditSection,
  EditSheet,
  EditTextField,
  ErrorText,
  HintText,
  TextButton,
  useEditTheme,
} from "./EditControls";
import { SelectField } from "./SelectField";
import { LiveStreamsField } from "./SetupFields";

export const LOCATION_TYPE_LABELS: Record<CalEventLocation["type"], string> = {
  address: "In person",
  link: "Link",
  integration: "Conferencing",
  organizersDefaultApp: "Conferencing",
  unknown: "Location",
};

const EMPTY_LOCATION: AddCalEventLocationFormValues = {
  kind: "address",
  value: "",
  label: "",
  capacity: "",
  price: "",
  currency: "usd",
};

/** The sheet: a new location (null) or a saved one, and its fields as typed. */
interface LocationDraft {
  location: EditableCalEventLocation | null;
  values: CalEventLocationFormValues;
}

const isEditable = (location: CalEventLocation): location is EditableCalEventLocation =>
  location.type !== "unknown";

/**
 * Where the event happens. Locations have their own endpoints, so adding, changing and removing
 * one applies at once, outside the form's Save; on a published event the guests are emailed.
 */
export function LocationsSection({
  event,
  liveStreams,
  onLiveStreamsChange,
  liveStreamsError,
}: {
  event: Pick<CalEvent, "uuid" | "locations" | "publishedAt" | "price" | "paymentsEnabled">;
  liveStreams: string[];
  onLiveStreamsChange: (liveStreams: string[]) => void;
  liveStreamsError?: string;
}) {
  const theme = useEditTheme();
  const { data: fetched } = useCalEventLocations(event.uuid);
  const locations = fetched ?? event.locations;
  const [draft, setDraft] = useState<LocationDraft | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { mutate: addLocation, isPending: isAdding } = useAddCalEventLocation();
  const { mutate: updateLocation, isPending: isUpdating } = useUpdateCalEventLocation();
  const { mutate: removeLocation, isPending: isRemoving } = useRemoveCalEventLocation();
  const published = !!event.publishedAt;
  // Without payments the server rejects a price, so the sheet doesn't offer one.
  const paymentsEnabled = event.paymentsEnabled !== false;

  const hasAddress = locations.some((location) => location.type === "address");
  const removalLocked = isCalEventLocationRemovalLocked(event, locations);
  const others = draft?.location
    ? locations.filter((location) => location.id !== draft.location?.id)
    : locations;
  const error = draft && submitted ? getCalEventLocationError(draft.values, others) : null;

  const openNew = () => {
    setSubmitted(false);
    setDraft({
      location: null,
      values: { ...EMPTY_LOCATION, kind: hasAddress ? "link" : "address" },
    });
  };

  const openSaved = (location: EditableCalEventLocation) => {
    setSubmitted(false);
    setDraft({ location, values: calEventLocationFormValues(location) });
  };

  const onFailure = (action: string) => (failure: Error) =>
    showInfoAlert(
      "Error",
      getUserFacingApiReason(failure) ?? `Failed to ${action} the location. Please try again.`
    );

  /** Asks first on a published event, whose guests get an email about the change. */
  const confirmIfPublished = (title: string, message: string, action: string, run: () => void) => {
    if (!published) {
      run();
      return;
    }
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: action, onPress: run },
    ]);
  };

  const submit = () => {
    if (!draft) return;
    setSubmitted(true);
    if (getCalEventLocationError(draft.values, others)) return;
    const { location, values } = draft;
    if (!location) {
      confirmIfPublished(
        "Add location",
        "It's added right away, and registered guests are emailed about it.",
        "Add",
        () =>
          addLocation(
            {
              uuid: event.uuid,
              location: buildAddCalEventLocationInput(values as AddCalEventLocationFormValues),
            },
            {
              onSuccess: () => {
                setDraft(null);
                showSilentSuccessAlert("Location added", "The location was added to your event");
              },
              onError: onFailure("add"),
            }
          )
      );
      return;
    }
    const patch = buildUpdateCalEventLocationInput(values, location);
    if (!patch || !location.id) {
      setDraft(null);
      return;
    }
    const locationId = location.id;
    confirmIfPublished(
      "Save location",
      "It's saved right away, and registered guests are emailed about the change.",
      "Save",
      () =>
        updateLocation(
          { uuid: event.uuid, locationId, patch },
          {
            onSuccess: () => {
              setDraft(null);
              showSilentSuccessAlert("Location saved", "The location was updated");
            },
            onError: onFailure("save"),
          }
        )
    );
  };

  const remove = (location: CalEventLocation) => {
    const locationId = location.id;
    if (!locationId) return;
    Alert.alert(
      "Remove location",
      published
        ? "It's removed right away, and registered guests are emailed about it."
        : "It's removed right away.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            removeLocation(
              { uuid: event.uuid, locationId },
              {
                onSuccess: () =>
                  showSilentSuccessAlert("Location removed", "The location was removed"),
                onError: onFailure("remove"),
              }
            ),
        },
      ]
    );
  };

  const update = (patch: Partial<CalEventLocationFormValues>) =>
    setDraft((current) =>
      current ? { ...current, values: { ...current.values, ...patch } } : current
    );

  const editing = draft?.location ?? null;
  const values = draft?.values ?? null;
  // A published event's prices can't change: guests who registered paid them.
  const priceLocked = editing !== null && published;
  const hasValue = values?.kind === "address" || values?.kind === "link";

  return (
    <>
      <EditSection title="Locations">
        {locations.map((location, index) => {
          const editable = isEditable(location) && !!location.id;
          const name = describeCalEventLocation(location);
          return (
            <View
              key={location.id ?? `${location.type}-${index}`}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
                padding: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                backgroundColor: theme.backgroundMuted,
              }}
            >
              <Pressable
                onPress={editable && isEditable(location) ? () => openSaved(location) : undefined}
                disabled={!editable}
                accessibilityRole={editable ? "button" : undefined}
                accessibilityHint={editable ? "Edits this location" : undefined}
                style={{ flex: 1, gap: 4 }}
              >
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {LOCATION_TYPE_LABELS[location.type]}
                </Text>
                <Text style={{ color: theme.text, fontSize: 16 }}>{name}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {[
                    location.label,
                    `Capacity: ${location.capacity ?? "Unlimited"}`,
                    location.price
                      ? formatCalEventPrice(location.price, location.currency ?? null)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
                {editable && removalLocked ? (
                  <HintText>
                    This location can't be removed — guests already chose it when they registered.
                  </HintText>
                ) : null}
              </Pressable>
              {editable ? (
                <Pressable
                  onPress={() => remove(location)}
                  disabled={removalLocked || isRemoving}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove location ${name}`}
                  accessibilityState={{ disabled: removalLocked || isRemoving }}
                  hitSlop={8}
                  style={{ padding: 4, opacity: removalLocked || isRemoving ? 0.3 : 1 }}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <HintText>Location changes apply right away, without Save.</HintText>
        <TextButton icon="add" label="Add a location" onPress={openNew} />
      </EditSection>

      <EditSection title="Live streams" description="Shown publicly on your event page.">
        <LiveStreamsField
          value={liveStreams}
          onChange={onLiveStreamsChange}
          error={liveStreamsError}
        />
      </EditSection>

      <EditSheet
        visible={draft !== null}
        title={editing ? "Edit location" : "Add a location"}
        doneLabel={editing ? "Save" : "Add"}
        busy={isAdding || isUpdating}
        onCancel={() => setDraft(null)}
        onDone={submit}
      >
        {values ? (
          <>
            {editing ? (
              <View style={{ gap: 2 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                  {LOCATION_TYPE_LABELS[editing.type]}
                </Text>
                {hasValue ? null : (
                  <Text style={{ color: theme.text, fontSize: 16 }}>
                    {describeCalEventLocation(editing)}
                  </Text>
                )}
              </View>
            ) : (
              <ChoiceChips
                label="Location type"
                options={[
                  {
                    value: "address" as const,
                    label: "In person",
                    hint: hasAddress ? "This event already has an address" : undefined,
                  },
                  { value: "link" as const, label: "Link" },
                ]}
                value={values.kind === "address" ? "address" : "link"}
                onChange={(kind) => update({ kind })}
              />
            )}
            {hasValue ? (
              <EditTextField
                label={values.kind === "address" ? "Address" : "Link"}
                value={values.value}
                onChangeText={(value) => update({ value })}
                placeholder={
                  values.kind === "address"
                    ? "Add the address"
                    : "https://example.com/my-meeting-room"
                }
                keyboardType={values.kind === "link" ? "url" : "default"}
                autoCapitalize={values.kind === "link" ? "none" : "words"}
              />
            ) : null}
            <EditTextField
              label="Location label"
              placeholder='Label shown to guests, e.g. "Overflow room"'
              value={values.label}
              onChangeText={(label) => update({ label })}
              maxLength={CAL_EVENT_LOCATION_LABEL_MAX_LENGTH}
            />
            <EditTextField
              label="Capacity"
              placeholder="Unlimited"
              value={values.capacity}
              onChangeText={(capacity) => update({ capacity })}
              keyboardType="number-pad"
            />
            {paymentsEnabled ? (
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
                <View style={{ flex: 3 }}>
                  <EditTextField
                    label="Price"
                    placeholder="Free"
                    value={values.price}
                    onChangeText={(price) => update({ price: price.replace(",", ".") })}
                    keyboardType="decimal-pad"
                    editable={!priceLocked}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <SelectField
                    label="Currency"
                    options={CAL_EVENT_CURRENCIES}
                    value={values.currency}
                    onChange={(currency) => update({ currency })}
                    disabled={priceLocked}
                  />
                </View>
              </View>
            ) : null}
            {paymentsEnabled && priceLocked ? (
              <HintText>A published event's prices can't change.</HintText>
            ) : null}
            <ErrorText message={error} />
          </>
        ) : null}
      </EditSheet>
    </>
  );
}
