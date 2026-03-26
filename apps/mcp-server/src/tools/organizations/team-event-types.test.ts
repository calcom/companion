import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  createOrgTeamEventType,
  createOrgTeamEventTypeSchema,
  getOrgTeamEventTypes,
  getOrgTeamEventTypesSchema,
  getOrgTeamEventType,
  getOrgTeamEventTypeSchema,
  updateOrgTeamEventType,
  updateOrgTeamEventTypeSchema,
  deleteOrgTeamEventType,
  deleteOrgTeamEventTypeSchema,
  createOrgTeamPhoneCall,
  createOrgTeamPhoneCallSchema,
  createOrgTeamEtPrivateLink,
  createOrgTeamEtPrivateLinkSchema,
  getOrgTeamEtPrivateLinks,
  getOrgTeamEtPrivateLinksSchema,
  updateOrgTeamEtPrivateLink,
  updateOrgTeamEtPrivateLinkSchema,
  deleteOrgTeamEtPrivateLink,
  deleteOrgTeamEtPrivateLinkSchema,
} from "./team-event-types.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("createOrgTeamEventType", () => {
  it("exports createOrgTeamEventTypeSchema", () => { expect(createOrgTeamEventTypeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgTeamEventType({"orgId":1,"teamId":1,"lengthInMinutes":1,"title":"test","slug":"test","schedulingType":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgTeamEventType({"orgId":1,"teamId":1,"lengthInMinutes":1,"title":"test","slug":"test","schedulingType":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamEventTypes", () => {
  it("exports getOrgTeamEventTypesSchema", () => { expect(getOrgTeamEventTypesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamEventTypes({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamEventTypes({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamEventType", () => {
  it("exports getOrgTeamEventTypeSchema", () => { expect(getOrgTeamEventTypeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamEventType({"orgId":1,"teamId":1,"eventTypeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamEventType({"orgId":1,"teamId":1,"eventTypeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgTeamEventType", () => {
  it("exports updateOrgTeamEventTypeSchema", () => { expect(updateOrgTeamEventTypeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgTeamEventType({"orgId":1,"teamId":1,"eventTypeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgTeamEventType({"orgId":1,"teamId":1,"eventTypeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteOrgTeamEventType", () => {
  it("exports deleteOrgTeamEventTypeSchema", () => { expect(deleteOrgTeamEventTypeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgTeamEventType({"orgId":1,"teamId":1,"eventTypeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgTeamEventType({"orgId":1,"teamId":1,"eventTypeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createOrgTeamPhoneCall", () => {
  it("exports createOrgTeamPhoneCallSchema", () => { expect(createOrgTeamPhoneCallSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgTeamPhoneCall({"orgId":1,"teamId":1,"eventTypeId":1,"yourPhoneNumber":"test","numberToCall":"test","calApiKey":"test","enabled":{},"templateType":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgTeamPhoneCall({"orgId":1,"teamId":1,"eventTypeId":1,"yourPhoneNumber":"test","numberToCall":"test","calApiKey":"test","enabled":{},"templateType":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createOrgTeamEtPrivateLink", () => {
  it("exports createOrgTeamEtPrivateLinkSchema", () => { expect(createOrgTeamEtPrivateLinkSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgTeamEtPrivateLink({"orgId":1,"teamId":1,"eventTypeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgTeamEtPrivateLink({"orgId":1,"teamId":1,"eventTypeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamEtPrivateLinks", () => {
  it("exports getOrgTeamEtPrivateLinksSchema", () => { expect(getOrgTeamEtPrivateLinksSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamEtPrivateLinks({"orgId":1,"teamId":1,"eventTypeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamEtPrivateLinks({"orgId":1,"teamId":1,"eventTypeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgTeamEtPrivateLink", () => {
  it("exports updateOrgTeamEtPrivateLinkSchema", () => { expect(updateOrgTeamEtPrivateLinkSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgTeamEtPrivateLink({"orgId":1,"teamId":1,"eventTypeId":1,"linkId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgTeamEtPrivateLink({"orgId":1,"teamId":1,"eventTypeId":1,"linkId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteOrgTeamEtPrivateLink", () => {
  it("exports deleteOrgTeamEtPrivateLinkSchema", () => { expect(deleteOrgTeamEtPrivateLinkSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgTeamEtPrivateLink({"orgId":1,"teamId":1,"eventTypeId":1,"linkId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgTeamEtPrivateLink({"orgId":1,"teamId":1,"eventTypeId":1,"linkId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
