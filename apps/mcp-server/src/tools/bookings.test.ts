import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  getBookings,
  getBooking,
  createBooking,
  rescheduleBooking,
  cancelBooking,
  confirmBooking,
  getBookingsSchema,
  getBookingSchema,
  createBookingSchema,
  rescheduleBookingSchema,
  cancelBookingSchema,
  confirmBookingSchema,
} from "./bookings.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bookings schemas", () => {
  it("exports getBookingsSchema with optional fields", () => {
    expect(getBookingsSchema).toBeDefined();
    expect(getBookingsSchema.status).toBeDefined();
    expect(getBookingsSchema.take).toBeDefined();
    expect(getBookingsSchema.skip).toBeDefined();
  });

  it("exports getBookingSchema with bookingUid", () => {
    expect(getBookingSchema.bookingUid).toBeDefined();
  });

  it("exports createBookingSchema with required fields", () => {
    expect(createBookingSchema.eventTypeId).toBeDefined();
    expect(createBookingSchema.start).toBeDefined();
    expect(createBookingSchema.attendee).toBeDefined();
  });

  it("exports rescheduleBookingSchema", () => {
    expect(rescheduleBookingSchema.bookingUid).toBeDefined();
    expect(rescheduleBookingSchema.start).toBeDefined();
  });

  it("exports cancelBookingSchema", () => {
    expect(cancelBookingSchema.bookingUid).toBeDefined();
  });

  it("exports confirmBookingSchema", () => {
    expect(confirmBookingSchema.bookingUid).toBeDefined();
  });
});

describe("getBookings", () => {
  it("returns formatted data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ bookings: [{ uid: "abc" }] });

    const result = await getBookings({ status: "upcoming" });

    expect(mockCalApi).toHaveBeenCalledWith("bookings", {
      params: { status: "upcoming" },
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({
      bookings: [{ uid: "abc" }],
    });
  });

  it("returns error response on CalApiError", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(403, "Forbidden", {}));

    const result = await getBookings({});

    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("Error 403: Forbidden");
  });

  it("rethrows non-CalApiError errors", async () => {
    mockCalApi.mockRejectedValueOnce(new TypeError("Network error"));

    await expect(getBookings({})).rejects.toThrow(TypeError);
  });
});

describe("getBooking", () => {
  it("calls correct endpoint with bookingUid", async () => {
    mockCalApi.mockResolvedValueOnce({ uid: "booking-123" });

    const result = await getBooking({ bookingUid: "booking-123" });

    expect(mockCalApi).toHaveBeenCalledWith("bookings/booking-123");
    expect(JSON.parse(result.content[0].text)).toEqual({ uid: "booking-123" });
  });

  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(404, "Not found", {}));

    const result = await getBooking({ bookingUid: "nonexistent" });

    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("404");
  });
});

describe("createBooking", () => {
  it("sends correct body with attendee info", async () => {
    mockCalApi.mockResolvedValueOnce({ uid: "new-booking" });

    const result = await createBooking({
      eventTypeId: 42,
      start: "2024-08-13T09:00:00Z",
      attendee: { name: "Alice", email: "alice@example.com", timeZone: "UTC" },
    });

    expect(mockCalApi).toHaveBeenCalledWith("bookings", {
      method: "POST",
      body: {
        eventTypeId: 42,
        start: "2024-08-13T09:00:00Z",
        attendee: { name: "Alice", email: "alice@example.com", timeZone: "UTC" },
      },
    });
    expect(JSON.parse(result.content[0].text)).toEqual({ uid: "new-booking" });
  });

  it("includes metadata when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ uid: "new" });

    await createBooking({
      eventTypeId: 1,
      start: "2024-08-13T09:00:00Z",
      attendee: { name: "Bob", email: "bob@example.com", timeZone: "UTC" },
      metadata: { source: "mcp" },
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toHaveProperty("metadata", { source: "mcp" });
  });
});

describe("rescheduleBooking", () => {
  it("sends reschedule request with body", async () => {
    mockCalApi.mockResolvedValueOnce({ uid: "rescheduled" });

    await rescheduleBooking({
      bookingUid: "abc",
      start: "2024-08-14T10:00:00Z",
      rescheduleReason: "Conflict",
    });

    expect(mockCalApi).toHaveBeenCalledWith("bookings/abc/reschedule", {
      method: "POST",
      body: { start: "2024-08-14T10:00:00Z", rescheduleReason: "Conflict" },
    });
  });

  it("sends empty body when no optional params", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await rescheduleBooking({ bookingUid: "abc" });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toEqual({});
  });
});

