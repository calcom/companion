import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Pressable, useColorScheme, View } from "react-native";
import {
  EnrichedTextInput,
  type EnrichedTextInputInstance,
  type OnChangeStateEvent,
} from "react-native-enriched-html";
import { getColors } from "@/constants/colors";
import { richTextToHtml, sanitizeRichTextHtml } from "@/utils/rich-text";

const formats = [
  { label: "Bold", icon: "text", state: "bold", command: "toggleBold" },
  { label: "Italic", icon: "text-outline", state: "italic", command: "toggleItalic" },
  { label: "Bullet list", icon: "list", state: "unorderedList", command: "toggleUnorderedList" },
  {
    label: "Numbered list",
    icon: "list-outline",
    state: "orderedList",
    command: "toggleOrderedList",
  },
] as const;

export function RichTextEditor({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
}: {
  value: string;
  onChangeText: (html: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}) {
  const theme = getColors(useColorScheme() === "dark");
  const editor = useRef<EnrichedTextInputInstance>(null);
  const lastValue = useRef(value);
  const hasFocused = useRef(false);
  const lastNativeHtml = useRef<string | null>(null);
  const hasEdited = useRef(false);
  const [initialHtml] = useState(() => richTextToHtml(value));
  const [formatState, setFormatState] = useState<OnChangeStateEvent>();

  useEffect(() => {
    if (value !== lastValue.current) {
      lastValue.current = value;
      lastNativeHtml.current = null;
      hasEdited.current = false;
      editor.current?.setValue(richTextToHtml(value));
    }
  }, [value]);

  return (
    <View style={{ borderRadius: 8, backgroundColor: theme.backgroundMuted, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: theme.borderSubtle }}>
        {formats.map(({ label, icon, state, command }) => (
          <Pressable
            key={command}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: formatState?.[state].isActive ?? false }}
            onPress={() => {
              hasEdited.current = true;
              hasFocused.current = true;
              editor.current?.focus();
              editor.current?.[command]();
            }}
            style={{
              padding: 12,
              backgroundColor: formatState?.[state].isActive ? theme.backgroundEmphasis : undefined,
            }}
          >
            <Ionicons name={icon} size={18} color={theme.text} />
          </Pressable>
        ))}
      </View>
      <EnrichedTextInput
        ref={editor}
        defaultValue={initialHtml}
        accessibilityLabel={accessibilityLabel}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        onFocus={() => {
          hasFocused.current = true;
        }}
        onChangeText={() => {
          if (hasFocused.current) hasEdited.current = true;
        }}
        onChangeHtml={({ nativeEvent }) => {
          const html = sanitizeRichTextHtml(nativeEvent.value);
          const previousHtml = lastNativeHtml.current;
          lastNativeHtml.current = html;
          // Initialization/focus can emit canonical HTML without the user editing anything.
          if (
            !hasFocused.current ||
            (!hasEdited.current && previousHtml === null) ||
            html === previousHtml
          )
            return;
          lastValue.current = html;
          onChangeText(html);
        }}
        onChangeState={({ nativeEvent }) => setFormatState(nativeEvent)}
        scrollEnabled={false}
        style={{ color: theme.text, fontSize: 16, minHeight: 120, padding: 12 }}
      />
    </View>
  );
}
