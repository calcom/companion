import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  getOrgTeamBookings,
  getOrgTeamBookingsSchema,
  getOrgUserBookings,
  getOrgUserBookingsSchema,
} from "./bookings.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getOrgTeamBookings", () => {
  it("exports getOrgTeamBookingsSchema", () => {
    expect(getOrgTeamBookingsSchema).toBeDefined();
  });

  it("enforces OpenAPI pagination bounds", () => {
    expect(getOrgTeamBookingsSchema.take.safeParse(0).success).toBe(false);
    expect(getOrgTeamBookingsSchema.take.safeParse(250).success).toBe(true);
    expect(getOrgTeamBookingsSchema.take.safeParse(251).success).toBe(false);
    expect(getOrgTeamBookingsSchema.skip.safeParse(-1).success).toBe(false);
  });

  it("calls the correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [] });
    await getOrgTeamBookings({ orgId: 1, teamId: 10 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/teams/10/bookings", { params: {} });
  });

  it("passes filter params as query params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [] });
    await getOrgTeamBookings({
      orgId: 1,
      teamId: 10,
      attendeeEmail: "test@example.com",
      status: "upcoming",
      sortCreated: "desc",
      take: 50,
    });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/teams/10/bookings", {
      params: {
        attendeeEmail: "test@example.com",
        status: "upcoming",
        sortCreated: "desc",
        take: 50,
      },
    });
  });

  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgTeamBookings({ orgId: 1, teamId: 10 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });

  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(403, "Forbidden", {}));
    const result = await getOrgTeamBookings({ orgId: 1, teamId: 10 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("403");
  });
});

describe("getOrgUserBookings", () => {
  it("exports getOrgUserBookingsSchema", () => {
    expect(getOrgUserBookingsSchema).toBeDefined();
  });

  it("enforces OpenAPI pagination bounds", () => {
    expect(getOrgUserBookingsSchema.take.safeParse(0).success).toBe(false);
    expect(getOrgUserBookingsSchema.take.safeParse(250).success).toBe(true);
    expect(getOrgUserBookingsSchema.take.safeParse(251).success).toBe(false);
    expect(getOrgUserBookingsSchema.skip.safeParse(-1).success).toBe(false);
  });

  it("calls the correct endpoint", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [] });
    await getOrgUserBookings({ orgId: 1, userId: 42 });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/users/42/bookings", { params: {} });
  });

  it("passes teamId and teamsIds as query params", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success", data: [] });
    await getOrgUserBookings({ orgId: 1, userId: 42, teamId: 10, teamsIds: "10,20" });
    expect(mockCalApi).toHaveBeenCalledWith("organizations/1/users/42/bookings", {
      params: { teamId: 10, teamsIds: "10,20" },
    });
  });

  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgUserBookings({ orgId: 1, userId: 42 });
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });

  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(403, "Forbidden", {}));
    const result = await getOrgUserBookings({ orgId: 1, userId: 42 });
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("403");
  });
});
