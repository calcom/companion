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

// ── New tools (generated) ──

export const createEventTypeWebhookSchema = {
  eventTypeId: z.number().int().describe("eventTypeId"),
  payloadTemplate: z.string().describe("The template of the payload that will be sent to the subscriberUrl, check cal.com/docs/core-features/webhooks for more information").optional(),
  active: z.boolean(),
  subscriberUrl: z.string(),
  triggers: z.array(z.enum(["BOOKING_CREATED", "BOOKING_PAYMENT_INITIATED", "BOOKING_PAID", "BOOKING_RESCHEDULED", "BOOKING_REQUESTED", "BOOKING_CANCELLED", "BOOKING_REJECTED", "BOOKING_NO_SHOW_UPDATED", "FORM_SUBMITTED", "MEETING_ENDED", "MEETING_STARTED", "RECORDING_READY", "INSTANT_MEETING", "RECORDING_TRANSCRIPTION_GENERATED", "OOO_CREATED", "AFTER_HOSTS_CAL_VIDEO_NO_SHOW", "AFTER_GUESTS_CAL_VIDEO_NO_SHOW", "FORM_SUBMITTED_NO_EVENT", "ROUTING_FORM_FALLBACK_HIT", "DELEGATION_CREDENTIAL_ERROR", "WRONG_ASSIGNMENT_REPORT"])),
  secret: z.string().optional(),
  version: z.enum(["2021-10-20"]).describe("The version of the webhook").optional(),
};

export async function createEventTypeWebhook(params: {
  eventTypeId: number;
  payloadTemplate?: string;
  active: boolean;
  subscriberUrl: string;
  triggers: ("BOOKING_CREATED" | "BOOKING_PAYMENT_INITIATED" | "BOOKING_PAID" | "BOOKING_RESCHEDULED" | "BOOKING_REQUESTED" | "BOOKING_CANCELLED" | "BOOKING_REJECTED" | "BOOKING_NO_SHOW_UPDATED" | "FORM_SUBMITTED" | "MEETING_ENDED" | "MEETING_STARTED" | "RECORDING_READY" | "INSTANT_MEETING" | "RECORDING_TRANSCRIPTION_GENERATED" | "OOO_CREATED" | "AFTER_HOSTS_CAL_VIDEO_NO_SHOW" | "AFTER_GUESTS_CAL_VIDEO_NO_SHOW" | "FORM_SUBMITTED_NO_EVENT" | "ROUTING_FORM_FALLBACK_HIT" | "DELEGATION_CREDENTIAL_ERROR" | "WRONG_ASSIGNMENT_REPORT")[];
  secret?: string;
  version?: "2021-10-20";
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.payloadTemplate !== undefined) body.payloadTemplate = params.payloadTemplate;
    body.active = params.active;
    body.subscriberUrl = params.subscriberUrl;
    body.triggers = params.triggers;
    if (params.secret !== undefined) body.secret = params.secret;
    if (params.version !== undefined) body.version = params.version;
    const data = await calApi(`event-types/${params.eventTypeId}/webhooks`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_event_type_webhook", err);
  }
}

export const getEventTypeWebhooksSchema = {
  eventTypeId: z.number().int().describe("eventTypeId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getEventTypeWebhooks(params: {
  eventTypeId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`event-types/${params.eventTypeId}/webhooks`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_event_type_webhooks", err);
  }
}

export const deleteAllEventTypeWebhooksSchema = {
  eventTypeId: z.number().int().describe("eventTypeId"),
};

