import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  assignAttributeToUser,
  assignAttributeToUserSchema,
  createOrgAttribute,
  createOrgAttributeOption,
  createOrgAttributeOptionSchema,
  createOrgAttributeSchema,
  deleteOrgAttribute,
  deleteOrgAttributeOption,
  deleteOrgAttributeOptionSchema,
  deleteOrgAttributeSchema,
  getAssignedAttributeOptions,
  getAssignedAttributeOptionsBySlug,
  getAssignedAttributeOptionsBySlugSchema,
  getAssignedAttributeOptionsSchema,
  getOrgAttribute,
  getOrgAttributeOptions,
  getOrgAttributeOptionsSchema,
  getOrgAttributeSchema,
  getOrgAttributes,
  getOrgAttributesSchema,
  getUserAttributeOptions,
  getUserAttributeOptionsSchema,
  removeAttributeFromUser,
  removeAttributeFromUserSchema,
  updateOrgAttribute,
  updateOrgAttributeOption,
  updateOrgAttributeOptionSchema,
  updateOrgAttributeSchema,
  updateUserAttributeAssignment,
  updateUserAttributeAssignmentSchema,
} from "./attributes.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getOrgAttributes ──

describe("getOrgAttributes", () => {
  it("exports getOrgAttributesSchema", () => {
    expect(getOrgAttributesSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgAttributes({ orgId: 1 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("passes pagination params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getOrgAttributes({ orgId: 1, take: 10, skip: 5 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes", {
      params: { take: 10, skip: 5 },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgAttributes({ orgId: 1 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── getOrgAttribute ──

describe("getOrgAttribute", () => {
  it("exports getOrgAttributeSchema", () => {
    expect(getOrgAttributeSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgAttribute({ orgId: 1, attributeId: "attr-1" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getOrgAttribute({ orgId: 1, attributeId: "attr-1" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/attr-1");
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(404, "Not found", {}));
    const result = await getOrgAttribute({ orgId: 1, attributeId: "attr-1" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("404");
  });
});

// ── createOrgAttribute ──

describe("createOrgAttribute", () => {
  it("exports createOrgAttributeSchema", () => {
    expect(createOrgAttributeSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgAttribute({
      orgId: 1,
      name: "Region",
      slug: "region",
      type: "SINGLE_SELECT",
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends body with options", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await createOrgAttribute({
      orgId: 1,
      name: "Region",
      slug: "region",
      type: "SINGLE_SELECT",
      options: [{ value: "US", slug: "us" }],
      enabled: true,
    });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes", {
      method: "POST",
      body: {
        name: "Region",
        slug: "region",
        type: "SINGLE_SELECT",
        options: [{ value: "US", slug: "us" }],
        enabled: true,
      },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgAttribute({
      orgId: 1,
      name: "Region",
      slug: "region",
      type: "TEXT",
    });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── updateOrgAttribute ──

describe("updateOrgAttribute", () => {
  it("exports updateOrgAttributeSchema", () => {
    expect(updateOrgAttributeSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgAttribute({ orgId: 1, attributeId: "attr-1", name: "Updated" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends only provided fields in body", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await updateOrgAttribute({ orgId: 1, attributeId: "attr-1", name: "Updated" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/attr-1", {
      method: "PATCH",
      body: { name: "Updated" },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgAttribute({ orgId: 1, attributeId: "attr-1" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── deleteOrgAttribute ──

describe("deleteOrgAttribute", () => {
  it("exports deleteOrgAttributeSchema", () => {
    expect(deleteOrgAttributeSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgAttribute({ orgId: 1, attributeId: "attr-1" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls DELETE on correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await deleteOrgAttribute({ orgId: 1, attributeId: "attr-1" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/attr-1", {
      method: "DELETE",
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgAttribute({ orgId: 1, attributeId: "attr-1" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── getOrgAttributeOptions ──

describe("getOrgAttributeOptions", () => {
  it("exports getOrgAttributeOptionsSchema", () => {
    expect(getOrgAttributeOptionsSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgAttributeOptions({ orgId: 1, attributeId: "attr-1" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("passes pagination params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getOrgAttributeOptions({ orgId: 1, attributeId: "attr-1", take: 5, skip: 0 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/attr-1/options", {
      params: { take: 5, skip: 0 },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgAttributeOptions({ orgId: 1, attributeId: "attr-1" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── getAssignedAttributeOptions ──

describe("getAssignedAttributeOptions", () => {
  it("exports getAssignedAttributeOptionsSchema", () => {
    expect(getAssignedAttributeOptionsSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getAssignedAttributeOptions({ orgId: 1, attributeId: "attr-1" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getAssignedAttributeOptions({ orgId: 1, attributeId: "attr-1" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/attr-1/options/assigned");
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getAssignedAttributeOptions({ orgId: 1, attributeId: "attr-1" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── getAssignedAttributeOptionsBySlug ──

describe("getAssignedAttributeOptionsBySlug", () => {
  it("exports getAssignedAttributeOptionsBySlugSchema", () => {
    expect(getAssignedAttributeOptionsBySlugSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getAssignedAttributeOptionsBySlug({ orgId: 1, attributeSlug: "region" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls correct endpoint with slug", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getAssignedAttributeOptionsBySlug({ orgId: 1, attributeSlug: "region" });
    expect(mockCalApi).toHaveBeenCalledWith(
      "organizations/1/attributes/slugs/region/options/assigned"
    );
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getAssignedAttributeOptionsBySlug({ orgId: 1, attributeSlug: "region" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── createOrgAttributeOption ──

describe("createOrgAttributeOption", () => {
  it("exports createOrgAttributeOptionSchema", () => {
    expect(createOrgAttributeOptionSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgAttributeOption({ orgId: 1, attributeId: "attr-1", value: "US" });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends body with optional slug", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await createOrgAttributeOption({ orgId: 1, attributeId: "attr-1", value: "US", slug: "us" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/attr-1/options", {
      method: "POST",
      body: { value: "US", slug: "us" },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgAttributeOption({ orgId: 1, attributeId: "attr-1", value: "US" });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── updateOrgAttributeOption ──

describe("updateOrgAttributeOption", () => {
  it("exports updateOrgAttributeOptionSchema", () => {
    expect(updateOrgAttributeOptionSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgAttributeOption({
      orgId: 1,
      attributeId: "attr-1",
      optionId: "opt-1",
      value: "EU",
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends PATCH with provided fields", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await updateOrgAttributeOption({
      orgId: 1,
      attributeId: "attr-1",
      optionId: "opt-1",
      value: "EU",
      slug: "eu",
    });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/attr-1/options/opt-1", {
      method: "PATCH",
      body: { value: "EU", slug: "eu" },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgAttributeOption({
      orgId: 1,
      attributeId: "attr-1",
      optionId: "opt-1",
    });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── deleteOrgAttributeOption ──

describe("deleteOrgAttributeOption", () => {
  it("exports deleteOrgAttributeOptionSchema", () => {
    expect(deleteOrgAttributeOptionSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgAttributeOption({
      orgId: 1,
      attributeId: "attr-1",
      optionId: "opt-1",
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls DELETE on correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await deleteOrgAttributeOption({ orgId: 1, attributeId: "attr-1", optionId: "opt-1" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/attr-1/options/opt-1", {
      method: "DELETE",
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgAttributeOption({
      orgId: 1,
      attributeId: "attr-1",
      optionId: "opt-1",
    });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── getUserAttributeOptions ──

describe("getUserAttributeOptions", () => {
  it("exports getUserAttributeOptionsSchema", () => {
    expect(getUserAttributeOptionsSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getUserAttributeOptions({ orgId: 1, userId: 42 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls correct endpoint with userId", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await getUserAttributeOptions({ orgId: 1, userId: 42 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/options/42");
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getUserAttributeOptions({ orgId: 1, userId: 42 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── assignAttributeToUser ──

describe("assignAttributeToUser", () => {
  it("exports assignAttributeToUserSchema", () => {
    expect(assignAttributeToUserSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await assignAttributeToUser({
      orgId: 1,
      userId: 42,
      attributeOptionId: "opt-1",
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends body with optional value", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await assignAttributeToUser({
      orgId: 1,
      userId: 42,
      attributeOptionId: "opt-1",
      value: "custom",
    });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/options/42", {
      method: "POST",
      body: { attributeOptionId: "opt-1", value: "custom" },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await assignAttributeToUser({
      orgId: 1,
      userId: 42,
      attributeOptionId: "opt-1",
    });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── updateUserAttributeAssignment ──

describe("updateUserAttributeAssignment", () => {
  it("exports updateUserAttributeAssignmentSchema", () => {
    expect(updateUserAttributeAssignmentSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateUserAttributeAssignment({
      orgId: 1,
      userId: 42,
      attributeOptionId: "opt-1",
      weight: 50,
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("sends PATCH with weight", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await updateUserAttributeAssignment({
      orgId: 1,
      userId: 42,
      attributeOptionId: "opt-1",
      weight: 75,
    });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/options/42/opt-1", {
      method: "PATCH",
      body: { weight: 75 },
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateUserAttributeAssignment({
      orgId: 1,
      userId: 42,
      attributeOptionId: "opt-1",
    });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

// ── removeAttributeFromUser ──

describe("removeAttributeFromUser", () => {
  it("exports removeAttributeFromUserSchema", () => {
    expect(removeAttributeFromUserSchema).toBeDefined();
  });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await removeAttributeFromUser({
      orgId: 1,
      userId: 42,
      attributeOptionId: "opt-1",
    });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("calls DELETE on correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    await removeAttributeFromUser({ orgId: 1, userId: 42, attributeOptionId: "opt-1" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/attributes/options/42/opt-1", {
      method: "DELETE",
    });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await removeAttributeFromUser({
      orgId: 1,
      userId: 42,
      attributeOptionId: "opt-1",
    });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
