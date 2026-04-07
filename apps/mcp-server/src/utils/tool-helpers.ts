import { CalApiError } from "./errors.js";
import { logger } from "./logger.js";

/**
 * Shared helper to format a successful tool response.
 */
export function ok(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

/**
 * Build a human-readable error string from a CalApiError.
 *
 * Includes the HTTP status, top-level message, and the full API response body
 * so that callers (LLMs) can understand *why* a request was rejected without
 * having to guess.  Cal.com v2 returns error details in various shapes
 * (`errors` array, `error` string/object, flat `message`, etc.) so we surface
 * the entire body rather than cherry-picking one format.
 */
function formatApiError(err: CalApiError): string {
  const parts: string[] = [`Error ${err.status}: ${err.message}`];

  if (err.body !== undefined && err.body !== null) {
    const bodyStr =
      typeof err.body === "string" ? err.body : JSON.stringify(err.body);
    parts.push(`Response body: ${bodyStr}`);
  }

  return parts.join("\n");
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
      content: [{ type: "text", text: formatApiError(err) }],
      isError: true,
    };
  }
  throw err;
}
