import {
  AlertDialog,
  Column,
  Host,
  Switch,
  Text,
  TextButton,
  TextField,
  useNativeState,
} from "@expo/ui/jetpack-compose";
import { Text as RNText, ScrollView, StyleSheet, View } from "react-native";
import { zoneCityLabel } from "../model.ts";
import { usePalette } from "../theme.ts";
import {
  type QuickAddFieldProps,
  SCOPE_LABELS,
  type ScopeDialogProps,
  type SettingsFormProps,
} from "./types.ts";

/** "This event / this and following / all events" as a Material 3 alert dialog. */
export function ScopeDialog({ request, onChoose }: ScopeDialogProps) {
  if (!request) return null;
  return (
    <Host matchContents style={styles.hidden}>
      <AlertDialog onDismissRequest={() => onChoose(null)}>
        <AlertDialog.Title>
          <Text>
            {request.action === "delete" ? "Delete repeating event" : "Save repeating event"}
          </Text>
        </AlertDialog.Title>
        <AlertDialog.Text>
          <Column>
            {request.scopes.map((scope) => (
              <TextButton key={scope} onClick={() => onChoose(scope)}>
                <Text>{SCOPE_LABELS[scope]}</Text>
              </TextButton>
            ))}
          </Column>
        </AlertDialog.Text>
        <AlertDialog.DismissButton>
          <TextButton onClick={() => onChoose(null)}>
            <Text>Cancel</Text>
          </TextButton>
        </AlertDialog.DismissButton>
      </AlertDialog>
    </Host>
  );
}

export function QuickAddField({ onChangeText, onSubmit }: QuickAddFieldProps) {
  const text = useNativeState("");
  return (
    <Host matchContents={{ vertical: true }} style={styles.field}>
      <TextField
        value={text}
        autoFocus
        singleLine
        onValueChange={onChangeText}
        keyboardOptions={{ imeAction: "done" }}
        keyboardActions={{ onDone: onSubmit }}
      >
        <TextField.Placeholder>
          <Text>Lunch with Sam tomorrow 1pm at Padella</Text>
        </TextField.Placeholder>
      </TextField>
    </Host>
  );
}

export function SettingsForm(props: SettingsFormProps) {
  const p = usePalette();
  const toggleRow = (key: string, label: string, on: boolean, set: (on: boolean) => void) => (
    <View key={key} style={[styles.row, { borderColor: p.rule }]}>
      <RNText style={[styles.label, { color: p.text }]}>{label}</RNText>
      <Host matchContents>
        <Switch value={on} onCheckedChange={set} />
      </Host>
    </View>
  );
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <RNText style={[styles.heading, { color: p.muted }]}>Calendars</RNText>
      {props.calendars.map((c) =>
        toggleRow(c.id, c.name, c.visible !== false, (on) => props.onToggleCalendar(c.id, on)),
      )}
      <RNText style={[styles.heading, { color: p.muted }]}>Time zones</RNText>
      {props.zones.map((zone) =>
        toggleRow(zone, zoneCityLabel(zone), props.selectedZones.includes(zone), (on) =>
          props.onToggleZone(zone, on),
        ),
      )}
      <RNText style={[styles.heading, { color: p.muted }]}>Clock</RNText>
      {toggleRow("hour12", "24-hour time", !props.hour12, (on) => props.onHour12(!on))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hidden: { position: "absolute", width: 1, height: 1 },
  field: { marginHorizontal: 16 },
  content: { padding: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1, fontSize: 16 },
  heading: { fontSize: 13, textTransform: "uppercase", marginTop: 20, marginBottom: 4 },
});
