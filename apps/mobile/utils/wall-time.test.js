import { describe, expect, test } from "@jest/globals";

const {
  addHoursToWallTime,
  isStartTimeInPast,
  nextHourWallTime,
  preserveWallTimeOnTimezoneChange,
  timeZoneOffsetMs,
  timeZoneSummary,
  todayStartWallTime,
  utcToWallTime,
  wallTimeDiffMs,
  wallTimeToUtc,
} = require("./wall-time");

describe("wallTimeToUtc", () => {
  test("reads the wall time on the event's clock, not the device's", () => {
    expect(wallTimeToUtc("2026-10-19T07:00", "Europe/Madrid").toISOString()).toBe(
      "2026-10-19T05:00:00.000Z"
    );
    expect(wallTimeToUtc("2026-10-19T07:00", "America/New_York").toISOString()).toBe(
      "2026-10-19T11:00:00.000Z"
    );
  });

  test("handles UTC and the widest offsets (+14, −11)", () => {
    expect(wallTimeToUtc("2026-10-19T07:00", "UTC").toISOString()).toBe("2026-10-19T07:00:00.000Z");
    expect(wallTimeToUtc("2026-10-19T07:00", "Pacific/Kiritimati").toISOString()).toBe(
      "2026-10-18T17:00:00.000Z"
    );
    expect(wallTimeToUtc("2026-10-19T07:00", "Pacific/Pago_Pago").toISOString()).toBe(
      "2026-10-19T18:00:00.000Z"
    );
  });

  test("uses the offset in force on that day, across a DST change", () => {
    // Madrid is UTC+2 until 25 Oct 2026, then UTC+1.
    expect(wallTimeToUtc("2026-10-24T12:00", "Europe/Madrid").toISOString()).toBe(
      "2026-10-24T10:00:00.000Z"
    );
    expect(wallTimeToUtc("2026-10-26T12:00", "Europe/Madrid").toISOString()).toBe(
      "2026-10-26T11:00:00.000Z"
    );
  });

  test("round-trips with utcToWallTime", () => {
    const instant = wallTimeToUtc("2026-03-29T03:30", "Europe/London");
    expect(utcToWallTime(instant, "Europe/London")).toBe("2026-03-29T03:30");
  });
});

describe("timeZoneOffsetMs", () => {
  test("is negative west of Greenwich", () => {
    expect(timeZoneOffsetMs(new Date("2026-01-15T12:00:00Z"), "America/New_York")).toBe(
      -5 * 3600 * 1000
    );
  });
});

describe("nextHourWallTime", () => {
  test("rounds up to the next whole hour in the event's zone", () => {
    const now = new Date("2026-10-19T05:20:00Z");
    expect(nextHourWallTime(now, "Europe/Madrid")).toBe("2026-10-19T08:00");
    expect(nextHourWallTime(now, "UTC")).toBe("2026-10-19T06:00");
  });

  test("moves a whole hour on, like the web", () => {
    expect(nextHourWallTime(new Date("2026-10-19T07:00:00Z"), "UTC")).toBe("2026-10-19T08:00");
  });

  test("crosses midnight", () => {
    expect(nextHourWallTime(new Date("2026-12-31T23:30:00Z"), "UTC")).toBe("2027-01-01T00:00");
  });
});

describe("wall-clock arithmetic", () => {
  test("adds hours on the face values, ignoring DST", () => {
    expect(addHoursToWallTime("2026-10-25T01:30", 1)).toBe("2026-10-25T02:30");
    expect(addHoursToWallTime("2026-10-19T23:30", 1)).toBe("2026-10-20T00:30");
  });

  test("measures durations on the face values", () => {
    expect(wallTimeDiffMs("2026-10-19T07:00", "2026-10-19T08:15")).toBe(75 * 60 * 1000);
  });
});

describe("todayStartWallTime", () => {
  test("is today in the event's zone", () => {
    const now = new Date("2026-10-19T23:30:00Z");
    expect(todayStartWallTime("UTC", now)).toBe("2026-10-19T00:00");
    expect(todayStartWallTime("Asia/Tokyo", now)).toBe("2026-10-20T00:00");
  });
});

describe("isStartTimeInPast", () => {
  test("allows a minute of slack, like the API", () => {
    const now = new Date("2026-10-19T07:00:00Z");
    expect(isStartTimeInPast(new Date("2026-10-19T06:59:30Z"), now)).toBe(false);
    expect(isStartTimeInPast(new Date("2026-10-19T06:58:00Z"), now)).toBe(true);
  });
});

describe("preserveWallTimeOnTimezoneChange", () => {
  test("keeps the wall times when they are still ahead in the new zone", () => {
    const now = new Date("2026-10-19T04:00:00Z");
    expect(
      preserveWallTimeOnTimezoneChange("2026-10-19T09:00", "2026-10-19T10:00", "Europe/Madrid", now)
    ).toEqual({ startWallTime: "2026-10-19T09:00", endWallTime: "2026-10-19T10:00" });
  });

  test("moves a start that has passed in the new zone to its next hour, keeping the duration", () => {
    // 09:00 in Tokyo is 00:00 UTC, already gone at 04:00 UTC (13:00 in Tokyo).
    const now = new Date("2026-10-19T04:00:00Z");
    expect(
      preserveWallTimeOnTimezoneChange("2026-10-19T09:00", "2026-10-19T11:00", "Asia/Tokyo", now)
    ).toEqual({ startWallTime: "2026-10-19T14:00", endWallTime: "2026-10-19T16:00" });
  });
});

describe("timeZoneSummary", () => {
  test("shows the zone's offset now and its city", () => {
    const at = new Date("2026-10-19T12:00:00Z");
    expect(timeZoneSummary("Europe/Madrid", at)).toEqual({ offset: "GMT+02:00", city: "Madrid" });
    expect(timeZoneSummary("America/New_York", at)).toEqual({
      offset: "GMT-04:00",
      city: "New York",
    });
    expect(timeZoneSummary("Asia/Kolkata", at)).toEqual({ offset: "GMT+05:30", city: "Kolkata" });
    expect(timeZoneSummary("UTC", at)).toEqual({ offset: "GMT+00:00", city: "UTC" });
  });
});
