import { useCallback, useRef, useState } from "react";
import { Keyboard } from "react-native";
import { draftFor, type EventDraft, patchFor } from "../editor/draft.ts";
import {
  type CalEventPatch,
  type CalendarSource,
  defaultCalendarId,
  describeRRule,
  eventTitle,
  RECURRENCE_SCOPES,
  type RecurrenceScope,
} from "../model.ts";
import { EventForm } from "../native/event-form";
import { ScopeDialog } from "../native/sheets";
import type { ScopeRequest } from "../native/types.ts";
import type { AskScope, EditTarget } from "../use-kloq.ts";
import { Sheet } from "./sheet.tsx";

export interface EventSheetProps {
  target: EditTarget | null;
  calendars: CalendarSource[];
  hour12: boolean;
  onClose: () => void;
  onSave: (target: EditTarget, patch: CalEventPatch, ask: AskScope) => Promise<boolean>;
  onDelete: (target: EditTarget, ask: AskScope) => Promise<boolean>;
}

export function EventSheet(props: EventSheetProps) {
  // a fresh editor per target, so native field state never leaks between events
  const key = props.target
    ? props.target.kind === "new"
      ? `new-${props.target.start.getTime()}`
      : `${props.target.event.id}-${props.target.occurrence?.start ?? ""}`
    : "closed";
  return <EventSheetBody key={key} {...props} />;
}

function EventSheetBody({ target, calendars, hour12, onClose, onSave, onDelete }: EventSheetProps) {
  const writable = calendars.filter((c) => !c.readOnly);
  // a read-only calendar is never a target; the event's own stays listed so the picker can show it
  const current = target?.kind === "event" ? target.event.calendarId : undefined;
  const offered = calendars.filter((c) => !c.readOnly || c.id === current);
  const [draft, setDraft] = useState<EventDraft | null>(() =>
    target ? draftFor(target, defaultCalendarId(writable.length ? writable : calendars)) : null,
  );
  const [scope, setScope] = useState<ScopeRequest | null>(null);
  const resolver = useRef<((s: RecurrenceScope | null) => void) | null>(null);

  const ask: AskScope = useCallback(
    ({ action, event, occurrence }) =>
      new Promise((resolve) => {
        resolver.current?.(null);
        resolver.current = resolve;
        setScope({
          action,
          title: eventTitle(event),
          summary: event.rrule ? describeRRule(event.rrule) : undefined,
          scopes: occurrence.isFirst ? ["this", "all"] : RECURRENCE_SCOPES,
        });
      }),
    [],
  );
  const choose = (s: RecurrenceScope | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    setScope(null);
    resolve?.(s);
  };

  if (!target || !draft) return null;
  const readOnly =
    target.kind === "event" &&
    (target.event.readOnly === true ||
      calendars.some((c) => c.id === target.event.calendarId && c.readOnly));

  return (
    <Sheet
      visible
      title={target.kind === "new" ? "New Event" : readOnly ? "Event" : "Edit Event"}
      onCancel={onClose}
      cancelLabel={readOnly ? "Close" : "Cancel"}
      confirm={
        readOnly
          ? undefined
          : {
              label: target.kind === "new" ? "Add" : "Save",
              testID: "kloq-save",
              onPress: async () => {
                Keyboard.dismiss();
                if (await onSave(target, patchFor(draft), ask)) onClose();
              },
            }
      }
    >
      <EventForm
        draft={draft}
        onChange={setDraft}
        calendars={offered}
        readOnly={readOnly}
        hour12={hour12}
        onDelete={
          target.kind === "event" && !readOnly
            ? async () => {
                Keyboard.dismiss();
                if (await onDelete(target, ask)) onClose();
              }
            : undefined
        }
      />
      <ScopeDialog request={scope} onChoose={choose} />
    </Sheet>
  );
}
