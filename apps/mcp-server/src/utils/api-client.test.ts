import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CalApiError } from "./errors.js";

// Mock the auth module before importing api-client
vi.mock("../auth.js", () => ({
  getApiKeyHeaders: vi.fn().mockReturnValue({
    Authorization: "Bearer test-key",
    "cal-api-version": "2024-08-13",
    "Content-Type": "application/json",
  }),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { calApi } from "./api-client.js";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CAL_API_BASE_URL;
  // Disable retries by default so tests don't need to mock multiple responses
  process.env.RETRY_MAX_ATTEMPTS = "0";
});

afterEach(() => {
  delete process.env.CAL_API_BASE_URL;
  delete process.env.RETRY_MAX_ATTEMPTS;
});

describe("calApi", () => {
  it("makes a GET request to the correct URL", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ data: "test" }),
    });

    const result = await calApi("bookings");

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.cal.com/v2/bookings");
    expect(options.method).toBe("GET");
    expect(result).toEqual({ data: "test" });
  });

  it("uses custom base URL from env", async () => {
    process.env.CAL_API_BASE_URL = "https://custom.cal.com";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ ok: true }),
    });

    await calApi("me");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://custom.cal.com/v2/me");
  });

  it("sends query params for GET requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve([]),
    });

    await calApi("bookings", { params: { status: "upcoming", take: 10 } });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("status=upcoming");
    expect(url).toContain("take=10");
  });

  it("skips undefined params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve([]),
    });

    await calApi("bookings", { params: { status: "upcoming", skip: undefined } });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("status=upcoming");
    expect(url).not.toContain("skip");
  });

  it("handles array params", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({}),
    });

    await calApi("bookings", {
      params: { tags: ["vip", "priority"] },
    });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("tags=vip");
    expect(url).toContain("tags=priority");
  });

  it("sends JSON body for POST requests", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ id: 1 }),
    });

    await calApi("bookings", {
      method: "POST",
      body: { eventTypeId: 1, start: "2024-08-13T09:00:00Z" },
    });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.method).toBe("POST");
    expect(options.body).toBe(
      JSON.stringify({ eventTypeId: 1, start: "2024-08-13T09:00:00Z" })
    );
  });

  it("throws CalApiError on non-2xx response with JSON body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ message: "Booking not found" }),
    });

    await expect(calApi("bookings/xyz")).rejects.toThrow(CalApiError);
  });

  it("throws CalApiError with generic message for non-JSON error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "text/plain" }),
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(calApi("me")).rejects.toSatisfy((err: unknown) => {
      const apiErr = err as CalApiError;
      return apiErr.status === 500 && apiErr.message.includes("Cal.com API error (500)");
    });
  });

  it("throws CalApiError on 401 (no retry in API key mode)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ message: "Invalid API key" }),
    });

    await expect(calApi("me")).rejects.toThrow(CalApiError);
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("retries on 500 and eventually throws", async () => {
    process.env.RETRY_MAX_ATTEMPTS = "2";
    process.env.RETRY_BASE_DELAY_MS = "1";

    const error500 = {
      ok: false,
      status: 500,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ message: "Internal Server Error" }),
    };
    mockFetch
      .mockResolvedValueOnce(error500)
      .mockResolvedValueOnce(error500)
      .mockResolvedValueOnce(error500);

    await expect(calApi("me")).rejects.toThrow(CalApiError);
    // 1 initial + 2 retries = 3 total calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries on 500 and succeeds on retry", async () => {
    process.env.RETRY_MAX_ATTEMPTS = "2";
    process.env.RETRY_BASE_DELAY_MS = "1";

    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ message: "Internal Server Error" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({ data: "recovered" }),
      });

    const result = await calApi("me");
    expect(result).toEqual({ data: "recovered" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("strips leading slash from path", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({}),
    });

    await calApi("/bookings");

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.cal.com/v2/bookings");
  });

  it("includes auth headers from getApiKeyHeaders", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({}),
    });

    await calApi("me");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers).toEqual({
      Authorization: "Bearer test-key",
      "cal-api-version": "2024-08-13",
      "Content-Type": "application/json",
    });
  });

  it("overrides cal-api-version for /v2/slots via path map", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ slots: {} }),
    });

    await calApi("slots", { params: { start: "2024-08-13", end: "2024-08-14" } });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["cal-api-version"]).toBe("2024-09-04");
  });

  it("overrides cal-api-version for /v2/event-types via path map", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ eventTypes: [] }),
    });

    await calApi("event-types");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["cal-api-version"]).toBe("2024-06-14");
  });

  it("overrides cal-api-version for /v2/event-types/:id sub-paths", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ id: 42 }),
    });

    await calApi("event-types/42");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["cal-api-version"]).toBe("2024-06-14");
  });

  it("overrides cal-api-version for /v2/schedules via path map", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ schedules: [] }),
    });

    await calApi("schedules");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["cal-api-version"]).toBe("2024-06-11");
  });

  it("overrides cal-api-version for /v2/schedules/:id sub-paths", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ id: 1 }),
    });

    await calApi("schedules/1");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["cal-api-version"]).toBe("2024-06-11");
  });

  it("uses explicit apiVersionOverride over path map", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({}),
    });

    await calApi("slots", { apiVersionOverride: "2025-01-01" });

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["cal-api-version"]).toBe("2025-01-01");
  });

  it("does not override cal-api-version for paths without overrides", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({}),
    });

    await calApi("bookings");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["cal-api-version"]).toBe("2024-08-13");
  });
});
