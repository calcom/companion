import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import { getBookingRoutingTraceSchema, getBookingRoutingTrace } from "./booking-routing-trace.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBookingRoutingTraceSchema", () => {
  it("exports schema with bookingUid", () => {
    expect(getBookingRoutingTraceSchema.bookingUid).toBeDefined();
  });
});

describe("getBookingRoutingTrace", () => {
  it("calls correct endpoint with bookingUid", async () => {
    const mockData = {
      steps: [{ message: "Route matched: 'Enterprise'", round: 1, domain: "routing-form" }],
      groups: [{ round: 1, domain: "routing-form", steps: [] }],
      formSubmission: { form: { name: "Lead Router" }, responses: [] },
    };
    mockCalApi.mockResolvedValueOnce(mockData);

    const result = await getBookingRoutingTrace({ bookingUid: "booking-abc123" });

    expect(mockCalApi).toHaveBeenCalledWith("bookings/booking-abc123/routing-trace");
    expect(JSON.parse(result.content[0].text)).toEqual(mockData);
  });

  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(404, "Not found", {}));

    const result = await getBookingRoutingTrace({ bookingUid: "nonexistent" });

    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("404");
  });

  it("rethrows non-CalApiError errors", async () => {
    mockCalApi.mockRejectedValueOnce(new TypeError("Network error"));

    await expect(getBookingRoutingTrace({ bookingUid: "abc" })).rejects.toThrow(TypeError);
  });

  it("rejects path traversal in bookingUid", async () => {
    await expect(getBookingRoutingTrace({ bookingUid: "../etc/passwd" })).rejects.toThrow(
      "Invalid path segment",
    );
  });
});
