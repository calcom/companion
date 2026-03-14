/**
 * Validates required environment variables for the chat bot.
 * Call at startup to fail fast if critical config is missing.
 */

import { type AIProvider, PROVIDER_CONFIG, SUPPORTED_PROVIDERS } from "./ai-provider";

export function validateRequiredEnv(): void {
  const missing: string[] = [];

  if (!process.env.SLACK_CLIENT_ID) missing.push("SLACK_CLIENT_ID");
  if (!process.env.SLACK_CLIENT_SECRET) missing.push("SLACK_CLIENT_SECRET");
  if (!process.env.SLACK_SIGNING_SECRET) missing.push("SLACK_SIGNING_SECRET");
  if (!process.env.SLACK_ENCRYPTION_KEY) missing.push("SLACK_ENCRYPTION_KEY");

  if (process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_USERNAME) {
    missing.push("TELEGRAM_BOT_USERNAME (required when TELEGRAM_BOT_TOKEN is set)");
  }

  // Validate AI_PROVIDER value
  const provider = (process.env.AI_PROVIDER ?? "groq") as string;
  if (!SUPPORTED_PROVIDERS.includes(provider as AIProvider)) {
    throw new Error(
      `Invalid AI_PROVIDER: "${provider}". Must be one of: ${SUPPORTED_PROVIDERS.join(", ")}`
    );
  }

  // Validate that the selected provider's API key is present
  const config = PROVIDER_CONFIG[provider as AIProvider];
  if (config && !process.env[config.apiKeyEnv]) {
    missing.push(`${config.apiKeyEnv} (required for AI_PROVIDER=${provider})`);
  }

  if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL) {
    throw new Error(
      "REDIS_URL is required in production. The in-memory state adapter is not suitable for production (state is lost on restart, locks don't work across instances)."
    );
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
