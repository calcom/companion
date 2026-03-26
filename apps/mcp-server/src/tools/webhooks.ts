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

export const getWebhooksSchema = {};

export async function getWebhooks() {
  try {
    const data = await calApi("webhooks");
    return ok(data);
  } catch (err) {
    return handleError("get_webhooks", err);
  }
}

export const createWebhookSchema = {
  subscriberUrl: z.string().url().describe("The URL to receive webhook events"),
  triggers: z
    .array(z.string())
    .describe("Array of event triggers (e.g. BOOKING_CREATED, BOOKING_CANCELLED)"),
  active: z.boolean().optional().describe("Whether the webhook is active (default: true)"),
  payloadTemplate: z.string().optional().describe("Custom payload template for the webhook"),
};

export async function createWebhook(params: {
  subscriberUrl: string;
  triggers: string[];
  active?: boolean;
  payloadTemplate?: string;
}) {
  try {
    const body: Record<string, unknown> = {
      subscriberUrl: params.subscriberUrl,
      triggers: params.triggers,
    };
    if (params.active !== undefined) body.active = params.active;
    if (params.payloadTemplate) body.payloadTemplate = params.payloadTemplate;
    const data = await calApi("webhooks", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_webhook", err);
  }
}

export const deleteWebhookSchema = {
  webhookId: z.string().describe("The ID of the webhook to delete"),
};

export async function deleteWebhook(params: { webhookId: string }) {
  try {
    const data = await calApi(`webhooks/${params.webhookId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_webhook", err);
  }
}

// ── New tools (generated) ──

export const updateWebhookSchema = {
  webhookId: z.string().describe("webhookId"),
  payloadTemplate: z.string().describe("The template of the payload that will be sent to the subscriberUrl, check cal.com/docs/core-features/webhooks for more information").optional(),
  active: z.boolean().optional(),
  subscriberUrl: z.string().optional(),
  triggers: z.array(z.enum(["BOOKING_CREATED", "BOOKING_PAYMENT_INITIATED", "BOOKING_PAID", "BOOKING_RESCHEDULED", "BOOKING_REQUESTED", "BOOKING_CANCELLED", "BOOKING_REJECTED", "BOOKING_NO_SHOW_UPDATED", "FORM_SUBMITTED", "MEETING_ENDED", "MEETING_STARTED", "RECORDING_READY", "INSTANT_MEETING", "RECORDING_TRANSCRIPTION_GENERATED", "OOO_CREATED", "AFTER_HOSTS_CAL_VIDEO_NO_SHOW", "AFTER_GUESTS_CAL_VIDEO_NO_SHOW", "FORM_SUBMITTED_NO_EVENT", "ROUTING_FORM_FALLBACK_HIT", "DELEGATION_CREDENTIAL_ERROR", "WRONG_ASSIGNMENT_REPORT"])).optional(),
  secret: z.string().optional(),
  version: z.enum(["2021-10-20"]).describe("The version of the webhook").optional(),
};

export async function updateWebhook(params: {
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
    const data = await calApi(`webhooks/${params.webhookId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_webhook", err);
  }
}

export const getWebhookSchema = {
  webhookId: z.string().describe("webhookId"),
};

export async function getWebhook(params: {
  webhookId: string;
}) {
  try {
    const data = await calApi(`webhooks/${params.webhookId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_webhook", err);
  }
}
