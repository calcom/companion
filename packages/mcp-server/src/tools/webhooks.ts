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
