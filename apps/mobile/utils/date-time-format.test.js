import { describe, expect, test } from "@jest/globals";
import {
  formatDate,
  formatTime,
  formatTimeRange,
  formatWallDateTime,
  toWallParts,
} from "./date-time-format";

const NOW = new Date("2026-10-22T12:00:00.000Z");

describe("formatDate", () => {
  test("puts the day before the month, the year only outside the current one", () => {
    expect(formatDate("2026-10-22T18:00:00.000Z", { timeZone: "UTC", now: NOW })).toBe(
      "Thu, 22 Oct"
    );
    expect(formatDate("2027-01-05T18:00:00.000Z", { timeZone: "UTC", now: NOW })).toBe(
      "Tue, 5 Jan 2027"
    );
  });

  test("reads the date in the given zone", () => {
    // 23:30Z on the 22nd is already the 23rd in Berlin.
    expect(formatDate("2026-10-22T23:30:00.000Z", { timeZone: "Europe/Berlin", now: NOW })).toBe(
      "Fri, 23 Oct"
    );
  });
});

describe("formatTime", () => {
  test("follows the 12- or 24-hour clock", () => {
    expect(formatTime("2026-10-22T19:05:00.000Z", { timeZone: "UTC" })).toBe("7:05 PM");
    expect(formatTime("2026-10-22T19:05:00.000Z", { timeZone: "UTC", hour12: false })).toBe(
      "19:05"
    );
    expect(formatTime("2026-10-22T00:00:00.000Z", { timeZone: "UTC" })).toBe("12:00 AM");
    expect(formatTime("2026-10-22T00:00:00.000Z", { timeZone: "UTC", hour12: false })).toBe(
      "00:00"
    );
    expect(formatTime("2026-10-22T12:30:00.000Z", { timeZone: "UTC" })).toBe("12:30 PM");
  });

  test("falls back to UTC for a zone the device doesn't know", () => {
    expect(toWallParts(new Date("2026-10-22T19:05:00.000Z"), "Not/AZone")).toEqual({
      year: 2026,
      month: 10,
      day: 22,
      hour: 19,
      minute: 5,
    });
  });
});

describe("formatTimeRange", () => {
  test("joins both ends with a hyphen", () => {
    expect(
      formatTimeRange("2026-10-22T19:00:00.000Z", "2026-10-22T20:00:00.000Z", { timeZone: "UTC" })
    ).toBe("7:00 PM - 8:00 PM");
  });
});

describe("formatWallDateTime", () => {
  test("reads a wall time without converting it", () => {
    expect(formatWallDateTime("2026-10-20T08:00", { now: NOW })).toBe("Tue, 20 Oct · 8:00 AM");
    expect(formatWallDateTime("2027-01-15T16:00", { now: NOW, hour12: false })).toBe(
      "Fri, 15 Jan 2027 · 16:00"
    );
  });
});
