import { CAL_API_VERSION } from "./config.js";

/**
 * Returns auth headers for Cal.com API requests using API key authentication.
 */
export function getApiKeyHeaders(): Record<string, string> {
  const apiKey = process.env.CAL_API_KEY;
  if (!apiKey) {
    throw new Error("CAL_API_KEY is required. Set it in your environment variables.");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "cal-api-version": CAL_API_VERSION,
    "Content-Type": "application/json",
  };
}
