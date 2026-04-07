import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  getConnectedCalendars,
  getConnectedCalendarsSchema,
  getBusyTimes,
  getBusyTimesSchema,
} from "./calendars.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("calendars schemas", () => {
  it("exports getConnectedCalendarsSchema", () => {
    expect(getConnectedCalendarsSchema).toBeDefined();
  });

  it("exports getBusyTimesSchema with required fields", () => {
    expect(getBusyTimesSchema.dateFrom).toBeDefined();
    expect(getBusyTimesSchema.dateTo).toBeDefined();
    expect(getBusyTimesSchema.credentialId).toBeDefined();
    expect(getBusyTimesSchema.externalId).toBeDefined();
    expect(getBusyTimesSchema.timeZone).toBeDefined();
  });
});

describe("getConnectedCalendars", () => {
  it("calls GET /calendars and returns data", async () => {
    const mockData = {
      connectedCalendars: [
        { credentialId: 123, calendars: [{ externalId: "user@gmail.com", name: "Personal" }] },
      ],
      destinationCalendar: { externalId: "user@gmail.com" },
    };
    mockCalApi.mockResolvedValueOnce(mockData);

    const result = await getConnectedCalendars();

    expect(mockCalApi).toHaveBeenCalledWith("calendars");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.connectedCalendars).toHaveLength(1);
    expect(parsed.connectedCalendars[0].credentialId).toBe(123);
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(401, "Unauthorized", {}));

    const result = await getConnectedCalendars();

    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("401");
  });
});

describe("getBusyTimes", () => {
  it("sends date and calendar params", async () => {
    mockCalApi.mockResolvedValueOnce({ busyTimes: [] });

    const result = await getBusyTimes({
      dateFrom: "2024-08-13T00:00:00Z",
      dateTo: "2024-08-14T00:00:00Z",
      credentialId: 1,
      externalId: "user@gmail.com",
    });

    expect(mockCalApi).toHaveBeenCalledWith("calendars/busy-times", {
      params: expect.objectContaining({
        dateFrom: "2024-08-13T00:00:00Z",
        dateTo: "2024-08-14T00:00:00Z",
        "calendarsToLoad[0][credentialId]": 1,
        "calendarsToLoad[0][externalId]": "user@gmail.com",
      }),
    });
    expect(JSON.parse(result.content[0].text)).toHaveProperty("busyTimes");
  });

  it("includes timeZone when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ busyTimes: [] });

    await getBusyTimes({
      dateFrom: "2024-08-13",
      dateTo: "2024-08-14",
      credentialId: 1,
      externalId: "cal@gmail.com",
      timeZone: "America/New_York",
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).toHaveProperty("timeZone", "America/New_York");
  });

  it("includes loggedInUsersTz when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ busyTimes: [] });

    await getBusyTimes({
      dateFrom: "2024-08-13",
      dateTo: "2024-08-14",
      credentialId: 1,
      externalId: "cal@gmail.com",
      loggedInUsersTz: "Europe/London",
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).toHaveProperty("loggedInUsersTz", "Europe/London");
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(500, "Server error", {}));

    const result = await getBusyTimes({
      dateFrom: "2024-08-13",
      dateTo: "2024-08-14",
      credentialId: 1,
      externalId: "cal@gmail.com",
    });

    expect(result).toHaveProperty("isError", true);
  });
});
