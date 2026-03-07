import { waitUntil } from "@vercel/functions";
import { bot, botLogger } from "@/lib/bot";

// Allow up to 60s for LLM streaming + Slack API calls.
// Vercel Hobby defaults to 10s which causes timeouts mid-stream.
export const maxDuration = 60;

const VALID_PLATFORMS = Object.keys(bot.webhooks) as string[];

type SlackPayload = {
  event?: { type?: string; text?: string; ts?: string };
  authorizations?: Array<{ user_id?: string; is_bot?: boolean }>;
};

/**
 * Slack sends both `message` and `app_mention` for the same @mention. The `message` event
 * arrives first, gets processed (but doesn't trigger mention handlers), and sets the dedupe key.
 * The `app_mention` event then arrives and is skipped as duplicate. We filter out `message`
 * events that contain a bot mention so `app_mention` is the one that gets processed.
 */
function isSlackMessageWithBotMention(payload: SlackPayload): boolean {
  const event = payload.event;
  const auths = payload.authorizations;
  if (event?.type !== "message" || !event.text || !auths?.length) return false;
  const botAuth = auths.find((a) => a.is_bot);
  const botUserId = botAuth?.user_id;
  if (!botUserId) return false;
  return event.text.includes(`<@${botUserId}>`);
}

export async function POST(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;

  if (!VALID_PLATFORMS.includes(platform)) {
    botLogger.warn("Webhook invalid platform", { platform, validPlatforms: VALID_PLATFORMS });
    return new Response(`Invalid platform: ${platform}. Valid: ${VALID_PLATFORMS.join(", ")}`, {
      status: 400,
    });
  }

  botLogger.info("Webhook received", { platform, at: new Date().toISOString() });

  let requestToHandle = request;

  // For Slack: read body once, skip message+mention events (app_mention will handle them)
  if (platform === "slack") {
    const body = await request.text();
    try {
      const payload = JSON.parse(body) as SlackPayload;
      if (isSlackMessageWithBotMention(payload)) {
        botLogger.info("Skipping message event (app_mention will handle)", {
          messageId: payload.event?.ts ?? "unknown",
        });
        return new Response(null, { status: 200 });
      }
      requestToHandle = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body,
      });
    } catch {
      requestToHandle = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body,
      });
    }
  }

  const handler = bot.webhooks[platform as keyof typeof bot.webhooks];

  const response = await handler(requestToHandle, {
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
