import { describe, it, expect, vi, beforeEach } from "vitest";
import { CalApiError } from "../../utils/errors.js";

vi.mock("../../utils/api-client.js", () => ({ calApi: vi.fn() }));

import { calApi } from "../../utils/api-client.js";
import {
  createOrgUserSchedule,
  createOrgUserScheduleSchema,
  getOrgUserSchedules,
  getOrgUserSchedulesSchema,
  getOrgUserSchedule,
  getOrgUserScheduleSchema,
  updateOrgUserSchedule,
  updateOrgUserScheduleSchema,
  deleteOrgUserSchedule,
  deleteOrgUserScheduleSchema,
} from "./user-schedules.js";

const mockCalApi = vi.mocked(calApi);

beforeEach(() => { vi.clearAllMocks(); });

describe("createOrgUserSchedule", () => {
  it("exports createOrgUserScheduleSchema", () => { expect(createOrgUserScheduleSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await createOrgUserSchedule({"orgId":1,"userId":1,"name":"test","timeZone":"test","isDefault":true});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await createOrgUserSchedule({"orgId":1,"userId":1,"name":"test","timeZone":"test","isDefault":true});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgUserSchedules", () => {
  it("exports getOrgUserSchedulesSchema", () => { expect(getOrgUserSchedulesSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgUserSchedules({"orgId":1,"userId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgUserSchedules({"orgId":1,"userId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("getOrgUserSchedule", () => {
  it("exports getOrgUserScheduleSchema", () => { expect(getOrgUserScheduleSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await getOrgUserSchedule({"orgId":1,"userId":1,"scheduleId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await getOrgUserSchedule({"orgId":1,"userId":1,"scheduleId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("updateOrgUserSchedule", () => {
  it("exports updateOrgUserScheduleSchema", () => { expect(updateOrgUserScheduleSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await updateOrgUserSchedule({"orgId":1,"userId":1,"scheduleId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await updateOrgUserSchedule({"orgId":1,"userId":1,"scheduleId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});

describe("deleteOrgUserSchedule", () => {
  it("exports deleteOrgUserScheduleSchema", () => { expect(deleteOrgUserScheduleSchema).toBeDefined(); });
  it("returns data on success", async () => {
    mockCalApi.mockResolvedValueOnce({ status: "success" });
    const result = await deleteOrgUserSchedule({"orgId":1,"userId":1,"scheduleId":1});
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "success" });
  });
  it("handles API errors", async () => {
    mockCalApi.mockRejectedValueOnce(new CalApiError(400, "Bad request", {}));
    const result = await deleteOrgUserSchedule({"orgId":1,"userId":1,"scheduleId":1});
    expect(result).toHaveProperty("isError", true);
    expect(result.content[0].text).toContain("400");
  });
});
