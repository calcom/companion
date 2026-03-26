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

export const refreshApiKeySchema = {
  apiKeyDaysValid: z.number().describe("For how many days is managed organization api key valid. Defaults to 30 days.").optional(),
  apiKeyNeverExpires: z.boolean().describe("If true, organization api key never expires.").optional(),
};

export async function refreshApiKey(params: {
  apiKeyDaysValid?: number;
  apiKeyNeverExpires?: boolean;
} = {}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.apiKeyDaysValid !== undefined) body.apiKeyDaysValid = params.apiKeyDaysValid;
    if (params.apiKeyNeverExpires !== undefined) body.apiKeyNeverExpires = params.apiKeyNeverExpires;
    const data = await calApi("api-keys/refresh", { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("refresh_api_key", err);
  }
}
