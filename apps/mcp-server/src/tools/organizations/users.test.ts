import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
	getOrgUsers,
	getOrgUsersSchema,
	createOrgUser,
	createOrgUserSchema,
} from "./users.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("getOrgUsers", () => {
	it("exports getOrgUsersSchema", () => { expect(getOrgUsersSchema).toBeDefined(); });
	it("returns data on success", async () => {
		mockCalApi.mockResolvedValueOnce({ status: "success" });
		const result = await getOrgUsers({ orgId: 1 });
		expect(result.content[0].type).toBe("text");
		expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
	});
	it("passes pagination and filter params", async () => {
		mockCalApi.mockResolvedValueOnce({ status: "success" });
		await getOrgUsers({ orgId: 1, take: 10, skip: 5, emails: ["a@b.com"] });
		expect(mockCalApi).toHaveBeenCalledWith("organizations/1/users", {
			params: { take: 10, skip: 5, emails: ["a@b.com"] },
		});
	});
	it("handles API errors", async () => {
		mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
		const result = await getOrgUsers({ orgId: 1 });
		expect(result).toHaveProperty("isError", true);
		expect(result.content[0].text).toContain("400");
	});
});

describe("createOrgUser", () => {
	it("exports createOrgUserSchema", () => { expect(createOrgUserSchema).toBeDefined(); });
	it("returns data on success", async () => {
		mockCalApi.mockResolvedValueOnce({ status: "success" });
		const result = await createOrgUser({ orgId: 1, email: "new@cal.com", username: "newuser" });
		expect(result.content[0].type).toBe("text");
		expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
	});
	it("sends correct body with required fields", async () => {
		mockCalApi.mockResolvedValueOnce({ status: "success" });
		await createOrgUser({ orgId: 1, email: "new@cal.com", username: "newuser" });
		expect(mockCalApi).toHaveBeenCalledWith("organizations/1/users", {
			method: "POST",
			body: { email: "new@cal.com", username: "newuser" },
		});
	});
	it("sends optional fields when provided", async () => {
		mockCalApi.mockResolvedValueOnce({ status: "success" });
		await createOrgUser({
			orgId: 1,
			email: "new@cal.com",
			username: "newuser",
			name: "New User",
			timeZone: "America/New_York",
			organizationRole: "ADMIN",
			autoAccept: true,
		});
		expect(mockCalApi).toHaveBeenCalledWith("organizations/1/users", {
			method: "POST",
			body: {
				email: "new@cal.com",
				username: "newuser",
				name: "New User",
				timeZone: "America/New_York",
				organizationRole: "ADMIN",
				autoAccept: true,
			},
		});
	});
	it("handles API errors", async () => {
		mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
		const result = await createOrgUser({ orgId: 1, email: "new@cal.com", username: "newuser" });
		expect(result).toHaveProperty("isError", true);
		expect(result.content[0].text).toContain("400");
	});
});
