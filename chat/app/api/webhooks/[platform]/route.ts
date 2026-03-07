import { waitUntil } from "@vercel/functions";
import { bot, botLogger } from "@/lib/bot";

// Allow up to 60s for LLM streaming + Slack API calls.
// Vercel Hobby defaults to 10s which causes timeouts mid-stream.
export const maxDuration = 60;

const VALID_PLATFORMS = Object.keys(bot.webhooks) as string[];

export async function POST(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;

  if (!VALID_PLATFORMS.includes(platform)) {
    botLogger.warn("Webhook invalid platform", { platform, validPlatforms: VALID_PLATFORMS });
    return new Response(`Invalid platform: ${platform}. Valid: ${VALID_PLATFORMS.join(", ")}`, {
      status: 400,
    });
  }

  botLogger.info("Webhook received", { platform, at: new Date().toISOString() });

  const handler = bot.webhooks[platform as keyof typeof bot.webhooks];

  const response = await handler(request, {
    waitUntil: (task) => {
      const tracked = task
        .then(() => botLogger.info("Webhook background task completed", { platform }))
        .catch((err: unknown) => botLogger.error("Webhook background task error", { platform, err }));
      waitUntil(tracked);
    },
  });

  botLogger.info("Webhook response", { platform, status: response.status });
  return response;
}
