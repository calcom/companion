import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

const availabilitySlotSchema = z.object({
  day: z.string().describe("Day of week (e.g. Monday)"),
  startTime: z.string().describe("Start time in HH:mm format (e.g. '09:00')"),
  endTime: z.string().describe("End time in HH:mm format (e.g. '17:00')"),
});

const overrideSchema = z.object({
  date: z.string().describe("Date of the override in YYYY-MM-DD format"),
  startTime: z.string().optional().describe("Start time in HH:mm format. Omit startTime and endTime to mark the date as unavailable."),
  endTime: z.string().optional().describe("End time in HH:mm format."),
});

export const getSchedulesSchema = {};

export async function getSchedules() {
  try {
    const data = await calApi("schedules");
    return ok(data);
  } catch (err) {
    return handleError("get_schedules", err);
  }
}

export const getScheduleSchema = {
  scheduleId: z.number().int().describe("Schedule ID"),
};

export async function getSchedule(params: { scheduleId: number }) {
  try {
    const data = await calApi(`schedules/${params.scheduleId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_schedule", err);
  }
}

export const createScheduleSchema = {
  name: z.string().describe("Schedule name"),
  timeZone: z.string().describe("IANA time zone used to calculate available times (e.g. America/New_York)"),
  isDefault: z.boolean().describe("Whether this is the user's default schedule. Each user should have exactly one default schedule."),
  availability: z
    .array(availabilitySlotSchema)
    .optional()
    .describe("Availability slots. If not provided, defaults to Mon-Fri 09:00-17:00."),
  overrides: z
    .array(overrideSchema)
    .optional()
    .describe("Date-specific overrides. Use to change availability for a specific date or mark it as unavailable."),
};

export async function createSchedule(params: {
  name: string;
  timeZone: string;
  isDefault: boolean;
  availability?: { day: string; startTime: string; endTime: string }[];
  overrides?: { date: string; startTime?: string; endTime?: string }[];
}) {
  try {
    const body: Record<string, unknown> = {
      name: params.name,
      timeZone: params.timeZone,
      isDefault: params.isDefault,
    };
    if (params.availability !== undefined) body.availability = params.availability;
    if (params.overrides !== undefined) body.overrides = params.overrides;
    const data = await calApi("schedules", {
      method: "POST",
      body,
    });
    return ok(data);
  } catch (err) {
    return handleError("create_schedule", err);
  }
}

export const updateScheduleSchema = {
  scheduleId: z.number().int().describe("Schedule ID"),
  name: z.string().optional().describe("New name"),
  timeZone: z.string().optional().describe("New IANA time zone"),
  isDefault: z.boolean().optional().describe("Set as the user's default schedule."),
  availability: z.array(availabilitySlotSchema).optional().describe("New availability slots. Replaces all existing slots."),
  overrides: z
    .array(overrideSchema)
    .optional()
    .describe("Date-specific overrides. Replaces all existing overrides."),
};

export async function updateSchedule(params: {
  scheduleId: number;
  name?: string;
  timeZone?: string;
  isDefault?: boolean;
  availability?: { day: string; startTime: string; endTime: string }[];
  overrides?: { date: string; startTime?: string; endTime?: string }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.timeZone !== undefined) body.timeZone = params.timeZone;
    if (params.isDefault !== undefined) body.isDefault = params.isDefault;
    if (params.availability !== undefined) body.availability = params.availability;
    if (params.overrides !== undefined) body.overrides = params.overrides;
    const data = await calApi(`schedules/${params.scheduleId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_schedule", err);
  }
}

export const deleteScheduleSchema = {
  scheduleId: z.number().int().describe("Schedule ID"),
};

export async function deleteSchedule(params: { scheduleId: number }) {
  try {
    const data = await calApi(`schedules/${params.scheduleId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_schedule", err);
  }
}

export const getDefaultScheduleSchema = {};

export async function getDefaultSchedule() {
  try {
    const data = await calApi("schedules/default");
    return ok(data);
  } catch (err) {
    return handleError("get_default_schedule", err);
  }
}