describe("cancelBooking", () => {
  it("sends cancel request", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await cancelBooking({ bookingUid: "xyz", cancellationReason: "Changed plans" });

    expect(mockCalApi).toHaveBeenCalledWith("bookings/xyz/cancel", {
      method: "POST",
      body: { cancellationReason: "Changed plans" },
    });
  });
});

describe("confirmBooking", () => {
  it("sends confirm request with empty body", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "confirmed" });

    await confirmBooking({ bookingUid: "uid-1" });

    expect(mockCalApi).toHaveBeenCalledWith("bookings/uid-1/confirm", {
      method: "POST",
      body: {},
    });
  });
});

// ── Tests for new tools ──
import {
  getBookingBySeat,
  getBookingBySeatSchema,
  getBookingRecordings,
  getBookingRecordingsSchema,
  getBookingTranscripts,
  getBookingTranscriptsSchema,
  markBookingAbsent,
  markBookingAbsentSchema,
  reassignBooking,
  reassignBookingSchema,
  reassignBookingToUser,
  reassignBookingToUserSchema,
  declineBooking,
  declineBookingSchema,
  getBookingCalendarLinks,
  getBookingCalendarLinksSchema,
  getBookingReferences,
  getBookingReferencesSchema,
  getBookingConferencingSessions,
  getBookingConferencingSessionsSchema,
  updateBookingLocation,
  updateBookingLocationSchema,
  getBookingAttendees,
  getBookingAttendeesSchema,
  addBookingAttendee,
  addBookingAttendeeSchema,
  getBookingAttendee,
  getBookingAttendeeSchema,
  addBookingGuests,
  addBookingGuestsSchema,
} from "./bookings.js";

describe("getBookingBySeat", () => {
  it("exports getBookingBySeatSchema", () => { expect(getBookingBySeatSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getBookingBySeat({"seatUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getBookingBySeat({"seatUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getBookingRecordings", () => {
  it("exports getBookingRecordingsSchema", () => { expect(getBookingRecordingsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getBookingRecordings({"bookingUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getBookingRecordings({"bookingUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getBookingTranscripts", () => {
  it("exports getBookingTranscriptsSchema", () => { expect(getBookingTranscriptsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getBookingTranscripts({"bookingUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getBookingTranscripts({"bookingUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("markBookingAbsent", () => {
  it("exports markBookingAbsentSchema", () => { expect(markBookingAbsentSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await markBookingAbsent({"bookingUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await markBookingAbsent({"bookingUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("reassignBooking", () => {
  it("exports reassignBookingSchema", () => { expect(reassignBookingSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await reassignBooking({"bookingUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await reassignBooking({"bookingUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("reassignBookingToUser", () => {
  it("exports reassignBookingToUserSchema", () => { expect(reassignBookingToUserSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await reassignBookingToUser({"bookingUid":"test-id","userId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await reassignBookingToUser({"bookingUid":"test-id","userId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("declineBooking", () => {
  it("exports declineBookingSchema", () => { expect(declineBookingSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await declineBooking({"bookingUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await declineBooking({"bookingUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getBookingCalendarLinks", () => {
  it("exports getBookingCalendarLinksSchema", () => { expect(getBookingCalendarLinksSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getBookingCalendarLinks({"bookingUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getBookingCalendarLinks({"bookingUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getBookingReferences", () => {
  it("exports getBookingReferencesSchema", () => { expect(getBookingReferencesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getBookingReferences({"bookingUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getBookingReferences({"bookingUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getBookingConferencingSessions", () => {
  it("exports getBookingConferencingSessionsSchema", () => { expect(getBookingConferencingSessionsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getBookingConferencingSessions({"bookingUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getBookingConferencingSessions({"bookingUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateBookingLocation", () => {
  it("exports updateBookingLocationSchema", () => { expect(updateBookingLocationSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateBookingLocation({"bookingUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateBookingLocation({"bookingUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getBookingAttendees", () => {
  it("exports getBookingAttendeesSchema", () => { expect(getBookingAttendeesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getBookingAttendees({"bookingUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getBookingAttendees({"bookingUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("addBookingAttendee", () => {
  it("exports addBookingAttendeeSchema", () => { expect(addBookingAttendeeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await addBookingAttendee({"bookingUid":"test-id","name":"test","timeZone":"test","email":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await addBookingAttendee({"bookingUid":"test-id","name":"test","timeZone":"test","email":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getBookingAttendee", () => {
  it("exports getBookingAttendeeSchema", () => { expect(getBookingAttendeeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getBookingAttendee({"bookingUid":"test-id","attendeeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getBookingAttendee({"bookingUid":"test-id","attendeeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("addBookingGuests", () => {
  it("exports addBookingGuestsSchema", () => { expect(addBookingGuestsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await addBookingGuests({"bookingUid":"test-id","guests":[]});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await addBookingGuests({"bookingUid":"test-id","guests":[]});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
