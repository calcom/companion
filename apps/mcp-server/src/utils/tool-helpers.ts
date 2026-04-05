import { CalApiError } from "./errors.js";
import { logger } from "./logger.js";

/**
 * Shared helper to format a successful tool response.
 */
export function ok(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

/**
 * Build a human-readable error string from a CalApiError.
 *
 * Includes the HTTP status, top-level message, and – when the API returns a
 * structured body with additional detail – the nested error array so that
 * callers (LLMs) can understand *why* a request was rejected without having
 * to guess.
 */
function formatApiError(err: CalApiError): string {
  const parts: string[] = [`Error ${err.status}: ${err.message}`];

  if (typeof err.body === "object" && err.body !== null) {
    const body = err.body as Record<string, unknown>;

    // Many Cal.com v2 validation errors include an `errors` array.
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      parts.push(`Details: ${JSON.stringify(body.errors)}`);
    }
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
