import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  createOrgTeamRole,
  createOrgTeamRoleSchema,
  getOrgTeamRoles,
  getOrgTeamRolesSchema,
  getOrgTeamRole,
  getOrgTeamRoleSchema,
  updateOrgTeamRole,
  updateOrgTeamRoleSchema,
  deleteOrgTeamRole,
  deleteOrgTeamRoleSchema,
  addOrgTeamRolePermissions,
  addOrgTeamRolePermissionsSchema,
  getOrgTeamRolePermissions,
  getOrgTeamRolePermissionsSchema,
  replaceOrgTeamRolePermissions,
  replaceOrgTeamRolePermissionsSchema,
  removeOrgTeamRolePermissions,
  removeOrgTeamRolePermissionsSchema,
  removeOrgTeamRolePermission,
  removeOrgTeamRolePermissionSchema,
} from "./team-roles.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("createOrgTeamRole", () => {
  it("exports createOrgTeamRoleSchema", () => { expect(createOrgTeamRoleSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgTeamRole({"orgId":1,"teamId":1,"name":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgTeamRole({"orgId":1,"teamId":1,"name":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamRoles", () => {
  it("exports getOrgTeamRolesSchema", () => { expect(getOrgTeamRolesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamRoles({"orgId":1,"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamRoles({"orgId":1,"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamRole", () => {
  it("exports getOrgTeamRoleSchema", () => { expect(getOrgTeamRoleSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamRole({"orgId":1,"teamId":1,"roleId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamRole({"orgId":1,"teamId":1,"roleId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgTeamRole", () => {
  it("exports updateOrgTeamRoleSchema", () => { expect(updateOrgTeamRoleSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgTeamRole({"orgId":1,"teamId":1,"roleId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgTeamRole({"orgId":1,"teamId":1,"roleId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteOrgTeamRole", () => {
  it("exports deleteOrgTeamRoleSchema", () => { expect(deleteOrgTeamRoleSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgTeamRole({"orgId":1,"teamId":1,"roleId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgTeamRole({"orgId":1,"teamId":1,"roleId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("addOrgTeamRolePermissions", () => {
  it("exports addOrgTeamRolePermissionsSchema", () => { expect(addOrgTeamRolePermissionsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await addOrgTeamRolePermissions({"orgId":1,"teamId":1,"roleId":"test-id","permissions":[]});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await addOrgTeamRolePermissions({"orgId":1,"teamId":1,"roleId":"test-id","permissions":[]});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgTeamRolePermissions", () => {
  it("exports getOrgTeamRolePermissionsSchema", () => { expect(getOrgTeamRolePermissionsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamRolePermissions({"orgId":1,"teamId":1,"roleId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgTeamRolePermissions({"orgId":1,"teamId":1,"roleId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("replaceOrgTeamRolePermissions", () => {
  it("exports replaceOrgTeamRolePermissionsSchema", () => { expect(replaceOrgTeamRolePermissionsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await replaceOrgTeamRolePermissions({"orgId":1,"teamId":1,"roleId":"test-id","permissions":[]});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await replaceOrgTeamRolePermissions({"orgId":1,"teamId":1,"roleId":"test-id","permissions":[]});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("removeOrgTeamRolePermissions", () => {
  it("exports removeOrgTeamRolePermissionsSchema", () => { expect(removeOrgTeamRolePermissionsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await removeOrgTeamRolePermissions({"orgId":1,"teamId":1,"roleId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await removeOrgTeamRolePermissions({"orgId":1,"teamId":1,"roleId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("removeOrgTeamRolePermission", () => {
  it("exports removeOrgTeamRolePermissionSchema", () => { expect(removeOrgTeamRolePermissionSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await removeOrgTeamRolePermission({"orgId":1,"teamId":1,"roleId":"test-id","permission":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await removeOrgTeamRolePermission({"orgId":1,"teamId":1,"roleId":"test-id","permission":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
