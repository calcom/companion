import {
  AdapterRateLimitError,
  AuthenticationError,
  NetworkError,
  PermissionError,
  ResourceNotFoundError,
  ValidationError,
} from "@chat-adapter/shared";
import { createSlackAdapter, type SlackAdapter } from "@chat-adapter/slack";
import { createIoRedisState } from "@chat-adapter/state-ioredis";
import { createMemoryState } from "@chat-adapter/state-memory";
import { createRedisState } from "@chat-adapter/state-redis";
import { createTelegramAdapter, type TelegramAdapter } from "@chat-adapter/telegram";
import type { ModelMessage } from "ai";
import type { Thread } from "chat";
import {
  Actions,
  Button,
  Card,
  CardText,
  Chat,
  emoji,
  LinkButton,
  LockError,
  NotImplementedError,
  RateLimitError,
} from "chat";
import type { LookupPlatformUserFn, UserContext } from "./agent";
import { detectToolSet, isAIRateLimitError, isAIToolCallError, runAgentStream } from "./agent";
import { generateAuthUrl } from "./calcom/oauth";
import { validateRequiredEnv } from "./env";
import { formatForTelegram } from "./format-for-telegram";
import { RETRY_STOP_BLOCKS, registerSlackHandlers } from "./handlers/slack";
import { registerTelegramHandlers } from "./handlers/telegram";
import { logger as botLogger } from "./logger";
import { helpCard, telegramHelpCard } from "./notifications";
import { getLinkedUser, getValidAccessToken, getToolContext, setToolContext, type ToolContextEntry } from "./user-linking";

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
        realName: data.user.profile?.real_name ?? data.user.real_name ?? data.user.name,
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
    clientId: process.env.SLACK_CLIENT_ID ?? "",
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
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

// ─── Helper: normalize Slack-mangled links in message text ──────────────────
// Slack auto-converts emails to <mailto:email@x.com|email@x.com> and URLs to
// <https://...|label>. The Chat SDK strips the angle brackets but leaves the
// raw content, so we get "mailto:email@x.com|email@x.com" in message.text.
// This normalizes those back to plain email addresses and URLs.
function normalizeSlackText(text: string): string {
  // mailto:email@x.com|email@x.com → email@x.com
  return text.replace(/mailto:[^\s|]+\|([^\s]+)/g, "$1");
}

// ─── Helper: reconstruct <@USER_ID> mentions from Slack raw blocks ───────────
// The Chat SDK resolves <@U0AC2LAL3PF> to "@displayname" in message.text.
// This loses the user ID, which is the only thing lookup_platform_user can use.
// We rebuild the original <@USER_ID> format by walking the Slack rich_text blocks.
type SlackRichTextElement =
  | { type: "text"; text: string }
  | { type: "user"; user_id: string }
  | { type: "link"; url: string; text?: string }
  | { type: string; [key: string]: unknown };

type SlackBlock =
  | { type: "rich_text"; elements: Array<{ type: string; elements?: SlackRichTextElement[] }> }
  | { type: string; [key: string]: unknown };

function reconstructSlackMentions(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const blocks = r.blocks as SlackBlock[] | undefined;
  if (!Array.isArray(blocks)) return null;

  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type !== "rich_text") continue;
    const richBlock = block as { type: "rich_text"; elements: Array<{ type: string; elements?: SlackRichTextElement[] }> };
    for (const section of richBlock.elements) {
      if (!Array.isArray(section.elements)) continue;
      for (const el of section.elements) {
        if (el.type === "text") {
          parts.push((el as { type: "text"; text: string }).text);
        } else if (el.type === "user") {
          parts.push(`<@${(el as { type: "user"; user_id: string }).user_id}>`);
        } else if (el.type === "link") {
          const linkEl = el as { type: "link"; url: string; text?: string };
          // mailto: links → plain email
          if (linkEl.url.startsWith("mailto:")) {
            parts.push(linkEl.url.slice("mailto:".length));
          } else {
            parts.push(linkEl.text ?? linkEl.url);
          }
        }
      }
    }
  }

  const result = parts.join("").trim();
  return result.length > 0 ? result : null;
}

