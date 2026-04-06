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
  name: z.string().optional().describe("Display name"),
  email: z.string().email().optional().describe("Email address"),
  bio: z.string().optional().describe("Short biography or description"),
  timeZone: z.string().optional().describe("IANA time zone (e.g. America/New_York)"),
  weekStart: z.string().optional().describe("Week start day (e.g. Monday, Sunday)"),
  timeFormat: z.number().int().optional().describe("Time format: 12 or 24"),
  defaultScheduleId: z.number().int().optional().describe("ID of the default schedule to use for event types"),
  locale: z.string().optional().describe("Locale / language code (e.g. 'en', 'fr', 'de')"),
  avatarUrl: z.string().optional().describe("URL of the user's avatar image"),
  metadata: z.record(z.unknown()).optional().describe("Custom metadata key-value pairs (max 50 keys, keys ≤40 chars, string values ≤500 chars)"),
};

export async function updateMe(params: {
  name?: string;
  email?: string;
  bio?: string;
  timeZone?: string;
  weekStart?: string;
  timeFormat?: number;
  defaultScheduleId?: number;
  locale?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
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
    if (params.locale !== undefined) body.locale = params.locale;
    if (params.avatarUrl !== undefined) body.avatarUrl = params.avatarUrl;
    if (params.metadata !== undefined) body.metadata = params.metadata;
    const data = await calApi("me", { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_me", err);
  }
}
