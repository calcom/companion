import { describe, expect, test } from "@jest/globals";
import { bookingsToCalendarEvents, calendarRange, weekStartIndex } from "./bookings-calendar";

function createBooking(overrides = {}) {
  return {
    id: 1,
    uid: "booking-1",
    title: "Intro call",
    status: "accepted",
    startTime: "2026-11-12T10:00:00.000Z",
    endTime: "2026-11-12T10:30:00.000Z",
    ...overrides,
  };
}

describe("bookingsToCalendarEvents", () => {
  test("turns a booking into a read-only event keyed by its uid", () => {
    const [event] = bookingsToCalendarEvents([
      createBooking({ location: "Office", meetingUrl: "https://example.com/room" }),
    ]);
    expect(event).toEqual({
      id: "booking-1",
      title: "Intro call",
      start: "2026-11-12T10:00:00.000Z",
      end: "2026-11-12T10:30:00.000Z",
      color: "blue",
      location: "Office",
      meetingUrl: "https://example.com/room",
      readOnly: true,
    });
  });

  test("shows unconfirmed bookings in amber", () => {
    const [event] = bookingsToCalendarEvents([createBooking({ status: "pending" })]);
    expect(event.color).toBe("amber");
  });

  test("leaves out cancelled and rejected bookings", () => {
    const events = bookingsToCalendarEvents([
      createBooking({ uid: "a", status: "cancelled" }),
      createBooking({ uid: "b", status: "rejected" }),
      createBooking({ uid: "c" }),
    ]);
    expect(events.map((e) => e.id)).toEqual(["c"]);
  });

  test("reads the status in any case, and counts requires_confirmation as unconfirmed", () => {
    const events = bookingsToCalendarEvents([
      createBooking({ uid: "a", status: "CANCELLED" }),
      createBooking({ uid: "b", status: "REJECTED" }),
      createBooking({ uid: "c", status: "PENDING" }),
      createBooking({ uid: "d", status: "requires_confirmation" }),
      createBooking({ uid: "e", status: "ACCEPTED" }),
    ]);
    expect(events.map((e) => [e.id, e.color])).toEqual([
      ["c", "amber"],
      ["d", "amber"],
      ["e", "blue"],
    ]);
  });

  test("falls back to start and end, and skips bookings without times", () => {
    const events = bookingsToCalendarEvents([
      createBooking({
        uid: "a",
        startTime: undefined,
        endTime: undefined,
        start: "2026-11-12T12:00:00.000Z",
        end: "2026-11-12T13:00:00.000Z",
      }),
      createBooking({ uid: "b", startTime: undefined, endTime: undefined }),
    ]);
    expect(events.map((e) => [e.id, e.start, e.end])).toEqual([
      ["a", "2026-11-12T12:00:00.000Z", "2026-11-12T13:00:00.000Z"],
    ]);
  });
});

describe("calendarRange", () => {
  test("reaches a day past the first and last shown day", () => {
    // The API only returns bookings that start and end inside the range, so a booking across
    // the view's first or last midnight needs the extra day on each side.
    const days = [new Date(2026, 10, 9), new Date(2026, 10, 10), new Date(2026, 10, 15)];
    expect(calendarRange({ days })).toEqual({
      afterStart: new Date(2026, 10, 8).toISOString(),
      beforeEnd: new Date(2026, 10, 17).toISOString(),
    });
  });
});

describe("weekStartIndex", () => {
  test("maps the profile's week start to kloq's day index", () => {
    expect(weekStartIndex("Sunday")).toBe(0);
    expect(weekStartIndex("Monday")).toBe(1);
    expect(weekStartIndex("saturday")).toBe(6);
  });

  test("starts on Monday when the profile has no week start", () => {
    expect(weekStartIndex(undefined)).toBe(1);
    expect(weekStartIndex("someday")).toBe(1);
  });
});
