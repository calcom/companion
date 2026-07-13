import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  createEventType,
  createEventTypeSchema,
  deleteEventType,
  deleteEventTypeSchema,
  getCrmSyncErrors,
  getCrmSyncErrorsSchema,
  getEventType,
  getEventTypeHistory,
  getEventTypeHistorySchema,
  getEventTypeSchema,
  getEventTypes,
  getEventTypesSchema,
  getSchedulingConfig,
  getSchedulingConfigSchema,
  updateEventType,
  updateEventTypeSchema,
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

  it("exports getCrmSyncErrorsSchema with eventTypeId, appSlug and pagination params", () => {
    expect(getCrmSyncErrorsSchema.eventTypeId).toBeDefined();
    expect(getCrmSyncErrorsSchema.appSlug).toBeDefined();
    expect(getCrmSyncErrorsSchema.includeDismissed).toBeDefined();
    expect(getCrmSyncErrorsSchema.cursor).toBeDefined();
    expect(getCrmSyncErrorsSchema.limit).toBeDefined();
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

describe("getCrmSyncErrors schema", () => {
  it("requires eventTypeId to be an integer", () => {
    expect(getCrmSyncErrorsSchema.eventTypeId.safeParse(42).success).toBe(true);
    expect(getCrmSyncErrorsSchema.eventTypeId.safeParse(1.5).success).toBe(false);
    expect(getCrmSyncErrorsSchema.eventTypeId.safeParse("abc").success).toBe(false);
  });

  it("requires a non-empty appSlug", () => {
    expect(getCrmSyncErrorsSchema.appSlug.safeParse("salesforce").success).toBe(true);
    expect(getCrmSyncErrorsSchema.appSlug.safeParse("").success).toBe(false);
  });

  it("enforces OpenAPI limit bounds (1-100)", () => {
    expect(getCrmSyncErrorsSchema.limit.safeParse(0).success).toBe(false);
    expect(getCrmSyncErrorsSchema.limit.safeParse(1).success).toBe(true);
    expect(getCrmSyncErrorsSchema.limit.safeParse(100).success).toBe(true);
    expect(getCrmSyncErrorsSchema.limit.safeParse(101).success).toBe(false);
    expect(getCrmSyncErrorsSchema.limit.safeParse(1.5).success).toBe(false);
    expect(getCrmSyncErrorsSchema.limit.safeParse(undefined).success).toBe(true);
  });
});

describe("getCrmSyncErrors", () => {
  it("calls the correct API path with required query params", async () => {
    const mockResponse = {
      status: "success",
      data: [
        {
          id: "019ea850-efc7-7a48-8508-aed31b72ce68",
          credentialId: 123,
          eventTypeId: 49,
          appSlug: "salesforce",
          timestamp: "2026-06-08T17:38:57.107Z",
          errorCode: "FIELD_CUSTOM_VALIDATION_EXCEPTION",
          errorMessage: "Validation rule blocked this update",
          droppedFields: ["Custom_Field__c"],
          dismissedAt: null,
        },
      ],
      pagination: {
        nextCursor: null,
        hasMore: false,
      },
    };
    mockCalApi.mockResolvedValueOnce(mockResponse);

    const result = await getCrmSyncErrors({ eventTypeId: 49, appSlug: "salesforce" });

    expect(mockCalApi).toHaveBeenCalledWith("event-types/49/crm-sync-errors", {
      params: { appSlug: "salesforce" },
    });
    expect(JSON.parse(result.content[0].text)).toEqual(mockResponse);
  });

  it("passes optional includeDismissed and pagination query params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [], pagination: {} });

    await getCrmSyncErrors({
      eventTypeId: 49,
      appSlug: "salesforce",
      includeDismissed: true,
      cursor: "eyJ2IjoxLCJzb3J0VXVpZCI6IjAxOWVhODUwIn0",
      limit: 25,
    });

    const [path, opts] = mockCalApi.mock.calls[0];
    expect(path).toBe("event-types/49/crm-sync-errors");
    const params = (opts as { params: Record<string, unknown> }).params;
    expect(params).toEqual({
      appSlug: "salesforce",
      includeDismissed: true,
      cursor: "eyJ2IjoxLCJzb3J0VXVpZCI6IjAxOWVhODUwIn0",
      limit: 25,
    });
  });

  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(403, "Forbidden", {}));

    const result = await getCrmSyncErrors({ eventTypeId: 49, appSlug: "salesforce" });

    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("403");
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

describe("getEventTypeHistory schema", () => {
  it("exports getEventTypeHistorySchema with eventTypeId, limit and cursor", () => {
    expect(getEventTypeHistorySchema.eventTypeId).toBeDefined();
    expect(getEventTypeHistorySchema.limit).toBeDefined();
    expect(getEventTypeHistorySchema.cursor).toBeDefined();
  });

  it("requires eventTypeId to be an integer", () => {
    expect(getEventTypeHistorySchema.eventTypeId.safeParse(42).success).toBe(true);
    expect(getEventTypeHistorySchema.eventTypeId.safeParse(1.5).success).toBe(false);
    expect(getEventTypeHistorySchema.eventTypeId.safeParse("abc").success).toBe(false);
  });

  it("enforces OpenAPI limit bounds (1-50)", () => {
    expect(getEventTypeHistorySchema.limit.safeParse(0).success).toBe(false);
    expect(getEventTypeHistorySchema.limit.safeParse(1).success).toBe(true);
    expect(getEventTypeHistorySchema.limit.safeParse(50).success).toBe(true);
    expect(getEventTypeHistorySchema.limit.safeParse(51).success).toBe(false);
    expect(getEventTypeHistorySchema.limit.safeParse(1.5).success).toBe(false);
    expect(getEventTypeHistorySchema.limit.safeParse(undefined).success).toBe(true);
  });

  it("enforces the cursor max length (2048)", () => {
    expect(getEventTypeHistorySchema.cursor.safeParse("abc").success).toBe(true);
    expect(getEventTypeHistorySchema.cursor.safeParse("a".repeat(2048)).success).toBe(true);
    expect(getEventTypeHistorySchema.cursor.safeParse("a".repeat(2049)).success).toBe(false);
    expect(getEventTypeHistorySchema.cursor.safeParse(undefined).success).toBe(true);
  });
});

describe("getEventTypeHistory", () => {
  it("calls the correct API path with no query params", async () => {
    mockCalApi.mockResolvedValueOnce({ eventTypeId: 42, auditLogs: [] });

    const result = await getEventTypeHistory({ eventTypeId: 42 });

    expect(mockCalApi).toHaveBeenCalledWith("event-types/42/history", { params: {} });
    expect(JSON.parse(result.content[0].text)).toHaveProperty("eventTypeId", 42);
  });

  it("passes limit and cursor query params", async () => {
    mockCalApi.mockResolvedValueOnce({ eventTypeId: 42, auditLogs: [] });

    await getEventTypeHistory({ eventTypeId: 42, limit: 10, cursor: "abc" });

    const [path, opts] = mockCalApi.mock.calls[0];
    expect(path).toBe("event-types/42/history");
    const params = (opts as { params: Record<string, unknown> }).params;
    expect(params).toHaveProperty("limit", 10);
    expect(params).toHaveProperty("cursor", "abc");
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(404, "Event type not found", {}));

    const result = await getEventTypeHistory({ eventTypeId: 99 });

    expect(result).toHaveProperty("isError", true);
  });
});

describe("getSchedulingConfig schema", () => {
  it("exports getSchedulingConfigSchema with eventTypeId", () => {
    expect(getSchedulingConfigSchema.eventTypeId).toBeDefined();
  });

  it("requires eventTypeId to be a positive integer", () => {
    expect(getSchedulingConfigSchema.eventTypeId.safeParse(1).success).toBe(true);
    expect(getSchedulingConfigSchema.eventTypeId.safeParse(0).success).toBe(false);
    expect(getSchedulingConfigSchema.eventTypeId.safeParse(-1).success).toBe(false);
    expect(getSchedulingConfigSchema.eventTypeId.safeParse(1.5).success).toBe(false);
    expect(getSchedulingConfigSchema.eventTypeId.safeParse("abc").success).toBe(false);
  });
});

describe("getSchedulingConfig", () => {
  it("calls the correct API path", async () => {
    mockCalApi.mockResolvedValueOnce({
      eventTypeId: 10,
      schedulingType: "roundRobin",
      hosts: [],
      hostGroups: [],
    });

    const result = await getSchedulingConfig({ eventTypeId: 10 });

    expect(mockCalApi).toHaveBeenCalledWith("event-types/10/scheduling-config");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.schedulingType).toBe("roundRobin");
  });

  it("returns full round-robin config data", async () => {
    const mockResponse = {
      eventTypeId: 10,
      schedulingType: "roundRobin",
      hosts: [
        {
          userId: 1,
          name: "Alice",
          username: "alice",
          mandatory: false,
          priority: "high",
          weight: 150,
          avatarUrl: null,
          groupId: "group-1",
        },
      ],
      hostGroups: [{ id: "group-1", name: "Sales Team" }],
      assignAllTeamMembers: false,
      rescheduleWithSameRoundRobinHost: true,
      isRRWeightsEnabled: true,
      maxLeadThreshold: 3,
      includeNoShowInRRCalculation: false,
      crmRecordOwnerFallbackWindowHours: 24,
    };
    mockCalApi.mockResolvedValueOnce(mockResponse);

    const result = await getSchedulingConfig({ eventTypeId: 10 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.hosts).toHaveLength(1);
    expect(parsed.hosts[0].weight).toBe(150);
    expect(parsed.hostGroups[0].name).toBe("Sales Team");
    expect(parsed.isRRWeightsEnabled).toBe(true);
    expect(parsed.maxLeadThreshold).toBe(3);
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(422, "Not a team event type", {}));

    const result = await getSchedulingConfig({ eventTypeId: 99 });

    expect(result).toHaveProperty("isError", true);
  });
});
