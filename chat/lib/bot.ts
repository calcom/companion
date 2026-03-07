import {
  Actions,
  Button,
  Card,
  CardText,
  Chat,
  LinkButton,
  LockError,
  NotImplementedError,
  RateLimitError,
  emoji,
} from "chat";
import {
  AdapterRateLimitError,
  AuthenticationError,
  NetworkError,
  PermissionError,
  ResourceNotFoundError,
  ValidationError,
} from "@chat-adapter/shared";
import { createSlackAdapter, type SlackAdapter } from "@chat-adapter/slack";
import { createTelegramAdapter, type TelegramAdapter } from "@chat-adapter/telegram";
import { createIoRedisState } from "@chat-adapter/state-ioredis";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createRedisState } from "@chat-adapter/state-redis";
import type { Thread } from "chat";
import type { ModelMessage } from "ai";
import { getLinkedUser } from "./user-linking";
import { registerSlackHandlers, RETRY_STOP_BLOCKS } from "./handlers/slack";
import { registerTelegramHandlers } from "./handlers/telegram";
import { isAIRateLimitError, runAgentStream } from "./agent";
import type { LookupPlatformUserFn } from "./agent";
import { generateAuthUrl } from "./calcom/oauth";
import { validateRequiredEnv } from "./env";
import { formatForTelegram } from "./format-for-telegram";
import { logger as botLogger } from "./logger";

validateRequiredEnv();

// ─── Slack user lookup via users.info API ────────────────────────────────────

function makeLookupSlackUser(teamId: string): LookupPlatformUserFn {
  return async (slackUserId: string) => {
    try {
      const installation = await slackAdapter.getInstallation(teamId);
      if (!installation?.botToken) return null;

      const res = await fetch(
        `https://slack.com/api/users.info?user=${encodeURIComponent(slackUserId)}`,
        { headers: { Authorization: `Bearer ${installation.botToken}` } }
      );
      if (!res.ok) return null;

      const data = (await res.json()) as {
        ok: boolean;
        user?: {
          id: string;
          name: string;
          real_name?: string;
          profile?: { display_name?: string; real_name?: string; email?: string };
        };
      };
      if (!data.ok || !data.user) return null;

      return {
        id: data.user.id,
        name: data.user.name,
        realName:
          data.user.profile?.real_name ??
          data.user.real_name ??
          data.user.name,
        email: data.user.profile?.email,
      };
    } catch {
      return null;
    }
  };
}

interface ThreadState extends Record<string, unknown> {
  lastBookingContext?: string;
}

const globalForBot = globalThis as unknown as {
  _slackAdapter?: ReturnType<typeof createSlackAdapter>;
  _chatBot?: Chat;
};

if (!globalForBot._slackAdapter) {
  globalForBot._slackAdapter = createSlackAdapter({
    clientId: process.env.SLACK_CLIENT_ID!,
    clientSecret: process.env.SLACK_CLIENT_SECRET!,
    encryptionKey: process.env.SLACK_ENCRYPTION_KEY,
    logger: botLogger,
  });
}

if (!globalForBot._chatBot) {
  const adapters = {
    slack: globalForBot._slackAdapter,
    ...(process.env.TELEGRAM_BOT_TOKEN && {
      telegram: createTelegramAdapter({
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        userName: process.env.TELEGRAM_BOT_USERNAME,
        mode: "webhook",
        logger: botLogger,
        ...(process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN && {
          secretToken: process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN,
        }),
        ...(process.env.TELEGRAM_API_BASE_URL && {
          apiBaseUrl: process.env.TELEGRAM_API_BASE_URL,
        }),
      }),
    }),
  } as const;

  const logger = botLogger;
  // Use "chat-sdk" (state adapter default) so Slack installation tokens are found.
  // REDIS_KEY_PREFIX overrides only when explicitly set (e.g. for multi-tenant).
  const state = process.env.REDIS_URL
    ? process.env.REDIS_USE_IOREDIS === "true"
      ? createIoRedisState({
          url: process.env.REDIS_URL,
          keyPrefix: process.env.REDIS_KEY_PREFIX ?? "chat-sdk",
          logger,
        })
      : createRedisState({
          url: process.env.REDIS_URL,
          keyPrefix: process.env.REDIS_KEY_PREFIX ?? "chat-sdk",
        })
    : createMemoryState();

  globalForBot._chatBot = new Chat<typeof adapters, ThreadState>({
    userName: "calcom",
    adapters,
    state,
    streamingUpdateIntervalMs: 400, // Tuned for both Slack and Telegram fallback post+edit
    logger,
  });

  globalForBot._chatBot.registerSingleton();
}

