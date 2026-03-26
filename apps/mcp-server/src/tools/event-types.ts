import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { CalApiError } from "../utils/errors.js";

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
  eventTypeId: z.number().int().describe("The ID of the event type"),
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
  title: z.string().describe("Title of the event type"),
  slug: z.string().describe("URL-friendly slug for the event type"),
  lengthInMinutes: z.number().int().positive().describe("Duration in minutes"),
  description: z.string().optional().describe("Description of the event type"),
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
  eventTypeId: z.number().int().describe("The ID of the event type to update"),
  title: z.string().optional().describe("Updated title"),
  slug: z.string().optional().describe("Updated slug"),
  lengthInMinutes: z.number().int().positive().optional().describe("Updated duration in minutes"),
  description: z.string().optional().describe("Updated description"),
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
  eventTypeId: z.number().int().describe("The ID of the event type to delete"),
};

export async function deleteEventType(params: { eventTypeId: number }) {
  try {
    const data = await calApi(`event-types/${params.eventTypeId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_event_type", err);
  }
}
