import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { FieldLabel, HintText, useEditTheme } from "./EditControls";

/** What both platforms' `SelectField` share: its props, its closed look and its swatches. */

export interface SelectOption<T extends string | null> {
  value: T;
  label: string;
  /** Shown under the option in the open menu (where the platform's menu can). */
  hint?: string;
  /** Color dots before the option's label, such as a palette's three colors. */
  swatches?: readonly string[];
}

export interface SelectFieldProps<T extends string | null> {
  label: string;
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Shown closed when no option matches the value, such as "Custom" colors. */
  placeholder?: string;
  /** Color dots on the closed select; the selected option's own swatches otherwise. */
  swatches?: readonly string[];
  /** Helper text under the select, such as the chosen option's description. */
  helper?: string;
  /** Shows the value without opening a menu, such as a locked currency. */
  disabled?: boolean;
}

export function SelectFieldFrame({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <FieldLabel label={label} />
      {children}
      {helper ? <HintText>{helper}</HintText> : null}
    </View>
  );
}

/** A select that can't change: its value, dimmed, without a menu. */
export function DisabledSelectBox({ label, text }: { label: string; text: string }) {
  return (
    <View
      accessible
      // A button like the enabled select, announced as disabled.
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${text}`}
      accessibilityState={{ disabled: true }}
      style={{ opacity: 0.5 }}
    >
      <SelectBox text={text} />
    </View>
  );
}

/** The closed select, bordered like the web's select triggers. */
export function SelectBox({ text, swatches }: { text: string; swatches?: readonly string[] }) {
  const theme = useEditTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 44,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.background,
      }}
    >
      {swatches ? <Swatches colors={swatches} /> : null}
      <Text style={{ flex: 1, color: theme.text, fontSize: 16 }} numberOfLines={1}>
        {text}
      </Text>
      <Ionicons name="chevron-expand-outline" size={18} color={theme.textSecondary} />
    </View>
  );
}

export function Swatches({ colors }: { colors: readonly string[] }) {
  const theme = useEditTheme();
  return (
    <View style={{ flexDirection: "row" }}>
      {colors.map((color, index) => (
        <View
          // A palette may repeat a color, so its place is part of the key.
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length tuple
          key={index}
          style={{
            width: 14,
            height: 14,
            borderRadius: 7,
            marginLeft: index === 0 ? 0 : -4,
            borderWidth: 1,
            borderColor: theme.background,
            backgroundColor: /^#[0-9a-f]{6}$/i.test(color) ? color : "transparent",
          }}
        />
      ))}
    </View>
  );
}
