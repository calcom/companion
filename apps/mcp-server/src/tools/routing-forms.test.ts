import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../utils/api-client.js";
import {
  calculateRoutingFormSlots,
  calculateRoutingFormSlotsSchema,
} from "./routing-forms.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("calculateRoutingFormSlots", () => {
  it("exports calculateRoutingFormSlotsSchema", () => { expect(calculateRoutingFormSlotsSchema).toBeDefined(); });
  it("sends start/end as query params and response as body", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await calculateRoutingFormSlots({
      routingFormId: "test-id",
      response: { field1: "answer1" },
      start: "2024-08-13",
      end: "2024-08-14",
      timeZone: "America/New_York",
      duration: 30,
    });
    expect(mockCalApi).toHaveBeenCalledWith("routing-forms/test-id/calculate-slots", {
      method: "POST",
      body: { field1: "answer1" },
      params: expect.objectContaining({
        start: "2024-08-13",
        end: "2024-08-14",
        timeZone: "America/New_York",
        duration: 30,
      }),
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await calculateRoutingFormSlots({routingFormId:"test-id",response:{field1:"answer1"},start:"test",end:"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
