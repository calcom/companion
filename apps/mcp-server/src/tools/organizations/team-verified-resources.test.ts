import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  requestOrgTeamEmailVerification,
  requestOrgTeamEmailVerificationSchema,
  requestOrgTeamPhoneVerification,
  requestOrgTeamPhoneVerificationSchema,
  verifyOrgTeamEmail,
  verifyOrgTeamEmailSchema,
  verifyOrgTeamPhone,
  verifyOrgTeamPhoneSchema,
  getOrgTeamVerifiedEmails,
  getOrgTeamVerifiedEmailsSchema,
  getOrgTeamVerifiedPhones,
  getOrgTeamVerifiedPhonesSchema,
  getOrgTeamVerifiedEmail,
  getOrgTeamVerifiedEmailSchema,
  getOrgTeamVerifiedPhone,
  getOrgTeamVerifiedPhoneSchema,
} from "./team-verified-resources.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("requestOrgTeamEmailVerification", () => {
  it("exports requestOrgTeamEmailVerificationSchema", () => { expect(requestOrgTeamEmailVerificationSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await requestOrgTeamEmailVerification({"orgId":1,"teamId":1,"email":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await requestOrgTeamEmailVerification({"orgId":1,"teamId":1,"email":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("requestOrgTeamPhoneVerification", () => {
  it("exports requestOrgTeamPhoneVerificationSchema", () => { expect(requestOrgTeamPhoneVerificationSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await requestOrgTeamPhoneVerification({"orgId":1,"teamId":1,"phone":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await requestOrgTeamPhoneVerification({"orgId":1,"teamId":1,"phone":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("verifyOrgTeamEmail", () => {
  it("exports verifyOrgTeamEmailSchema", () => { expect(verifyOrgTeamEmailSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await verifyOrgTeamEmail({"orgId":1,"teamId":1,"email":"test","code":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await verifyOrgTeamEmail({"orgId":1,"teamId":1,"email":"test","code":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("verifyOrgTeamPhone", () => {
  it("exports verifyOrgTeamPhoneSchema", () => { expect(verifyOrgTeamPhoneSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await verifyOrgTeamPhone({"orgId":1,"teamId":1,"phone":"test","code":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await verifyOrgTeamPhone({"orgId":1,"teamId":1,"phone":"test","code":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamVerifiedEmails", () => {
  it("exports getOrgTeamVerifiedEmailsSchema", () => { expect(getOrgTeamVerifiedEmailsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamVerifiedEmails({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamVerifiedEmails({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamVerifiedPhones", () => {
  it("exports getOrgTeamVerifiedPhonesSchema", () => { expect(getOrgTeamVerifiedPhonesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamVerifiedPhones({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamVerifiedPhones({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamVerifiedEmail", () => {
  it("exports getOrgTeamVerifiedEmailSchema", () => { expect(getOrgTeamVerifiedEmailSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamVerifiedEmail({"orgId":1,"teamId":1,"id":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamVerifiedEmail({"orgId":1,"teamId":1,"id":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamVerifiedPhone", () => {
  it("exports getOrgTeamVerifiedPhoneSchema", () => { expect(getOrgTeamVerifiedPhoneSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamVerifiedPhone({"orgId":1,"teamId":1,"id":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamVerifiedPhone({"orgId":1,"teamId":1,"id":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
