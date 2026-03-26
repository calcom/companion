import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getOrgTeamMemberships,
  getOrgTeamMembershipsSchema,
  createOrgTeamMembership,
  createOrgTeamMembershipSchema,
  getOrgTeamMembership,
  getOrgTeamMembershipSchema,
  deleteOrgTeamMembership,
  deleteOrgTeamMembershipSchema,
  updateOrgTeamMembership,
  updateOrgTeamMembershipSchema,
} from "./team-memberships.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("getOrgTeamMemberships", () => {
  it("exports getOrgTeamMembershipsSchema", () => { expect(getOrgTeamMembershipsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamMemberships({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamMemberships({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createOrgTeamMembership", () => {
  it("exports createOrgTeamMembershipSchema", () => { expect(createOrgTeamMembershipSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgTeamMembership({"orgId":1,"teamId":1,"userId":1,"role":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgTeamMembership({"orgId":1,"teamId":1,"userId":1,"role":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamMembership", () => {
  it("exports getOrgTeamMembershipSchema", () => { expect(getOrgTeamMembershipSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamMembership({"orgId":1,"teamId":1,"membershipId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamMembership({"orgId":1,"teamId":1,"membershipId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteOrgTeamMembership", () => {
  it("exports deleteOrgTeamMembershipSchema", () => { expect(deleteOrgTeamMembershipSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgTeamMembership({"orgId":1,"teamId":1,"membershipId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgTeamMembership({"orgId":1,"teamId":1,"membershipId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgTeamMembership", () => {
  it("exports updateOrgTeamMembershipSchema", () => { expect(updateOrgTeamMembershipSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgTeamMembership({"orgId":1,"teamId":1,"membershipId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgTeamMembership({"orgId":1,"teamId":1,"membershipId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
