import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  connectOrgTeamConferencingApp,
  connectOrgTeamConferencingAppSchema,
  getOrgTeamConferencingAuthUrl,
  getOrgTeamConferencingAuthUrlSchema,
  getOrgTeamConferencingApps,
  getOrgTeamConferencingAppsSchema,
  setOrgTeamDefaultConferencing,
  setOrgTeamDefaultConferencingSchema,
  getOrgTeamDefaultConferencing,
  getOrgTeamDefaultConferencingSchema,
  disconnectOrgTeamConferencingApp,
  disconnectOrgTeamConferencingAppSchema,
} from "./team-conferencing.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("connectOrgTeamConferencingApp", () => {
  it("exports connectOrgTeamConferencingAppSchema", () => { expect(connectOrgTeamConferencingAppSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await connectOrgTeamConferencingApp({"orgId":1,"teamId":1,"app":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await connectOrgTeamConferencingApp({"orgId":1,"teamId":1,"app":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamConferencingAuthUrl", () => {
  it("exports getOrgTeamConferencingAuthUrlSchema", () => { expect(getOrgTeamConferencingAuthUrlSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamConferencingAuthUrl({"orgId":1,"teamId":"test-id","app":"test-id","returnTo":"test","onErrorReturnTo":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamConferencingAuthUrl({"orgId":1,"teamId":"test-id","app":"test-id","returnTo":"test","onErrorReturnTo":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamConferencingApps", () => {
  it("exports getOrgTeamConferencingAppsSchema", () => { expect(getOrgTeamConferencingAppsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamConferencingApps({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamConferencingApps({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("setOrgTeamDefaultConferencing", () => {
  it("exports setOrgTeamDefaultConferencingSchema", () => { expect(setOrgTeamDefaultConferencingSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await setOrgTeamDefaultConferencing({"orgId":1,"teamId":1,"app":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await setOrgTeamDefaultConferencing({"orgId":1,"teamId":1,"app":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamDefaultConferencing", () => {
  it("exports getOrgTeamDefaultConferencingSchema", () => { expect(getOrgTeamDefaultConferencingSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamDefaultConferencing({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamDefaultConferencing({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("disconnectOrgTeamConferencingApp", () => {
  it("exports disconnectOrgTeamConferencingAppSchema", () => { expect(disconnectOrgTeamConferencingAppSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await disconnectOrgTeamConferencingApp({"orgId":1,"teamId":1,"app":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await disconnectOrgTeamConferencingApp({"orgId":1,"teamId":1,"app":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
