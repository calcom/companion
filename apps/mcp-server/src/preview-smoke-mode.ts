export const PREVIEW_SMOKE_MODE_ENV = "MCP_PREVIEW_SMOKE_MODE";
export const PREVIEW_SMOKE_MODE_VALUE = "empty-deny";

/**
 * Enable the inert data adapter only for an explicitly opted-in Vercel preview.
 * Production and non-Vercel runtimes always retain the real data path.
 */
export function isPreviewSmokeMode(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === "preview" && env.MCP_PREVIEW_SMOKE_MODE === PREVIEW_SMOKE_MODE_VALUE;
}
