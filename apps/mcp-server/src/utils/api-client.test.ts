import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CalApiError } from "./errors.js";

// Mock the auth module before importing api-client
vi.mock("../auth.js", () => ({
  getAuthHeaders: vi.fn().mockResolvedValue({
    Authorization: "Bearer test-key",
    "cal-api-version": "2024-08-13",
    "Content-Type": "application/json",
  }),
  getAuthMode: vi.fn().mockReturnValue("apikey"),
  refreshOAuthToken: vi.fn().mockResolvedValue(undefined),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { calApi } from "./api-client.js";
import { getAuthHeaders, getAuthMode, refreshOAuthToken } from "../auth.js";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.CAL_API_BASE_URL;
});

afterEach(() => {
  delete process.env.CAL_API_BASE_URL;
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

  it("retries on 401 in OAuth mode", async () => {
    vi.mocked(getAuthMode).mockReturnValue("oauth");

    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ message: "Unauthorized" }),
    });
    // Retry returns 200
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ data: "refreshed" }),
    });

    const result = await calApi("me");

    expect(refreshOAuthToken).toHaveBeenCalledOnce();
    expect(getAuthHeaders).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: "refreshed" });
  });

  it("does not retry on 401 in apikey mode", async () => {
    vi.mocked(getAuthMode).mockReturnValue("apikey");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ message: "Invalid API key" }),
    });

    await expect(calApi("me")).rejects.toThrow(CalApiError);
    expect(refreshOAuthToken).not.toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledOnce();
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

  it("includes auth headers from getAuthHeaders", async () => {
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

  it("does not override cal-api-version for non-slots paths", async () => {
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

  it("preserves path-based version override on 401 retry (slots)", async () => {
    vi.mocked(getAuthMode).mockReturnValue("oauth");
    vi.mocked(getAuthHeaders)
      .mockResolvedValueOnce({
        Authorization: "Bearer old",
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      })
      .mockResolvedValueOnce({
        Authorization: "Bearer new",
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      });

    // First call returns 401
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ message: "Unauthorized" }),
    });
    // Retry returns 200
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ slots: {} }),
    });

    await calApi("slots", { params: { start: "2024-08-13", end: "2024-08-14" } });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Initial request: refreshed auth + path-based version override
    const [, firstOpts] = mockFetch.mock.calls[0];
    expect(firstOpts.headers.Authorization).toBe("Bearer old");
    expect(firstOpts.headers["cal-api-version"]).toBe("2024-09-04");
    // Retry request: refreshed auth + path-based version override preserved
    const [, retryOpts] = mockFetch.mock.calls[1];
    expect(retryOpts.headers.Authorization).toBe("Bearer new");
    expect(retryOpts.headers["cal-api-version"]).toBe("2024-09-04");
  });

  it("preserves explicit apiVersionOverride on 401 retry", async () => {
    vi.mocked(getAuthMode).mockReturnValue("oauth");
    vi.mocked(getAuthHeaders)
      .mockResolvedValueOnce({
        Authorization: "Bearer old",
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      })
      .mockResolvedValueOnce({
        Authorization: "Bearer new",
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ message: "Unauthorized" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({}),
    });

    await calApi("slots", { apiVersionOverride: "2025-01-01" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, firstOpts] = mockFetch.mock.calls[0];
    expect(firstOpts.headers["cal-api-version"]).toBe("2025-01-01");
    const [, retryOpts] = mockFetch.mock.calls[1];
    expect(retryOpts.headers.Authorization).toBe("Bearer new");
    expect(retryOpts.headers["cal-api-version"]).toBe("2025-01-01");
  });

  it("non-overridden endpoint retry keeps default version", async () => {
    vi.mocked(getAuthMode).mockReturnValue("oauth");
    vi.mocked(getAuthHeaders)
      .mockResolvedValueOnce({
        Authorization: "Bearer old",
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      })
      .mockResolvedValueOnce({
        Authorization: "Bearer new",
        "cal-api-version": "2024-08-13",
        "Content-Type": "application/json",
      });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ message: "Unauthorized" }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve({ data: "ok" }),
    });

    await calApi("me");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [, firstOpts] = mockFetch.mock.calls[0];
    expect(firstOpts.headers["cal-api-version"]).toBe("2024-08-13");
    const [, retryOpts] = mockFetch.mock.calls[1];
    expect(retryOpts.headers.Authorization).toBe("Bearer new");
    expect(retryOpts.headers["cal-api-version"]).toBe("2024-08-13");
  });
});
