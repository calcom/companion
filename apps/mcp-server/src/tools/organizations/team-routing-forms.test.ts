import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getOrgTeamRoutingForms,
  getOrgTeamRoutingFormsSchema,
  getOrgTeamRoutingFormResponses,
  getOrgTeamRoutingFormResponsesSchema,
  createOrgTeamRoutingFormResponse,
  createOrgTeamRoutingFormResponseSchema,
  updateOrgTeamRoutingFormResponse,
  updateOrgTeamRoutingFormResponseSchema,
} from "./team-routing-forms.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("getOrgTeamRoutingForms", () => {
  it("exports getOrgTeamRoutingFormsSchema", () => { expect(getOrgTeamRoutingFormsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamRoutingForms({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamRoutingForms({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamRoutingFormResponses", () => {
  it("exports getOrgTeamRoutingFormResponsesSchema", () => { expect(getOrgTeamRoutingFormResponsesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamRoutingFormResponses({"orgId":1,"teamId":1,"routingFormId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamRoutingFormResponses({"orgId":1,"teamId":1,"routingFormId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createOrgTeamRoutingFormResponse", () => {
  it("exports createOrgTeamRoutingFormResponseSchema", () => { expect(createOrgTeamRoutingFormResponseSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgTeamRoutingFormResponse({"orgId":1,"teamId":1,"routingFormId":"test-id","start":"test","end":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgTeamRoutingFormResponse({"orgId":1,"teamId":1,"routingFormId":"test-id","start":"test","end":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgTeamRoutingFormResponse", () => {
  it("exports updateOrgTeamRoutingFormResponseSchema", () => { expect(updateOrgTeamRoutingFormResponseSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgTeamRoutingFormResponse({"orgId":1,"teamId":1,"routingFormId":"test-id","responseId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgTeamRoutingFormResponse({"orgId":1,"teamId":1,"routingFormId":"test-id","responseId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
