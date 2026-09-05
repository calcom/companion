import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "./api-client.js";
import { resolveOrgHostEventType } from "./org-host-resolution.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveOrgHostEventType", () => {
  it("returns the matching organization event type", async () => {
    mockCalApi
      .mockResolvedValueOnce({ data: { organizationId: 7 } })
      .mockResolvedValueOnce({ data: [{ id: 42, slug: "30min" }] });

    await expect(resolveOrgHostEventType("bailey", "30min")).resolves.toEqual({
      eventTypeId: 42,
      organizationId: 7,
    });
    expect(mockCalApi).toHaveBeenLastCalledWith("event-types", {
      params: { username: "bailey", orgId: 7 },
    });
  });

  it("returns null when the organization has no matching slug", async () => {
    mockCalApi
      .mockResolvedValueOnce({ data: { organizationId: 7 } })
      .mockResolvedValueOnce({ data: [{ id: 42, slug: "60min" }] });

    await expect(resolveOrgHostEventType("bailey", "30min")).resolves.toBeNull();
  });

  it("returns null without an organization lookup when organizationId is null", async () => {
    mockCalApi.mockResolvedValueOnce({ data: { organizationId: null } });

    await expect(resolveOrgHostEventType("bailey", "30min")).resolves.toBeNull();
    expect(mockCalApi).toHaveBeenCalledTimes(1);
  });

  it("returns null when the profile lookup fails", async () => {
    mockCalApi.mockRejectedValueOnce(new Error("Network failure"));

    await expect(resolveOrgHostEventType("bailey", "30min")).resolves.toBeNull();
  });
});
