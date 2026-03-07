import { waitUntil } from "@vercel/functions";
import { bot } from "@/lib/bot";

// Allow up to 60s for LLM streaming + Slack API calls.
// Vercel Hobby defaults to 10s which causes timeouts mid-stream.
export const maxDuration = 60;

type Platform = keyof typeof bot.webhooks;

const pendingTasks: Promise<void>[] = [];

export async function POST(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;

  console.log(`[Webhook] ${platform} webhook received at ${new Date().toISOString()}`);

  const handler = bot.webhooks[platform as Platform];

  if (!handler) {
    console.log(`[Webhook] Unknown platform: ${platform}`);
    return new Response(`Unknown platform: ${platform}`, { status: 404 });
  }

  const response = await handler(request, {
    waitUntil: (task) => {
      const tracked = task
        .then(() => console.log("[Webhook] Background task completed"))
        .catch((err: unknown) => console.error("[Webhook] Background task error:", err));
      pendingTasks.push(tracked);
      waitUntil(tracked);
    },
  });

  console.log(`[Webhook] Handler returned response ${response.status}, pending tasks: ${pendingTasks.length}`);

  return response;
}
