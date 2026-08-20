import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  createOooEntry,
  createOooEntrySchema,
  deleteOooEntry,
  deleteOooEntrySchema,
  getOooEntries,
  getOooEntriesSchema,
  updateOooEntry,
  updateOooEntrySchema,
} from "./ooo.js";

const mockCalApi = vi.mocked(calApi);
const start = "2026-09-01T00:00:00.000Z";
const end = "2026-09-03T23:59:59.999Z";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OOO schemas", () => {
  it("exports pagination and sorting fields", () => {
    expect(getOooEntriesSchema.take).toBeDefined();
    expect(getOooEntriesSchema.skip).toBeDefined();
    expect(getOooEntriesSchema.sortStart).toBeDefined();
    expect(getOooEntriesSchema.sortEnd).toBeDefined();
  });

  it("enforces pagination bounds", () => {
    expect(getOooEntriesSchema.take.safeParse(0).success).toBe(false);
    expect(getOooEntriesSchema.take.safeParse(1).success).toBe(true);
    expect(getOooEntriesSchema.take.safeParse(250).success).toBe(true);
    expect(getOooEntriesSchema.take.safeParse(251).success).toBe(false);
    expect(getOooEntriesSchema.skip.safeParse(-1).success).toBe(false);
    expect(getOooEntriesSchema.skip.safeParse(0).success).toBe(true);
  });

  it("enforces sort enums", () => {
    expect(getOooEntriesSchema.sortStart.safeParse("asc").success).toBe(true);
    expect(getOooEntriesSchema.sortEnd.safeParse("desc").success).toBe(true);
    expect(getOooEntriesSchema.sortStart.safeParse("up").success).toBe(false);
  });

  it("enforces strict UTC date-time format", () => {
    expect(createOooEntrySchema.start.safeParse(start).success).toBe(true);
    expect(createOooEntrySchema.start.safeParse("2026-09-01T00:00:00Z").success).toBe(true);
    expect(createOooEntrySchema.start.safeParse("2026-09-01").success).toBe(false);
    expect(createOooEntrySchema.start.safeParse("2026-09-01T00:00:00+02:00").success).toBe(false);
    expect(updateOooEntrySchema.end.safeParse(end).success).toBe(true);
  });

  it("enforces the reason enum", () => {
    expect(createOooEntrySchema.reason.safeParse("vacation").success).toBe(true);
    expect(createOooEntrySchema.reason.safeParse("public_holiday").success).toBe(true);
    expect(createOooEntrySchema.reason.safeParse("holiday").success).toBe(false);
    expect(updateOooEntrySchema.reason.safeParse("sick").success).toBe(true);
  });

  it("exports ID schemas", () => {
    expect(updateOooEntrySchema.oooId).toBeDefined();
    expect(deleteOooEntrySchema.oooId).toBeDefined();
  });
});

describe("getOooEntries", () => {
  it("sends query params and returns the response", async () => {
    mockCalApi.mockResolvedValueOnce({ entries: [{ id: 1 }] });

    const result = await getOooEntries({
      take: 25,
      skip: 5,
      sortStart: "asc",
      sortEnd: "desc",
    });

    expect(mockCalApi).toHaveBeenCalledWith("me/ooo", {
      params: { take: 25, skip: 5, sortStart: "asc", sortEnd: "desc" },
    });
    expect(JSON.parse(result.content[0].text)).toEqual({ entries: [{ id: 1 }] });
  });

  it("omits undefined query params", async () => {
    mockCalApi.mockResolvedValueOnce([]);

    await getOooEntries({});

    expect(mockCalApi).toHaveBeenCalledWith("me/ooo", { params: {} });
  });

  it("passes API errors through the tool error response", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(409, "Ooo entry already exists", {}));

    const result = await getOooEntries({});

    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("409");
    expect(result.content[0].text).toContain("Ooo entry already exists");
  });
});

describe("createOooEntry", () => {
  it("sends POST with required and optional fields", async () => {
    mockCalApi.mockResolvedValueOnce({ id: 10 });

    await createOooEntry({
      start,
      end,
      notes: "Vacation",
      toUserId: 42,
      reason: "vacation",
    });

    expect(mockCalApi).toHaveBeenCalledWith("me/ooo", {
      method: "POST",
      body: { start, end, notes: "Vacation", toUserId: 42, reason: "vacation" },
    });
  });

  it("only sends defined optional fields", async () => {
    mockCalApi.mockResolvedValueOnce({ id: 11 });

    await createOooEntry({ start, end });

    expect(mockCalApi).toHaveBeenCalledWith("me/ooo", {
      method: "POST",
      body: { start, end },
    });
  });
});

describe("updateOooEntry", () => {
  it("sends PATCH with a partial body", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await updateOooEntry({ oooId: 5, notes: "Updated notes" });

    expect(mockCalApi).toHaveBeenCalledWith("me/ooo/5", {
      method: "PATCH",
      body: { notes: "Updated notes" },
    });
  });

  it("sends all defined fields and omits undefined fields", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await updateOooEntry({
      oooId: 5,
      start,
      end,
      toUserId: 42,
      reason: "travel",
    });

    expect(mockCalApi).toHaveBeenCalledWith("me/ooo/5", {
      method: "PATCH",
      body: { start, end, toUserId: 42, reason: "travel" },
    });
  });
});

describe("deleteOooEntry", () => {
  it("sends DELETE request", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await deleteOooEntry({ oooId: 5 });

    expect(mockCalApi).toHaveBeenCalledWith("me/ooo/5", { method: "DELETE" });
  });
});
