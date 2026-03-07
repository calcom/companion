import { waitUntil } from "@vercel/functions";
import { bot, botLogger } from "@/lib/bot";

// Allow up to 60s for LLM streaming + Slack API calls.
// Vercel Hobby defaults to 10s which causes timeouts mid-stream.
export const maxDuration = 60;

const VALID_PLATFORMS = Object.keys(bot.webhooks) as string[];

export async function POST(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;

  if (!VALID_PLATFORMS.includes(platform)) {
    return new Response(`Invalid platform: ${platform}. Valid: ${VALID_PLATFORMS.join(", ")}`, {
      status: 400,
    });
  }

  botLogger.info(`[Webhook] ${platform} webhook received at ${new Date().toISOString()}`);

  const handler = bot.webhooks[platform as keyof typeof bot.webhooks];

  const response = await handler(request, {
    waitUntil: (task) => {
      const tracked = task
        .then(() => botLogger.info("[Webhook] Background task completed"))
        .catch((err: unknown) => botLogger.error("[Webhook] Background task error:", err));
      waitUntil(tracked);
    },
  });

  return response;
}