export const slackAdapter = globalForBot._slackAdapter;
export const bot = globalForBot._chatBot;
export { botLogger };

// Clear handlers from previous hot reloads before re-registering.
// Next.js dev mode re-executes this module on HMR; without this, handlers would stack.
// Relies on Chat SDK internal structure; may need updates on SDK upgrades.
const b = bot as unknown as Record<string, unknown>;
for (const key of Object.keys(b)) {
  const val = b[key];
  if (key.endsWith("Handlers") && Array.isArray(val) && typeof val.length === "number") {
    val.length = 0;
  }
}

// ─── Platform context extraction ────────────────────────────────────────────

interface PlatformContext {
  platform: string;
  teamId: string;
  userId: string;
}

function extractSlackTeamId(raw: unknown): string {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (typeof r.team === "string") return r.team;
    if (r.team && typeof r.team === "object") {
      const t = r.team as Record<string, unknown>;
      if (typeof t.id === "string") return t.id;
    }
    if (typeof r.team_id === "string") return r.team_id;
  }
  return "";
}

function extractPlatformContext(source: {
  adapter: { name: string };
  raw?: unknown;
  user?: { userId: string };
  message?: { author: { userId: string }; raw: unknown };
}): PlatformContext {
  const platform = source.adapter.name;
  const userId = source.user?.userId ?? source.message?.author.userId ?? "";
  const raw = source.raw ?? source.message?.raw;
  const teamId = platform === "slack" ? extractSlackTeamId(raw) : platform;
  return { platform, teamId, userId };
}

function extractContext(
  thread: { adapter: { name: string } },
  message: { author: { userId: string }; raw: unknown }
): PlatformContext {
  return extractPlatformContext({ adapter: thread.adapter, message });
}

function extractTeamIdFromRaw(raw: unknown, adapterName?: string): string {
  if (adapterName === "telegram") return "telegram";
  return extractSlackTeamId(raw);
}

function extractPlatformContextFromEvent(event: {
  adapter: { name: string };
  raw: unknown;
  user: { userId: string };
}): PlatformContext {
  return extractPlatformContext(event);
}

// ─── Build conversation history from thread messages ────────────────────────
// Uses thread.messages (newest first, auto-paginates) per docs/usage.mdx.
// We collect the 20 most recent, reverse to chronological order for the model.
async function buildHistory(thread: Thread): Promise<ModelMessage[]> {
  try {
    const collected: ModelMessage[] = [];
    for await (const msg of thread.messages) {
      if (collected.length >= 20) break;
      if (msg.text.trim()) {
        collected.push({
          role: (msg.author.isMe ? "assistant" : "user") as "assistant" | "user",
          content: msg.text,
        });
      }
    }
    return collected.reverse();
  } catch {
    return [];
  }
}

// ─── Helper: detect "aside" messages to ignore ─────────────────────────────

function isAsideMessage(text: string): boolean {
  return /^\s*aside\b/i.test(text);
}

function handleSlackAuthError(err: unknown): boolean {
  if (
    err instanceof Error &&
    "code" in err &&
    (err as Record<string, unknown>).code === "slack_webapi_platform_error"
  ) {
    const slackErr = (err as Record<string, unknown>).data as Record<string, unknown> | undefined;
    if (slackErr?.error === "not_authed" || slackErr?.error === "invalid_auth") {
      botLogger.error("Slack auth error — workspace may need reinstall", err);
      return true;
    }
  }
  return false;
}

