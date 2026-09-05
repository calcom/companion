import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import { findHost, findHostSchema } from "./host-lookup.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findHost", () => {
  it("returns an organization match before checking the public username", async () => {
    mockCalApi
      .mockResolvedValueOnce({ data: { organizationId: 7 } })
      .mockResolvedValueOnce({ data: [{ id: 1, slug: "30min" }] });

    const result = await findHost({ username: "bailey" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed).toMatchObject({
      scope: "organization",
      organizationId: 7,
      username: "bailey",
      eventTypes: [{ id: 1, slug: "30min" }],
    });
    expect(mockCalApi).toHaveBeenCalledWith("event-types", {
      params: { username: "bailey", orgId: 7 },
    });
    expect(mockCalApi).toHaveBeenCalledTimes(2);
  });

  it("falls back to a public username when the organization has no match", async () => {
    mockCalApi
      .mockResolvedValueOnce({ data: { organizationId: 7 } })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ id: 9 }] });

    const result = await findHost({ username: "bailey" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed).toMatchObject({
      scope: "public",
      username: "bailey",
      eventTypes: [{ id: 9 }],
    });
    expect(mockCalApi.mock.calls[2]).toEqual(["event-types", { params: { username: "bailey" } }]);
  });

  it("skips the organization lookup when the caller has no organization", async () => {
    mockCalApi
      .mockResolvedValueOnce({ data: { organizationId: null } })
      .mockResolvedValueOnce({ data: [{ id: 9 }] });

    const result = await findHost({ username: "bailey" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed.scope).toBe("public");
    expect(mockCalApi).toHaveBeenCalledTimes(2);
    expect(mockCalApi).toHaveBeenLastCalledWith("event-types", {
      params: { username: "bailey" },
    });
  });

  it("returns not_found when no event types match", async () => {
    mockCalApi
      .mockResolvedValueOnce({ data: { organizationId: 7 } })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    const result = await findHost({ username: "bailey" });
    const parsed = JSON.parse(result.content[0].text);

    expect(parsed).toMatchObject({
      scope: "not_found",
      username: "bailey",
      eventTypes: [],
    });
  });

  it("returns an MCP error response for API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(401, "Unauthorized", {}));

    const result = await findHost({ username: "bailey" });

    expect(result).toHaveProperty("isError", true);
  });
});

describe("findHostSchema", () => {
  it("requires a non-empty username", () => {
    expect(findHostSchema.username.safeParse("").success).toBe(false);
  });
});
