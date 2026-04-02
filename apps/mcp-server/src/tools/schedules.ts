import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

const availabilitySlotSchema = z.object({
  day: z.string().describe("Day of the week (e.g. Monday)"),
  startTime: z.string().describe("Start time in HH:mm format"),
  endTime: z.string().describe("End time in HH:mm format"),
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
  scheduleId: z.number().int().describe("The ID of the schedule"),
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
  name: z.string().describe("Name of the schedule"),
  timeZone: z.string().describe("IANA time zone (e.g. America/New_York)"),
  availability: z.array(availabilitySlotSchema).describe("Array of availability slots"),
};

export async function createSchedule(params: {
  name: string;
  timeZone: string;
  availability: { day: string; startTime: string; endTime: string }[];
}) {
  try {
    const data = await calApi("schedules", {
      method: "POST",
      body: { name: params.name, timeZone: params.timeZone, availability: params.availability },
    });
    return ok(data);
  } catch (err) {
    return handleError("create_schedule", err);
  }
}

export const updateScheduleSchema = {
  scheduleId: z.number().int().describe("The ID of the schedule to update"),
  name: z.string().optional().describe("Updated schedule name"),
  timeZone: z.string().optional().describe("Updated IANA time zone"),
  availability: z.array(availabilitySlotSchema).optional().describe("Updated availability slots"),
};

export async function updateSchedule(params: {
  scheduleId: number;
  name?: string;
  timeZone?: string;
  availability?: { day: string; startTime: string; endTime: string }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.timeZone !== undefined) body.timeZone = params.timeZone;
    if (params.availability !== undefined) body.availability = params.availability;
    const data = await calApi(`schedules/${params.scheduleId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_schedule", err);
  }
}

export const deleteScheduleSchema = {
  scheduleId: z.number().int().describe("The ID of the schedule to delete"),
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
