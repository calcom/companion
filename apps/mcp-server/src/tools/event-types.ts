import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { handleError, ok } from "../utils/tool-helpers.js";

export const getEventTypesSchema = {};

export async function getEventTypes() {
  try {
    const data = await calApi("event-types");
    return ok(data);
  } catch (err) {
    return handleError("get_event_types", err);
  }
}

export const getEventTypeSchema = {
  eventTypeId: z.number().int().describe("Event type ID"),
};

export async function getEventType(params: { eventTypeId: number }) {
  try {
    const data = await calApi(`event-types/${params.eventTypeId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_event_type", err);
  }
}

export const createEventTypeSchema = {
  title: z.string().describe("Event type title"),
  slug: z.string().describe("URL-friendly slug"),
  lengthInMinutes: z.number().int().positive().describe("Duration in minutes"),
  description: z.string().optional().describe("Description"),
};

export async function createEventType(params: {
  title: string;
  slug: string;
  lengthInMinutes: number;
  description?: string;
}) {
  try {
    const body: Record<string, unknown> = {
      title: params.title,
      slug: params.slug,
      lengthInMinutes: params.lengthInMinutes,
    };
    if (params.description) body.description = params.description;
    const data = await calApi("event-types", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_event_type", err);
  }
}

export const updateEventTypeSchema = {
  eventTypeId: z.number().int().describe("Event type ID"),
  title: z.string().optional().describe("New title"),
  slug: z.string().optional().describe("New slug"),
  lengthInMinutes: z.number().int().positive().optional().describe("New duration in minutes"),
  description: z.string().optional().describe("New description"),
};

export async function updateEventType(params: {
  eventTypeId: number;
  title?: string;
  slug?: string;
  lengthInMinutes?: number;
  description?: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.title !== undefined) body.title = params.title;
    if (params.slug !== undefined) body.slug = params.slug;
    if (params.lengthInMinutes !== undefined) body.lengthInMinutes = params.lengthInMinutes;
    if (params.description !== undefined) body.description = params.description;
    const data = await calApi(`event-types/${params.eventTypeId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_event_type", err);
  }
}

export const deleteEventTypeSchema = {
  eventTypeId: z.number().int().describe("Event type ID"),
};

export async function deleteEventType(params: { eventTypeId: number }) {
  try {
    const data = await calApi(`event-types/${params.eventTypeId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_event_type", err);
  }
}
