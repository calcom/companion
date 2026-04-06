import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  getEventTypes,
  getEventType,
  createEventType,
  updateEventType,
  deleteEventType,
  getEventTypesSchema,
  getEventTypeSchema,
  createEventTypeSchema,
  updateEventTypeSchema,
  deleteEventTypeSchema,
} from "./event-types.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("event-types schemas", () => {
  it("exports getEventTypesSchema with optional query params", () => {
    expect(getEventTypesSchema.username).toBeDefined();
    expect(getEventTypesSchema.eventSlug).toBeDefined();
    expect(getEventTypesSchema.usernames).toBeDefined();
    expect(getEventTypesSchema.orgSlug).toBeDefined();
    expect(getEventTypesSchema.orgId).toBeDefined();
    expect(getEventTypesSchema.sortCreatedAt).toBeDefined();
  });

  it("exports getEventTypeSchema with eventTypeId", () => {
    expect(getEventTypeSchema.eventTypeId).toBeDefined();
  });

  it("exports createEventTypeSchema with required and optional fields", () => {
    expect(createEventTypeSchema.title).toBeDefined();
    expect(createEventTypeSchema.slug).toBeDefined();
    expect(createEventTypeSchema.lengthInMinutes).toBeDefined();
    expect(createEventTypeSchema.locations).toBeDefined();
    expect(createEventTypeSchema.bookingFields).toBeDefined();
    expect(createEventTypeSchema.disableGuests).toBeDefined();
    expect(createEventTypeSchema.slotInterval).toBeDefined();
    expect(createEventTypeSchema.minimumBookingNotice).toBeDefined();
    expect(createEventTypeSchema.beforeEventBuffer).toBeDefined();
    expect(createEventTypeSchema.afterEventBuffer).toBeDefined();
    expect(createEventTypeSchema.scheduleId).toBeDefined();
    expect(createEventTypeSchema.recurrence).toBeDefined();
    expect(createEventTypeSchema.confirmationPolicy).toBeDefined();
    expect(createEventTypeSchema.seats).toBeDefined();
    expect(createEventTypeSchema.hidden).toBeDefined();
  });

  it("exports updateEventTypeSchema with id and optional fields", () => {
    expect(updateEventTypeSchema.eventTypeId).toBeDefined();
    expect(updateEventTypeSchema.title).toBeDefined();
  });

  it("exports deleteEventTypeSchema", () => {
    expect(deleteEventTypeSchema.eventTypeId).toBeDefined();
  });
});

describe("getEventTypes", () => {
  it("returns list of event types", async () => {
    mockCalApi.mockResolvedValueOnce({ eventTypes: [{ id: 1, title: "30min" }] });

    const result = await getEventTypes({});

    expect(mockCalApi).toHaveBeenCalledWith("event-types", { params: {} });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.eventTypes).toHaveLength(1);
  });

  it("passes query params", async () => {
    mockCalApi.mockResolvedValueOnce({ eventTypes: [] });

    await getEventTypes({ username: "alice", eventSlug: "30min" });

    const [, opts] = mockCalApi.mock.calls[0];
    const params = (opts as { params: Record<string, unknown> }).params;
    expect(params).toHaveProperty("username", "alice");
    expect(params).toHaveProperty("eventSlug", "30min");
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(500, "Server error", {}));

    const result = await getEventTypes({});

    expect(result).toHaveProperty("isError", true);
  });
});

describe("getEventType", () => {
  it("fetches event type by id", async () => {
    mockCalApi.mockResolvedValueOnce({ id: 42, title: "Discovery" });

    const result = await getEventType({ eventTypeId: 42 });

    expect(mockCalApi).toHaveBeenCalledWith("event-types/42");
    expect(JSON.parse(result.content[0].text)).toHaveProperty("title", "Discovery");
  });
});

describe("createEventType", () => {
  it("sends POST with required fields", async () => {
    mockCalApi.mockResolvedValueOnce({ id: 99 });

    await createEventType({
      title: "Quick Chat",
      slug: "quick-chat",
      lengthInMinutes: 15,
    });

    expect(mockCalApi).toHaveBeenCalledWith("event-types", {
      method: "POST",
      body: { title: "Quick Chat", slug: "quick-chat", lengthInMinutes: 15 },
    });
  });

  it("includes optional description", async () => {
    mockCalApi.mockResolvedValueOnce({ id: 100 });

    await createEventType({
      title: "Long Meeting",
      slug: "long-meeting",
      lengthInMinutes: 60,
      description: "A longer session",
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toHaveProperty(
      "description",
      "A longer session"
    );
  });
});

describe("updateEventType", () => {
  it("sends PATCH with partial fields", async () => {
    mockCalApi.mockResolvedValueOnce({ id: 42 });

    await updateEventType({ eventTypeId: 42, title: "Updated" });

    expect(mockCalApi).toHaveBeenCalledWith("event-types/42", {
      method: "PATCH",
      body: { title: "Updated" },
    });
  });

  it("sends empty body when no optional fields provided", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await updateEventType({ eventTypeId: 1 });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toEqual({});
  });
});

describe("deleteEventType", () => {
  it("sends DELETE request", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await deleteEventType({ eventTypeId: 42 });

    expect(mockCalApi).toHaveBeenCalledWith("event-types/42", { method: "DELETE" });
  });
});
