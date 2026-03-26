import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getOrgAttributes,
  getOrgAttributesSchema,
  createOrgAttribute,
  createOrgAttributeSchema,
  getOrgAttribute,
  getOrgAttributeSchema,
  updateOrgAttribute,
  updateOrgAttributeSchema,
  deleteOrgAttribute,
  deleteOrgAttributeSchema,
  createOrgAttributeOption,
  createOrgAttributeOptionSchema,
  getOrgAttributeOptions,
  getOrgAttributeOptionsSchema,
  deleteOrgAttributeOption,
  deleteOrgAttributeOptionSchema,
  updateOrgAttributeOption,
  updateOrgAttributeOptionSchema,
  getOrgAttributeAssignedOptions,
  getOrgAttributeAssignedOptionsSchema,
  getOrgAttributeOptionsBySlug,
  getOrgAttributeOptionsBySlugSchema,
  assignOrgAttributeToUser,
  assignOrgAttributeToUserSchema,
  getOrgUserAttributeOptions,
  getOrgUserAttributeOptionsSchema,
  unassignOrgAttributeFromUser,
  unassignOrgAttributeFromUserSchema,
} from "./attributes.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("getOrgAttributes", () => {
  it("exports getOrgAttributesSchema", () => { expect(getOrgAttributesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgAttributes({"orgId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgAttributes({"orgId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createOrgAttribute", () => {
  it("exports createOrgAttributeSchema", () => { expect(createOrgAttributeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgAttribute({"orgId":1,"name":"test","slug":"test","type":"test","options":[]});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgAttribute({"orgId":1,"name":"test","slug":"test","type":"test","options":[]});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgAttribute", () => {
  it("exports getOrgAttributeSchema", () => { expect(getOrgAttributeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgAttribute({"orgId":1,"attributeId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgAttribute({"orgId":1,"attributeId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgAttribute", () => {
  it("exports updateOrgAttributeSchema", () => { expect(updateOrgAttributeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgAttribute({"orgId":1,"attributeId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgAttribute({"orgId":1,"attributeId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteOrgAttribute", () => {
  it("exports deleteOrgAttributeSchema", () => { expect(deleteOrgAttributeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgAttribute({"orgId":1,"attributeId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgAttribute({"orgId":1,"attributeId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createOrgAttributeOption", () => {
  it("exports createOrgAttributeOptionSchema", () => { expect(createOrgAttributeOptionSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgAttributeOption({"orgId":1,"attributeId":"test-id","value":"test","slug":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgAttributeOption({"orgId":1,"attributeId":"test-id","value":"test","slug":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgAttributeOptions", () => {
  it("exports getOrgAttributeOptionsSchema", () => { expect(getOrgAttributeOptionsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgAttributeOptions({"orgId":1,"attributeId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgAttributeOptions({"orgId":1,"attributeId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteOrgAttributeOption", () => {
  it("exports deleteOrgAttributeOptionSchema", () => { expect(deleteOrgAttributeOptionSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgAttributeOption({"orgId":1,"attributeId":"test-id","optionId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgAttributeOption({"orgId":1,"attributeId":"test-id","optionId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgAttributeOption", () => {
  it("exports updateOrgAttributeOptionSchema", () => { expect(updateOrgAttributeOptionSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgAttributeOption({"orgId":1,"attributeId":"test-id","optionId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgAttributeOption({"orgId":1,"attributeId":"test-id","optionId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgAttributeAssignedOptions", () => {
  it("exports getOrgAttributeAssignedOptionsSchema", () => { expect(getOrgAttributeAssignedOptionsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgAttributeAssignedOptions({"orgId":1,"attributeId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgAttributeAssignedOptions({"orgId":1,"attributeId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgAttributeOptionsBySlug", () => {
  it("exports getOrgAttributeOptionsBySlugSchema", () => { expect(getOrgAttributeOptionsBySlugSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgAttributeOptionsBySlug({"orgId":1,"attributeSlug":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgAttributeOptionsBySlug({"orgId":1,"attributeSlug":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("assignOrgAttributeToUser", () => {
  it("exports assignOrgAttributeToUserSchema", () => { expect(assignOrgAttributeToUserSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await assignOrgAttributeToUser({"orgId":1,"userId":1,"attributeId":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await assignOrgAttributeToUser({"orgId":1,"userId":1,"attributeId":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgUserAttributeOptions", () => {
  it("exports getOrgUserAttributeOptionsSchema", () => { expect(getOrgUserAttributeOptionsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgUserAttributeOptions({"orgId":1,"userId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgUserAttributeOptions({"orgId":1,"userId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("unassignOrgAttributeFromUser", () => {
  it("exports unassignOrgAttributeFromUserSchema", () => { expect(unassignOrgAttributeFromUserSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await unassignOrgAttributeFromUser({"orgId":1,"userId":1,"attributeOptionId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await unassignOrgAttributeFromUser({"orgId":1,"userId":1,"attributeOptionId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
