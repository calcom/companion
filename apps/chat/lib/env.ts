/**
 * Validates required environment variables for the chat bot.
 * Call at startup to fail fast if critical config is missing.
 */
export function validateRequiredEnv(): void {
  const missing: string[] = [];

  if (!process.env.AI_GATEWAY_API_KEY) missing.push("AI_GATEWAY_API_KEY");

  if (!process.env.SLACK_CLIENT_ID) missing.push("SLACK_CLIENT_ID");
  if (!process.env.SLACK_CLIENT_SECRET) missing.push("SLACK_CLIENT_SECRET");
  if (!process.env.SLACK_SIGNING_SECRET) missing.push("SLACK_SIGNING_SECRET");
  if (!process.env.SLACK_ENCRYPTION_KEY) missing.push("SLACK_ENCRYPTION_KEY");

  if (process.env.TELEGRAM_BOT_TOKEN && !process.env.TELEGRAM_BOT_USERNAME) {
    missing.push("TELEGRAM_BOT_USERNAME (required when TELEGRAM_BOT_TOKEN is set)");
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
