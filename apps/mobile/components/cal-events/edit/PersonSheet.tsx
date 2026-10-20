import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useUploadCalEventPersonAvatar } from "@/hooks";
import type { CalEventLineupPerson } from "@/services/types/cal-events.types";
import { showInfoAlert } from "@/utils/alerts";
import { getAvatarUrl } from "@/utils/getAvatarUrl";
import { getUserFacingApiReason } from "../useCalEventActions";
import {
  EditSheet,
  EditTextField,
  FieldLabel,
  HintText,
  RowControls,
  TextButton,
  useEditTheme,
} from "./EditControls";
import {
  CAL_EVENT_AVATAR_MAX_BYTES,
  CAL_EVENT_AVATAR_MAX_DIMENSION,
  pickCalEventImage,
} from "./pickImage";

export const EMPTY_PERSON: CalEventLineupPerson = {
  name: "",
  role: null,
  avatarUrl: null,
  links: [],
};

const AVATAR_SIZE = 64;

/**
 * Edits one person on a local copy: a lineup person (with players) or a schedule item's person
 * (`maxMedia` 0). Done hands the copy back; Cancel drops it. Remount it (a new `key`) per open.
 */
export function PersonSheet({
  visible,
  uuid,
  initial,
  isNew,
  maxLinks,
  maxMedia = 0,
  onCancel,
  onDone,
}: {
  visible: boolean;
  /** The event's uuid: photos upload as soon as they're picked. */
  uuid: string;
  initial: CalEventLineupPerson;
  isNew: boolean;
  maxLinks: number;
  maxMedia?: number;
  onCancel: () => void;
  onDone: (person: CalEventLineupPerson) => void;
}) {
  const theme = useEditTheme();
  const upload = useUploadCalEventPersonAvatar();
  const [draft, setDraft] = useState<CalEventLineupPerson>(() => ({
    ...initial,
    links: initial.links ?? [],
    // Schedule people have no players, so they don't gain an empty list either.
    ...(maxMedia > 0 ? { media: initial.media ?? [] } : {}),
  }));
  const update = (patch: Partial<CalEventLineupPerson>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const links = draft.links ?? [];
  const media = draft.media ?? [];
  const displayName = draft.name.trim() || "this person";

  const choosePhoto = async () => {
    const file = await pickCalEventImage({
      maxBytes: CAL_EVENT_AVATAR_MAX_BYTES,
      maxDimension: CAL_EVENT_AVATAR_MAX_DIMENSION,
      aspect: [1, 1],
    });
    if (!file) return;
    upload.mutate(
      { uuid, file },
      {
        onSuccess: (avatarUrl) => update({ avatarUrl }),
        onError: (error) =>
          showInfoAlert(
            "Error",
            getUserFacingApiReason(error) ?? "Couldn't upload the photo. Please try again."
          ),
      }
    );
  };

  return (
    <EditSheet
      visible={visible}
      title={isNew ? (maxMedia > 0 ? "Add lineup person" : "Add person") : "Edit person"}
      doneLabel={isNew ? "Add" : "Save"}
      onCancel={onCancel}
      onDone={() => onDone(draft)}
      doneDisabled={!draft.name.trim()}
      busy={upload.isPending}
    >
      <HintText>Add a name, title, and optional links for this person.</HintText>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={draft.avatarUrl ? `Photo of ${displayName}` : "No photo"}
            accessibilityState={{ busy: upload.isPending }}
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              borderRadius: AVATAR_SIZE / 2,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.backgroundMuted,
            }}
          >
            {draft.avatarUrl ? (
              <Image
                source={{ uri: getAvatarUrl(draft.avatarUrl) }}
                style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Ionicons name="person" size={28} color={theme.textMuted} />
            )}
            {upload.isPending ? (
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0, 0, 0, 0.35)",
                }}
              >
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <View>
            <TextButton
              label={
                upload.isPending
                  ? "Uploading…"
                  : draft.avatarUrl
                    ? "Change avatar"
                    : "Upload avatar"
              }
              onPress={choosePhoto}
              disabled={upload.isPending}
            />
            {draft.avatarUrl ? (
              <TextButton
                label="Remove"
                destructive
                onPress={() => update({ avatarUrl: null })}
                disabled={upload.isPending}
              />
            ) : null}
          </View>
        </View>
      </View>

      <EditTextField
        label="Name*"
        value={draft.name}
        onChangeText={(name) => update({ name })}
        placeholder="Name"
        autoCapitalize="words"
        accessibilityLabel="Name"
      />
      <EditTextField
        label="Title"
        value={draft.role ?? ""}
        onChangeText={(role) => update({ role })}
        placeholder="Title"
      />

      <View style={{ gap: 8 }}>
        <FieldLabel label="Links" />
        {links.map((link, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
          <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <EditTextField
                value={link.url}
                onChangeText={(url) =>
                  update({ links: links.map((item, i) => (i === index ? { url } : item)) })
                }
                placeholder="https://"
                keyboardType="url"
                autoCapitalize="none"
                accessibilityLabel={`Link ${index + 1}`}
              />
            </View>
            <RowControls
              itemLabel={`link ${index + 1}`}
              onRemove={() => update({ links: links.filter((_, i) => i !== index) })}
            />
          </View>
        ))}
        <HintText>{`Add up to ${maxLinks} links per ${maxMedia > 0 ? "lineup" : "schedule"} person.`}</HintText>
        <TextButton
          icon="add"
          label="Add link"
          onPress={() => update({ links: [...links, { url: "" }] })}
          disabled={links.length >= maxLinks}
        />
      </View>

      {maxMedia > 0 ? (
        <View style={{ gap: 8 }}>
          <FieldLabel
            label="Media"
            hint="Spotify, YouTube or SoundCloud links. Guests click to load each player."
          />
          {media.map((item, index) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
              key={index}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
            >
              <View style={{ flex: 1, gap: 6 }}>
                <EditTextField
                  value={item.url}
                  onChangeText={(url) =>
                    update({
                      media: media.map((entry, i) => (i === index ? { ...entry, url } : entry)),
                    })
                  }
                  placeholder="https://"
                  keyboardType="url"
                  autoCapitalize="none"
                  accessibilityLabel={`Media ${index + 1} link`}
                />
                <EditTextField
                  value={item.label ?? ""}
                  onChangeText={(label) =>
                    update({
                      media: media.map((entry, i) => (i === index ? { ...entry, label } : entry)),
                    })
                  }
                  placeholder="Label (optional)"
                  maxLength={100}
                  accessibilityLabel={`Media ${index + 1} label`}
                />
              </View>
              <View style={{ paddingTop: 10 }}>
                <RowControls
                  itemLabel={`media ${index + 1}`}
                  onRemove={() => update({ media: media.filter((_, i) => i !== index) })}
                />
              </View>
            </View>
          ))}
          <HintText>{`Up to ${maxMedia} per person`}</HintText>
          <TextButton
            icon="add"
            label="Add media"
            onPress={() => update({ media: [...media, { url: "", label: null }] })}
            disabled={media.length >= maxMedia}
          />
        </View>
      ) : null}
    </EditSheet>
  );
}
