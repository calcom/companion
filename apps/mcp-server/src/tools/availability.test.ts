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
    expect(getAvailabilitySchema.start).toBeDefined();
    expect(getAvailabilitySchema.end).toBeDefined();
  });

  it("has optional timeZone, eventTypeId, and eventTypeSlug", () => {
    expect(getAvailabilitySchema.timeZone).toBeDefined();
    expect(getAvailabilitySchema.eventTypeId).toBeDefined();
    expect(getAvailabilitySchema.eventTypeSlug).toBeDefined();
  });

  it("has optional username, teamSlug, organizationSlug", () => {
    expect(getAvailabilitySchema.username).toBeDefined();
    expect(getAvailabilitySchema.teamSlug).toBeDefined();
    expect(getAvailabilitySchema.organizationSlug).toBeDefined();
  });

  it("has optional usernames, duration, format, bookingUidToReschedule", () => {
    expect(getAvailabilitySchema.usernames).toBeDefined();
    expect(getAvailabilitySchema.duration).toBeDefined();
    expect(getAvailabilitySchema.format).toBeDefined();
    expect(getAvailabilitySchema.bookingUidToReschedule).toBeDefined();
  });
});

describe("getAvailability", () => {
  it("sends query params to slots endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: { "2024-08-13": ["09:00", "10:00"] } });

    const result = await getAvailability({
      start: "2024-08-13",
      end: "2024-08-14",
    });

    expect(mockCalApi).toHaveBeenCalledWith("slots", {
      params: {
        start: "2024-08-13",
        end: "2024-08-14",
      },
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.slots).toBeDefined();
  });

  it("includes timeZone when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: {} });

    await getAvailability({
      start: "2024-08-13",
      end: "2024-08-14",
      timeZone: "America/New_York",
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).toHaveProperty("timeZone", "America/New_York");
  });

  it("includes eventTypeId when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: {} });

    await getAvailability({
      start: "2024-08-13",
      end: "2024-08-14",
      eventTypeId: 42,
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).toHaveProperty("eventTypeId", 42);
  });

  it("includes username when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: {} });

    await getAvailability({
      start: "2024-08-13",
      end: "2024-08-14",
      username: "alice",
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).toHaveProperty("username", "alice");
  });

  it("joins usernames array into comma-separated string", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: {} });

    await getAvailability({
      start: "2024-08-13",
      end: "2024-08-14",
      usernames: ["alice", "bob"],
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).toHaveProperty("usernames", "alice,bob");
  });

  it("passes usernames string as-is", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: {} });

    await getAvailability({
      start: "2024-08-13",
      end: "2024-08-14",
      usernames: "alice,bob",
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).toHaveProperty("usernames", "alice,bob");
  });

  it("includes duration and format when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: {} });

    await getAvailability({
      start: "2024-08-13",
      end: "2024-08-14",
      duration: 30,
      format: "json",
    });

    const [, opts] = mockCalApi.mock.calls[0];
    const params = (opts as { params: Record<string, unknown> }).params;
    expect(params).toHaveProperty("duration", 30);
    expect(params).toHaveProperty("format", "json");
  });

  it("includes bookingUidToReschedule when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ slots: {} });

    await getAvailability({
      start: "2024-08-13",
      end: "2024-08-14",
      bookingUidToReschedule: "uid-123",
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { params: Record<string, unknown> }).params).toHaveProperty("bookingUidToReschedule", "uid-123");
  });

  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));

    const result = await getAvailability({
      start: "invalid",
      end: "invalid",
    });

    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });

  it("rethrows non-CalApiError", async () => {
    mockCalApi.mockRejectedValueOnce(new Error("Network failure"));

    await expect(
      getAvailability({
        start: "2024-08-13",
        end: "2024-08-14",
      })
    ).rejects.toThrow("Network failure");
  });
});

// ── Tests for new tools ──
import {
  reserveSlot,
  reserveSlotSchema,
  getSlotReservation,
  getSlotReservationSchema,
  updateSlotReservation,
  updateSlotReservationSchema,
  deleteSlotReservation,
  deleteSlotReservationSchema,
} from "./availability.js";

describe("reserveSlot", () => {
  it("exports reserveSlotSchema", () => { expect(reserveSlotSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await reserveSlot({"eventTypeId":1,"slotStart":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await reserveSlot({"eventTypeId":1,"slotStart":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getSlotReservation", () => {
  it("exports getSlotReservationSchema", () => { expect(getSlotReservationSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getSlotReservation({"uid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getSlotReservation({"uid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateSlotReservation", () => {
  it("exports updateSlotReservationSchema", () => { expect(updateSlotReservationSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateSlotReservation({"uid":"test-id","eventTypeId":1,"slotStart":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateSlotReservation({"uid":"test-id","eventTypeId":1,"slotStart":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteSlotReservation", () => {
  it("exports deleteSlotReservationSchema", () => { expect(deleteSlotReservationSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteSlotReservation({"uid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteSlotReservation({"uid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
