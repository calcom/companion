import { beforeEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("@/utils/region", () => ({
  getCalAppUrl: () => "https://app.example.test",
  getCalWebUrl: () => "https://example.test",
}));

const mockMakeRequest = jest.fn();
jest.mock("./request", () => ({
  // Same shape as the real class, without loading request.ts and its native networking.
  ApiRequestError: class ApiRequestError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
  makeRequest: (...args) => mockMakeRequest(...args),
}));

const {
  addCalEventLocation,
  createCalEvent,
  deleteCalEventCoverImage,
  getCalEvent,
  getCalEvents,
  reorderCalEventCoHosts,
  updateCalEvent,
  uploadCalEventCoverImage,
  uploadCalEventPersonAvatar,
} = require("./cal-events");
const { ApiRequestError } = require("./request");

describe("getCalEvents", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockMakeRequest.mockResolvedValue({ status: "success", data: [] });
  });

  test("lists the user's own events without a team", async () => {
    await getCalEvents(null);
    expect(mockMakeRequest).toHaveBeenCalledWith("/events", {}, "2024-06-14");
  });

  test("lists a team's events from the team route, since /events ignores teamId", async () => {
    await getCalEvents(7);
    expect(mockMakeRequest).toHaveBeenCalledWith("/teams/7/events", {}, "2024-06-14");
  });
});

describe("getCalEvent", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
  });

  test("resolves to null when the API answers 404", async () => {
    mockMakeRequest.mockRejectedValue(new ApiRequestError(404, "API Error: 404 Event not found"));
    await expect(getCalEvent("event-uuid")).resolves.toBeNull();
  });

  test("rethrows any other failure", async () => {
    const error = new ApiRequestError(500, "API Error: 500 Internal server error");
    mockMakeRequest.mockRejectedValue(error);
    await expect(getCalEvent("event-uuid")).rejects.toBe(error);
  });
});

describe("createCalEvent", () => {
  const input = {
    title: "Rooftop meetup",
    startTime: "2026-10-20T17:00:00.000Z",
    endTime: "2026-10-20T19:00:00.000Z",
    timeZone: "Europe/Madrid",
    visibility: "PUBLIC",
    requiresApproval: false,
  };
  const created = {
    uuid: "event-uuid",
    slug: "rooftop-meetup",
    title: "Rooftop meetup",
    endTime: "2026-10-20T19:00:00.000Z",
    publishedAt: null,
    cancelledAt: null,
    locations: [{ type: "address", address: "Calle Mayor 1" }],
  };

  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockMakeRequest.mockResolvedValue({ status: "success", data: created });
  });

  test("creates a personal event on /events", async () => {
    await createCalEvent(input, null);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      "2024-06-14"
    );
  });

  test("creates a team's event on the team route", async () => {
    await createCalEvent(input, 7);
    expect(mockMakeRequest.mock.calls[0][0]).toBe("/teams/7/events");
  });

  test("returns the draft with what the app derives from it", async () => {
    const event = await createCalEvent(input, null);
    expect(event).toMatchObject({
      uuid: "event-uuid",
      status: "draft",
      locationAddress: "Calle Mayor 1",
      publicUrl: "https://example.test/rooftop-meetup",
    });
  });

  test("fails on a response without the event", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success" });
    await expect(createCalEvent(input, null)).rejects.toThrow("Invalid response");
  });
});

describe("updateCalEvent", () => {
  beforeEach(() => {
    mockMakeRequest.mockReset();
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: {
        uuid: "event-uuid",
        slug: "rooftop-meetup",
        title: "Renamed",
        endTime: "2026-10-20T19:00:00.000Z",
        publishedAt: null,
        cancelledAt: null,
        locations: [],
      },
    });
  });

  test("patches only the given fields", async () => {
    const event = await updateCalEvent("event-uuid", { title: "Renamed", capacity: null });
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Renamed", capacity: null }),
      },
      "2024-06-14"
    );
    expect(event).toMatchObject({ title: "Renamed", status: "draft" });
  });
});

describe("event media and locations", () => {
  const file = { uri: "file:///cover.jpg", name: "cover.jpg", type: "image/jpeg" };

  beforeEach(() => {
    mockMakeRequest.mockReset();
  });

  test("adds a location with a POST of that one location", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success", data: { id: "l2", type: "link" } });
    const location = { type: "link", link: "https://zoom.us/j/1", label: "Stream" };
    await addCalEventLocation("event-uuid", location);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/locations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location),
      },
      "2024-06-14"
    );
  });

  test("uploads the cover as multipart, without a JSON content type", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: { coverImageUrl: "https://x/c.jpg" },
    });
    await expect(uploadCalEventCoverImage("event-uuid", file)).resolves.toBe("https://x/c.jpg");
    const [endpoint, options] = mockMakeRequest.mock.calls[0];
    expect(endpoint).toBe("/events/event-uuid/cover-image");
    expect(options.method).toBe("POST");
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
  });

  test("removes the cover with a DELETE", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success" });
    await deleteCalEventCoverImage("event-uuid");
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/cover-image",
      { method: "DELETE" },
      "2024-06-14"
    );
  });

  test("resolves a person's photo to its URL", async () => {
    mockMakeRequest.mockResolvedValue({
      status: "success",
      data: { avatarUrl: "https://x/a.jpg" },
    });
    await expect(uploadCalEventPersonAvatar("event-uuid", file)).resolves.toBe("https://x/a.jpg");
    expect(mockMakeRequest.mock.calls[0][0]).toBe("/events/event-uuid/person-avatar");
  });

  test("reorders co-hosts with every id", async () => {
    mockMakeRequest.mockResolvedValue({ status: "success" });
    await reorderCalEventCoHosts("event-uuid", ["b", "a"]);
    expect(mockMakeRequest).toHaveBeenCalledWith(
      "/events/event-uuid/co-hosts/order",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coHostIds: ["b", "a"] }),
      },
      "2024-06-14"
    );
  });
});