// ─── Helper: pre-resolve Slack @mentions to name + email ─────────────────────
// Extracts <@USER_ID> patterns from the message, resolves each via Slack API,
// and prepends a [Context: @mentions resolved] block to the user message.
async function preResolveMentions(
  userMessage: string,
  teamId: string,
  logger: ReturnType<typeof bot.getLogger>
): Promise<{ text: string; attendees: Array<{ uid: string; name: string; email: string | null }> }> {
  const mentionPattern = /<@([A-Z0-9]+)>/g;
  const matches = [...userMessage.matchAll(mentionPattern)];
  if (matches.length === 0) return { text: userMessage, attendees: [] };

  const uniqueIds = [...new Set(matches.map((m) => m[1]))];
  const lookup = makeLookupSlackUser(teamId);

  const results = await Promise.all(
    uniqueIds.map(async (uid) => {
      try {
        const profile = await lookup(uid);
        if (!profile) return null;
        return { uid, name: profile.realName ?? profile.name, email: profile.email ?? null };
      } catch {
        return null;
      }
    })
  );

  const resolved = results.filter(
    (r): r is { uid: string; name: string; email: string | null } => r !== null
  );
  if (resolved.length === 0) return { text: userMessage, attendees: [] };

  const contextLines = resolved.map((r) =>
    r.email
      ? `- <@${r.uid}> = "${r.name}" <${r.email}>`
      : `- <@${r.uid}> = "${r.name}" (email not visible)`
  );

  logger.info("Pre-resolved mentions", { resolved: resolved.map((r) => r.uid) });

  return {
    text: `[Context: @mentions resolved]\n${contextLines.join("\n")}\n[End context]\n\n${userMessage}`,
    attendees: resolved,
  };
}

// ─── Helper: build UserContext from linked user data ─────────────────────────
function buildUserContext(linked: {
  calcomEmail: string;
  calcomUsername: string;
  calcomTimeZone: string;
}): UserContext {
  return {
    calcomEmail: linked.calcomEmail,
    calcomUsername: linked.calcomUsername,
    calcomTimeZone: linked.calcomTimeZone,
  };
}

// ─── Helper: persist booking context (ASAP intent + resolved attendees) ──────
const ASAP_PATTERN = /\b(asap|as soon as possible|earliest|next available|soonest)\b/i;

async function persistBookingContext(
  threadId: string,
  userMessage: string,
  attendees: Array<{ uid: string; name: string; email: string | null }>
): Promise<void> {
  const entries: ToolContextEntry[] = [];

  if (ASAP_PATTERN.test(userMessage)) {
    entries.push({
      toolName: "_booking_intent",
      args: {},
      result: { urgency: "asap" },
      timestamp: Date.now(),
    });
  }

  if (attendees.length > 0) {
    entries.push({
      toolName: "_resolved_attendees",
      args: {},
      result: {
        attendees: attendees.map((a) => ({
          name: a.name,
          email: a.email,
          slackUserId: a.uid,
        })),
      },
      timestamp: Date.now(),
    });
  }

  if (entries.length === 0) return;

  const existing = await getToolContext(threadId);
  const merged = [...existing, ...entries].slice(-10);
  await setToolContext(threadId, merged);
}

// ─── Helper: build enriched user message with cached tool data ───────────────
async function buildEnrichedMessage(
  userMessage: string,
  threadId: string
): Promise<string> {
  const entries = await getToolContext(threadId);
  if (entries.length === 0) return userMessage;

  const latestByTool = new Map<string, ToolContextEntry>();
  for (const e of entries) {
    latestByTool.set(e.toolName, e);
  }

  const summary = [...latestByTool.values()]
    .map((e) => `${e.toolName}: ${JSON.stringify(e.result)}`)
    .join("\n");

  return `[CACHED TOOL DATA - DO NOT re-call these tools]\n${summary}\n[END CACHED DATA]\n\n${userMessage}`;
}

