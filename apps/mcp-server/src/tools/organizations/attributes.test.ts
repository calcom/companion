import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getOrgAttributes,
  getOrgAttributesSchema,
  getOrgAttribute,
  getOrgAttributeSchema,
  getAttributeOptions,
  getAttributeOptionsSchema,
  getUserAttributes,
  getUserAttributesSchema,
  assignAttributeToUser,
  assignAttributeToUserSchema,
  updateUserAttribute,
  updateUserAttributeSchema,
  unassignAttributeFromUser,
  unassignAttributeFromUserSchema,
} from "./attributes.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("getOrgAttributes", () => {
  it("exports getOrgAttributesSchema", () => { expect(getOrgAttributesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgAttributes({ orgId: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("passes pagination params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getOrgAttributes({ orgId: 1, skip: 10, take: 5 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes", { params: { skip: 10, take: 5 } });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgAttributes({ orgId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgAttribute", () => {
  it("exports getOrgAttributeSchema", () => { expect(getOrgAttributeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgAttribute({ orgId: 1, attributeId: "abc" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getOrgAttribute({ orgId: 1, attributeId: "abc" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/abc");
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(404, "Not found", {}));
    const result = await getOrgAttribute({ orgId: 1, attributeId: "abc" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("404");
  });
});

describe("getAttributeOptions", () => {
  it("exports getAttributeOptionsSchema", () => { expect(getAttributeOptionsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [{ id: "opt1", value: "Engineering" }] });
    const result = await getAttributeOptions({ orgId: 1, attributeId: "abc" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success", data: [{ id: "opt1", value: "Engineering" }] });
  });
  it("calls correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getAttributeOptions({ orgId: 1, attributeId: "abc" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/abc/options");
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(404, "Not found", {}));
    const result = await getAttributeOptions({ orgId: 1, attributeId: "abc" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("404");
  });
});

describe("getUserAttributes", () => {
  it("exports getUserAttributesSchema", () => { expect(getUserAttributesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getUserAttributes({ orgId: 1, userId: 42 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getUserAttributes({ orgId: 1, userId: 42 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/options/42");
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(403, "Forbidden", {}));
    const result = await getUserAttributes({ orgId: 1, userId: 42 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("403");
  });
});

describe("assignAttributeToUser", () => {
  it("exports assignAttributeToUserSchema", () => { expect(assignAttributeToUserSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await assignAttributeToUser({ orgId: 1, userId: 42, attributeId: "abc" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends correct body with attributeOptionId", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await assignAttributeToUser({ orgId: 1, userId: 42, attributeId: "abc", attributeOptionId: "opt1", weight: 100 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/options/42", {
      method: "POST",
      body: { attributeId: "abc", attributeOptionId: "opt1", weight: 100 },
    });
  });
  it("sends correct body with value", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await assignAttributeToUser({ orgId: 1, userId: 42, attributeId: "abc", value: "Engineering" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/options/42", {
      method: "POST",
      body: { attributeId: "abc", value: "Engineering" },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await assignAttributeToUser({ orgId: 1, userId: 42, attributeId: "abc" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateUserAttribute", () => {
  it("exports updateUserAttributeSchema", () => { expect(updateUserAttributeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateUserAttribute({ orgId: 1, userId: 42, attributeOptionId: "opt1" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends weight in body", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await updateUserAttribute({ orgId: 1, userId: 42, attributeOptionId: "opt1", weight: 50 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/options/42/opt1", {
      method: "PATCH",
      body: { weight: 50 },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateUserAttribute({ orgId: 1, userId: 42, attributeOptionId: "opt1" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("unassignAttributeFromUser", () => {
  it("exports unassignAttributeFromUserSchema", () => { expect(unassignAttributeFromUserSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await unassignAttributeFromUser({ orgId: 1, userId: 42, attributeOptionId: "opt1" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls correct endpoint with DELETE", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await unassignAttributeFromUser({ orgId: 1, userId: 42, attributeOptionId: "opt1" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/options/42/opt1", { method: "DELETE" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await unassignAttributeFromUser({ orgId: 1, userId: 42, attributeOptionId: "opt1" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