export async function deleteAllEventTypeWebhooks(params: {
  eventTypeId: number;
}) {
  try {
    const data = await calApi(`event-types/${params.eventTypeId}/webhooks`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_all_event_type_webhooks", err);
  }
}

export const updateEventTypeWebhookSchema = {
  eventTypeId: z.number().int().describe("eventTypeId"),
  webhookId: z.string().describe("webhookId"),
  payloadTemplate: z.string().describe("The template of the payload that will be sent to the subscriberUrl, check cal.com/docs/core-features/webhooks for more information").optional(),
  active: z.boolean().optional(),
  subscriberUrl: z.string().optional(),
  triggers: z.array(z.enum(["BOOKING_CREATED", "BOOKING_PAYMENT_INITIATED", "BOOKING_PAID", "BOOKING_RESCHEDULED", "BOOKING_REQUESTED", "BOOKING_CANCELLED", "BOOKING_REJECTED", "BOOKING_NO_SHOW_UPDATED", "FORM_SUBMITTED", "MEETING_ENDED", "MEETING_STARTED", "RECORDING_READY", "INSTANT_MEETING", "RECORDING_TRANSCRIPTION_GENERATED", "OOO_CREATED", "AFTER_HOSTS_CAL_VIDEO_NO_SHOW", "AFTER_GUESTS_CAL_VIDEO_NO_SHOW", "FORM_SUBMITTED_NO_EVENT", "ROUTING_FORM_FALLBACK_HIT", "DELEGATION_CREDENTIAL_ERROR", "WRONG_ASSIGNMENT_REPORT"])).optional(),
  secret: z.string().optional(),
  version: z.enum(["2021-10-20"]).describe("The version of the webhook").optional(),
};

export async function updateEventTypeWebhook(params: {
  eventTypeId: number;
  webhookId: string;
  payloadTemplate?: string;
  active?: boolean;
  subscriberUrl?: string;
  triggers?: ("BOOKING_CREATED" | "BOOKING_PAYMENT_INITIATED" | "BOOKING_PAID" | "BOOKING_RESCHEDULED" | "BOOKING_REQUESTED" | "BOOKING_CANCELLED" | "BOOKING_REJECTED" | "BOOKING_NO_SHOW_UPDATED" | "FORM_SUBMITTED" | "MEETING_ENDED" | "MEETING_STARTED" | "RECORDING_READY" | "INSTANT_MEETING" | "RECORDING_TRANSCRIPTION_GENERATED" | "OOO_CREATED" | "AFTER_HOSTS_CAL_VIDEO_NO_SHOW" | "AFTER_GUESTS_CAL_VIDEO_NO_SHOW" | "FORM_SUBMITTED_NO_EVENT" | "ROUTING_FORM_FALLBACK_HIT" | "DELEGATION_CREDENTIAL_ERROR" | "WRONG_ASSIGNMENT_REPORT")[];
  secret?: string;
  version?: "2021-10-20";
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.payloadTemplate !== undefined) body.payloadTemplate = params.payloadTemplate;
    if (params.active !== undefined) body.active = params.active;
    if (params.subscriberUrl !== undefined) body.subscriberUrl = params.subscriberUrl;
    if (params.triggers !== undefined) body.triggers = params.triggers;
    if (params.secret !== undefined) body.secret = params.secret;
    if (params.version !== undefined) body.version = params.version;
    const data = await calApi(`event-types/${params.eventTypeId}/webhooks/${params.webhookId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_event_type_webhook", err);
  }
}

export const getEventTypeWebhookSchema = {
  eventTypeId: z.number().int().describe("eventTypeId"),
  webhookId: z.string().describe("webhookId"),
};

export async function getEventTypeWebhook(params: {
  eventTypeId: number;
  webhookId: string;
}) {
  try {
    const data = await calApi(`event-types/${params.eventTypeId}/webhooks/${params.webhookId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_event_type_webhook", err);
  }
}

export const deleteEventTypeWebhookSchema = {
  eventTypeId: z.number().int().describe("eventTypeId"),
  webhookId: z.string().describe("webhookId"),
};

export async function deleteEventTypeWebhook(params: {
  eventTypeId: number;
  webhookId: string;
}) {
  try {
    const data = await calApi(`event-types/${params.eventTypeId}/webhooks/${params.webhookId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_event_type_webhook", err);
  }
}

export const createEventTypePrivateLinkSchema = {
  eventTypeId: z.number().int().describe("eventTypeId"),
  expiresAt: z.string().describe("Expiration date for time-based links").optional(),
  maxUsageCount: z.number().describe("Maximum number of times the link can be used. If omitted and expiresAt is not provided, defaults to 1 (one time use).").optional(),
};

export async function createEventTypePrivateLink(params: {
  eventTypeId: number;
  expiresAt?: string;
  maxUsageCount?: number;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.expiresAt !== undefined) body.expiresAt = params.expiresAt;
    if (params.maxUsageCount !== undefined) body.maxUsageCount = params.maxUsageCount;
    const data = await calApi(`event-types/${params.eventTypeId}/private-links`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_event_type_private_link", err);
  }
}

export const getEventTypePrivateLinksSchema = {
  eventTypeId: z.number().int().describe("eventTypeId"),
};

export async function getEventTypePrivateLinks(params: {
  eventTypeId: number;
}) {
  try {
    const data = await calApi(`event-types/${params.eventTypeId}/private-links`);
    return ok(data);
  } catch (err) {
    return handleError("get_event_type_private_links", err);
  }
}

export const updateEventTypePrivateLinkSchema = {
  eventTypeId: z.number().int().describe("eventTypeId"),
  linkId: z.string().describe("linkId"),
  expiresAt: z.string().describe("New expiration date for time-based links").optional(),
  maxUsageCount: z.number().describe("New maximum number of times the link can be used").optional(),
};

export async function updateEventTypePrivateLink(params: {
  eventTypeId: number;
  linkId: string;
  expiresAt?: string;
  maxUsageCount?: number;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.expiresAt !== undefined) body.expiresAt = params.expiresAt;
    if (params.maxUsageCount !== undefined) body.maxUsageCount = params.maxUsageCount;
    const data = await calApi(`event-types/${params.eventTypeId}/private-links/${params.linkId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_event_type_private_link", err);
  }
}

export const deleteEventTypePrivateLinkSchema = {
  eventTypeId: z.number().int().describe("eventTypeId"),
  linkId: z.string().describe("linkId"),
};

export async function deleteEventTypePrivateLink(params: {
  eventTypeId: number;
  linkId: string;
}) {
  try {
    const data = await calApi(`event-types/${params.eventTypeId}/private-links/${params.linkId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_event_type_private_link", err);
  }
}
