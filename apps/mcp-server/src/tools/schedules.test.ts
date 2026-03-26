import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../utils/errors.js";

vi.mock("../utils/api-client.js", () => ({
  calApi: vi.fn(),
}));

import { calApi } from "../utils/api-client.js";
import {
  getSchedules,
  getSchedule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedulesSchema,
  getScheduleSchema,
  createScheduleSchema,
  updateScheduleSchema,
  deleteScheduleSchema,
} from "./schedules.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("schedules schemas", () => {
  it("exports empty getSchedulesSchema", () => {
    expect(getSchedulesSchema).toEqual({});
  });

  it("exports getScheduleSchema with scheduleId", () => {
    expect(getScheduleSchema.scheduleId).toBeDefined();
  });

  it("exports createScheduleSchema with required fields", () => {
    expect(createScheduleSchema.name).toBeDefined();
    expect(createScheduleSchema.timeZone).toBeDefined();
    expect(createScheduleSchema.availability).toBeDefined();
  });

  it("exports updateScheduleSchema", () => {
    expect(updateScheduleSchema.scheduleId).toBeDefined();
    expect(updateScheduleSchema.name).toBeDefined();
  });

  it("exports deleteScheduleSchema", () => {
    expect(deleteScheduleSchema.scheduleId).toBeDefined();
  });
});

describe("getSchedules", () => {
  it("returns schedules list", async () => {
    mockCalApi.mockResolvedValueOnce({ schedules: [{ id: 1 }] });

    const result = await getSchedules();

    expect(mockCalApi).toHaveBeenCalledWith("schedules");
    expect(JSON.parse(result.content[0].text)).toHaveProperty("schedules");
  });

  it("handles errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(500, "Error", {}));
    const result = await getSchedules();
    expect(result).toHaveProperty("isError", true);
  });
});

describe("getSchedule", () => {
  it("fetches schedule by id", async () => {
    mockCalApi.mockResolvedValueOnce({ id: 5, name: "Work" });

    const result = await getSchedule({ scheduleId: 5 });

    expect(mockCalApi).toHaveBeenCalledWith("schedules/5");
    expect(JSON.parse(result.content[0].text)).toHaveProperty("name", "Work");
  });
});

describe("createSchedule", () => {
  it("sends POST with schedule data", async () => {
    mockCalApi.mockResolvedValueOnce({ id: 10 });

    await createSchedule({
      name: "Office Hours",
      timeZone: "America/New_York",
      availability: [
        { day: "Monday", startTime: "09:00", endTime: "17:00" },
      ],
    });

    expect(mockCalApi).toHaveBeenCalledWith("schedules", {
      method: "POST",
      body: {
        name: "Office Hours",
        timeZone: "America/New_York",
        availability: [{ day: "Monday", startTime: "09:00", endTime: "17:00" }],
      },
    });
  });
});

describe("updateSchedule", () => {
  it("sends PATCH with partial fields", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await updateSchedule({ scheduleId: 5, name: "New Name" });

    expect(mockCalApi).toHaveBeenCalledWith("schedules/5", {
      method: "PATCH",
      body: { name: "New Name" },
    });
  });

  it("includes availability when provided", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await updateSchedule({
      scheduleId: 5,
      availability: [{ day: "Tuesday", startTime: "10:00", endTime: "16:00" }],
    });

    const [, opts] = mockCalApi.mock.calls[0];
    expect((opts as { body: Record<string, unknown> }).body).toHaveProperty("availability");
  });
});

describe("deleteSchedule", () => {
  it("sends DELETE request", async () => {
    mockCalApi.mockResolvedValueOnce({});

    await deleteSchedule({ scheduleId: 5 });

    expect(mockCalApi).toHaveBeenCalledWith("schedules/5", { method: "DELETE" });
  });
});

// ── Tests for new tools ──
import {
  getDefaultSchedule,
  getDefaultScheduleSchema,
} from "./schedules.js";

describe("getDefaultSchedule", () => {
  it("exports getDefaultScheduleSchema", () => { expect(getDefaultScheduleSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getDefaultSchedule();
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getDefaultSchedule();
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
