import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  createOrgDelegationCredential,
  createOrgDelegationCredentialSchema,
  updateOrgDelegationCredential,
  updateOrgDelegationCredentialSchema,
} from "./delegation-credentials.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("createOrgDelegationCredential", () => {
  it("exports createOrgDelegationCredentialSchema", () => { expect(createOrgDelegationCredentialSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgDelegationCredential({"orgId":1,"workspacePlatformSlug":"test","domain":"test","serviceAccountKey":[]});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgDelegationCredential({"orgId":1,"workspacePlatformSlug":"test","domain":"test","serviceAccountKey":[]});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgDelegationCredential", () => {
  it("exports updateOrgDelegationCredentialSchema", () => { expect(updateOrgDelegationCredentialSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgDelegationCredential({"orgId":1,"credentialId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgDelegationCredential({"orgId":1,"credentialId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
