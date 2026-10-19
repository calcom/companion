import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  type KeyboardTypeOptions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getColors } from "@/constants/colors";
import { getAvatarUrl } from "@/utils/getAvatarUrl";

/** The edit screen's building blocks: sections, fields, rows and sheets in one visual style. */

// Lives with the edit model so node tests can reach it without React Native.
export { moveItem } from "@/utils/cal-event-edit";

export function useEditTheme() {
  return getColors(useColorScheme() === "dark");
}

export function EditSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const theme = useEditTheme();
  return (
    <View style={{ gap: 8 }}>
      <View style={{ paddingHorizontal: 4, gap: 2 }}>
        <Text
          accessibilityRole="header"
          style={{ color: theme.text, fontSize: 20, fontWeight: "700" }}
        >
          {title}
        </Text>
        {description ? (
          <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{description}</Text>
        ) : null}
      </View>
      <View
        style={{
          backgroundColor: theme.background,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 16,
          padding: 14,
          gap: 18,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  const theme = useEditTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: theme.text, fontSize: 15, fontWeight: "600" }}>{label}</Text>
      {hint ? <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{hint}</Text> : null}
    </View>
  );
}

/** Small secondary text under a field or list. */
export function HintText({ children }: { children: ReactNode }) {
  const theme = useEditTheme();
  return <Text style={{ color: theme.textSecondary, fontSize: 13 }}>{children}</Text>;
}

export function ErrorText({ message }: { message?: string | null }) {
  const theme = useEditTheme();
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={{ color: theme.error, fontSize: 14 }}>
      {message}
    </Text>
  );
}

interface EditTextFieldProps {
  label?: string;
  hint?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words";
  editable?: boolean;
  maxLength?: number;
  error?: string | null;
  testID?: string;
  accessibilityLabel?: string;
  /** Text before the field, such as a URL's host. */
  prefix?: string;
  /** A control after the field, such as a copy button. */
  trailing?: ReactNode;
}

export function EditTextField({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  autoCapitalize,
  editable = true,
  maxLength,
  error,
  testID,
  accessibilityLabel,
  prefix,
  trailing,
}: EditTextFieldProps) {
  const theme = useEditTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <FieldLabel label={label} hint={hint} /> : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          borderWidth: 1,
          borderColor: error ? theme.error : theme.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          backgroundColor: editable ? theme.background : theme.backgroundMuted,
        }}
      >
        {prefix ? (
          <Text style={{ color: theme.textSecondary, fontSize: 16 }} numberOfLines={1}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          multiline={multiline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCapitalize !== "none"}
          editable={editable}
          maxLength={maxLength}
          testID={testID}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityHint={hint}
          style={{
            flex: 1,
            color: editable ? theme.text : theme.textSecondary,
            fontSize: 16,
            paddingVertical: 10,
            minHeight: multiline ? 120 : 44,
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
        {trailing}
      </View>
      <ErrorText message={error} />
    </View>
  );
}

export function SwitchRow({
  label,
  hint,
  value,
  onValueChange,
  disabled = false,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value, disabled }}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, opacity: disabled ? 0.5 : 1 }}
    >
      <View style={{ flex: 1 }}>
        <FieldLabel label={label} hint={hint} />
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

