/**
 * Validate and sanitize a path segment to prevent path traversal attacks.
 * Only allows alphanumeric characters, hyphens, underscores, and dots.
 * Rejects segments containing path traversal sequences.
 */
export function sanitizePathSegment(segment: string): string {
  if (!segment || segment.includes("..") || segment.includes("/") || segment.includes("\\")) {
    throw new Error(`Invalid path segment: "${segment}"`);
  }
  return encodeURIComponent(segment);
}
