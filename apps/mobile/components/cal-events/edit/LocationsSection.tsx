import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { getUserFacingApiReason } from "@/components/cal-events/useCalEventActions";
import { useAddCalEventLocation, useCalEventLocations } from "@/hooks";
import type { CalEvent, CalEventLocation } from "@/services/calcom";
import { showInfoAlert, showSilentSuccessAlert } from "@/utils/alerts";
import {
  type AddCalEventLocationFormValues,
  buildAddCalEventLocationInput,
  CAL_EVENT_LOCATION_LABEL_MAX_LENGTH,
  describeCalEventLocation,
  getAddCalEventLocationError,
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
import { LiveStreamsField } from "./SetupFields";

const LOCATION_TYPE_LABELS: Record<CalEventLocation["type"], string> = {
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
  currency: "USD",
};

/**
 * Where the event happens. The API can only add locations, not change or remove them, so the
 * list is read-only and adding one applies at once, outside the form's Save.
 */
export function LocationsSection({
  event,
  liveStreams,
  onLiveStreamsChange,
  liveStreamsError,
}: {
  event: Pick<CalEvent, "uuid" | "locations" | "publishedAt">;
  liveStreams: string[];
  onLiveStreamsChange: (liveStreams: string[]) => void;
  liveStreamsError?: string;
}) {
  const theme = useEditTheme();
  const { data: fetched } = useCalEventLocations(event.uuid);
  const locations = fetched ?? event.locations;
  const [draft, setDraft] = useState<AddCalEventLocationFormValues | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { mutate: addLocation, isPending } = useAddCalEventLocation();

  const hasAddress = locations.some((location) => location.type === "address");
  const error = draft && submitted ? getAddCalEventLocationError(draft, locations) : null;

  const open = () => {
    setSubmitted(false);
    setDraft({ ...EMPTY_LOCATION, kind: hasAddress ? "link" : "address" });
  };

  const submit = () => {
    if (!draft) return;
    setSubmitted(true);
    if (getAddCalEventLocationError(draft, locations)) return;
    const save = () =>
      addLocation(
        { uuid: event.uuid, location: buildAddCalEventLocationInput(draft) },
        {
          onSuccess: () => {
            setDraft(null);
            showSilentSuccessAlert("Location added", "The location was added to your event");
          },
          onError: (failure) =>
            showInfoAlert(
              "Error",
              getUserFacingApiReason(failure) ?? "Failed to add the location. Please try again."
            ),
        }
      );
    Alert.alert(
      "Add location",
      event.publishedAt
        ? "It's added right away, and registered guests are emailed about it. Once added, a location and its price can't be changed or removed."
        : "It's added right away. Once added, a location and its price can't be changed or removed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Add", onPress: save },
      ]
    );
  };

  const update = (patch: Partial<AddCalEventLocationFormValues>) =>
    setDraft((current) => (current ? { ...current, ...patch } : current));

  return (
    <>
      <EditSection title="Locations">
        {locations.map((location, index) => (
          <View
            key={location.id ?? `${location.type}-${index}`}
            accessible
            style={{
              gap: 4,
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: theme.border,
              backgroundColor: theme.backgroundMuted,
            }}
          >
            <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
              {LOCATION_TYPE_LABELS[location.type]}
            </Text>
            <Text style={{ color: theme.text, fontSize: 16 }}>
              {describeCalEventLocation(location)}
            </Text>
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
          </View>
        ))}
        <HintText>
          Added locations apply right away. A location, including its price, can't be changed or
          removed once added.
        </HintText>
        <TextButton icon="add" label="Add a location" onPress={open} />
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
        title="Add a location"
        doneLabel="Add"
        busy={isPending}
        onCancel={() => setDraft(null)}
        onDone={submit}
      >
        {draft ? (
          <>
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
              value={draft.kind}
              onChange={(kind) => update({ kind })}
            />
            <EditTextField
              label={draft.kind === "address" ? "Address" : "Link"}
              value={draft.value}
              onChangeText={(value) => update({ value })}
              placeholder={
                draft.kind === "address" ? "Add the address" : "https://example.com/my-meeting-room"
              }
              keyboardType={draft.kind === "link" ? "url" : "default"}
              autoCapitalize={draft.kind === "link" ? "none" : "words"}
            />
            <EditTextField
              label="Location label"
              placeholder='Label shown to guests, e.g. "Overflow room"'
              value={draft.label}
              onChangeText={(label) => update({ label })}
              maxLength={CAL_EVENT_LOCATION_LABEL_MAX_LENGTH}
            />
            <EditTextField
              label="Capacity"
              placeholder="Unlimited"
              value={draft.capacity}
              onChangeText={(capacity) => update({ capacity })}
              keyboardType="number-pad"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 2 }}>
                <EditTextField
                  label="Price"
                  placeholder="Free"
                  value={draft.price}
                  onChangeText={(price) => update({ price })}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <EditTextField
                  label="Currency"
                  value={draft.currency}
                  onChangeText={(currency) => update({ currency: currency.toUpperCase() })}
                  autoCapitalize="none"
                  maxLength={3}
                />
              </View>
            </View>
            <ErrorText message={error} />
          </>
        ) : null}
      </EditSheet>
    </>
  );
}
