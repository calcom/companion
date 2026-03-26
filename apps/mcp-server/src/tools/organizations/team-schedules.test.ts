import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getOrgTeamSchedules,
  getOrgTeamSchedulesSchema,
  getOrgTeamUserSchedules,
  getOrgTeamUserSchedulesSchema,
} from "./team-schedules.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("getOrgTeamSchedules", () => {
  it("exports getOrgTeamSchedulesSchema", () => { expect(getOrgTeamSchedulesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamSchedules({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamSchedules({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamUserSchedules", () => {
  it("exports getOrgTeamUserSchedulesSchema", () => { expect(getOrgTeamUserSchedulesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamUserSchedules({"orgId":1,"teamId":1,"userId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamUserSchedules({"orgId":1,"teamId":1,"userId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