function isSlackAuthError(err: unknown): boolean {
  if (
    err instanceof Error &&
    "code" in err &&
    (err as Record<string, unknown>).code === "slack_webapi_platform_error"
  ) {
    const slackErr = (err as Record<string, unknown>).data as Record<string, unknown> | undefined;
    return slackErr?.error === "not_authed" || slackErr?.error === "invalid_auth";
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
      await options
        .postError("I'm being rate-limited right now. Please try again in a moment.")
        .catch(() => {});
      return;
    }
    if (err instanceof AdapterRateLimitError) {
      botLogger.warn("Adapter rate limited", err.adapter, err.retryAfter);
      await options
        .postError("I'm being rate-limited right now. Please try again in a moment.")
        .catch(() => {});
      return;
    }
    if (err instanceof AuthenticationError) {
      botLogger.error("Authentication error", err.adapter, err.message);
      await options
        .postError("There was an authentication issue. Please try reconnecting your account.")
        .catch(() => {});
      return;
    }
    if (err instanceof ResourceNotFoundError) {
      botLogger.warn("Resource not found", err.adapter, err.resourceType, err.resourceId);
      await options
        .postError("The requested resource wasn't found. It may have been deleted.")
        .catch(() => {});
      return;
    }
    if (err instanceof PermissionError) {
      botLogger.error("Permission error", err.adapter, err.action, err.requiredScope);
      await options
        .postError("I don't have permission to do that. Please check the app's permissions.")
        .catch(() => {});
      return;
    }
    if (err instanceof ValidationError) {
      botLogger.warn("Validation error", err.adapter, err.message);
      await options
        .postError("There was a problem with the request. Please try again.")
        .catch(() => {});
      return;
    }
    if (err instanceof NetworkError) {
      botLogger.error("Network error", err.adapter, err.message, err.originalError);
      await options
        .postError("I'm having trouble connecting. Please try again in a moment.")
        .catch(() => {});
      return;
    }
    if (err instanceof NotImplementedError) {
      botLogger.warn("Feature not supported", err.feature);
      return;
    }
    if (isSlackAuthError(err)) {
      botLogger.error("Slack auth error — workspace may need reinstall", err);
      await options
        .postError(
          "The Slack app token has expired or been revoked. Please reinstall the app by visiting the Cal.com app settings."
        )
        .catch(() => {});
      return;
    }
    // AI/LLM rate limit (e.g. Groq tokens-per-day) — show friendly message
    if (isAIRateLimitError(err)) {
      botLogger.warn("AI rate limit", err);
      await options
        .postError("I've hit my daily token limit. Please try again later when the limit resets.")
        .catch(() => {});
      return;
    }
    // Groq tool-call failure (failed_generation) — known intermittent issue
    if (isAIToolCallError(err)) {
      botLogger.warn("AI tool call error", err);
      await options
        .postError(
          "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID)."
        )
        .catch(() => {});
      return;
    }
    botLogger.error(options.logContext ? `Error in ${options.logContext}` : "Error", err);
    const customMsg = options.getCustomErrorMessage?.(err);
    await options
      .postError(customMsg ?? "Sorry, something went wrong. Please try again.")
      .catch((postErr) => {
        botLogger.error("Failed to post error message to user", { postErr, originalErr: err });
      });
  }
}

// ─── Helper: post OAuth link prompt ─────────────────────────────────────────

function oauthLinkMessage(platform: string, teamId: string, userId: string, reason?: "expired" | "not_linked") {
  const authUrl = generateAuthUrl(platform, teamId, userId);
  const title = reason === "expired"
    ? "Your Cal.com Session Has Expired"
    : "Connect Your Cal.com Account";
  return Card({
    title,
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

async function promptUserToLink(
  thread: Thread,
  author: Parameters<Thread["postEphemeral"]>[0],
  ctx: PlatformContext,
  reason: "expired" | "not_linked" = "not_linked"
): Promise<void> {
  const card = oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId, reason);
  if (ctx.platform === "telegram") {
    const isGroup = thread.id !== `telegram:${ctx.userId}`;
    if (isGroup) {
      await thread.post("Please check your DMs to connect your Cal.com account.");
      await thread.postEphemeral(author, card, { fallbackToDM: true });
    } else {
      await thread.post(card);
    }
  } else {
    // Ephemeral messages are unreliable in Slack assistant threads, so post as a
    // regular thread message. The OAuth URL is user-specific and safe to show.
    // Wrap with withSlackToken to ensure the bot token is in context.
    await withSlackToken(ctx.teamId, () => thread.post(card));
  }
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
    const interval = setInterval(() => thread.startTyping().catch(() => {}), 4000);
    try {
      await fn();
    } finally {
      clearInterval(interval);
    }
  })();
}

