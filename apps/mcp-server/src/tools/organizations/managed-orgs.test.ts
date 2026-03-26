import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  createManagedOrg,
  createManagedOrgSchema,
  getManagedOrgs,
  getManagedOrgsSchema,
  getManagedOrg,
  getManagedOrgSchema,
  updateManagedOrg,
  updateManagedOrgSchema,
  deleteManagedOrg,
  deleteManagedOrgSchema,
} from "./managed-orgs.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("createManagedOrg", () => {
  it("exports createManagedOrgSchema", () => { expect(createManagedOrgSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createManagedOrg({"orgId":1,"name":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createManagedOrg({"orgId":1,"name":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getManagedOrgs", () => {
  it("exports getManagedOrgsSchema", () => { expect(getManagedOrgsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getManagedOrgs({"orgId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getManagedOrgs({"orgId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getManagedOrg", () => {
  it("exports getManagedOrgSchema", () => { expect(getManagedOrgSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getManagedOrg({"orgId":1,"managedOrganizationId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getManagedOrg({"orgId":1,"managedOrganizationId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateManagedOrg", () => {
  it("exports updateManagedOrgSchema", () => { expect(updateManagedOrgSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateManagedOrg({"orgId":1,"managedOrganizationId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateManagedOrg({"orgId":1,"managedOrganizationId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteManagedOrg", () => {
  it("exports deleteManagedOrgSchema", () => { expect(deleteManagedOrgSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteManagedOrg({"orgId":1,"managedOrganizationId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteManagedOrg({"orgId":1,"managedOrganizationId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
