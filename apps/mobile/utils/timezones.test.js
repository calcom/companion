import { describe, expect, test } from "@jest/globals";
import { filterTimezones, getTimezoneLabel, TIMEZONE_OPTIONS } from "@/utils/timezones";

describe("filterTimezones", () => {
  test("pins selected and device timezones (including UTC) to the top when query is empty", () => {
    const results = filterTimezones("", "UTC", "America/New_York");

    expect(results[0]?.id).toBe("UTC");
    expect(results[1]?.id).toBe("America/New_York");
    expect(results).toHaveLength(TIMEZONE_OPTIONS.length);
  });

  test("resolves runtime IANA aliases like Asia/Calcutta and Europe/Kyiv", () => {
    const pinned = filterTimezones("", "America/Adak", "Asia/Calcutta");
    expect(pinned[0]?.id).toBe("America/Adak");
    expect(pinned[1]?.id).toBe("Asia/Kolkata");

    expect(filterTimezones("kyiv")[0]?.id).toBe("Europe/Kiev");
    expect(filterTimezones("calcutta")[0]?.id).toBe("Asia/Kolkata");
    expect(filterTimezones("Etc/UTC")[0]?.id).toBe("UTC");
    expect(filterTimezones("Etc/GMT")[0]?.id).toBe("UTC");
  });

  test("does not duplicate when selected and device timezones are the same", () => {
    const results = filterTimezones("  ", "Asia/Kolkata", "Asia/Calcutta");

    expect(results[0]?.id).toBe("Asia/Kolkata");
    expect(results.filter((tz) => tz.id === "Asia/Kolkata")).toHaveLength(1);
    expect(results).toHaveLength(TIMEZONE_OPTIONS.length);
  });

  test("filters by city name and ranks city prefix matches before substring matches", () => {
    const results = filterTimezones("os").map((tz) => tz.id);

    expect(results[0]).toBe("Europe/Oslo");
    expect(results).toContain("America/Los_Angeles");
    expect(results.indexOf("Europe/Oslo")).toBeLessThan(results.indexOf("America/Los_Angeles"));
  });

  test("matches multi-word city names with spaces or underscores", () => {
    expect(filterTimezones("new york")[0]?.id).toBe("America/New_York");
    expect(filterTimezones("New_York")[0]?.id).toBe("America/New_York");
  });

  test("returns empty array when no timezone matches", () => {
    expect(filterTimezones("nonexistent-zone")).toEqual([]);
  });
});

describe("getTimezoneLabel", () => {
  test("formats underscores as spaces", () => {
    expect(getTimezoneLabel("America/New_York")).toBe("America/New York");
  });
});
