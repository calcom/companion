import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  getBusyTimes,
  getBusyTimesSchema,
} from "./calendars.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("calendars schemas", () => {
  it("exports getBusyTimesSchema with required fields", () => {
    expect(getBusyTimesSchema.dateFrom).toBeDefined();
    expect(getBusyTimesSchema.dateTo).toBeDefined();
    expect(getBusyTimesSchema.credentialId).toBeDefined();
    expect(getBusyTimesSchema.externalId).toBeDefined();
    expect(getBusyTimesSchema.timeZone).toBeDefined();
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
        credentialId: 1,
        externalId: "user@gmail.com",
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
