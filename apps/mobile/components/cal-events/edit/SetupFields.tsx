import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type {
  CalEventBackground,
  CalEventCategory,
  CalEventImageFile,
  CalEventTheme,
} from "@/services/calcom";
import {
  CAL_EVENT_LIVE_STREAM_LIMIT,
  CAL_EVENT_SHADER_PALETTES,
  CAL_EVENT_SHADERS,
  DEFAULT_CAL_EVENT_BACKGROUND,
} from "@/utils/cal-event-edit";
import { getCalEventLiveStreamError } from "@/utils/cal-event-live-stream";
import {
  EditTextField,
  ErrorText,
  FieldLabel,
  RowControls,
  SwitchRow,
  TextButton,
  useEditTheme,
} from "./EditControls";
import { CAL_EVENT_COVER_MAX_BYTES, pickCalEventImage } from "./pickImage";
import { SelectField } from "./SelectField";

/** What a save does to the cover: it uploads or deletes before the rest of the edit is sent. */
export type CoverChange =
  | { kind: "keep" }
  | { kind: "remove" }
  | { kind: "replace"; file: CalEventImageFile };

/** From this width-to-height ratio up, the event page crops a cover to fill its square frame. */
const LANDSCAPE_COVER_RATIO = 1.2;

/**
 * The cover, previewed as guests see it: a conference page shows a 2:1 banner, the others a square
 * that a landscape cover fills and a square or portrait one sits in uncropped.
 */
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
  // Until the image reports its size it fills the frame, as on the page.
  const [landscape, setLandscape] = useState(true);
  const previewUri =
    change.kind === "replace" ? change.file.uri : change.kind === "remove" ? null : currentUrl;
  const wide = category === "conference";
  const sizeHint = wide
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
          style={{
            width: "100%",
            aspectRatio: wide ? 2 : 1,
            borderRadius: 8,
            backgroundColor: theme.backgroundMuted,
          }}
          contentFit={wide || landscape ? "cover" : "contain"}
          onLoad={({ source }) =>
            setLandscape(source.width / source.height >= LANDSCAPE_COVER_RATIO)
          }
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
            borderRadius: 8,
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
      <View style={{ flexDirection: "row", gap: 8 }}>
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

const THEMES: { value: CalEventTheme | null; label: string }[] = [
  { value: null, label: "System default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** The web's theme radio cards, each with a sketch of the page in that theme. */
export function ThemeField({
  value,
  onChange,
}: {
  value: CalEventTheme | null;
  onChange: (value: CalEventTheme | null) => void;
}) {
  const theme = useEditTheme();
  return (
    <View style={{ gap: 8 }}>
      <FieldLabel label="Theme" />
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 10 }}>
        {THEMES.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.label}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              style={{ flex: 1, gap: 8 }}
            >
              <View
                style={{
                  aspectRatio: 1.3,
                  flexDirection: "row",
                  overflow: "hidden",
                  borderRadius: 8,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? theme.text : theme.border,
                }}
              >
                {option.value !== "dark" ? <ThemeSketch dark={false} /> : null}
                {option.value !== "light" ? <ThemeSketch dark /> : null}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons
                  name={selected ? "radio-button-on" : "radio-button-off"}
                  size={18}
                  color={selected ? theme.text : theme.textMuted}
                />
                <Text
                  style={{ flexShrink: 1, color: theme.text, fontSize: 14 }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {option.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A page in miniature: a title bar and two lines of text. "System default" shows both halves. */
function ThemeSketch({ dark }: { dark: boolean }) {
  const line = dark ? "#404040" : "#E5E5EA";
  return (
    <View style={{ flex: 1, padding: 8, gap: 5, backgroundColor: dark ? "#171717" : "#FFFFFF" }}>
      <View style={{ height: 6, width: "70%", borderRadius: 3, backgroundColor: line }} />
      <View style={{ height: 4, width: "90%", borderRadius: 2, backgroundColor: line }} />
      <View style={{ height: 4, width: "55%", borderRadius: 2, backgroundColor: line }} />
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
  // Hand-typed colors that match no palette read as "Custom", as on the web.
  const palette = value
    ? CAL_EVENT_SHADER_PALETTES.find((item) =>
        item.colors.every(
          (color, index) => color.toLowerCase() === value.colors[index]?.toLowerCase()
        )
      )
    : undefined;
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
          <SelectField
            label="Effect"
            options={CAL_EVENT_SHADERS}
            value={value.effect}
            onChange={(effect) => onChange({ ...value, effect })}
          />
          <SelectField
            label="Color palette"
            options={CAL_EVENT_SHADER_PALETTES.map((palette) => ({
              value: palette.label,
              label: palette.label,
              swatches: palette.colors,
            }))}
            value={palette?.label ?? null}
            placeholder="Custom"
            swatches={value.colors}
            onChange={(label) => {
              const next = CAL_EVENT_SHADER_PALETTES.find((item) => item.label === label);
              if (next) onChange({ ...value, colors: next.colors });
            }}
          />
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

/**
 * As on the web, a link's error shows under it once the host leaves the field, and under every
 * link after a save attempt (`error` set). `error` itself shows alone only when no single link
 * is to blame (too many links).
 */
export function LiveStreamsField({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}) {
  const [left, setLeft] = useState<boolean[]>(() => value.map(() => false));
  const rowErrors = value.map((url, index) =>
    left[index] || error ? getCalEventLiveStreamError(url) : null
  );
  return (
    <View style={{ gap: 8 }}>
      {value.map((url, index) => (
        <View
          // Rows have no identity besides their place; edits keep the order.
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
          key={index}
          style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
        >
          <View style={{ flex: 1 }}>
            <EditTextField
              value={url}
              onChangeText={(text) => onChange(value.map((row, i) => (i === index ? text : row)))}
              onBlur={() => setLeft((current) => value.map((_, i) => current[i] || i === index))}
              placeholder="https://streaming-provider.com/..."
              keyboardType="url"
              autoCapitalize="none"
              accessibilityLabel={`Live stream ${index + 1}`}
              error={rowErrors[index]}
            />
          </View>
          {/* Level with the field, not with the field and its message. */}
          <View style={{ height: 46, justifyContent: "center" }}>
            <RowControls
              itemLabel={`live stream ${index + 1}`}
              onRemove={() => {
                onChange(value.filter((_, i) => i !== index));
                setLeft((current) => current.filter((_, i) => i !== index));
              }}
            />
          </View>
        </View>
      ))}
      <TextButton
        icon="add"
        label="Add live stream"
        disabled={value.length >= CAL_EVENT_LIVE_STREAM_LIMIT}
        onPress={() => {
          onChange([...value, ""]);
          setLeft((current) => [...current, false]);
        }}
      />
      {rowErrors.some(Boolean) ? null : <ErrorText message={error} />}
    </View>
  );
}