/**
 * Run an async function with the Slack bot token explicitly set in context.
 * Prevents `not_authed` errors when AsyncLocalStorage context is lost across
 * async boundaries (e.g. Vercel waitUntil, long-running agent streams).
 */
async function withSlackToken<T>(teamId: string, fn: () => Promise<T>): Promise<T> {
  const slack = getSlackAdapter();
  const installation = await slack.getInstallation(teamId);
  if (installation?.botToken) {
    return slack.withBotToken(installation.botToken, fn);
  }
  return fn();
}

// Streaming flow (see chat/docs/streaming.mdx): Slack uses the native chatStream API via
// adapter.stream() with stopBlocks for the Retry button; other platforms use the post+edit
// fallback via thread.post(textStream).
// For Telegram we use result.text (Promise) instead of consuming textStream — the AI SDK
// textStream can yield empty when used with multi-step tool calls; result.text resolves to the full text.
async function postAgentStream(
  thread: Thread,
  agentResult: {
    textStream: AsyncIterable<string>;
    text: PromiseLike<string>;
    steps?: PromiseLike<unknown[]>;
  },
  ctx: PlatformContext,
  options?: { onErrorRef?: { current: Error | null } }
): Promise<void> {
  const log = bot.getLogger("stream");
  log.info("Posting agent stream", {
    platform: ctx.platform,
    userId: ctx.userId,
    teamId: ctx.teamId,
    threadId: thread.id,
  });
  try {
    if (ctx.platform === "slack") {
      const slack = getSlackAdapter();
      await withSlackToken(ctx.teamId, async () => {
        await slack.stream(thread.id, agentResult.textStream, {
          recipientUserId: ctx.userId,
          recipientTeamId: ctx.teamId,
          stopBlocks: RETRY_STOP_BLOCKS,
        });
        log.info("Slack stream completed", { userId: ctx.userId });
      });
    } else {
      if (ctx.platform === "telegram") {
        const fullText = await agentResult.text;
        const formatted = formatForTelegram(fullText ?? "");
        if (!formatted.trim()) {
          log.warn("Agent produced empty text, posting fallback", { userId: ctx.userId });
          const fallbackMsg =
            options?.onErrorRef?.current && isAIToolCallError(options.onErrorRef.current)
              ? "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID)."
              : "Sorry, I couldn't generate a response. Please try again.";
          await thread.post(fallbackMsg);
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

    // Persist tool results to Redis for subsequent turns in this thread
    try {
      if (!agentResult.steps) return;
      const steps = await agentResult.steps;
      const toolEntries: ToolContextEntry[] = [];
      for (const step of steps) {
        const s = step as Record<string, unknown>;
        const toolResults = s.toolResults;
        if (!Array.isArray(toolResults)) continue;
        for (const tr of toolResults) {
          const r = tr as Record<string, unknown>;
          if (typeof r.toolName === "string" && r.args && r.result !== undefined) {
            toolEntries.push({
              toolName: r.toolName,
              args: r.args as Record<string, unknown>,
              result: r.result,
              timestamp: Date.now(),
            });
          }
        }
      }
      if (toolEntries.length > 0) {
        // Merge with existing context (keep last 10 entries to avoid unbounded growth)
        const existing = await getToolContext(thread.id);
        const merged = [...existing, ...toolEntries].slice(-10);
        await setToolContext(thread.id, merged);
        log.info("Tool context persisted", {
          threadId: thread.id,
          newEntries: toolEntries.length,
          totalEntries: merged.length,
        });
      }
    } catch (persistErr) {
      // Non-fatal: tool context persistence failure should not break the response
      log.warn("Failed to persist tool context", { err: persistErr, threadId: thread.id });
    }
  } catch (err) {
    log.error("Stream failed", {
      err,
      platform: ctx.platform,
      userId: ctx.userId,
      threadId: thread.id,
    });
    throw err;
  }
}

// ─── Telegram commands (/start, /help, /link, /unlink; /cal as Slack alias) ───

registerTelegramHandlers(bot, {
  withBotErrorHandling,
  extractContext,
});

// ─── Telegram freeform messages (1:1 DM only) ───────────────────────────────
// Only handles DMs. Group messages are handled by onNewMention (unsubscribed)
// or onSubscribedMessage (subscribed). Even if the bot is a group admin and
// receives all messages, we only want to respond to @mentions in groups.
bot.onNewMessage(/[\s\S]+/, async (thread, message) => {
  if (thread.adapter.name !== "telegram") return;
  if (message.author.isBot || message.author.isMe) return;
  if (/^\/(cal\s+)?(start|help|link|unlink|bookings|availability)/i.test(message.text.trim()))
    return;
  if (isAsideMessage(message.text)) return;

  // Restrict to DMs only — group messages (subscribed or not) are handled elsewhere.
  const isGroupThread = thread.id !== `telegram:${message.author.userId}`;
  if (isGroupThread) return;

  const ctx = extractContext(thread, message);

  bot
    .getLogger("telegram-freeform")
    .info("Telegram DM message", { userId: ctx.userId, text: message.text });

  // Empty text means the user sent only "@botname" with no additional text. Show help.
  if (!message.text.trim()) {
    await thread.post(telegramHelpCard());
    return;
  }

  const lastStreamErrorRef = { current: null as Error | null };
  await withBotErrorHandling(
    async () => {
      const linked = await getLinkedUser(ctx.teamId, ctx.userId);
      bot
        .getLogger("telegram-freeform")
        .info("User link check", { userId: ctx.userId, linked: !!linked });
      if (!linked) {
        await thread.post(oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId));
        return;
      }
      const token = await getValidAccessToken(ctx.teamId, ctx.userId);
      if (!token) {
        bot.getLogger("telegram-freeform").warn("Token expired/revoked", { userId: ctx.userId });
        await thread.post(oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId, "expired"));
        return;
      }

      if (!(await thread.isSubscribed())) {
        await thread.subscribe();
      }

      const userContext = buildUserContext(linked);

      if (ASAP_PATTERN.test(message.text)) {
        await persistBookingContext(thread.id, message.text, []);
      }

      const enrichedMessage = await buildEnrichedMessage(message.text, thread.id);
      const rawHistory = await buildHistory(thread);
      const toolSet = detectToolSet(message.text, rawHistory);

      await withTelegramTypingRefresh(thread, ctx.platform, async () => {
        bot
          .getLogger("telegram-freeform")
          .info("Running agent", { userId: ctx.userId, textLength: enrichedMessage.length });
        const result = runAgentStream({
          teamId: ctx.teamId,
          userId: ctx.userId,
          userMessage: enrichedMessage,
          conversationHistory: rawHistory.slice(0, -1),
          lookupPlatformUser: undefined,
          platform: ctx.platform,
          logger: bot.getLogger("agent"),
          onErrorRef: lastStreamErrorRef,
          userContext,
          toolSet,
        });
        await postAgentStream(thread, result, ctx, { onErrorRef: lastStreamErrorRef });
      });
    },
    {
      postError: (msg) => thread.post(msg).catch(() => {}),
      logContext: "telegram freeform",
      getCustomErrorMessage: () => {
        if (!lastStreamErrorRef.current) return undefined;
        if (isAIRateLimitError(lastStreamErrorRef.current))
          return "I've hit my daily token limit. Please try again later when the limit resets.";
        if (isAIToolCallError(lastStreamErrorRef.current))
          return "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID).";
        return undefined;
      },
    }
  );
});

// ─── Agentic mention handler ────────────────────────────────────────────────
// For Telegram: privacy mode ON means only @mention messages are delivered in
// groups, so onNewMention is the primary group entry point.
// The Telegram adapter does NOT strip the bot @mention from message.text, so
// we strip it here before passing to the agent.

bot.onNewMention(async (thread, message) => {
  if (message.author.isBot || message.author.isMe) return;
  if (isAsideMessage(message.text)) return;

  const ctx = extractContext(thread, message);

  // For Slack: reconstruct <@USER_ID> mentions from raw blocks (the SDK resolves
  // them to display names in message.text, losing the user ID lookup_platform_user needs).
  // Also handles mailto: email links. Falls back to normalizeSlackText if no blocks.
  // For Telegram: strip the leading @botname the adapter doesn't strip automatically.
  const userMessage =
    ctx.platform === "telegram"
      ? message.text.replace(/^@\S+\s*/, "").trim()
      : (reconstructSlackMentions(message.raw) ?? normalizeSlackText(message.text));

  bot.getLogger("mention").info("New mention", {
    platform: ctx.platform,
    teamId: ctx.teamId,
    userId: ctx.userId,
    text: userMessage,
  });

  const lastStreamErrorRef = { current: null as Error | null };
  const safePost = (msg: string) =>
    ctx.platform === "slack"
      ? withSlackToken(ctx.teamId, () => thread.post(msg)).catch(() => {})
      : thread.post(msg).catch(() => {});

  await withBotErrorHandling(
    async () => {
      // Telegram commands handled by onNewMessage (slash command handler)
      if (
        ctx.platform === "telegram" &&
        /^\/(cal\s+)?(start|help|link|unlink|bookings|availability)/i.test(userMessage)
      )
        return;

      const linked = await getLinkedUser(ctx.teamId, ctx.userId);
      bot
        .getLogger("mention")
        .info("User link check", { userId: ctx.userId, teamId: ctx.teamId, linked: !!linked });
      if (!linked) {
        bot.getLogger("mention").warn("User not linked", { userId: ctx.userId });
        await promptUserToLink(thread, message.author, ctx);
        return;
      }
      const token = await getValidAccessToken(ctx.teamId, ctx.userId);
      if (!token) {
        bot.getLogger("mention").warn("Token expired/revoked", { userId: ctx.userId });
        await promptUserToLink(thread, message.author, ctx, "expired");
        return;
      }

      // Empty text means user only sent "@botname" with no additional message — show help.
      if (!userMessage) {
        await thread.post(ctx.platform === "telegram" ? telegramHelpCard() : helpCard());
        return;
      }

      if (!(await thread.isSubscribed())) {
        await thread.subscribe();
      }

      const userContext = buildUserContext(linked);

      // Pre-resolve @mentions for Slack so the agent doesn't need to call lookup_platform_user
      let resolvedMessage = userMessage;
      if (ctx.platform === "slack") {
        const { text, attendees } = await preResolveMentions(userMessage, ctx.teamId, bot.getLogger("mention"));
        resolvedMessage = text;
        await persistBookingContext(thread.id, userMessage, attendees);
      } else if (ASAP_PATTERN.test(userMessage)) {
        await persistBookingContext(thread.id, userMessage, []);
      }

      const enrichedMessage = await buildEnrichedMessage(resolvedMessage, thread.id);
      const rawHistory = await buildHistory(thread);
      const toolSet = detectToolSet(userMessage, rawHistory);

      await withTelegramTypingRefresh(thread, ctx.platform, async () => {
        bot
          .getLogger("mention")
          .info("Running agent", { userId: ctx.userId, textLength: enrichedMessage.length });
        const result = runAgentStream({
          teamId: ctx.teamId,
          userId: ctx.userId,
          userMessage: enrichedMessage,
          conversationHistory: rawHistory.slice(0, -1),
          lookupPlatformUser:
            ctx.platform === "slack" ? makeLookupSlackUser(ctx.teamId) : undefined,
          platform: ctx.platform,
          logger: bot.getLogger("agent"),
          onErrorRef: lastStreamErrorRef,
          userContext,
          toolSet,
        });
        await postAgentStream(thread, result, ctx, { onErrorRef: lastStreamErrorRef });
      });
    },
    {
      postError: safePost,
      logContext: "handling mention",
      getCustomErrorMessage: () => {
        if (!lastStreamErrorRef.current) return undefined;
        if (isAIRateLimitError(lastStreamErrorRef.current))
          return "I've hit my daily token limit. Please try again later when the limit resets.";
        if (isAIToolCallError(lastStreamErrorRef.current))
          return "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID).";
        return undefined;
      },
    }
  );
});

// ─── Agentic thread follow-up ───────────────────────────────────────────────

bot.onSubscribedMessage(async (thread, message) => {
  if (message.author.isBot || message.author.isMe) return;
  if (isAsideMessage(message.text)) return;

  const ctx = extractContext(thread, message);

  // For Telegram group threads: only process @mentions. This ensures the bot
  // doesn't respond to every message when it has admin permissions (which bypass
  // Telegram's privacy mode and deliver all group messages).
  const isTelegramGroup = ctx.platform === "telegram" && thread.id !== `telegram:${ctx.userId}`;
  if (isTelegramGroup && !message.isMention) return;

  // For Slack: reconstruct <@USER_ID> mentions from raw blocks (the SDK resolves
  // them to display names in message.text, losing the user ID lookup_platform_user needs).
  // Also handles mailto: email links. Falls back to normalizeSlackText if no blocks.
  // For Telegram: strip the leading @botname the adapter doesn't strip automatically.
  const userMessage =
    ctx.platform === "telegram"
      ? message.text.replace(/^@\S+\s*/, "").trim()
      : (reconstructSlackMentions(message.raw) ?? normalizeSlackText(message.text));

  bot.getLogger("thread-follow-up").info("Thread follow-up", {
    platform: ctx.platform,
    teamId: ctx.teamId,
    userId: ctx.userId,
    text: userMessage,
    isMention: message.isMention ?? false,
  });

  const lastStreamErrorRef = { current: null as Error | null };
  const safePost = (msg: string) =>
    ctx.platform === "slack"
      ? withSlackToken(ctx.teamId, () => thread.post(msg)).catch(() => {})
      : thread.post(msg).catch(() => {});

  await withBotErrorHandling(
    async () => {
      const linked = await getLinkedUser(ctx.teamId, ctx.userId);
      bot
        .getLogger("thread-follow-up")
        .info("User link check", { userId: ctx.userId, teamId: ctx.teamId, linked: !!linked });
      if (!linked) {
        bot.getLogger("thread-follow-up").warn("User not linked", { userId: ctx.userId });
        await promptUserToLink(thread, message.author, ctx);
        return;
      }
      const token = await getValidAccessToken(ctx.teamId, ctx.userId);
      if (!token) {
        bot.getLogger("thread-follow-up").warn("Token expired/revoked", { userId: ctx.userId });
        await promptUserToLink(thread, message.author, ctx, "expired");
        return;
      }

      if (message.isMention && !(await thread.isSubscribed())) {
        await thread.subscribe();
      }

      const userContext = buildUserContext(linked);

      // Pre-resolve @mentions for Slack so the agent doesn't need to call lookup_platform_user
      let resolvedMessage = userMessage;
      if (ctx.platform === "slack") {
        const { text } = await preResolveMentions(userMessage, ctx.teamId, bot.getLogger("thread-follow-up"));
        resolvedMessage = text;
      }

      const enrichedMessage = await buildEnrichedMessage(resolvedMessage, thread.id);
      const rawHistory = await buildHistory(thread);
      const toolSet = detectToolSet(userMessage, rawHistory);

      await withTelegramTypingRefresh(thread, ctx.platform, async () => {
        bot
          .getLogger("thread-follow-up")
          .info("Running agent", { userId: ctx.userId, textLength: enrichedMessage.length });
        const result = runAgentStream({
          teamId: ctx.teamId,
          userId: ctx.userId,
          userMessage: enrichedMessage,
          conversationHistory: rawHistory.slice(0, -1),
          lookupPlatformUser:
            ctx.platform === "slack" ? makeLookupSlackUser(ctx.teamId) : undefined,
          platform: ctx.platform,
          logger: bot.getLogger("agent"),
          onErrorRef: lastStreamErrorRef,
          userContext,
          toolSet,
        });
        await postAgentStream(thread, result, ctx, { onErrorRef: lastStreamErrorRef });
      });
    },
    {
      postError: safePost,
      logContext: "thread follow-up",
      getCustomErrorMessage: () => {
        if (!lastStreamErrorRef.current) return undefined;
        if (isAIRateLimitError(lastStreamErrorRef.current))
          return "I've hit my daily token limit. Please try again later when the limit resets.";
        if (isAIToolCallError(lastStreamErrorRef.current))
          return "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID).";
        return undefined;
      },
    }
  );
});

// ─── Reaction handler (Slack) ───────────────────────────────────────────────
// Acknowledge thumbs_up on messages; Telegram reactions may differ.
bot.onReaction(["thumbs_up", "+1"], async (event) => {
  if (event.adapter.name !== "slack" || !event.added) return;
  try {
    await event.adapter.addReaction(event.threadId, event.messageId, emoji.check);
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
