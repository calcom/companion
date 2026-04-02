import { CalApiError } from "./errors.js";
import { logger } from "./logger.js";

/**
 * Shared helper to format a successful tool response.
 */
export function ok(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/**
 * Shared helper to handle Cal.com API errors in tool handlers.
 * Returns a structured MCP error response for CalApiError, re-throws everything else.
 */
export function handleError(
  tag: string,
  err: unknown,
): { content: { type: "text"; text: string }[]; isError: true } {
  if (err instanceof CalApiError) {
    logger.error(`Tool error: ${tag}`, { status: err.status, error: err.message });
    return {
      content: [{ type: "text", text: `Error ${err.status}: ${err.message}` }],
      isError: true,
    };
  }
  throw err;
}