/** Wraps async handlers with consistent LockError, RateLimitError, adapter errors, and Slack auth error handling. */
async function withBotErrorHandling(
  fn: () => Promise<void>,
  options: {
    postError: (message: string) => Promise<unknown>;
    logContext?: string;
    getCustomErrorMessage?: (err: unknown) => string | undefined;
  }
): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if (err instanceof LockError) return;
    if (err instanceof RateLimitError) {
      botLogger.warn("Rate limited", err.retryAfterMs);
      await options.postError("I'm being rate-limited right now. Please try again in a moment.").catch(() => {});
      return;
    }
    if (err instanceof AdapterRateLimitError) {
      botLogger.warn("Adapter rate limited", err.adapter, err.retryAfter);
      await options.postError("I'm being rate-limited right now. Please try again in a moment.").catch(() => {});
      return;
    }
    if (err instanceof AuthenticationError) {
      botLogger.error("Authentication error", err.adapter, err.message);
      await options.postError("There was an authentication issue. Please try reconnecting your account.").catch(() => {});
      return;
    }
    if (err instanceof ResourceNotFoundError) {
      botLogger.warn("Resource not found", err.adapter, err.resourceType, err.resourceId);
      await options.postError("The requested resource wasn't found. It may have been deleted.").catch(() => {});
      return;
    }
    if (err instanceof PermissionError) {
      botLogger.error("Permission error", err.adapter, err.action, err.requiredScope);
      await options.postError("I don't have permission to do that. Please check the app's permissions.").catch(() => {});
      return;
    }
    if (err instanceof ValidationError) {
      botLogger.warn("Validation error", err.adapter, err.message);
      await options.postError("There was a problem with the request. Please try again.").catch(() => {});
      return;
    }
    if (err instanceof NetworkError) {
      botLogger.error("Network error", err.adapter, err.message, err.originalError);
      await options.postError("I'm having trouble connecting. Please try again in a moment.").catch(() => {});
      return;
    }
    if (err instanceof NotImplementedError) {
      botLogger.warn("Feature not supported", err.feature);
      return;
    }
    if (handleSlackAuthError(err)) return;
    // AI/LLM rate limit (e.g. Groq tokens-per-day) — show friendly message
    if (isAIRateLimitError(err)) {
      botLogger.warn("AI rate limit", err);
      await options.postError("I've hit my daily token limit. Please try again later when the limit resets.").catch(() => {});
      return;
    }
    botLogger.error(options.logContext ? `Error in ${options.logContext}` : "Error", err);
    const customMsg = options.getCustomErrorMessage?.(err);
    await options.postError(customMsg ?? "Sorry, something went wrong. Please try again.").catch((postErr) => {
      botLogger.error("Failed to post error message to user", { postErr, originalErr: err });
    });
  }
}

// ─── Helper: post OAuth link prompt ─────────────────────────────────────────

function oauthLinkMessage(platform: string, teamId: string, userId: string) {
  const authUrl = generateAuthUrl(platform, teamId, userId);
  return Card({
    title: "Connect Your Cal.com Account",
    children: [
      Actions([
        LinkButton({
          url: authUrl,
          label: "Continue with Cal.com",
        }),
      ]),
    ],
  });
}

function getSlackAdapter(): SlackAdapter {
  return bot.getAdapter("slack") as SlackAdapter;
}

export function getTelegramAdapter(): TelegramAdapter | null {
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  const adapter = bot.getAdapter("telegram");
  return adapter ? (adapter as TelegramAdapter) : null;
}

/** Telegram typing indicator lasts ~5s. Refresh it every 4s during long agent runs. */
async function withTelegramTypingRefresh(
  thread: Thread,
  platform: string,
  fn: () => Promise<void>
): Promise<void> {
  await thread.startTyping();
  if (platform !== "telegram") return fn();
  return (async () => {
    await thread.startTyping();
    const interval = setInterval(() => thread.startTyping().catch(() => {}), 4000);
    try {
      await fn();
    } finally {
      clearInterval(interval);
    }
  })();
}

// Streaming flow (see chat/docs/streaming.mdx): Slack uses the native chatStream API via
// adapter.stream() with stopBlocks for the Retry button; other platforms use the post+edit
// fallback via thread.post(textStream).
// For Telegram we use result.text (Promise) instead of consuming textStream — the AI SDK
// textStream can yield empty when used with multi-step tool calls; result.text resolves to the full text.
async function postAgentStream(
  thread: Thread,
  agentResult: { textStream: AsyncIterable<string>; text: PromiseLike<string> },
  ctx: PlatformContext
): Promise<void> {
  const log = bot.getLogger("stream");
  log.info("Posting agent stream", { platform: ctx.platform, userId: ctx.userId, teamId: ctx.teamId, threadId: thread.id });
  try {
    if (ctx.platform === "slack") {
      const slack = getSlackAdapter();
      await slack.stream(thread.id, agentResult.textStream, {
        recipientUserId: ctx.userId,
        recipientTeamId: ctx.teamId,
        stopBlocks: RETRY_STOP_BLOCKS,
      });
      log.info("Slack stream completed", { userId: ctx.userId });
    } else {
      if (ctx.platform === "telegram") {
        const fullText = await agentResult.text;
        const formatted = formatForTelegram(fullText ?? "");
        if (!formatted.trim()) {
          log.warn("Agent produced empty text, posting fallback", { userId: ctx.userId });
          await thread.post("Sorry, I couldn't generate a response. Please try again.");
        } else {
          // Wrap in Card so the adapter uses parse_mode=Markdown; plain text gets no parse_mode and links don't render.
          await thread.post(
            Card({
              children: [
                CardText(formatted),
                Actions([Button({ id: "retry_response", label: "Retry" })]),
              ],
            })
          );
        }
      } else {
        await thread.post(agentResult.textStream as unknown as string);
      }
      log.info("Stream posted", { platform: ctx.platform, userId: ctx.userId });
    }
  } catch (err) {
    log.error("Stream failed", { err, platform: ctx.platform, userId: ctx.userId, threadId: thread.id });
    throw err;
  }
}

