import chalk from "chalk";
import {
  formatDateTime,
  type OutputOptions,
  renderHeader,
  renderSuccess,
  renderTable,
} from "../../shared/output";
import type {
  BusyTime,
  CalendarConnection,
  CalendarEvent,
} from "./types";

export function renderConnections(
  connections: CalendarConnection[] | undefined,
  { json }: OutputOptions = {}
): void {
  if (json) {
    console.log(JSON.stringify(connections, null, 2));
    return;
  }

  if (!connections || connections.length === 0) {
    console.log("No calendar connections found.");
    return;
  }

  renderHeader("Calendar Connections");
  renderTable(
    ["Connection ID", "Type", "Email"],
    connections.map((c) => [c.connectionId, c.type, c.email || chalk.dim("unknown")])
  );
}

export function renderEventList(
  events: CalendarEvent[] | undefined,
  { json }: OutputOptions = {}
): void {
  if (json) {
    console.log(JSON.stringify(events, null, 2));
    return;
  }

  if (!events || events.length === 0) {
    console.log("No events found.");
    return;
  }

  renderHeader(`Events (${events.length})`);
  renderTable(
    ["Start", "End", "Title", "ID"],
    events.map((e) => [
      e.isAllDay ? chalk.cyan("All day") : formatDateTime(e.start),
      e.isAllDay ? "" : formatDateTime(e.end),
      e.title || chalk.dim("(no title)"),
      chalk.dim(e.id),
    ])
  );
}

export function renderEvent(
  event: CalendarEvent | undefined,
  { json }: OutputOptions = {}
): void {
  if (json) {
    console.log(JSON.stringify(event, null, 2));
    return;
  }

  if (!event) {
    console.log("Event not found.");
    return;
  }

  renderHeader(event.title || "(no title)");
  console.log(`  ID:        ${event.id}`);
  if (event.isAllDay) {
    console.log(`  When:      All day`);
  } else {
    console.log(`  Start:     ${formatDateTime(event.start)}`);
    console.log(`  End:       ${formatDateTime(event.end)}`);
  }
  if (event.timeZone) {
    console.log(`  Timezone:  ${event.timeZone}`);
  }
  if (event.status) {
    console.log(`  Status:    ${event.status}`);
  }
  if (event.location) {
    console.log(`  Location:  ${event.location}`);
  }
  if (event.description) {
    console.log(`  Notes:     ${event.description}`);
  }
  if (event.organizer?.email) {
    const name = event.organizer.displayName
      ? `${event.organizer.displayName} <${event.organizer.email}>`
      : event.organizer.email;
    console.log(`  Organizer: ${name}`);
  }
  if (event.attendees && event.attendees.length > 0) {
    console.log("  Attendees:");
    for (const a of event.attendees) {
      const label = a.displayName ? `${a.displayName} <${a.email}>` : (a.email || "unknown");
      const status = a.responseStatus ? chalk.dim(` (${a.responseStatus})`) : "";
      console.log(`    - ${label}${status}`);
    }
  }
  if (event.htmlLink) {
    console.log(`  Link:      ${event.htmlLink}`);
  }
  console.log();
}

export function renderEventCreated(
  event: CalendarEvent | undefined,
  { json }: OutputOptions = {}
): void {
  if (json) {
    console.log(JSON.stringify(event, null, 2));
    return;
  }

  renderSuccess("Event created successfully.");
  if (event) {
    renderEvent(event);
  }
}

export function renderEventUpdated(
  event: CalendarEvent | undefined,
  { json }: OutputOptions = {}
): void {
  if (json) {
    console.log(JSON.stringify(event, null, 2));
    return;
  }

  renderSuccess("Event updated successfully.");
  if (event) {
    renderEvent(event);
  }
}

export function renderEventDeleted({ json }: OutputOptions = {}): void {
  if (json) {
    console.log(JSON.stringify({ status: "success", message: "Event deleted" }, null, 2));
    return;
  }

  renderSuccess("Event deleted successfully.");
}

export function renderBusyTimes(
  busyTimes: BusyTime[] | undefined,
  { json }: OutputOptions = {}
): void {
  if (json) {
    console.log(JSON.stringify(busyTimes, null, 2));
    return;
  }

  if (!busyTimes || busyTimes.length === 0) {
    console.log("No busy times found.");
    return;
  }

  renderHeader("Busy Times");
  renderTable(
    ["Start", "End", "Source"],
    busyTimes.map((bt) => [formatDateTime(bt.start), formatDateTime(bt.end), bt.source || ""])
  );
}
