/**
 * InviteGuestsScreen Component
 *
 * The web's "Invite guests" dialog as a sheet: addresses typed or pasted into chips, an optional
 * note, and the skipped addresses grouped by why after a send. Used by the
 * cal-event-invite-guests route, whose header holds Send.
 */

import { Ionicons } from "@expo/vector-icons";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  EditTextField,
  HintText,
  useEditSurfaces,
  useEditTheme,
} from "@/components/cal-events/edit/EditControls";
import { getUserFacingApiReason } from "@/components/cal-events/useCalEventActions";
import { useInviteCalEventGuests } from "@/hooks";
import { showInfoAlert } from "@/utils/alerts";
import {
  getInviteResultMessage,
  INVITE_MAX_EMAILS,
  INVITE_NOTE_MAX_LENGTH,
  type InviteSkippedGroup,
  isValidInviteEmail,
  parseInviteEmails,
} from "@/utils/cal-event-guests";

export interface InviteGuestsScreenHandle {
  submit: () => void;
}

export interface InviteGuestsScreenProps {
  uuid: string;
  /** An address to start with, such as one typed into the roster's search. */
  initialEmail?: string;
  /** Called after a send that skipped nobody; one that skipped some stays open to say who. */
  onDone: () => void;
  /** Whether Send has something to send, and whether it's sending. */
  onStateChange?: (state: { canSubmit: boolean; saving: boolean }) => void;
  transparentBackground?: boolean;
}

/** A field value still being typed: nothing to split yet, or an unclosed `Name <`. */
const isStillTyping = (text: string) =>
  !/[\s,;]/.test(text.trimStart()) || text.lastIndexOf("<") > text.lastIndexOf(">");

export const InviteGuestsScreen = forwardRef<InviteGuestsScreenHandle, InviteGuestsScreenProps>(
  function InviteGuestsScreen(
    { uuid, initialEmail, onDone, onStateChange, transparentBackground = false },
    ref
  ) {
    const theme = useEditTheme();
    const surfaces = useEditSurfaces();
    const insets = useSafeAreaInsets();
    const [emails, setEmails] = useState<string[]>(() =>
      initialEmail && isValidInviteEmail(initialEmail) ? [initialEmail] : []
    );
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [skippedGroups, setSkippedGroups] = useState<InviteSkippedGroup[]>([]);
    const { mutate: invite, isPending: saving } = useInviteCalEventGuests();

    const canSubmit = emails.length > 0 || isValidInviteEmail(draft.trim());
    useEffect(() => {
      onStateChange?.({ canSubmit, saving });
    }, [canSubmit, saving, onStateChange]);

    /** Moves what's in the field into chips; returns every address, or null when it can't. */
    const commit = (text: string): string[] | null => {
      if (!text.trim()) {
        setError(null);
        return emails;
      }
      const parsed = parseInviteEmails(text, emails);
      const next = [...emails, ...parsed.emails];
      if (next.length > INVITE_MAX_EMAILS) {
        setError(`You can invite up to ${INVITE_MAX_EMAILS} guests at a time`);
        return null;
      }
      setEmails(next);
      setDraft(parsed.invalid.join(" "));
      if (parsed.invalid.length > 0) {
        const single = parsed.invalid.length === 1 && parsed.emails.length === 0;
        setError(
          single
            ? "Please enter a valid email"
            : `${parsed.invalid.length === 1 ? "Not an email address" : "Not email addresses"}: ${parsed.invalid.join(", ")}`
        );
        return null;
      }
      setError(parsed.emails.length === 0 && parsed.duplicates.length > 0 ? "Already added" : null);
      return next;
    };

    const onChangeDraft = (text: string) => {
      setError(null);
      if (isStillTyping(text)) setDraft(text);
      else commit(text);
    };

    const submit = () => {
      if (saving) return;
      const all = commit(draft);
      if (!all || all.length === 0) return;
      invite(
        { uuid, input: { emails: all, hostNote: note } },
        {
          onSuccess: (result) => {
            const message = getInviteResultMessage(result);
            showInfoAlert("Invite guests", message.title);
            if (message.skippedGroups.length === 0) {
              onDone();
              return;
            }
            // The sent ones are done; what's left on screen is who was skipped and why.
            setEmails([]);
            setDraft("");
            setSkippedGroups(message.skippedGroups);
          },
          onError: (sendError) =>
            showInfoAlert(
              "Error",
              getUserFacingApiReason(sendError) ?? "Failed to send invitations. Please try again."
            ),
        }
      );
    };

    useImperativeHandle(ref, () => ({ submit }));

    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        style={{ backgroundColor: transparentBackground ? undefined : surfaces.screen }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 20 }}
      >
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: error ? theme.error : theme.border,
                borderRadius: 8,
                paddingHorizontal: 12,
              }}
            >
              <TextInput
                value={draft}
                onChangeText={onChangeDraft}
                onSubmitEditing={() => commit(draft)}
                placeholder="guest@example.com"
                placeholderTextColor={theme.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="done"
                submitBehavior="submit"
                editable={!saving}
                accessibilityLabel="Guest email"
                style={{ color: theme.text, fontSize: 16, minHeight: 44, paddingVertical: 10 }}
              />
            </View>
            <Pressable
              onPress={() => commit(draft)}
              disabled={!draft.trim() || saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: !draft.trim() || saving }}
              style={{
                height: 44,
                paddingHorizontal: 16,
                justifyContent: "center",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: theme.border,
                opacity: draft.trim() ? 1 : 0.4,
              }}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: "500" }}>Add</Text>
            </Pressable>
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: theme.error, fontSize: 14 }}>
              {error}
            </Text>
          ) : null}
          {emails.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {emails.map((email) => (
                <View
                  key={email.toLowerCase()}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingLeft: 10,
                    paddingRight: 6,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: theme.backgroundEmphasis,
                  }}
                >
                  <Text style={{ color: theme.text, fontSize: 14 }}>{email}</Text>
                  <Pressable
                    onPress={() => setEmails((current) => current.filter((item) => item !== email))}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${email}`}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ gap: 6 }}>
          <EditTextField
            label="Optional note"
            value={note}
            onChangeText={setNote}
            placeholder="Add a short personal note for the invitation email"
            multiline
            maxLength={INVITE_NOTE_MAX_LENGTH}
            editable={!saving}
          />
          <HintText>
            You can invite up to {INVITE_MAX_EMAILS} guests at a time. Paste a list to add them all.
          </HintText>
        </View>

        {skippedGroups.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text
              accessibilityRole="header"
              style={{ color: theme.text, fontSize: 17, fontWeight: "600" }}
            >
              Skipped guests
            </Text>
            {skippedGroups.map((group) => (
              <View
                key={group.reason}
                style={{
                  gap: 4,
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: surfaces.card,
                }}
              >
                <Text style={{ color: theme.text, fontSize: 15, fontWeight: "500" }}>
                  {group.label}
                </Text>
                {group.emails.map((email) => (
                  <Text key={email} selectable style={{ color: theme.textSecondary, fontSize: 14 }}>
                    {email}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    );
  }
);
