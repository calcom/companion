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
  markBookingAbsent,
  getBookingAttendees,
  addBookingAttendee,
  getBookingAttendee,
  getBookingsSchema,
  getBookingSchema,
  createBookingSchema,
  rescheduleBookingSchema,
  cancelBookingSchema,
  confirmBookingSchema,
  markBookingAbsentSchema,
  getBookingAttendeesSchema,
  addBookingAttendeeSchema,
  getBookingAttendeeSchema,
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
    expect(getBookingsSchema.attendeeName).toBeDefined();
    expect(getBookingsSchema.eventTypeIds).toBeDefined();
    expect(getBookingsSchema.teamId).toBeDefined();
    expect(getBookingsSchema.teamsIds).toBeDefined();
    expect(getBookingsSchema.afterStart).toBeDefined();
    expect(getBookingsSchema.beforeEnd).toBeDefined();
    expect(getBookingsSchema.sortStart).toBeDefined();
    expect(getBookingsSchema.sortCreated).toBeDefined();
    expect(getBookingsSchema.bookingUid).toBeDefined();
  });

  it("exports getBookingSchema with bookingUid", () => {
    expect(getBookingSchema.bookingUid).toBeDefined();
  });

  it("exports createBookingSchema with eventTypeId and slug-based alternatives", () => {
    expect(createBookingSchema.eventTypeId).toBeDefined();
    expect(createBookingSchema.eventTypeSlug).toBeDefined();
    expect(createBookingSchema.username).toBeDefined();
    expect(createBookingSchema.teamSlug).toBeDefined();
    expect(createBookingSchema.organizationSlug).toBeDefined();
    expect(createBookingSchema.start).toBeDefined();
    expect(createBookingSchema.attendee).toBeDefined();
    expect(createBookingSchema.guests).toBeDefined();
    expect(createBookingSchema.lengthInMinutes).toBeDefined();
    expect(createBookingSchema.bookingFieldsResponses).toBeDefined();
    expect(createBookingSchema.location).toBeDefined();
  });

  it("exports rescheduleBookingSchema", () => {
    expect(rescheduleBookingSchema.bookingUid).toBeDefined();
    expect(rescheduleBookingSchema.start).toBeDefined();
    expect(rescheduleBookingSchema.reschedulingReason).toBeDefined();
    expect(rescheduleBookingSchema.rescheduledBy).toBeDefined();
  });

  it("exports cancelBookingSchema", () => {
    expect(cancelBookingSchema.bookingUid).toBeDefined();
    expect(cancelBookingSchema.cancelSubsequentBookings).toBeDefined();
  });

  it("exports confirmBookingSchema", () => {
    expect(confirmBookingSchema.bookingUid).toBeDefined();
  });

  it("exports markBookingAbsentSchema", () => {
    expect(markBookingAbsentSchema.bookingUid).toBeDefined();
  });

  it("exports getBookingAttendeesSchema", () => {
    expect(getBookingAttendeesSchema.bookingUid).toBeDefined();
  });

  it("exports addBookingAttendeeSchema", () => {
    expect(addBookingAttendeeSchema.bookingUid).toBeDefined();
    expect(addBookingAttendeeSchema.name).toBeDefined();
    expect(addBookingAttendeeSchema.email).toBeDefined();
  });

  it("exports getBookingAttendeeSchema", () => {
    expect(getBookingAttendeeSchema.bookingUid).toBeDefined();
    expect(getBookingAttendeeSchema.attendeeId).toBeDefined();
  });
});