/** A row of chips, one of which is picked. */
export function ChoiceChips<T extends string | null>({
  label,
  hint,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label?: string;
  hint?: string;
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const theme = useEditTheme();
  return (
    <View style={{ gap: 8, opacity: disabled ? 0.5 : 1 }}>
      {label ? <FieldLabel label={label} hint={hint} /> : null}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => !disabled && onChange(option.value)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              accessibilityHint={option.hint}
              style={{
                height: 38,
                justifyContent: "center",
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: selected ? theme.text : theme.border,
                backgroundColor: selected ? theme.backgroundEmphasis : "transparent",
              }}
            >
              <Text
                style={{ color: theme.text, fontSize: 15, fontWeight: selected ? "600" : "400" }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** A plain text button: "Add person", "Invite", "Remove cover". */
export function TextButton({
  icon,
  label,
  onPress,
  destructive = false,
  disabled = false,
  accessibilityLabel,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useEditTheme();
  const color = destructive ? theme.destructive : theme.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        paddingVertical: 6,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {icon ? <Ionicons name={icon} size={18} color={color} /> : null}
      <Text style={{ color, fontSize: 16, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

/** Up / down / remove buttons for a row in an ordered list. */
export function RowControls({
  itemLabel,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  /** Names the row for VoiceOver: "Move Ada up". */
  itemLabel: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
}) {
  const theme = useEditTheme();
  const button = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: (() => void) | undefined,
    // Not a default parameter: the React Compiler can't lower `= theme.textSecondary`.
    color?: string
  ) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !onPress }}
      hitSlop={6}
      style={{ padding: 4, opacity: onPress ? 1 : 0.25 }}
    >
      <Ionicons name={icon} size={20} color={color ?? theme.textSecondary} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {onMoveUp !== undefined || onMoveDown !== undefined ? (
        <>
          {button("chevron-up", `Move ${itemLabel} up`, onMoveUp)}
          {button("chevron-down", `Move ${itemLabel} down`, onMoveDown)}
        </>
      ) : null}
      {onRemove ? button("close-circle", `Remove ${itemLabel}`, onRemove, theme.destructive) : null}
    </View>
  );
}

/** A row with an optional avatar, a title and a subtitle; tappable when `onPress` is given. */
export function ListRow({
  title,
  subtitle,
  avatarUrl,
  showAvatar = false,
  onPress,
  trailing,
  accessibilityHint,
}: {
  title: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
  showAvatar?: boolean;
  onPress?: () => void;
  trailing?: ReactNode;
  accessibilityHint?: string;
}) {
  const theme = useEditTheme();
  const content = (
    <>
      {showAvatar ? (
        <Image
          source={{ uri: getAvatarUrl(avatarUrl) }}
          style={{ width: 32, height: 32, borderRadius: 16 }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: theme.textSecondary, fontSize: 13 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </>
  );
  const rowStyle = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    minHeight: 44,
  };
  return (
    <View style={rowStyle}>
      {onPress ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityHint={accessibilityHint}
          style={[rowStyle, { flex: 1 }]}
        >
          {content}
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </Pressable>
      ) : (
        <View style={[rowStyle, { flex: 1 }]}>{content}</View>
      )}
      {trailing}
    </View>
  );
}

/**
 * A page sheet over the edit screen with Cancel and Done, for editing one list item (a person,
 * a schedule item, a question) before it goes into the form.
 */
export function EditSheet({
  visible,
  title,
  onCancel,
  onDone,
  doneLabel = "Done",
  doneDisabled = false,
  busy = false,
  children,
}: {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onDone: () => void;
  doneLabel?: string;
  doneDisabled?: boolean;
  busy?: boolean;
  children: ReactNode;
}) {
  const theme = useEditTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          flex: 1,
          backgroundColor: theme.backgroundSecondary,
          paddingTop: Platform.OS === "ios" ? 8 : insets.top,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            height: 52,
          }}
        >
          <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={10}>
            <Text style={{ color: theme.accent, fontSize: 17 }}>Cancel</Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{ color: theme.text, fontSize: 17, fontWeight: "600", flexShrink: 1 }}
            numberOfLines={1}
          >
            {title}
          </Text>
          <Pressable
            onPress={onDone}
            disabled={doneDisabled || busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: doneDisabled || busy, busy }}
            hitSlop={10}
          >
            <Text
              style={{
                color: theme.accent,
                fontSize: 17,
                fontWeight: "600",
                opacity: doneDisabled || busy ? 0.4 : 1,
              }}
            >
              {doneLabel}
            </Text>
          </Pressable>
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 18 }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
