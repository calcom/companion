import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getOrgRoutingForms,
  getOrgRoutingFormsSchema,
  getOrgRoutingFormResponses,
  getOrgRoutingFormResponsesSchema,
  createOrgRoutingFormResponse,
  createOrgRoutingFormResponseSchema,
  updateOrgRoutingFormResponse,
  updateOrgRoutingFormResponseSchema,
} from "./routing-forms.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("getOrgRoutingForms", () => {
  it("exports getOrgRoutingFormsSchema", () => { expect(getOrgRoutingFormsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgRoutingForms({"orgId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgRoutingForms({"orgId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgRoutingFormResponses", () => {
  it("exports getOrgRoutingFormResponsesSchema", () => { expect(getOrgRoutingFormResponsesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgRoutingFormResponses({"orgId":1,"routingFormId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgRoutingFormResponses({"orgId":1,"routingFormId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createOrgRoutingFormResponse", () => {
  it("exports createOrgRoutingFormResponseSchema", () => { expect(createOrgRoutingFormResponseSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgRoutingFormResponse({"orgId":1,"routingFormId":"test-id","start":"test","end":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgRoutingFormResponse({"orgId":1,"routingFormId":"test-id","start":"test","end":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgRoutingFormResponse", () => {
  it("exports updateOrgRoutingFormResponseSchema", () => { expect(updateOrgRoutingFormResponseSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgRoutingFormResponse({"orgId":1,"routingFormId":"test-id","responseId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgRoutingFormResponse({"orgId":1,"routingFormId":"test-id","responseId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