describe("getBookings", () => {
  it("returns formatted data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ bookings: [{ uid: "abc" }] });

    const result = await getBookings({ status: "upcoming" });

    expect(mockCalApi).toHaveBeenCalledWith("bookings", {
      params: expect.objectContaining({ status: "upcoming" }),
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({
      bookings: [{ uid: "abc" }],
    });
  });

  it("passes date range and sort params", async () => {
    mockCalApi.mockResolvedValueOnce({ bookings: [] });

    await getBookings({
      afterStart: "2024-08-01",
      beforeEnd: "2024-08-31",
      sortStart: "asc",
      teamId: 5,
    });

    const [, opts] = mockCalApi.mock.calls[0];
    const params = (opts as { params: Record<string, unknown> }).params;
    expect(params).toHaveProperty("afterStart", "2024-08-01");
    expect(params).toHaveProperty("beforeEnd", "2024-08-31");
    expect(params).toHaveProperty("sortStart", "asc");
    expect(params).toHaveProperty("teamId", 5);
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

  it("includes guests and lengthInMinutes when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ uid: "with-guests" });

    await createBooking({
      eventTypeId: 1,
      start: "2024-08-13T09:00:00Z",
      attendee: { name: "Bob", email: "bob@example.com", timeZone: "UTC" },
      guests: ["guest@example.com"],
      lengthInMinutes: 30,
    });

    const [, opts] = mockCalApi.mock.calls[0];
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body).toHaveProperty("guests", ["guest@example.com"]);
    expect(body).toHaveProperty("lengthInMinutes", 30);
  });

  it("includes location and bookingFieldsResponses when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ uid: "with-location" });

    await createBooking({
      eventTypeId: 1,
      start: "2024-08-13T09:00:00Z",
      attendee: { name: "Bob", email: "bob@example.com", timeZone: "UTC" },
      location: "https://meet.google.com/abc",
      bookingFieldsResponses: { company: "Acme" },
    });

    const [, opts] = mockCalApi.mock.calls[0];
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body).toHaveProperty("location", "https://meet.google.com/abc");
    expect(body).toHaveProperty("bookingFieldsResponses", { company: "Acme" });
  });

  it("supports booking by eventTypeSlug + username instead of eventTypeId", async () => {
    mockCalApi.mockResolvedValueOnce({ uid: "slug-booking" });

    const result = await createBooking({
      eventTypeSlug: "15min",
      username: "alice",
      start: "2024-08-13T09:00:00Z",
      attendee: { name: "Bob", email: "bob@example.com", timeZone: "UTC" },
    });

    expect(mockCalApi).toHaveBeenCalledWith("bookings", {
      method: "POST",
      body: {
        eventTypeSlug: "15min",
        username: "alice",
        start: "2024-08-13T09:00:00Z",
        attendee: { name: "Bob", email: "bob@example.com", timeZone: "UTC" },
      },
    });
    expect(JSON.parse(result.content[0].text)).toEqual({ uid: "slug-booking" });
  });

  it("supports booking by eventTypeSlug + teamSlug + organizationSlug", async () => {
    mockCalApi.mockResolvedValueOnce({ uid: "team-booking" });

    await createBooking({
      eventTypeSlug: "standup",
      teamSlug: "engineering",
      organizationSlug: "acme",
      start: "2024-08-13T09:00:00Z",
      attendee: { name: "Carol", email: "carol@example.com", timeZone: "America/New_York" },
    });

    const [, opts] = mockCalApi.mock.calls[0];
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body).toHaveProperty("eventTypeSlug", "standup");
    expect(body).toHaveProperty("teamSlug", "engineering");
    expect(body).toHaveProperty("organizationSlug", "acme");
    expect(body).not.toHaveProperty("eventTypeId");
  });
});

describe("rescheduleBooking", () => {
  it("sends reschedule request with reschedulingReason", async () => {
    mockCalApi.mockResolvedValueOnce({ uid: "rescheduled" });

    await rescheduleBooking({
      bookingUid: "abc",
      start: "2024-08-14T10:00:00Z",
      reschedulingReason: "Conflict",
    });

    expect(mockCalApi).toHaveBeenCalledWith("bookings/abc/reschedule", {
      method: "POST",
      body: { start: "2024-08-14T10:00:00Z", reschedulingReason: "Conflict" },
    });
  });

  it("sends body with only start when no optional params", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await rescheduleBooking({ bookingUid: "abc", start: "2024-08-14T10:00:00Z" });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toEqual({ start: "2024-08-14T10:00:00Z" });
  });

  it("includes rescheduledBy when provided", async () => {
    mockCalApi.mockResolvedValueOnce({ uid: "rescheduled" });

    await rescheduleBooking({
      bookingUid: "abc",
      start: "2024-08-14T10:00:00Z",
      rescheduledBy: "owner@example.com",
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toHaveProperty("rescheduledBy", "owner@example.com");
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

  it("includes cancelSubsequentBookings for recurring bookings", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await cancelBooking({ bookingUid: "xyz", cancelSubsequentBookings: true });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toHaveProperty("cancelSubsequentBookings", true);
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

describe("markBookingAbsent", () => {
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await markBookingAbsent({ bookingUid: "test-id" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await markBookingAbsent({ bookingUid: "test-id" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getBookingAttendees", () => {
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getBookingAttendees({ bookingUid: "test-id" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getBookingAttendees({ bookingUid: "test-id" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("addBookingAttendee", () => {
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await addBookingAttendee({ bookingUid: "test-id", name: "test", timeZone: "UTC", email: "test@example.com" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await addBookingAttendee({ bookingUid: "test-id", name: "test", timeZone: "UTC", email: "test@example.com" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getBookingAttendee", () => {
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getBookingAttendee({ bookingUid: "test-id", attendeeId: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getBookingAttendee({ bookingUid: "test-id", attendeeId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
