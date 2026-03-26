import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getOrgTeamStripeConnectUrl,
  getOrgTeamStripeConnectUrlSchema,
  checkOrgTeamStripe,
  checkOrgTeamStripeSchema,
} from "./team-stripe.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("getOrgTeamStripeConnectUrl", () => {
  it("exports getOrgTeamStripeConnectUrlSchema", () => { expect(getOrgTeamStripeConnectUrlSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamStripeConnectUrl({"orgId":1,"teamId":"test-id","returnTo":"test","onErrorReturnTo":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamStripeConnectUrl({"orgId":1,"teamId":"test-id","returnTo":"test","onErrorReturnTo":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("checkOrgTeamStripe", () => {
  it("exports checkOrgTeamStripeSchema", () => { expect(checkOrgTeamStripeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await checkOrgTeamStripe({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await checkOrgTeamStripe({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
