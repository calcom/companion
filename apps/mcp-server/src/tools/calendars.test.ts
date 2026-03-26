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
  it("exports getBusyTimesSchema with optional date fields", () => {
    expect(getBusyTimesSchema.dateFrom).toBeDefined();
    expect(getBusyTimesSchema.dateTo).toBeDefined();
  });
});

describe("getBusyTimes", () => {
  it("sends date params", async () => {
    mockCalApi.mockResolvedValueOnce({ busyTimes: [] });

    const result = await getBusyTimes({
      dateFrom: "2024-08-13T00:00:00Z",
      dateTo: "2024-08-14T00:00:00Z",
    });

    expect(mockCalApi).toHaveBeenCalledWith("calendars/busy-times", {
      params: {
        dateFrom: "2024-08-13T00:00:00Z",
        dateTo: "2024-08-14T00:00:00Z",
      },
    });
    expect(JSON.parse(result.content[0].text)).toHaveProperty("busyTimes");
  });

  it("works with no params", async () => {
    mockCalApi.mockResolvedValueOnce({ busyTimes: [] });

    await getBusyTimes({});

    expect(mockCalApi).toHaveBeenCalledWith("calendars/busy-times", {
      params: { dateFrom: undefined, dateTo: undefined },
    });
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(500, "Server error", {}));

    const result = await getBusyTimes({});

    expect(result).toHaveProperty("isError", true);
  });
});
