/**
 * MessageGuestsScreen Component
 *
 * The web's "Message guests" dialog as a sheet: one group of guests (Going, Maybe or Pending),
 * narrowed by check-in and location, gets a plain-text email. Used by the
 * cal-event-message-guests route, whose header holds Send.
 */

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EditTextField, HintText, useEditTheme } from "@/components/cal-events/edit/EditControls";
import { SegmentedField } from "@/components/cal-events/edit/SegmentedField";
import { SelectField } from "@/components/cal-events/edit/SelectField";
import { getUserFacingApiReason } from "@/components/cal-events/useCalEventActions";
import {
  useCalEvent,
  useCalEventLocations,
  useCalEventRoster,
  useSendCalEventMessage,
} from "@/hooks";
import type { CalEventMessageSegment, CalEventMessageSendResult } from "@/services/calcom";
import { showInfoAlert } from "@/utils/alerts";
import {
  countMessageRecipients,
  formatMessageRecipients,
  getGuestLocationOptions,
  MESSAGE_BODY_MAX_LENGTH,
  MESSAGE_MAX_RECIPIENTS,
  MESSAGE_SEGMENT_LABELS,
  MESSAGE_SUBJECT_MAX_LENGTH,
  type MessageCheckInFilter,
} from "@/utils/cal-event-guests";

export interface MessageGuestsScreenHandle {
  submit: () => void;
}

export interface MessageGuestsScreenProps {
  uuid: string;
  onDone: () => void;
  /** Whether Send can go, and whether it's sending. */
  onStateChange?: (state: { canSubmit: boolean; saving: boolean }) => void;
}

const SEGMENTS: { value: CalEventMessageSegment; label: string }[] = (
  ["GOING", "MAYBE", "PENDING"] as const
).map((value) => ({ value, label: MESSAGE_SEGMENT_LABELS[value] }));

const CHECK_IN_OPTIONS: { value: MessageCheckInFilter; label: string }[] = [
  { value: "ANY", label: "Any" },
  { value: "CHECKED_IN", label: "Checked in" },
  { value: "NOT_CHECKED_IN", label: "Not checked in" },
];

const plural = (count: number, one: string, other: string) => (count === 1 ? one : other);

/** What happened to a send, in the web's words plus what the API says about phone guests. */
function describeSend(result: CalEventMessageSendResult): { title: string; message: string } {
  if (result.status === "FAILED_TO_QUEUE") {
    return { title: "Not sent", message: "The message couldn't be queued. Please try again." };
  }
  const notes = [
    `Sending to ${result.recipientCount} ${plural(result.recipientCount, "guest", "guests")}…`,
  ];
  if (result.textRecipientCount > 0) {
    notes.push(
      `${result.textRecipientCount} ${plural(result.textRecipientCount, "guest", "guests")} RSVP'd by phone and will get a text.`
    );
  }
  if (result.skippedPhoneCount > 0) {
    notes.push(
      `${result.skippedPhoneCount} ${plural(result.skippedPhoneCount, "guest", "guests")} RSVP'd by phone and won't get it.`
    );
  }
  return { title: "Message guests", message: notes.join("\n") };
}

export const MessageGuestsScreen = forwardRef<MessageGuestsScreenHandle, MessageGuestsScreenProps>(
  function MessageGuestsScreen({ uuid, onDone, onStateChange }, ref) {
    const theme = useEditTheme();
    const insets = useSafeAreaInsets();
    const { data: event } = useCalEvent(uuid);
    const { data: fetchedLocations } = useCalEventLocations(uuid);
    const roster = useCalEventRoster(uuid);
    const { mutate: send, isPending: saving } = useSendCalEventMessage();
    const [segment, setSegment] = useState<CalEventMessageSegment>("GOING");
    const [checkIn, setCheckIn] = useState<MessageCheckInFilter>("ANY");
    const [locationId, setLocationId] = useState<string | null>(null);
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");

    const locationOptions = getGuestLocationOptions(fetchedLocations ?? event?.locations ?? []);
    const activeLocationId = locationOptions.some((option) => option.id === locationId)
      ? locationId
      : null;
    const recipients = roster.data
      ? countMessageRecipients(roster.data, { segment, locationId: activeLocationId, checkIn })
      : undefined;
    const blocked =
      recipients === undefined || recipients === 0 || recipients > MESSAGE_MAX_RECIPIENTS;
    const canSubmit = subject.trim() !== "" && body.trim() !== "" && !blocked;

    useEffect(() => {
      onStateChange?.({ canSubmit, saving });
    }, [canSubmit, saving, onStateChange]);

    const submit = () => {
      if (!canSubmit || saving) return;
      send(
        {
          uuid,
          input: {
            segment,
            subject: subject.trim(),
            body: body.trim(),
            ...(activeLocationId ? { locationId: activeLocationId } : {}),
            ...(checkIn === "ANY" ? {} : { checkedIn: checkIn === "CHECKED_IN" }),
          },
        },
        {
          onSuccess: (result) => {
            const { title, message } = describeSend(result);
            showInfoAlert(title, message);
            if (result.status !== "FAILED_TO_QUEUE") onDone();
          },
          onError: (error) =>
            showInfoAlert(
              "Error",
              getUserFacingApiReason(error) ?? "Failed to send the message. Please try again."
            ),
        }
      );
    };

    useImperativeHandle(ref, () => ({ submit }));

    const recipientLine =
      recipients === undefined
        ? roster.isError
          ? "Couldn't count the guests in this group."
          : "Counting guests…"
        : formatMessageRecipients(recipients);
    const recipientLineIsWarning = blocked && recipients !== undefined;

    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 20 }}
      >
        <HintText>Email one group of this event's guests.</HintText>
        <View pointerEvents={saving ? "none" : "auto"} style={{ gap: 20 }}>
          <SegmentedField
            label="Send to"
            options={SEGMENTS}
            value={segment}
            onChange={setSegment}
          />
          <SelectField
            label="Check-in"
            options={CHECK_IN_OPTIONS}
            value={checkIn}
            onChange={setCheckIn}
          />
          {locationOptions.length > 0 ? (
            <SelectField<string | null>
              label="Location"
              options={[
                { value: null, label: "All locations" },
                ...locationOptions.map((option) => ({ value: option.id, label: option.label })),
              ]}
              value={activeLocationId}
              onChange={setLocationId}
            />
          ) : null}
          {/* Under the filters, as on the web: it follows all of them. */}
          <View style={{ gap: 4 }}>
            <Text
              style={{
                color: recipientLineIsWarning ? theme.error : theme.textSecondary,
                fontSize: 14,
              }}
            >
              {recipientLine}
            </Text>
            {segment === "PENDING" ? (
              <HintText>
                These guests aren't admitted yet, so the email won't include the venue or join link.
              </HintText>
            ) : null}
          </View>
          <EditTextField
            label="Subject"
            value={subject}
            onChangeText={setSubject}
            maxLength={MESSAGE_SUBJECT_MAX_LENGTH}
          />
          <View style={{ gap: 6 }}>
            <EditTextField
              label="Message"
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={MESSAGE_BODY_MAX_LENGTH}
            />
            <HintText>Plain text only. Paste links as plain URLs.</HintText>
          </View>
        </View>
      </ScrollView>
    );
  }
);
