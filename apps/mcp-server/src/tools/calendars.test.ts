import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  getCalendars,
  getBusyTimes,
  getCalendarsSchema,
  getBusyTimesSchema,
} from "./calendars.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("calendars schemas", () => {
  it("exports empty getCalendarsSchema", () => {
    expect(getCalendarsSchema).toEqual({});
  });

  it("exports getBusyTimesSchema with optional date fields", () => {
    expect(getBusyTimesSchema.dateFrom).toBeDefined();
    expect(getBusyTimesSchema.dateTo).toBeDefined();
  });
});

describe("getCalendars", () => {
  it("returns list of calendars", async () => {
    mockCalApi.mockResolvedValueOnce({
      connectedCalendars: [{ integration: "google" }],
    });

    const result = await getCalendars();

    expect(mockCalApi).toHaveBeenCalledWith("calendars");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.connectedCalendars).toHaveLength(1);
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(401, "Unauthorized", {}));

    const result = await getCalendars();

    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("401");
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

// ── Tests for new tools ──
import {
  getCalendarConnections,
  getCalendarConnectionsSchema,
  getConnectionEvents,
  getConnectionEventsSchema,
  createConnectionEvent,
  createConnectionEventSchema,
  getConnectionEvent,
  getConnectionEventSchema,
  updateConnectionEvent,
  updateConnectionEventSchema,
  deleteConnectionEvent,
  deleteConnectionEventSchema,
  getConnectionFreebusy,
  getConnectionFreebusySchema,
  getCalendarEventByUid,
  getCalendarEventByUidSchema,
  updateCalendarEventByUid,
  updateCalendarEventByUidSchema,
  deleteCalendarEvent,
  deleteCalendarEventSchema,
  getCalendarEvent,
  getCalendarEventSchema,
  updateCalendarEvent,
  updateCalendarEventSchema,
  listCalendarEvents,
  listCalendarEventsSchema,
  createCalendarEvent,
  createCalendarEventSchema,
  getCalendarFreebusy,
  getCalendarFreebusySchema,
  saveIcsFeed,
  saveIcsFeedSchema,
  checkIcsFeed,
  checkIcsFeedSchema,
  getCalendarConnectUrl,
  getCalendarConnectUrlSchema,
  saveCalendarCredentials,
  saveCalendarCredentialsSchema,
  checkCalendarConnection,
  checkCalendarConnectionSchema,
  disconnectCalendar,
  disconnectCalendarSchema,
} from "./calendars.js";

describe("getCalendarConnections", () => {
  it("exports getCalendarConnectionsSchema", () => { expect(getCalendarConnectionsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getCalendarConnections();
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getCalendarConnections();
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getConnectionEvents", () => {
  it("exports getConnectionEventsSchema", () => { expect(getConnectionEventsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getConnectionEvents({"connectionId":"test-id","from":"test","to":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getConnectionEvents({"connectionId":"test-id","from":"test","to":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createConnectionEvent", () => {
  it("exports createConnectionEventSchema", () => { expect(createConnectionEventSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createConnectionEvent({"connectionId":"test-id","title":"test","start":{},"end":{}});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createConnectionEvent({"connectionId":"test-id","title":"test","start":{},"end":{}});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getConnectionEvent", () => {
  it("exports getConnectionEventSchema", () => { expect(getConnectionEventSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getConnectionEvent({"connectionId":"test-id","eventId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getConnectionEvent({"connectionId":"test-id","eventId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateConnectionEvent", () => {
  it("exports updateConnectionEventSchema", () => { expect(updateConnectionEventSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateConnectionEvent({"connectionId":"test-id","eventId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateConnectionEvent({"connectionId":"test-id","eventId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteConnectionEvent", () => {
  it("exports deleteConnectionEventSchema", () => { expect(deleteConnectionEventSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteConnectionEvent({"connectionId":"test-id","eventId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteConnectionEvent({"connectionId":"test-id","eventId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getConnectionFreebusy", () => {
  it("exports getConnectionFreebusySchema", () => { expect(getConnectionFreebusySchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getConnectionFreebusy({"connectionId":"test-id","from":"test","to":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getConnectionFreebusy({"connectionId":"test-id","from":"test","to":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getCalendarEventByUid", () => {
  it("exports getCalendarEventByUidSchema", () => { expect(getCalendarEventByUidSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getCalendarEventByUid({"calendar":"test-id","eventUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getCalendarEventByUid({"calendar":"test-id","eventUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateCalendarEventByUid", () => {
  it("exports updateCalendarEventByUidSchema", () => { expect(updateCalendarEventByUidSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateCalendarEventByUid({"calendar":"test-id","eventUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateCalendarEventByUid({"calendar":"test-id","eventUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteCalendarEvent", () => {
  it("exports deleteCalendarEventSchema", () => { expect(deleteCalendarEventSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteCalendarEvent({"calendar":"test-id","eventUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteCalendarEvent({"calendar":"test-id","eventUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getCalendarEvent", () => {
  it("exports getCalendarEventSchema", () => { expect(getCalendarEventSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getCalendarEvent({"calendar":"test-id","eventUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getCalendarEvent({"calendar":"test-id","eventUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateCalendarEvent", () => {
  it("exports updateCalendarEventSchema", () => { expect(updateCalendarEventSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateCalendarEvent({"calendar":"test-id","eventUid":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateCalendarEvent({"calendar":"test-id","eventUid":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("listCalendarEvents", () => {
  it("exports listCalendarEventsSchema", () => { expect(listCalendarEventsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await listCalendarEvents({"calendar":"test-id","from":"test","to":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await listCalendarEvents({"calendar":"test-id","from":"test","to":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createCalendarEvent", () => {
  it("exports createCalendarEventSchema", () => { expect(createCalendarEventSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createCalendarEvent({"calendar":"test-id","title":"test","start":{},"end":{}});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createCalendarEvent({"calendar":"test-id","title":"test","start":{},"end":{}});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getCalendarFreebusy", () => {
  it("exports getCalendarFreebusySchema", () => { expect(getCalendarFreebusySchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getCalendarFreebusy({"calendar":"test-id","from":"test","to":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getCalendarFreebusy({"calendar":"test-id","from":"test","to":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("saveIcsFeed", () => {
  it("exports saveIcsFeedSchema", () => { expect(saveIcsFeedSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await saveIcsFeed({"urls":[]});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await saveIcsFeed({"urls":[]});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("checkIcsFeed", () => {
  it("exports checkIcsFeedSchema", () => { expect(checkIcsFeedSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await checkIcsFeed();
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await checkIcsFeed();
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getCalendarConnectUrl", () => {
  it("exports getCalendarConnectUrlSchema", () => { expect(getCalendarConnectUrlSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getCalendarConnectUrl({"calendar":"test-id","isDryRun":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getCalendarConnectUrl({"calendar":"test-id","isDryRun":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("saveCalendarCredentials", () => {
  it("exports saveCalendarCredentialsSchema", () => { expect(saveCalendarCredentialsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await saveCalendarCredentials({"calendar":"test-id","username":"test","password":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await saveCalendarCredentials({"calendar":"test-id","username":"test","password":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("checkCalendarConnection", () => {
  it("exports checkCalendarConnectionSchema", () => { expect(checkCalendarConnectionSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await checkCalendarConnection({"calendar":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await checkCalendarConnection({"calendar":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("disconnectCalendar", () => {
  it("exports disconnectCalendarSchema", () => { expect(disconnectCalendarSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await disconnectCalendar({"calendar":"test-id","id":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await disconnectCalendar({"calendar":"test-id","id":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
