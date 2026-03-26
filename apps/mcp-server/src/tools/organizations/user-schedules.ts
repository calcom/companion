import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { CalApiError } from "../../utils/errors.js";

function handleError(
  tag: string,
  err: unknown
): { content: { type: "text"; text: string }[]; isError: true } {
  if (err instanceof CalApiError) {
    console.error(`[${tag}] ${err.status}: ${err.message}`);
    return {
      content: [{ type: "text", text: `Error ${err.status}: ${err.message}` }],
      isError: true,
    };
  }
  throw err;
}

function ok(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export const createOrgUserScheduleSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  name: z.string(),
  timeZone: z.string().describe("Timezone is used to calculate available times when an event using the schedule is booked."),
  availability: z.array(z.object({
    days: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]).describe("Array of days when schedule is active."),
    startTime: z.string().describe("startTime must be a valid time in format HH:MM e.g. 08:00"),
    endTime: z.string().describe("endTime must be a valid time in format HH:MM e.g. 15:00"),
  })).optional(),
  isDefault: z.boolean().describe("Each user should have 1 default schedule. If you specified `timeZone` when creating managed user, then the default schedule will be created with that timezone.     Default schedule means that if an ev"),
  overrides: z.array(z.object({
    date: z.string(),
    startTime: z.string().describe("startTime must be a valid time in format HH:MM e.g. 12:00"),
    endTime: z.string().describe("endTime must be a valid time in format HH:MM e.g. 13:00"),
  })).optional(),
};

export async function createOrgUserSchedule(params: {
  orgId: number;
  userId: number;
  name: string;
  timeZone: string;
  availability?: { days: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"; startTime: string; endTime: string }[];
  isDefault: boolean;
  overrides?: { date: string; startTime: string; endTime: string }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    body.name = params.name;
    body.timeZone = params.timeZone;
    if (params.availability !== undefined) body.availability = params.availability;
    body.isDefault = params.isDefault;
    if (params.overrides !== undefined) body.overrides = params.overrides;
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/schedules`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_user_schedule", err);
  }
}

export const getOrgUserSchedulesSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
};

export async function getOrgUserSchedules(params: {
  orgId: number;
  userId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/schedules`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_user_schedules", err);
  }
}

export const getOrgUserScheduleSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  scheduleId: z.number().int().describe("scheduleId"),
};

export async function getOrgUserSchedule(params: {
  orgId: number;
  userId: number;
  scheduleId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/schedules/${params.scheduleId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_user_schedule", err);
  }
}

export const updateOrgUserScheduleSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  scheduleId: z.number().int().describe("scheduleId"),
  name: z.string().optional(),
  timeZone: z.string().optional(),
  availability: z.array(z.object({
    days: z.enum(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]).describe("Array of days when schedule is active."),
    startTime: z.string().describe("startTime must be a valid time in format HH:MM e.g. 08:00"),
    endTime: z.string().describe("endTime must be a valid time in format HH:MM e.g. 15:00"),
  })).optional(),
  isDefault: z.boolean().optional(),
  overrides: z.array(z.object({
    date: z.string(),
    startTime: z.string().describe("startTime must be a valid time in format HH:MM e.g. 12:00"),
    endTime: z.string().describe("endTime must be a valid time in format HH:MM e.g. 13:00"),
  })).optional(),
};

export async function updateOrgUserSchedule(params: {
  orgId: number;
  userId: number;
  scheduleId: number;
  name?: string;
  timeZone?: string;
  availability?: { days: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday"; startTime: string; endTime: string }[];
  isDefault?: boolean;
  overrides?: { date: string; startTime: string; endTime: string }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.timeZone !== undefined) body.timeZone = params.timeZone;
    if (params.availability !== undefined) body.availability = params.availability;
    if (params.isDefault !== undefined) body.isDefault = params.isDefault;
    if (params.overrides !== undefined) body.overrides = params.overrides;
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/schedules/${params.scheduleId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_user_schedule", err);
  }
}

export const deleteOrgUserScheduleSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  scheduleId: z.number().int().describe("scheduleId"),
};

export async function deleteOrgUserSchedule(params: {
  orgId: number;
  userId: number;
  scheduleId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/users/${params.userId}/schedules/${params.scheduleId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_user_schedule", err);
  }
}
