import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../utils/api-client.js";
import {
  createTeam,
  createTeamSchema,
  getTeams,
  getTeamsSchema,
  getTeam,
  getTeamSchema,
  updateTeam,
  updateTeamSchema,
  deleteTeam,
  deleteTeamSchema,
  getTeamBookings,
  getTeamBookingsSchema,
  createTeamEventType,
  createTeamEventTypeSchema,
  getTeamEventTypes,
  getTeamEventTypesSchema,
  getTeamEventType,
  getTeamEventTypeSchema,
  updateTeamEventType,
  updateTeamEventTypeSchema,
  deleteTeamEventType,
  deleteTeamEventTypeSchema,
  createTeamPhoneCall,
  createTeamPhoneCallSchema,
  createTeamEventTypeWebhook,
  createTeamEventTypeWebhookSchema,
  getTeamEventTypeWebhooks,
  getTeamEventTypeWebhooksSchema,
  deleteAllTeamEventTypeWebhooks,
  deleteAllTeamEventTypeWebhooksSchema,
  updateTeamEventTypeWebhook,
  updateTeamEventTypeWebhookSchema,
  getTeamEventTypeWebhook,
  getTeamEventTypeWebhookSchema,
  deleteTeamEventTypeWebhook,
  deleteTeamEventTypeWebhookSchema,
  createTeamInvite,
  createTeamInviteSchema,
  createTeamMembership,
  createTeamMembershipSchema,
  getTeamMemberships,
  getTeamMembershipsSchema,
  getTeamMembership,
  getTeamMembershipSchema,
  updateTeamMembership,
  updateTeamMembershipSchema,
  deleteTeamMembership,
  deleteTeamMembershipSchema,
  getTeamSchedules,
  getTeamSchedulesSchema,
  requestTeamEmailVerification,
  requestTeamEmailVerificationSchema,
  requestTeamPhoneVerification,
  requestTeamPhoneVerificationSchema,
  verifyTeamEmail,
  verifyTeamEmailSchema,
  verifyTeamPhone,
  verifyTeamPhoneSchema,
  getTeamVerifiedEmails,
  getTeamVerifiedEmailsSchema,
  getTeamVerifiedPhones,
  getTeamVerifiedPhonesSchema,
  getTeamVerifiedEmail,
  getTeamVerifiedEmailSchema,
  getTeamVerifiedPhone,
  getTeamVerifiedPhoneSchema,
} from "./teams.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("createTeam", () => {
  it("exports createTeamSchema", () => { expect(createTeamSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createTeam({"name":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createTeam({"name":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeams", () => {
  it("exports getTeamsSchema", () => { expect(getTeamsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeams();
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeams();
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeam", () => {
  it("exports getTeamSchema", () => { expect(getTeamSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeam({"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeam({"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateTeam", () => {
  it("exports updateTeamSchema", () => { expect(updateTeamSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateTeam({"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateTeam({"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteTeam", () => {
  it("exports deleteTeamSchema", () => { expect(deleteTeamSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteTeam({"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteTeam({"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamBookings", () => {
  it("exports getTeamBookingsSchema", () => { expect(getTeamBookingsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamBookings({"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamBookings({"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createTeamEventType", () => {
  it("exports createTeamEventTypeSchema", () => { expect(createTeamEventTypeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createTeamEventType({"teamId":1,"lengthInMinutes":1,"title":"test","slug":"test","schedulingType":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createTeamEventType({"teamId":1,"lengthInMinutes":1,"title":"test","slug":"test","schedulingType":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamEventTypes", () => {
  it("exports getTeamEventTypesSchema", () => { expect(getTeamEventTypesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamEventTypes({"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamEventTypes({"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamEventType", () => {
  it("exports getTeamEventTypeSchema", () => { expect(getTeamEventTypeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamEventType({"teamId":1,"eventTypeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamEventType({"teamId":1,"eventTypeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateTeamEventType", () => {
  it("exports updateTeamEventTypeSchema", () => { expect(updateTeamEventTypeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateTeamEventType({"teamId":1,"eventTypeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateTeamEventType({"teamId":1,"eventTypeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteTeamEventType", () => {
  it("exports deleteTeamEventTypeSchema", () => { expect(deleteTeamEventTypeSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteTeamEventType({"teamId":1,"eventTypeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteTeamEventType({"teamId":1,"eventTypeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createTeamPhoneCall", () => {
  it("exports createTeamPhoneCallSchema", () => { expect(createTeamPhoneCallSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createTeamPhoneCall({"teamId":1,"eventTypeId":1,"yourPhoneNumber":"test","numberToCall":"test","calApiKey":"test","enabled":{},"templateType":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createTeamPhoneCall({"teamId":1,"eventTypeId":1,"yourPhoneNumber":"test","numberToCall":"test","calApiKey":"test","enabled":{},"templateType":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createTeamEventTypeWebhook", () => {
  it("exports createTeamEventTypeWebhookSchema", () => { expect(createTeamEventTypeWebhookSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createTeamEventTypeWebhook({"teamId":1,"eventTypeId":1,"active":true,"subscriberUrl":"test","triggers":[]});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createTeamEventTypeWebhook({"teamId":1,"eventTypeId":1,"active":true,"subscriberUrl":"test","triggers":[]});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamEventTypeWebhooks", () => {
  it("exports getTeamEventTypeWebhooksSchema", () => { expect(getTeamEventTypeWebhooksSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamEventTypeWebhooks({"teamId":1,"eventTypeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamEventTypeWebhooks({"teamId":1,"eventTypeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteAllTeamEventTypeWebhooks", () => {
  it("exports deleteAllTeamEventTypeWebhooksSchema", () => { expect(deleteAllTeamEventTypeWebhooksSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteAllTeamEventTypeWebhooks({"teamId":1,"eventTypeId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteAllTeamEventTypeWebhooks({"teamId":1,"eventTypeId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateTeamEventTypeWebhook", () => {
  it("exports updateTeamEventTypeWebhookSchema", () => { expect(updateTeamEventTypeWebhookSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateTeamEventTypeWebhook({"teamId":1,"eventTypeId":1,"webhookId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateTeamEventTypeWebhook({"teamId":1,"eventTypeId":1,"webhookId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamEventTypeWebhook", () => {
  it("exports getTeamEventTypeWebhookSchema", () => { expect(getTeamEventTypeWebhookSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamEventTypeWebhook({"teamId":1,"eventTypeId":1,"webhookId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamEventTypeWebhook({"teamId":1,"eventTypeId":1,"webhookId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteTeamEventTypeWebhook", () => {
  it("exports deleteTeamEventTypeWebhookSchema", () => { expect(deleteTeamEventTypeWebhookSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteTeamEventTypeWebhook({"teamId":1,"eventTypeId":1,"webhookId":"test-id"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteTeamEventTypeWebhook({"teamId":1,"eventTypeId":1,"webhookId":"test-id"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createTeamInvite", () => {
  it("exports createTeamInviteSchema", () => { expect(createTeamInviteSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createTeamInvite({"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createTeamInvite({"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("createTeamMembership", () => {
  it("exports createTeamMembershipSchema", () => { expect(createTeamMembershipSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createTeamMembership({"teamId":1,"userId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createTeamMembership({"teamId":1,"userId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamMemberships", () => {
  it("exports getTeamMembershipsSchema", () => { expect(getTeamMembershipsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamMemberships({"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamMemberships({"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamMembership", () => {
  it("exports getTeamMembershipSchema", () => { expect(getTeamMembershipSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamMembership({"teamId":1,"membershipId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamMembership({"teamId":1,"membershipId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateTeamMembership", () => {
  it("exports updateTeamMembershipSchema", () => { expect(updateTeamMembershipSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateTeamMembership({"teamId":1,"membershipId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateTeamMembership({"teamId":1,"membershipId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteTeamMembership", () => {
  it("exports deleteTeamMembershipSchema", () => { expect(deleteTeamMembershipSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteTeamMembership({"teamId":1,"membershipId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteTeamMembership({"teamId":1,"membershipId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamSchedules", () => {
  it("exports getTeamSchedulesSchema", () => { expect(getTeamSchedulesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamSchedules({"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamSchedules({"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("requestTeamEmailVerification", () => {
  it("exports requestTeamEmailVerificationSchema", () => { expect(requestTeamEmailVerificationSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await requestTeamEmailVerification({"teamId":1,"email":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await requestTeamEmailVerification({"teamId":1,"email":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("requestTeamPhoneVerification", () => {
  it("exports requestTeamPhoneVerificationSchema", () => { expect(requestTeamPhoneVerificationSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await requestTeamPhoneVerification({"teamId":1,"phone":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await requestTeamPhoneVerification({"teamId":1,"phone":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("verifyTeamEmail", () => {
  it("exports verifyTeamEmailSchema", () => { expect(verifyTeamEmailSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await verifyTeamEmail({"teamId":1,"email":"test","code":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await verifyTeamEmail({"teamId":1,"email":"test","code":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("verifyTeamPhone", () => {
  it("exports verifyTeamPhoneSchema", () => { expect(verifyTeamPhoneSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await verifyTeamPhone({"teamId":1,"phone":"test","code":"test"});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await verifyTeamPhone({"teamId":1,"phone":"test","code":"test"});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamVerifiedEmails", () => {
  it("exports getTeamVerifiedEmailsSchema", () => { expect(getTeamVerifiedEmailsSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamVerifiedEmails({"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamVerifiedEmails({"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamVerifiedPhones", () => {
  it("exports getTeamVerifiedPhonesSchema", () => { expect(getTeamVerifiedPhonesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamVerifiedPhones({"teamId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamVerifiedPhones({"teamId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamVerifiedEmail", () => {
  it("exports getTeamVerifiedEmailSchema", () => { expect(getTeamVerifiedEmailSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamVerifiedEmail({"teamId":1,"id":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamVerifiedEmail({"teamId":1,"id":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getTeamVerifiedPhone", () => {
  it("exports getTeamVerifiedPhoneSchema", () => { expect(getTeamVerifiedPhoneSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getTeamVerifiedPhone({"teamId":1,"id":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getTeamVerifiedPhone({"teamId":1,"id":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
