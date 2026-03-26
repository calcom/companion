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

export const getConferencingAppsSchema = {};

export async function getConferencingApps() {
  try {
    const data = await calApi("conferencing");
    return ok(data);
  } catch (err) {
    return handleError("get_conferencing_apps", err);
  }
}
