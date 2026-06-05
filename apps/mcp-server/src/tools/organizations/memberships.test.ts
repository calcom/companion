import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getOrgMemberships,
  getOrgMembershipsSchema,
  createOrgMembership,
  createOrgMembershipSchema,
  getOrgMembership,
  getOrgMembershipSchema,
  deleteOrgMembership,
  deleteOrgMembershipSchema,
  updateOrgMembership,
  updateOrgMembershipSchema,
} from "./memberships.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrgMemberships", () => {
  it("exports getOrgMembershipsSchema", () => {
    expect(getOrgMembershipsSchema).toBeDefined();
  });
  it("requires integer pagination values", () => {
    expect(getOrgMembershipsSchema.take.safeParse(1.5).success).toBe(false);
    expect(getOrgMembershipsSchema.skip.safeParse(1.5).success).toBe(false);
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgMemberships({ orgId: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgMemberships({ orgId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createOrgMembership", () => {
  it("exports createOrgMembershipSchema", () => {
    expect(createOrgMembershipSchema).toBeDefined();
  });
  it("returns data on success with userId", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgMembership({ orgId: 1, userId: 1, role: "MEMBER" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends email for invite-by-email flow", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", accepted: true });
    const result = await createOrgMembership({
      orgId: 1,
      email: "user@example.com",
      role: "MEMBER",
    });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/memberships", {
      method: "POST",
      body: { email: "user@example.com", role: "MEMBER" },
    });
    expect(result.content[0].type).toBe("text");
  });
  it("rejects when both userId and email are provided", async () => {
    const result = await createOrgMembership({
      orgId: 1,
      userId: 1,
      email: "user@example.com",
      role: "MEMBER",
    });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("Provide exactly one of userId or email");
  });
  it("rejects when neither userId nor email is provided", async () => {
    const result = await createOrgMembership({ orgId: 1, role: "MEMBER" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("Provide exactly one of userId or email");
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgMembership({ orgId: 1, userId: 1, role: "MEMBER" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgMembership", () => {
  it("exports getOrgMembershipSchema", () => {
    expect(getOrgMembershipSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgMembership({ orgId: 1, membershipId: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgMembership({ orgId: 1, membershipId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteOrgMembership", () => {
  it("exports deleteOrgMembershipSchema", () => {
    expect(deleteOrgMembershipSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgMembership({ orgId: 1, membershipId: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgMembership({ orgId: 1, membershipId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgMembership", () => {
  it("exports updateOrgMembershipSchema", () => {
    expect(updateOrgMembershipSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgMembership({ orgId: 1, membershipId: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgMembership({ orgId: 1, membershipId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
