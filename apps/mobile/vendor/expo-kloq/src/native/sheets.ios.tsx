import {
  Button,
  ConfirmationDialog,
  Form,
  Host,
  Section,
  Text,
  TextField,
  Toggle,
  useNativeState,
} from "@expo/ui/swift-ui";
import {
  accessibilityIdentifier,
  autocorrectionDisabled,
  onSubmit,
  submitLabel,
} from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
import { zoneCityLabel } from "../model.ts";
import {
  type QuickAddFieldProps,
  SCOPE_LABELS,
  type ScopeDialogProps,
  type SettingsFormProps,
} from "./types.ts";

/**
 * "This event / this and following / all events" as SwiftUI's confirmation dialog. Its trigger is a
 * 1-point host pinned out of the way: the dialog is presented by SwiftUI, the trigger never shows.
 */
export function ScopeDialog({ request, onChoose }: ScopeDialogProps) {
  const verb = request?.action === "delete" ? "Delete" : "Save";
  return (
    <Host style={styles.hidden} pointerEvents="none">
      <ConfirmationDialog
        title={
          request?.action === "delete"
            ? "This is a repeating event. Delete…"
            : "This is a repeating event. Save changes to…"
        }
        titleVisibility="visible"
        isPresented={request !== null}
        onIsPresentedChange={(open) => {
          if (!open) onChoose(null);
        }}
      >
        <ConfirmationDialog.Trigger>
          <Text> </Text>
        </ConfirmationDialog.Trigger>
        <ConfirmationDialog.Actions>
          {(request?.scopes ?? []).map((scope) => (
            <Button
              key={scope}
              label={SCOPE_LABELS[scope]}
              role={request?.action === "delete" ? "destructive" : "default"}
              onPress={() => onChoose(scope)}
            />
          ))}
          <Button label="Cancel" role="cancel" onPress={() => onChoose(null)} />
        </ConfirmationDialog.Actions>
        <ConfirmationDialog.Message>
          <Text>{`${verb} “${request?.title ?? ""}”${request?.summary ? ` (${request.summary})` : ""}`}</Text>
        </ConfirmationDialog.Message>
      </ConfirmationDialog>
    </Host>
  );
}

/** One line of natural language, typed into a SwiftUI text field. */
export function QuickAddField({ onChangeText, onSubmit: submit }: QuickAddFieldProps) {
  const text = useNativeState("");
  return (
    <Host style={styles.field}>
      <Form>
        <Section>
          <TextField
            text={text}
            autoFocus
            placeholder="Lunch with Sam tomorrow 1pm at Padella"
            onTextChange={onChangeText}
            modifiers={[
              submitLabel("done"),
              onSubmit(submit),
              autocorrectionDisabled(true),
              accessibilityIdentifier("kloq-quick-add-input"),
            ]}
          />
        </Section>
      </Form>
    </Host>
  );
}

/** Calendar visibility toggles and the extra gutter zones, as one SwiftUI form. */
export function SettingsForm(props: SettingsFormProps) {
  return (
    <Host style={styles.fill} useViewportSizeMeasurement>
      <Form>
        <Section title="Calendars">
          {props.calendars.map((c) => (
            <Toggle
              key={c.id}
              label={c.name}
              isOn={c.visible !== false}
              onIsOnChange={(on) => props.onToggleCalendar(c.id, on)}
            />
          ))}
        </Section>
        <Section
          title="Time zones"
          footer={
            <Text>Extra zones are drawn as columns in the day and week views' hour gutter.</Text>
          }
        >
          {props.zones.map((zone) => (
            <Toggle
              key={zone}
              label={zoneCityLabel(zone)}
              isOn={props.selectedZones.includes(zone)}
              onIsOnChange={(on) => props.onToggleZone(zone, on)}
            />
          ))}
        </Section>
        <Section title="Clock">
          <Toggle
            label="24-hour time"
            isOn={!props.hour12}
            onIsOnChange={(on) => props.onHour12(!on)}
          />
        </Section>
      </Form>
    </Host>
  );
}

const styles = StyleSheet.create({
  // just under the sheet's Save button, which is what the dialog's popover then points at
  hidden: { position: "absolute", top: 0, right: 56, width: 1, height: 1, opacity: 0 },
  field: { height: 120 },
  fill: { flex: 1 },
});
