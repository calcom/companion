import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import { getOrgTeams, getOrgTeamsSchema } from "./teams.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrgTeams", () => {
  it("exports getOrgTeamsSchema", () => {
    expect(getOrgTeamsSchema).toBeDefined();
  });

  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [{ id: 1, name: "Engineering" }] });
    const result = await getOrgTeams({ orgId: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({
      status: "success",
      data: [{ id: 1, name: "Engineering" }],
    });
  });

  it("passes pagination params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [] });
    await getOrgTeams({ orgId: 5, take: 10, skip: 20 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/5/teams/me", {
      params: { take: 10, skip: 20 },
    });
  });

  it("omits undefined pagination params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [] });
    await getOrgTeams({ orgId: 3 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/3/teams/me", { params: {} });
  });

  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(403, "Forbidden", {}));
    const result = await getOrgTeams({ orgId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("403");
  });
});
