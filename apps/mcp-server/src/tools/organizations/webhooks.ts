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

export const getOrgWebhooksSchema = {
  orgId: z.number().int().describe("orgId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgWebhooks(params: {
  orgId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/webhooks`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_webhooks", err);
  }
}

export const createOrgWebhookSchema = {
  orgId: z.number().int().describe("orgId"),
  payloadTemplate: z.string().describe("The template of the payload that will be sent to the subscriberUrl, check cal.com/docs/core-features/webhooks for more information").optional(),
  active: z.boolean(),
  subscriberUrl: z.string(),
  triggers: z.array(z.enum(["BOOKING_CREATED", "BOOKING_PAYMENT_INITIATED", "BOOKING_PAID", "BOOKING_RESCHEDULED", "BOOKING_REQUESTED", "BOOKING_CANCELLED", "BOOKING_REJECTED", "BOOKING_NO_SHOW_UPDATED", "FORM_SUBMITTED", "MEETING_ENDED", "MEETING_STARTED", "RECORDING_READY", "INSTANT_MEETING", "RECORDING_TRANSCRIPTION_GENERATED", "OOO_CREATED", "AFTER_HOSTS_CAL_VIDEO_NO_SHOW", "AFTER_GUESTS_CAL_VIDEO_NO_SHOW", "FORM_SUBMITTED_NO_EVENT", "ROUTING_FORM_FALLBACK_HIT", "DELEGATION_CREDENTIAL_ERROR", "WRONG_ASSIGNMENT_REPORT"])),
  secret: z.string().optional(),
  version: z.enum(["2021-10-20"]).describe("The version of the webhook").optional(),
};

export async function createOrgWebhook(params: {
  orgId: number;
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
    const data = await calApi(`organizations/${params.orgId}/webhooks`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_webhook", err);
  }
}

export const getOrgWebhookSchema = {
  orgId: z.number().int().describe("orgId"),
  webhookId: z.string().describe("webhookId"),
};

export async function getOrgWebhook(params: {
  orgId: number;
  webhookId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/webhooks/${params.webhookId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_webhook", err);
  }
}

export const deleteOrgWebhookSchema = {
  orgId: z.number().int().describe("orgId"),
  webhookId: z.string().describe("webhookId"),
};

export async function deleteOrgWebhook(params: {
  orgId: number;
  webhookId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/webhooks/${params.webhookId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_webhook", err);
  }
}

export const updateOrgWebhookSchema = {
  orgId: z.number().int().describe("orgId"),
  webhookId: z.string().describe("webhookId"),
  payloadTemplate: z.string().describe("The template of the payload that will be sent to the subscriberUrl, check cal.com/docs/core-features/webhooks for more information").optional(),
  active: z.boolean().optional(),
  subscriberUrl: z.string().optional(),
  triggers: z.array(z.enum(["BOOKING_CREATED", "BOOKING_PAYMENT_INITIATED", "BOOKING_PAID", "BOOKING_RESCHEDULED", "BOOKING_REQUESTED", "BOOKING_CANCELLED", "BOOKING_REJECTED", "BOOKING_NO_SHOW_UPDATED", "FORM_SUBMITTED", "MEETING_ENDED", "MEETING_STARTED", "RECORDING_READY", "INSTANT_MEETING", "RECORDING_TRANSCRIPTION_GENERATED", "OOO_CREATED", "AFTER_HOSTS_CAL_VIDEO_NO_SHOW", "AFTER_GUESTS_CAL_VIDEO_NO_SHOW", "FORM_SUBMITTED_NO_EVENT", "ROUTING_FORM_FALLBACK_HIT", "DELEGATION_CREDENTIAL_ERROR", "WRONG_ASSIGNMENT_REPORT"])).optional(),
  secret: z.string().optional(),
  version: z.enum(["2021-10-20"]).describe("The version of the webhook").optional(),
};

export async function updateOrgWebhook(params: {
  orgId: number;
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
    const data = await calApi(`organizations/${params.orgId}/webhooks/${params.webhookId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_webhook", err);
  }
}
