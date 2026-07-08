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
  getEventType,
  getEventTypeHistory,
  getEventTypeHistorySchema,
  getEventTypeSchema,
  getEventTypeSettings,
  getEventTypeSettingsSchema,
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

  it("exports getEventTypeSettingsSchema with required and optional fields", () => {
    expect(getEventTypeSettingsSchema.eventTypeId).toBeDefined();
    expect(getEventTypeSettingsSchema.orgId).toBeDefined();
    expect(getEventTypeSettingsSchema.teamId).toBeDefined();
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

describe("getEventTypeSettings", () => {
  it("returns full event type settings from the API", async () => {
    const apiResponse = {
      id: 10,
      title: "Team Meeting",
      slug: "team-meeting",
      schedulingType: "roundRobin",
      assignAllTeamMembers: false,
      lengthInMinutes: 30,
      hosts: [
        { userId: 1, name: "Alice", isFixed: false, priority: 2, weight: 100, scheduleId: 456 },
        { userId: 2, name: "Bob", isFixed: true, priority: 1, weight: 50, scheduleId: null },
      ],
    };
    mockCalApi.mockResolvedValueOnce(apiResponse);

    const result = await getEventTypeSettings({ eventTypeId: 10 });

    expect(mockCalApi).toHaveBeenCalledWith("event-types/10");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(apiResponse);
  });

  it("uses org-scoped path when orgId and teamId are provided", async () => {
    const apiResponse = {
      id: 5,
      schedulingType: "roundRobin",
      assignAllTeamMembers: true,
      hosts: [],
    };
    mockCalApi.mockResolvedValueOnce(apiResponse);

    const result = await getEventTypeSettings({ eventTypeId: 5, orgId: 100, teamId: 200 });

    expect(mockCalApi).toHaveBeenCalledWith("organizations/100/teams/200/event-types/5");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(apiResponse);
  });

  it("returns whatever the API exposes without transformation", async () => {
    const apiResponse = {
      id: 7,
      schedulingType: "collective",
      hosts: [{ userId: 3, name: "Carol", isFixed: true }],
      bookingLimitsCount: { day: 2 },
      locations: [{ type: "inPerson", address: "123 Main St" }],
    };
    mockCalApi.mockResolvedValueOnce(apiResponse);

    const result = await getEventTypeSettings({ eventTypeId: 7 });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(apiResponse);
  });

  it("returns an error when only orgId is provided without teamId", async () => {
    const result = await getEventTypeSettings({ eventTypeId: 5, orgId: 100 });

    expect(mockCalApi).not.toHaveBeenCalled();
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("orgId and teamId must be provided together");
  });

  it("returns an error when only teamId is provided without orgId", async () => {
    const result = await getEventTypeSettings({ eventTypeId: 5, teamId: 200 });

    expect(mockCalApi).not.toHaveBeenCalled();
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("orgId and teamId must be provided together");
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(404, "Not found", {}));

    const result = await getEventTypeSettings({ eventTypeId: 999 });

    expect(result).toHaveProperty("isError", true);
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
