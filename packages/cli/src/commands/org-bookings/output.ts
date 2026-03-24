import {
  formatDateShort,
  formatTimeRange,
  type OutputOptions,
  renderTable,
} from "../../shared/output";
import type { OrgBookingList } from "./types";

export function renderOrgBookingList(
  bookings: OrgBookingList | undefined,
  { json }: OutputOptions = {}
): void {
  if (json) {
    console.log(JSON.stringify(bookings, null, 2));
    return;
  }

  if (!bookings?.length) {
    console.log("No organization bookings found.");
    return;
  }

  renderTable(
    ["UID", "Title", "Date", "Time", "Status", "Attendees"],
    bookings.map((booking) => {
      const attendees = booking.attendees?.map((a) => a.name || a.email).join(", ") || "";
      return [
        booking.uid.substring(0, 8),
        booking.title || "",
        formatDateShort(booking.start),
        formatTimeRange(booking.start, booking.end),
        booking.status || "",
        attendees,
      ];
    })
  );
}
