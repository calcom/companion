import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getTeamMemberships,
  getTeamMembershipsSchema,
  getTeamMembership,
  getTeamMembershipSchema,
  createTeamMembership,
  createTeamMembershipSchema,
  updateTeamMembership,
  updateTeamMembershipSchema,
  deleteTeamMembership,
  deleteTeamMembershipSchema,
  createTeamInvite,
  createTeamInviteSchema,
} from "./memberships.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTeamMemberships", () => {
  it("exports getTeamMembershipsSchema", () => {
    expect(getTeamMembershipsSchema).toBeDefined();
  });
  it("requires integer pagination values", () => {
    expect(getTeamMembershipsSchema.take.safeParse(1.5).success).toBe(false);
    expect(getTeamMembershipsSchema.skip.safeParse(1.5).success).toBe(false);
  });
  it("enforces OpenAPI pagination and email filter bounds", () => {
    expect(getTeamMembershipsSchema.take.safeParse(0).success).toBe(false);
    expect(getTeamMembershipsSchema.take.safeParse(250).success).toBe(true);
    expect(getTeamMembershipsSchema.take.safeParse(251).success).toBe(false);
    expect(getTeamMembershipsSchema.skip.safeParse(-1).success).toBe(false);
    expect(getTeamMembershipsSchema.emails.safeParse(["user@example.com"]).success).toBe(true);
    expect(getTeamMembershipsSchema.emails.safeParse(["not-an-email"]).success).toBe(false);
    expect(
      getTeamMembershipsSchema.emails.safeParse(Array(21).fill("user@example.com")).success
    ).toBe(false);
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamMemberships({ teamId: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("passes pagination params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getTeamMemberships({
      teamId: 1,
      take: 10,
      skip: 5,
      emails: ["a@example.com", "b@example.com"],
    });
    expect(mockCalApi).toHaveBeenCalledWith("teams/1/memberships", {
      params: { take: 10, skip: 5, emails: "a@example.com,b@example.com" },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamMemberships({ teamId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamMembership", () => {
  it("exports getTeamMembershipSchema", () => {
    expect(getTeamMembershipSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamMembership({ teamId: 1, membershipId: 42 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getTeamMembership({ teamId: 1, membershipId: 42 });
    expect(mockCalApi).toHaveBeenCalledWith("teams/1/memberships/42");
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(404, "Not found", {}));
    const result = await getTeamMembership({ teamId: 1, membershipId: 42 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("404");
  });
});

describe("createTeamMembership", () => {
  it("exports createTeamMembershipSchema", () => {
    expect(createTeamMembershipSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createTeamMembership({ teamId: 1, userId: 5, role: "MEMBER" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends correct body", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await createTeamMembership({ teamId: 1, userId: 5, role: "ADMIN", accepted: true });
    expect(mockCalApi).toHaveBeenCalledWith("teams/1/memberships", {
      method: "POST",
      body: { userId: 5, role: "ADMIN", accepted: true },
    });
  });
  it("omits role when not provided so the API default can apply", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await createTeamMembership({ teamId: 1, userId: 5 });
    expect(mockCalApi).toHaveBeenCalledWith("teams/1/memberships", {
      method: "POST",
      body: { userId: 5 },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createTeamMembership({ teamId: 1, userId: 5, role: "MEMBER" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateTeamMembership", () => {
  it("exports updateTeamMembershipSchema", () => {
    expect(updateTeamMembershipSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateTeamMembership({ teamId: 1, membershipId: 42 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends correct body", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await updateTeamMembership({ teamId: 1, membershipId: 42, role: "OWNER", accepted: true });
    expect(mockCalApi).toHaveBeenCalledWith("teams/1/memberships/42", {
      method: "PATCH",
      body: { role: "OWNER", accepted: true },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateTeamMembership({ teamId: 1, membershipId: 42 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteTeamMembership", () => {
  it("exports deleteTeamMembershipSchema", () => {
    expect(deleteTeamMembershipSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteTeamMembership({ teamId: 1, membershipId: 42 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls correct endpoint with DELETE", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await deleteTeamMembership({ teamId: 1, membershipId: 42 });
    expect(mockCalApi).toHaveBeenCalledWith("teams/1/memberships/42", { method: "DELETE" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteTeamMembership({ teamId: 1, membershipId: 42 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createTeamInvite", () => {
  it("exports createTeamInviteSchema", () => {
    expect(createTeamInviteSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", inviteLink: "https://..." });
    const result = await createTeamInvite({ teamId: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({
      status: "success",
      inviteLink: "https://...",
    });
  });
  it("calls correct endpoint with POST", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await createTeamInvite({ teamId: 1 });
    expect(mockCalApi).toHaveBeenCalledWith("teams/1/invite", { method: "POST", body: {} });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(403, "Forbidden", {}));
    const result = await createTeamInvite({ teamId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("403");
  });
});
