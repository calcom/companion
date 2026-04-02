import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getMeSchema = {};

export async function getMe() {
  try {
    const data = await calApi("me");
    return ok(data);
  } catch (err) {
    return handleError("get_me", err);
  }
}

export const updateMeSchema = {
  name: z.string().optional().describe("Updated display name"),
  email: z.string().email().optional().describe("Updated email address"),
  bio: z.string().optional().describe("Updated bio / description"),
  timeZone: z.string().optional().describe("Updated IANA time zone (e.g. America/New_York)"),
  weekStart: z.string().optional().describe("Updated week start day (e.g. Monday)"),
  timeFormat: z.number().int().optional().describe("Time format: 12 or 24"),
  defaultScheduleId: z.number().int().optional().describe("Default schedule ID"),
};

export async function updateMe(params: {
  name?: string;
  email?: string;
  bio?: string;
  timeZone?: string;
  weekStart?: string;
  timeFormat?: number;
  defaultScheduleId?: number;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.email !== undefined) body.email = params.email;
    if (params.bio !== undefined) body.bio = params.bio;
    if (params.timeZone !== undefined) body.timeZone = params.timeZone;
    if (params.weekStart !== undefined) body.weekStart = params.weekStart;
    if (params.timeFormat !== undefined) body.timeFormat = params.timeFormat;
    if (params.defaultScheduleId !== undefined) body.defaultScheduleId = params.defaultScheduleId;
    const data = await calApi("me", { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_me", err);
  }
}
