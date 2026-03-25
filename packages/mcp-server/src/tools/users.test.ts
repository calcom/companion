import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  getMe,
  updateMe,
  getMeSchema,
  updateMeSchema,
} from "./users.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("users schemas", () => {
  it("exports empty getMeSchema", () => {
    expect(getMeSchema).toEqual({});
  });

  it("exports updateMeSchema with optional fields", () => {
    expect(updateMeSchema.name).toBeDefined();
    expect(updateMeSchema.email).toBeDefined();
    expect(updateMeSchema.bio).toBeDefined();
    expect(updateMeSchema.timeZone).toBeDefined();
    expect(updateMeSchema.weekStart).toBeDefined();
    expect(updateMeSchema.timeFormat).toBeDefined();
    expect(updateMeSchema.defaultScheduleId).toBeDefined();
  });
});

describe("getMe", () => {
  it("returns user profile", async () => {
    mockCalApi.mockResolvedValueOnce({ id: 1, name: "Test User", email: "test@example.com" });

    const result = await getMe();

    expect(mockCalApi).toHaveBeenCalledWith("me");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveProperty("name", "Test User");
    expect(parsed).toHaveProperty("email", "test@example.com");
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(401, "Unauthorized", {}));

    const result = await getMe();

    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("401");
  });

  it("rethrows non-CalApiError", async () => {
    mockCalApi.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(getMe()).rejects.toThrow(TypeError);
  });
});

describe("updateMe", () => {
  it("sends PATCH with provided fields", async () => {
    mockCalApi.mockResolvedValueOnce({ id: 1, name: "Updated" });

    await updateMe({ name: "Updated", bio: "New bio" });

    expect(mockCalApi).toHaveBeenCalledWith("me", {
      method: "PATCH",
      body: { name: "Updated", bio: "New bio" },
    });
  });

  it("only includes defined fields in body", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await updateMe({ timeZone: "Europe/London" });

    const [, opts] = mockCalApi.mock.calls[0];
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body).toEqual({ timeZone: "Europe/London" });
    expect(body).not.toHaveProperty("name");
    expect(body).not.toHaveProperty("email");
  });

  it("sends empty body when no fields provided", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await updateMe({});

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toEqual({});
  });

  it("includes all fields when all are provided", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await updateMe({
      name: "Full",
      email: "full@example.com",
      bio: "Bio",
      timeZone: "UTC",
      weekStart: "Monday",
      timeFormat: 24,
      defaultScheduleId: 1,
    });

    const [, opts] = mockCalApi.mock.calls[0];
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(Object.keys(body)).toHaveLength(7);
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Invalid email", {}));

    const result = await updateMe({ email: "invalid" });

    expect(result).toHaveProperty("isError", true);
  });
});
