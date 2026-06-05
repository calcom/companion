import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import { getMyTeams, getMyTeamsSchema, getOrgTeams, getOrgTeamsSchema } from "./teams.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrgTeams", () => {
  it("exports getOrgTeamsSchema", () => {
    expect(getOrgTeamsSchema).toBeDefined();
  });

  it("calls the admin teams endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [{ id: 1, name: "Engineering" }] });
    const result = await getOrgTeams({ orgId: 1 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/teams", { params: {} });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({
      status: "success",
      data: [{ id: 1, name: "Engineering" }],
    });
  });

  it("passes pagination params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [] });
    await getOrgTeams({ orgId: 5, take: 10, skip: 20 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/5/teams", {
      params: { take: 10, skip: 20 },
    });
  });

  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(403, "Forbidden", {}));
    const result = await getOrgTeams({ orgId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("403");
  });
});

describe("getMyTeams", () => {
  it("exports getMyTeamsSchema", () => {
    expect(getMyTeamsSchema).toBeDefined();
  });

  it("calls the /me teams endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [{ id: 2, name: "Sales" }] });
    const result = await getMyTeams({ orgId: 1 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/teams/me", { params: {} });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({
      status: "success",
      data: [{ id: 2, name: "Sales" }],
    });
  });

  it("passes pagination params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [] });
    await getMyTeams({ orgId: 3, take: 5, skip: 0 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/3/teams/me", {
      params: { take: 5, skip: 0 },
    });
  });

  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(401, "Unauthorized", {}));
    const result = await getMyTeams({ orgId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("401");
  });
});
