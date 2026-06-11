/**
 * Build query parameters efficiently by filtering undefined values.
 * Replaces verbose if-checks throughout the codebase.
 *
 * @param params Object with optional parameters
 * @returns Object with only defined parameters
 * @example
 *   buildParams({ status: "upcoming", skip: undefined }) // { status: "upcoming" }
 */
export function buildParams(
  params: Record<string, unknown>
): Record<string, string | number | boolean | string[] | undefined> {
  const result: Record<string, string | number | boolean | string[] | undefined> = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      result[key] = value as string | number | boolean | string[];
    }
  }

  return result;
}

/**
 * Build request body by filtering undefined values.
 * More performant than multiple if-checks.
 *
 * @param required Required fields to always include
 * @param optional Optional fields to conditionally include
 * @returns Combined body object
 */
export function buildBody(
  required: Record<string, unknown>,
  optional: Record<string, unknown>
): Record<string, unknown> {
  const body: Record<string, unknown> = { ...required };

  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) {
      body[key] = value;
    }
  }

  return body;
}
