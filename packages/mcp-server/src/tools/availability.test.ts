import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  getAvailability,
  getAvailabilitySchema,
} from "./availability.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("availability schema", () => {
  it("exports getAvailabilitySchema with required fields", () => {
    expect(getAvailabilitySchema.startTime).toBeDefined();
    expect(getAvailabilitySchema.endTime).toBeDefined();
    expect(getAvailabilitySchema.timeZone).toBeDefined();
  });

  it("has optional eventTypeId and eventTypeSlug", () => {
    expect(getAvailabilitySchema.eventTypeId).toBeDefined();
    expect(getAvailabilitySchema.eventTypeSlug).toBeDefined();
  });

  it("has optional usernameList", () => {
    expect(getAvailabilitySchema.usernameList).toBeDefined();
  });
});

describe("getAvailability", () => {
  it("sends query params to slots/available", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: { "2024-08-13": ["09:00", "10:00"] } });

    const result = await getAvailability({
      startTime: "2024-08-13T00:00:00Z",
      endTime: "2024-08-14T00:00:00Z",
      timeZone: "America/New_York",
    });

    expect(mockCalApi).toHaveBeenCalledWith("slots/available", {
      params: {
        startTime: "2024-08-13T00:00:00Z",
        endTime: "2024-08-14T00:00:00Z",
        timeZone: "America/New_York",
      },
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.slots).toBeDefined();
  });

  it("includes eventTypeId when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: {} });

    await getAvailability({
      startTime: "2024-08-13T00:00:00Z",
      endTime: "2024-08-14T00:00:00Z",
      timeZone: "UTC",
      eventTypeId: 42,
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).toHaveProperty("eventTypeId", 42);
  });

  it("includes usernameList when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: {} });

    await getAvailability({
      startTime: "2024-08-13T00:00:00Z",
      endTime: "2024-08-14T00:00:00Z",
      timeZone: "UTC",
      usernameList: ["alice", "bob"],
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).toHaveProperty("usernameList", [
      "alice",
      "bob",
    ]);
  });

  it("excludes empty usernameList", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: {} });

    await getAvailability({
      startTime: "2024-08-13T00:00:00Z",
      endTime: "2024-08-14T00:00:00Z",
      timeZone: "UTC",
      usernameList: [],
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).not.toHaveProperty("usernameList");
  });

  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));

    const result = await getAvailability({
      startTime: "invalid",
      endTime: "invalid",
      timeZone: "UTC",
    });

    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });

  it("rethrows non-CalApiError", async () => {
    mockCalApi.mockRejectedValueOnce(new Error("Network failure"));

    await expect(
      getAvailability({
        startTime: "2024-08-13T00:00:00Z",
        endTime: "2024-08-14T00:00:00Z",
        timeZone: "UTC",
      })
    ).rejects.toThrow("Network failure");
  });
});
