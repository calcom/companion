import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  addDays,
  type CalEvent,
  formatInstant,
  parseQuickAdd,
  type QuickAddResult,
  quickAddPreview,
  toDateOnlyString,
} from "../model.ts";
import { QuickAddField } from "../native/sheets";
import { usePalette } from "../theme.ts";
import { Sheet } from "./sheet.tsx";

export interface QuickAddSheetProps {
  visible: boolean;
  onClose: () => void;
  /** the new event, and the day to show it on */
  onAdd: (event: Omit<CalEvent, "id">, day: Date) => void;
}

/** kloq's natural-language quick add: one line in, a live preview of what it understood, one event out. */
export function QuickAddSheet({ visible, onClose, onAdd }: QuickAddSheetProps) {
  const p = usePalette();
  const [text, setText] = useState("");
  const parsed = useMemo(() => parseQuickAdd(text, new Date()), [text]);
  const ready = parsed.start !== null && parsed.title.trim() !== "";

  const add = () => {
    const event = eventFrom(parsed);
    if (!event || !parsed.start) return;
    onAdd(event, parsed.start);
    setText("");
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      title="Quick add"
      onCancel={() => {
        setText("");
        onClose();
      }}
      confirm={{ label: "Add", onPress: add, disabled: !ready, testID: "kloq-quick-add-confirm" }}
    >
      {visible ? <QuickAddField onChangeText={setText} onSubmit={add} /> : null}
      <View style={[styles.preview, { backgroundColor: p.background, borderColor: p.rule }]}>
        {text.trim() === "" ? (
          <Text style={[styles.hint, { color: p.muted }]}>
            Type an event the way you'd say it: “Design review Friday 3–4pm”, “Dentist tomorrow at 9
            for 45m”, “Offsite next Monday all day”.
          </Text>
        ) : (
          <>
            <Row label="Title" value={parsed.title || "—"} />
            <Row label="When" value={quickAddPreview(parsed, new Date()).when ?? "—"} />
            {parsed.location ? <Row label="Where" value={parsed.location} /> : null}
            {parsed.attendees.length ? (
              <Row label="Guests" value={parsed.attendees.join(", ")} />
            ) : null}
          </>
        )}
      </View>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: p.muted }]}>{label}</Text>
      <Text style={[styles.value, { color: p.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function eventFrom(r: QuickAddResult): Omit<CalEvent, "id"> | null {
  if (!r.start) return null;
  const base = {
    title: r.title.trim(),
    location: r.location ?? undefined,
    attendees: r.attendees.length ? r.attendees.map((email) => ({ email })) : undefined,
  };
  if (r.allDay) {
    // the parser's all-day `end` is inclusive; the store's is exclusive
    return {
      ...base,
      allDay: true,
      start: toDateOnlyString(r.start),
      end: toDateOnlyString(addDays(r.end ?? r.start, 1)),
    };
  }
  const end = r.end ?? new Date(r.start.getTime() + 30 * 60_000);
  return { ...base, allDay: false, start: formatInstant(r.start), end: formatInstant(end) };
}

const styles = StyleSheet.create({
  preview: {
    margin: 16,
    marginTop: 0,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  hint: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 12 },
  label: { width: 56, fontSize: 14 },
  value: { flex: 1, fontSize: 14, fontWeight: "600" },
});
