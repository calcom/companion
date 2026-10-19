import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import type { CalEventBackground, CalEventCategory, CalEventImageFile } from "@/services/calcom";
import {
  CAL_EVENT_LIVE_STREAM_LIMIT,
  CAL_EVENT_SHADER_PALETTES,
  CAL_EVENT_SHADERS,
  DEFAULT_CAL_EVENT_BACKGROUND,
} from "@/utils/cal-event-edit";
import {
  ChoiceChips,
  EditTextField,
  ErrorText,
  FieldLabel,
  RowControls,
  SwitchRow,
  TextButton,
  useEditTheme,
} from "./EditControls";
import { CAL_EVENT_COVER_MAX_BYTES, pickCalEventImage } from "./pickImage";

/** What a save does to the cover: it uploads or deletes before the rest of the edit is sent. */
export type CoverChange =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "replace"; file: CalEventImageFile };

export function CoverField({
  currentUrl,
  change,
  onChange,
  category,
}: {
  currentUrl: string | null;
  change: CoverChange;
  onChange: (change: CoverChange) => void;
  category: CalEventCategory;
}) {
  const theme = useEditTheme();
  const previewUri =
    change.kind === "replace" ? change.file.uri : change.kind === "remove" ? null : currentUrl;
  const sizeHint =
    category === "conference"
      ? "Ideal size is 1600x800 px. Conference events use a wide horizontal cover."
      : "Ideal size is 800x800 px.";

  const choose = async () => {
    const file = await pickCalEventImage({ maxBytes: CAL_EVENT_COVER_MAX_BYTES });
    if (file) onChange({ kind: "replace", file });
  };

  return (
    <View style={{ gap: 8 }}>
      <FieldLabel label="Cover" />
      {previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={{ width: "100%", aspectRatio: 2, borderRadius: 12 }}
          contentFit="cover"
          accessibilityLabel="Cover image"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Pressable
          onPress={choose}
          accessibilityRole="button"
          accessibilityLabel="Upload images"
          accessibilityHint={sizeHint}
          style={{
            width: "100%",
            paddingVertical: 28,
            paddingHorizontal: 16,
            gap: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: theme.borderLight,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="cloud-upload-outline" size={26} color={theme.textSecondary} />
          <Text style={{ color: theme.text, fontSize: 16, fontWeight: "600" }}>Upload images</Text>
          <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: "center" }}>
            {sizeHint}
          </Text>
        </Pressable>
      )}
      <View style={{ flexDirection: "row", gap: 20 }}>
        <TextButton
          icon={previewUri ? "swap-horizontal-outline" : "cloud-upload-outline"}
          label={previewUri ? "Replace" : "Upload"}
          onPress={choose}
        />
        {previewUri ? (
          <TextButton
            icon="trash-outline"
            label="Remove"
            destructive
            onPress={() => onChange(currentUrl ? { kind: "remove" } : { kind: "keep" })}
          />
        ) : null}
      </View>
    </View>
  );
}

export function BackgroundField({
  value,
  onChange,
  error,
}: {
  value: CalEventBackground | null;
  onChange: (value: CalEventBackground | null) => void;
  error?: string;
}) {
  const theme = useEditTheme();
  return (
    <View style={{ gap: 14 }}>
      <SwitchRow
        label="Shader"
        hint="Add an animated shader background to the event page hero."
        value={value !== null}
        onValueChange={(on) => onChange(on ? DEFAULT_CAL_EVENT_BACKGROUND : null)}
      />
      {value ? (
        <>
          <ChoiceChips
            label="Effect"
            options={CAL_EVENT_SHADERS}
            value={value.effect}
            onChange={(effect) => onChange({ ...value, effect })}
          />
          <View style={{ gap: 8 }}>
            <FieldLabel label="Color palette" />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {CAL_EVENT_SHADER_PALETTES.map((palette) => {
                const selected = palette.colors.every(
                  (color, index) => color.toLowerCase() === value.colors[index]?.toLowerCase()
                );
                return (
                  <Pressable
                    key={palette.label}
                    onPress={() => onChange({ ...value, colors: palette.colors })}
                    accessibilityRole="radio"
                    accessibilityLabel={`${palette.label} palette`}
                    accessibilityState={{ checked: selected }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      height: 36,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: selected ? theme.text : theme.border,
                      backgroundColor: selected ? theme.backgroundEmphasis : "transparent",
                    }}
                  >
                    <Swatches colors={palette.colors} />
                    <Text style={{ color: theme.text, fontSize: 14 }}>{palette.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <FieldLabel label="Colors" hint="Primary, secondary and tertiary, as hex codes." />
            {value.colors.map((color, index) => (
              <View
                // The three slots are fixed, so the index is the color's identity.
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length tuple
                key={index}
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.border,
                    backgroundColor: /^#[0-9a-f]{6}$/i.test(color) ? color : "transparent",
                  }}
                />
                <View style={{ flex: 1 }}>
                  <EditTextField
                    value={color}
                    onChangeText={(text) => {
                      const colors = [...value.colors] as CalEventBackground["colors"];
                      colors[index] = text.startsWith("#") ? text : `#${text}`;
                      onChange({ ...value, colors });
                    }}
                    autoCapitalize="none"
                    maxLength={7}
                    accessibilityLabel={`${["Primary", "Secondary", "Tertiary"][index]} color`}
                  />
                </View>
              </View>
            ))}
            <ErrorText message={error} />
          </View>
        </>
      ) : null}
    </View>
  );
}

function Swatches({ colors }: { colors: readonly string[] }) {
  const theme = useEditTheme();
  return (
    <View style={{ flexDirection: "row" }}>
      {colors.map((color, index) => (
        <View
          key={color}
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            marginLeft: index === 0 ? 0 : -4,
            borderWidth: 1,
            borderColor: theme.background,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

export function LiveStreamsField({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {value.map((url, index) => (
        <View
          // Rows have no identity besides their place; edits keep the order.
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
          key={index}
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <View style={{ flex: 1 }}>
            <EditTextField
              value={url}
              onChangeText={(text) => onChange(value.map((row, i) => (i === index ? text : row)))}
              placeholder="https://streaming-provider.com/..."
              keyboardType="url"
              autoCapitalize="none"
              accessibilityLabel={`Live stream ${index + 1}`}
            />
          </View>
          <RowControls
            itemLabel={`live stream ${index + 1}`}
            onRemove={() => onChange(value.filter((_, i) => i !== index))}
          />
        </View>
      ))}
      <TextButton
        icon="add"
        label="Add live stream"
        disabled={value.length >= CAL_EVENT_LIVE_STREAM_LIMIT}
        onPress={() => onChange([...value, ""])}
      />
      <ErrorText message={error} />
    </View>
  );
}