// ─── Telegram commands (/start, /help, /link, /unlink; /cal as Slack alias) ───

registerTelegramHandlers(bot, {
  withBotErrorHandling,
  extractContext,
});

// ─── Telegram freeform messages (1:1 DM; no @mention, so onNewMention doesn't fire) ───
// Catches messages like "show me my bookings" that don't match slash commands.
bot.onNewMessage(/[\s\S]+/, async (thread, message) => {
  if (thread.adapter.name !== "telegram") return;
  if (/^\/(cal\s+)?(start|help|link|unlink|bookings|availability)/i.test(message.text.trim())) return;
  if (isAsideMessage(message.text)) return;
  if (!message.text.trim()) return;

  const ctx = extractContext(thread, message);

  bot.getLogger("telegram-freeform").info("Telegram freeform message", { userId: ctx.userId, text: message.text });

  const lastStreamErrorRef = { current: null as Error | null };
  await withBotErrorHandling(
    async () => {
      const linked = await getLinkedUser(ctx.teamId, ctx.userId);
      bot.getLogger("telegram-freeform").info("User link check", { userId: ctx.userId, linked: !!linked });
      if (!linked) {
        await thread.post(oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId));
        return;
      }

      if (!(await thread.isSubscribed())) {
        await thread.subscribe();
      }

      const history = await buildHistory(thread);
      await withTelegramTypingRefresh(thread, ctx.platform, async () => {
        bot.getLogger("telegram-freeform").info("Running agent", { userId: ctx.userId, textLength: message.text.length });
        const result = runAgentStream({
          teamId: ctx.teamId,
          userId: ctx.userId,
          userMessage: message.text,
          conversationHistory: history.slice(0, -1),
          lookupPlatformUser: undefined,
          platform: ctx.platform,
          logger: bot.getLogger("agent"),
          onErrorRef: lastStreamErrorRef,
        });
        await postAgentStream(thread, result, ctx);
      });
    },
    {
      postError: (msg) => thread.post(msg).catch(() => {}),
      logContext: "telegram freeform",
      getCustomErrorMessage: () =>
        lastStreamErrorRef.current && isAIRateLimitError(lastStreamErrorRef.current)
          ? "I've hit my daily token limit. Please try again later when the limit resets."
          : undefined,
    }
  );
});

// ─── Agentic mention handler ────────────────────────────────────────────────

bot.onNewMention(async (thread, message) => {
  if (isAsideMessage(message.text)) return;

  const ctx = extractContext(thread, message);

  bot.getLogger("mention").info("New mention", { platform: ctx.platform, teamId: ctx.teamId, userId: ctx.userId, text: message.text });

  const lastStreamErrorRef = { current: null as Error | null };
  await withBotErrorHandling(
    async () => {
      // Telegram commands handled by onNewMessage
      if (ctx.platform === "telegram" && /^\/(cal\s+)?(start|help|link|unlink|bookings|availability)/i.test(message.text.trim())) return;

      const linked = await getLinkedUser(ctx.teamId, ctx.userId);
      bot.getLogger("mention").info("User link check", { userId: ctx.userId, teamId: ctx.teamId, linked: !!linked });
      if (!linked) {
        bot.getLogger("mention").warn("User not linked, posting ephemeral", { userId: ctx.userId });
        try {
          await thread.postEphemeral(message.author, oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId), { fallbackToDM: true });
          bot.getLogger("mention").info("Ephemeral OAuth link posted", { userId: ctx.userId });
        } catch (ephemeralErr) {
          bot.getLogger("mention").error("Ephemeral post failed", { err: ephemeralErr, userId: ctx.userId });
          throw ephemeralErr;
        }
        return;
      }

      if (!(await thread.isSubscribed())) {
        await thread.subscribe();
      }

      const history = await buildHistory(thread);

      await withTelegramTypingRefresh(thread, ctx.platform, async () => {
        bot.getLogger("mention").info("Running agent", { userId: ctx.userId, textLength: message.text.length });
        const result = runAgentStream({
          teamId: ctx.teamId,
          userId: ctx.userId,
          userMessage: message.text,
          conversationHistory: history.slice(0, -1),
          lookupPlatformUser: ctx.platform === "slack" ? makeLookupSlackUser(ctx.teamId) : undefined,
          platform: ctx.platform,
          logger: bot.getLogger("agent"),
          onErrorRef: lastStreamErrorRef,
        });
        await postAgentStream(thread, result, ctx);
      });
    },
    {
      postError: (msg) => thread.post(msg).catch(() => {}),
      logContext: "handling mention",
      getCustomErrorMessage: () =>
        lastStreamErrorRef.current && isAIRateLimitError(lastStreamErrorRef.current)
          ? "I've hit my daily token limit. Please try again later when the limit resets."
          : undefined,
    }
  );
});

