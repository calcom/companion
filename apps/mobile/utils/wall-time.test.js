import { describe, expect, test } from "@jest/globals";

const {
  addHoursToWallTime,
  isStartTimeInPast,
  nextHourWallTime,
  preserveWallTimeOnTimezoneChange,
  timeZoneOffsetMs,
  timeZoneSummary,
  todayStartWallTime,
  utcFaceDateToWallTime,
  utcToWallTime,
  wallTimeDiffMs,
  wallTimeToUtc,
  wallTimeToUtcFaceDate,
} = require("./wall-time");

/**
 * Runs `assert` with the device's clock in each of `timeZones`. Jest hands tests a copy of
 * process.env, where TZ does nothing, so this sets it on Node's own, which re-reads it at once.
 */
function inDeviceTimeZones(timeZones, assert) {
  const nodeEnv = require("node:vm").runInThisContext("process.env");
  const original = nodeEnv.TZ;
  try {
    for (const timeZone of timeZones) {
      nodeEnv.TZ = timeZone;
      // Fails if the zone ever stops reaching the clock, rather than testing UTC again.
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(timeZone);
      assert();
    }
  } finally {
    if (original === undefined) Reflect.deleteProperty(nodeEnv, "TZ");
    else nodeEnv.TZ = original;
  }
}

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

  test("moves a time the clock skips on by the jump", () => {
    // New York jumps 02:00 EST -> 03:00 EDT on 8 Mar 2026, so 02:30 never happens there.
    const skipped = wallTimeToUtc("2026-03-08T02:30", "America/New_York");
    expect(skipped.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(utcToWallTime(skipped, "America/New_York")).toBe("2026-03-08T03:30");
    // Madrid jumps 02:00 CET -> 03:00 CEST on 29 Mar 2026.
    expect(wallTimeToUtc("2026-03-29T02:30", "Europe/Madrid").toISOString()).toBe(
      "2026-03-29T01:30:00.000Z"
    );
  });

  test("takes the earlier instant for a time the clock reads twice", () => {
    // New York reads 01:30 twice on 1 Nov 2026: at 05:30Z (EDT) and 06:30Z (EST).
    expect(wallTimeToUtc("2026-11-01T01:30", "America/New_York").toISOString()).toBe(
      "2026-11-01T05:30:00.000Z"
    );
    // Madrid reads 02:30 twice on 25 Oct 2026: at 00:30Z (CEST) and 01:30Z (CET).
    expect(wallTimeToUtc("2026-10-25T02:30", "Europe/Madrid").toISOString()).toBe(
      "2026-10-25T00:30:00.000Z"
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

describe("wallTimeToUtcFaceDate", () => {
  // Two zones that skip an hour in March 2026, and the furthest east (UTC+14).
  const deviceTimeZones = ["America/New_York", "Europe/Madrid", "Pacific/Kiritimati"];

  test("carries the face values on the UTC clock, whatever the device's zone", () => {
    inDeviceTimeZones(deviceTimeZones, () => {
      expect(wallTimeToUtcFaceDate("2026-08-01T18:00").toISOString()).toBe(
        "2026-08-01T18:00:00.000Z"
      );
    });
  });

  test("round-trips a wall time the device's own clock skips", () => {
    // 02:30 does not exist in America/New_York or Europe/Madrid on these dates.
    inDeviceTimeZones(deviceTimeZones, () => {
      for (const wallTime of ["2026-03-08T02:30", "2026-03-29T02:30"]) {
        expect(utcFaceDateToWallTime(wallTimeToUtcFaceDate(wallTime))).toBe(wallTime);
      }
    });
  });

  test("reads back only the minutes a picker shows", () => {
    expect(utcFaceDateToWallTime(new Date("2026-08-01T18:05:42.123Z"))).toBe("2026-08-01T18:05");
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