// ─── Agentic thread follow-up ───────────────────────────────────────────────

bot.onSubscribedMessage(async (thread, message) => {
  if (message.author.isBot || message.author.isMe) return;
  if (isAsideMessage(message.text)) return;

  const ctx = extractContext(thread, message);

  bot.getLogger("thread-follow-up").info("Thread follow-up", {
    platform: ctx.platform,
    teamId: ctx.teamId,
    userId: ctx.userId,
    text: message.text,
    isMention: message.isMention ?? false,
  });

  const lastStreamErrorRef = { current: null as Error | null };
  await withBotErrorHandling(
    async () => {
      const linked = await getLinkedUser(ctx.teamId, ctx.userId);
      bot.getLogger("thread-follow-up").info("User link check", { userId: ctx.userId, teamId: ctx.teamId, linked: !!linked });
      if (!linked) {
        bot.getLogger("thread-follow-up").warn("User not linked, posting ephemeral", { userId: ctx.userId });
        try {
          await thread.postEphemeral(message.author, oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId), { fallbackToDM: true });
          bot.getLogger("thread-follow-up").info("Ephemeral OAuth link posted", { userId: ctx.userId });
        } catch (ephemeralErr) {
          bot.getLogger("thread-follow-up").error("Ephemeral post failed", { err: ephemeralErr, userId: ctx.userId });
          throw ephemeralErr;
        }
        return;
      }

      if (message.isMention && !(await thread.isSubscribed())) {
        await thread.subscribe();
      }

      const history = await buildHistory(thread);

      await withTelegramTypingRefresh(thread, ctx.platform, async () => {
        bot.getLogger("thread-follow-up").info("Running agent", { userId: ctx.userId, textLength: message.text.length });
        const result = runAgentStream({
          teamId: ctx.teamId,
          userId: ctx.userId,
          userMessage: message.text,
          conversationHistory: history.slice(0, -1),
          lookupPlatformUser: ctx.platform === "slack" ? makeLookupSlackUser(ctx.teamId) : undefined,
          platform: ctx.platform,
          logger: bot.getLogger("agent"),
          onErrorRef: lastStreamErrorRef,
        });
        await postAgentStream(thread, result, ctx);
      });
    },
    {
      postError: (msg) => thread.post(msg).catch(() => {}),
      logContext: "thread follow-up",
      getCustomErrorMessage: () =>
        lastStreamErrorRef.current && isAIRateLimitError(lastStreamErrorRef.current)
          ? "I've hit my daily token limit. Please try again later when the limit resets."
          : undefined,
    }
  );
});

// ─── Reaction handler (Slack) ───────────────────────────────────────────────
// Acknowledge thumbs_up on messages; Telegram reactions may differ.
bot.onReaction(["thumbs_up", "+1"], async (event) => {
  if (event.adapter.name !== "slack" || !event.added) return;
  try {
    await event.adapter.addReaction(
      event.threadId,
      event.messageId,
      emoji.check
    );
  } catch {
    // Ignore reaction failures (e.g. rate limit, unsupported)
  }
});

// ─── Slack-only handlers (App Home, slash commands, modals, actions) ────────
// Intentional: handlers check event.adapter.name !== "slack" and return early.
registerSlackHandlers(bot, getSlackAdapter, {
  postAgentStream,
  withBotErrorHandling,
  extractPlatformContextFromEvent,
  extractTeamIdFromRaw,
  buildHistory,
  makeLookupSlackUser,
});
