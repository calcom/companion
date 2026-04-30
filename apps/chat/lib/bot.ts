import { createHash } from "node:crypto";
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
import type { Adapter, Thread } from "chat";
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
import { createSendblueAdapter, type SendblueAdapter } from "chat-adapter-sendblue";
import type { LookupPlatformUserFn, UserContext } from "./agent";
import { isAIRateLimitError, isAIToolCallError, runAgentStream } from "./agent";
import { CalcomApiError, chargeCredits, checkCredits } from "./calcom/client";
import { generateAuthUrl } from "./calcom/oauth";
import { validateRequiredEnv } from "./env";
import { truncateForSendblue } from "./format-for-sendblue";
import { formatForTelegram } from "./format-for-telegram";
import {
  handleSendblueCommand,
  handleSendblueFlowInput,
  registerSendblueHandlers,
} from "./handlers/sendblue";
import { registerSlackHandlers } from "./handlers/slack";
import {
  handleTelegramCommand,
  registerTelegramHandlers,
  TELEGRAM_COMMAND_RE,
} from "./handlers/telegram";
import { logger as botLogger } from "./logger";
import { helpCard, telegramHelpCard } from "./notifications";
import {
  getLinkedUser,
  getToolContext,
  getValidAccessToken,
  setToolContext,
  type ToolContextEntry,
} from "./user-linking";

validateRequiredEnv();

// ─── Named constants ────────────────────────────────────────────────────────
const MAX_THREAD_MESSAGES = 20;
const MAX_TOOL_CONTEXT_ENTRIES = 10;
const STREAMING_UPDATE_INTERVAL_MS = 400;
const TELEGRAM_TYPING_REFRESH_MS = 4000;

function isSendblueConfigured(): boolean {
  return !!(
    process.env.SENDBLUE_API_KEY &&
    process.env.SENDBLUE_API_SECRET &&
    process.env.SENDBLUE_FROM_NUMBER
  );
}

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
    ...(isSendblueConfigured() && {
      // Published chat-adapter-sendblue@0.2.0 bundles newer Chat SDK types.
      // Keep that version skew contained at the adapter boundary until upstream
      // ships a peer-only Chat SDK dependency.
      sendblue: createSendblueAdapter({
        apiKey: process.env.SENDBLUE_API_KEY ?? "",
        apiSecret: process.env.SENDBLUE_API_SECRET ?? "",
        defaultFromNumber: process.env.SENDBLUE_FROM_NUMBER ?? "",
        logger: botLogger,
        ...(process.env.SENDBLUE_WEBHOOK_SECRET && {
          webhookSecret: process.env.SENDBLUE_WEBHOOK_SECRET,
          webhookSecretHeader: "sb-signing-secret",
        }),
        ...(process.env.SENDBLUE_STATUS_CALLBACK_URL && {
          statusCallbackUrl: process.env.SENDBLUE_STATUS_CALLBACK_URL,
        }),
      }) as unknown as Adapter<unknown, unknown>,
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
    streamingUpdateIntervalMs: STREAMING_UPDATE_INTERVAL_MS, // Tuned for both Slack and Telegram fallback post+edit
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
      if (collected.length >= MAX_THREAD_MESSAGES) break;
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
    const richBlock = block as {
      type: "rich_text";
      elements: Array<{ type: string; elements?: SlackRichTextElement[] }>;
    };
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
): Promise<{
  text: string;
  attendees: Array<{ uid: string; name: string; email: string | null }>;
}> {
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
  const merged = [...existing, ...entries].slice(-MAX_TOOL_CONTEXT_ENTRIES);
  await setToolContext(threadId, merged);
}

// ─── Helper: build enriched user message with cached tool data ───────────────
async function buildEnrichedMessage(userMessage: string, threadId: string): Promise<string> {
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

function friendlyCalcomError(err: CalcomApiError, context?: string): string {
  const apiDetail =
    err.message && !err.message.startsWith("Cal.com API error:") ? ` (${err.message})` : "";

  switch (err.statusCode) {
    case 400:
      return `The request had invalid data${apiDetail}. Please check the details and try again.`;
    case 401:
    case 403:
      return "Your Cal.com session has expired. Please reconnect your account to continue.";
    case 404:
      return `The requested resource was not found${apiDetail}. It may have been deleted or the ID is incorrect.`;
    case 409:
      return context === "booking"
        ? "This time slot is no longer available \u2014 someone else may have just booked it. Would you like me to check for other available times?"
        : `There was a conflict${apiDetail}. The resource may have been modified. Please try again.`;
    case 422:
      return `The request was missing required information${apiDetail}. Please provide all required fields and try again.`;
    case 429:
      return "Cal.com's rate limit has been reached. Please wait about 30 seconds and try again.";
    default:
      if (err.statusCode && err.statusCode >= 500) {
        return err.code === "FETCH_RETRY_EXHAUSTED"
          ? "Cal.com is not responding after multiple attempts. The service may be temporarily down \u2014 please try again in a few minutes."
          : "Cal.com is experiencing issues right now. Please try again in a moment.";
      }
      return `Something went wrong with the Cal.com API${apiDetail}. Please try again.`;
  }
}

function agentStreamErrorMessage(lastStreamErrorRef: {
  current: Error | null;
}): (err: unknown) => string | undefined {
  return (err) => {
    if (!lastStreamErrorRef.current) return undefined;
    if (isAIRateLimitError(lastStreamErrorRef.current))
      return "I've hit my daily token limit. Please try again later when the limit resets.";
    if (isAIToolCallError(lastStreamErrorRef.current))
      return "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID).";
    if (lastStreamErrorRef.current instanceof CalcomApiError)
      return friendlyCalcomError(lastStreamErrorRef.current);
    if (isSlackAuthError(err))
      return "Sorry, something went wrong while processing your request. Please try again.";
    return undefined;
  };
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
    // Check for a custom error message from the handler (e.g. captured AI stream error)
    // before falling through to generic handlers — callers can provide context-specific
    // messages (e.g. friendlyCalcomError with "booking" context for 409 conflicts).
    const customMsg = options.getCustomErrorMessage?.(err);
    if (customMsg) {
      botLogger.error(options.logContext ? `Error in ${options.logContext}` : "Error", err);
      await options.postError(customMsg).catch((postErr) => {
        botLogger.error("Failed to post error message to user", { postErr, originalErr: err });
      });
      return;
    }
    // Cal.com API errors — show status-specific messages (after custom handler so
    // callers like the booking modal can provide context-aware messages first)
    if (err instanceof CalcomApiError) {
      botLogger.warn("Cal.com API error", { statusCode: err.statusCode, message: err.message });
      await options.postError(friendlyCalcomError(err)).catch(() => {});
      return;
    }
    if (isSlackAuthError(err)) {
      botLogger.error("Slack auth error — workspace may need reinstall", err);
      await options
        .postError(
          "Sorry, I'm having trouble connecting to Slack right now. If this persists, please ask your workspace admin to reinstall the Cal.com app."
        )
        .catch(() => {});
      return;
    }
    botLogger.error(options.logContext ? `Error in ${options.logContext}` : "Error", err);
    await options.postError("Sorry, something went wrong. Please try again.").catch((postErr) => {
      botLogger.error("Failed to post error message to user", { postErr, originalErr: err });
    });
  }
}

// ─── Helper: post OAuth link prompt ─────────────────────────────────────────

function oauthLinkMessage(
  platform: string,
  teamId: string,
  userId: string,
  reason?: "expired" | "not_linked"
) {
  const authUrl = generateAuthUrl(platform, teamId, userId);
  const title =
    reason === "expired" ? "Your Cal.com Session Has Expired" : "Connect Your Cal.com Account";
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
  } else if (ctx.platform === "sendblue") {
    const authUrl = generateAuthUrl(ctx.platform, ctx.teamId, ctx.userId);
    const title =
      reason === "expired"
        ? "Your Cal.com session has expired. Reconnect here:"
        : "Connect your Cal.com account here:";
    await thread.post(`${title}\n${authUrl}`);
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

export function getSendblueAdapter(): SendblueAdapter | null {
  if (!isSendblueConfigured()) return null;
  const adapter = bot.getAdapter("sendblue");
  return adapter ? (adapter as SendblueAdapter) : null;
}

function isSendblueGroupThread(threadId: string): boolean {
  const adapter = getSendblueAdapter();
  if (!adapter) return false;
  try {
    return !!adapter.decodeThreadId(threadId).groupId;
  } catch {
    return false;
  }
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
    const interval = setInterval(
      () => thread.startTyping().catch(() => {}),
      TELEGRAM_TYPING_REFRESH_MS
    );
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

/** Returns true when the agent response warrants a Retry button (error, tool failure, or empty output). */
function shouldShowRetry(
  onErrorRef: { current: Error | null } | undefined,
  steps: unknown[] | undefined
): boolean {
  if (onErrorRef?.current) return true;
  if (steps) {
    for (const step of steps) {
      const s = step as Record<string, unknown>;
      if (!Array.isArray(s.toolResults)) continue;
      for (const tr of s.toolResults) {
        const r = tr as Record<string, unknown>;
        if (r.result && typeof r.result === "object" && "error" in (r.result as object)) {
          return true;
        }
      }
    }
  }
  return false;
}

// Streaming flow (see chat/docs/streaming.mdx): Slack uses the native chatStream API via
// adapter.stream(); other platforms use the post+edit fallback via thread.post(textStream).
// For Telegram we use result.text (Promise) instead of consuming textStream — the AI SDK
// textStream can yield empty when used with multi-step tool calls; result.text resolves to the full text.
// The Retry button is only shown when shouldShowRetry detects an error signal (stream error,
// tool call error, or empty response).
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
        });
        log.info("Slack stream completed", { userId: ctx.userId });
        const steps = agentResult.steps ? await agentResult.steps : undefined;
        if (shouldShowRetry(options?.onErrorRef, steps)) {
          await thread.post(
            Card({ children: [Actions([Button({ id: "retry_response", label: "Retry" })])] })
          );
        }
      });
    } else {
      if (ctx.platform === "telegram") {
        const fullText = await agentResult.text;
        const steps = agentResult.steps ? await agentResult.steps : undefined;
        const showRetry = shouldShowRetry(options?.onErrorRef, steps);
        const formatted = formatForTelegram(fullText ?? "");
        if (!formatted.trim()) {
          log.warn("Agent produced empty text, posting fallback", { userId: ctx.userId });
          const fallbackMsg =
            options?.onErrorRef?.current && isAIToolCallError(options.onErrorRef.current)
              ? "I had trouble processing that request. Please try again, or be more specific (e.g. run /cal bookings first, then cancel by booking ID)."
              : "Sorry, I couldn't generate a response. Please try again.";
          await thread.post(
            Card({
              children: [
                CardText(fallbackMsg),
                Actions([Button({ id: "retry_response", label: "Retry" })]),
              ],
            })
          );
        } else {
          // Wrap in Card so the adapter uses parse_mode=Markdown; plain text gets no parse_mode and links don't render.
          await thread.post(
            Card({
              children: [
                CardText(formatted),
                ...(showRetry ? [Actions([Button({ id: "retry_response", label: "Retry" })])] : []),
              ],
            })
          );
        }
      } else if (ctx.platform === "sendblue") {
        const fullText = await agentResult.text;
        const steps = agentResult.steps ? await agentResult.steps : undefined;
        const showRetry = shouldShowRetry(options?.onErrorRef, steps);
        const formatted = truncateForSendblue((fullText ?? "").trim());
        if (!formatted) {
          const fallbackMsg =
            options?.onErrorRef?.current && isAIToolCallError(options.onErrorRef.current)
              ? "I had trouble processing that request. Please try again, or be more specific."
              : "Sorry, I couldn't generate a response. Please try again.";
          await thread.post(`${fallbackMsg}\n\nSend the request again to retry.`);
        } else {
          await thread.post(
            showRetry
              ? `${formatted}\n\nIf this looks wrong, send the request again to retry.`
              : formatted
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
        const merged = [...existing, ...toolEntries].slice(-MAX_TOOL_CONTEXT_ENTRIES);
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
    // If the thrown error is a Slack auth error but the agent stream itself had
    // issues (captured via onErrorRef), the Slack error is a secondary failure
    // caused by AsyncLocalStorage context loss — not a real token problem.
    // Re-throw as a generic error so withBotErrorHandling doesn't misclassify it.
    if (isSlackAuthError(err) && options?.onErrorRef?.current) {
      log.warn("Slack auth error is secondary to stream error, re-throwing as generic", {
        streamError: options.onErrorRef.current.message,
      });
      throw new Error(`Agent stream failed: ${options.onErrorRef.current.message}`);
    }
    throw err;
  }
}

// ─── Shared agent handler ────────────────────────────────────────────────────

interface AgentHandlerOptions {
  thread: Thread;
  ctx: PlatformContext;
  userMessage: string;
  loggerName: string;
  lastStreamErrorRef: { current: Error | null };
  promptIfNotLinked: (reason?: "expired") => Promise<void>;
  shouldSubscribe: () => boolean | Promise<boolean>;
  resolveMentions: boolean;
  persistContext: boolean;
}

async function runAgentHandler(opts: AgentHandlerOptions): Promise<void> {
  const log = bot.getLogger(opts.loggerName);

  let linked = await getLinkedUser(opts.ctx.teamId, opts.ctx.userId);
  log.info("User link check", {
    userId: opts.ctx.userId,
    teamId: opts.ctx.teamId,
    linked: !!linked,
  });
  if (!linked) {
    await opts.promptIfNotLinked();
    return;
  }

  const token = await getValidAccessToken(opts.ctx.teamId, opts.ctx.userId);
  if (!token) {
    log.warn("Token expired/revoked", { userId: opts.ctx.userId });
    await opts.promptIfNotLinked("expired");
    return;
  }

  // Re-read in case token refresh synced org fields from /v2/me
  linked = (await getLinkedUser(opts.ctx.teamId, opts.ctx.userId)) ?? linked;

  try {
    const credits = await checkCredits(token);
    if (!credits.hasCredits) {
      log.info("Agentic blocked — no credits", { userId: opts.ctx.userId });
      const noCreditsMsg =
        opts.ctx.platform === "slack"
          ? "You've run out of AI credits. Use `/cal help` to see available slash commands, or purchase more credits at <https://cal.com/pricing|cal.com/pricing>."
          : opts.ctx.platform === "sendblue"
            ? "You've run out of AI credits. Send /help to see available commands, or purchase more credits at https://cal.com/pricing."
            : "You've run out of AI credits. Use /help to see available commands, or purchase more credits at [cal.com/pricing](https://cal.com/pricing).";
      if (opts.ctx.platform === "slack") {
        await withSlackToken(opts.ctx.teamId, () => opts.thread.post(noCreditsMsg));
      } else {
        await opts.thread.post(noCreditsMsg);
      }
      return;
    }
  } catch (err) {
    // If credits endpoint is unavailable, allow the request through
    // so existing org-plan users aren't blocked during rollout.
    log.warn("Credits check failed, allowing request", {
      userId: opts.ctx.userId,
      error: String(err),
    });
  }

  if (await opts.shouldSubscribe()) {
    if (!(await opts.thread.isSubscribed())) {
      await opts.thread.subscribe();
    }
  }

  const userContext = buildUserContext(linked);

  let resolvedMessage = opts.userMessage;
  if (opts.resolveMentions && opts.ctx.platform === "slack") {
    const { text, attendees } = await preResolveMentions(opts.userMessage, opts.ctx.teamId, log);
    resolvedMessage = text;
    if (opts.persistContext) {
      await persistBookingContext(opts.thread.id, opts.userMessage, attendees);
    }
  } else if (opts.persistContext && ASAP_PATTERN.test(opts.userMessage)) {
    await persistBookingContext(opts.thread.id, opts.userMessage, []);
  }

  const enrichedMessage = await buildEnrichedMessage(resolvedMessage, opts.thread.id);
  const rawHistory = await buildHistory(opts.thread);

  await withTelegramTypingRefresh(opts.thread, opts.ctx.platform, async () => {
    log.info("Running agent", { userId: opts.ctx.userId, textLength: enrichedMessage.length });
    const result = runAgentStream({
      teamId: opts.ctx.teamId,
      userId: opts.ctx.userId,
      userMessage: enrichedMessage,
      conversationHistory: rawHistory.slice(0, -1),
      lookupPlatformUser:
        opts.ctx.platform === "slack" ? makeLookupSlackUser(opts.ctx.teamId) : undefined,
      platform: opts.ctx.platform,
      logger: bot.getLogger("agent"),
      onErrorRef: opts.lastStreamErrorRef,
      userContext,
    });
    await postAgentStream(opts.thread, result, opts.ctx, {
      onErrorRef: opts.lastStreamErrorRef,
    });

    // Charge credits after successful agent completion
    const msgHash = createHash("sha256").update(opts.userMessage).digest("hex").slice(0, 12);
    const externalRef = `agent-${opts.ctx.platform}-${opts.thread.id}-${msgHash}`;
    try {
      const chargeResult = await chargeCredits(token, { externalRef });
      log.info("Credits charged", {
        userId: opts.ctx.userId,
        externalRef,
        remaining: chargeResult.remainingBalance,
      });

      // Warn if balance is running low
      if (chargeResult.remainingBalance) {
        const remaining =
          chargeResult.remainingBalance.monthlyRemaining + chargeResult.remainingBalance.additional;
        if (remaining < 10) {
          const lowBalanceMsg =
            opts.ctx.platform === "slack"
              ? `_Your AI credits are running low (${remaining} remaining). Visit <https://cal.com/settings/billing|cal.com/settings/billing> to purchase more._`
              : opts.ctx.platform === "sendblue"
                ? `Your AI credits are running low (${remaining} remaining). Visit https://cal.com/settings/billing to purchase more.`
                : `_Your AI credits are running low (${remaining} remaining). Visit [cal.com/settings/billing](https://cal.com/settings/billing) to purchase more._`;
          if (opts.ctx.platform === "slack") {
            await withSlackToken(opts.ctx.teamId, () => opts.thread.post(lowBalanceMsg));
          } else {
            await opts.thread.post(lowBalanceMsg);
          }
        }
      }
    } catch (err) {
      // Don't fail the interaction if charging fails — log and continue
      log.warn("Failed to charge credits", {
        userId: opts.ctx.userId,
        externalRef,
        error: String(err),
      });
    }
  });
}

// ─── Telegram commands (/start, /help, /link, /unlink; /cal as Slack alias) ───

registerTelegramHandlers(bot, {
  withBotErrorHandling,
  extractContext,
});

registerSendblueHandlers(bot, {
  withBotErrorHandling,
  extractContext,
});

// ─── Telegram freeform messages (1:1 DM only) ───────────────────────────────
// Only handles DMs. Group messages are handled by onNewMention (unsubscribed)
// or onSubscribedMessage (subscribed). Even if the bot is a group admin and
// receives all messages, we only want to respond to @mentions in groups.
bot.onNewMessage(/[\s\S]+/, async (thread, message) => {
  if (thread.adapter.name !== "telegram" && thread.adapter.name !== "sendblue") return;
  if (message.author.isBot || message.author.isMe) return;
  if (thread.adapter.name === "telegram" && TELEGRAM_COMMAND_RE.test(message.text.trim())) return;
  if (isAsideMessage(message.text)) return;

  if (thread.adapter.name === "sendblue") {
    if (isSendblueGroupThread(thread.id)) return;
    if (message.text.trim().startsWith("/")) return;
    if (await handleSendblueFlowInput(thread, message, { withBotErrorHandling, extractContext }))
      return;
  }

  // Restrict to DMs only — group messages (subscribed or not) are handled elsewhere.
  const isGroupThread =
    thread.adapter.name === "telegram" && thread.id !== `telegram:${message.author.userId}`;
  if (isGroupThread) return;

  const ctx = extractContext(thread, message);

  bot
    .getLogger(`${ctx.platform}-freeform`)
    .info("DM message", { platform: ctx.platform, userId: ctx.userId, text: message.text });

  // Empty text means the user sent only "@botname" with no additional text. Show help.
  if (!message.text.trim()) {
    await thread.post(
      ctx.platform === "telegram" ? telegramHelpCard() : "Send /help to see available commands."
    );
    return;
  }

  const lastStreamErrorRef = { current: null as Error | null };
  await withBotErrorHandling(
    () =>
      runAgentHandler({
        thread,
        ctx,
        userMessage: message.text,
        loggerName: `${ctx.platform}-freeform`,
        lastStreamErrorRef,
        promptIfNotLinked: (reason) => promptUserToLink(thread, message.author, ctx, reason),
        shouldSubscribe: () => true,
        resolveMentions: false,
        persistContext: true,
      }),
    {
      postError: (msg) => thread.post(msg).catch(() => {}),
      logContext: `${ctx.platform} freeform`,
      getCustomErrorMessage: agentStreamErrorMessage(lastStreamErrorRef),
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

  if (ctx.platform === "sendblue") {
    if (isSendblueGroupThread(thread.id)) return;
    if (await handleSendblueCommand(thread, message, { withBotErrorHandling, extractContext }))
      return;
    if (await handleSendblueFlowInput(thread, message, { withBotErrorHandling, extractContext }))
      return;
  }

  // For Slack: reconstruct <@USER_ID> mentions from raw blocks (the SDK resolves
  // them to display names in message.text, losing the user ID lookup_platform_user needs).
  // Also handles mailto: email links. Falls back to normalizeSlackText if no blocks.
  // For Telegram: strip the leading @botname the adapter doesn't strip automatically.
  const userMessage =
    ctx.platform === "telegram"
      ? message.text.replace(/^@\S+\s*/, "").trim()
      : ctx.platform === "sendblue"
        ? message.text.trim()
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
      if (ctx.platform === "telegram" && TELEGRAM_COMMAND_RE.test(userMessage)) return;

      // Empty text means user only sent "@botname" with no additional message — show help.
      if (!userMessage) {
        await thread.post(
          ctx.platform === "telegram"
            ? telegramHelpCard()
            : ctx.platform === "sendblue"
              ? "Send /help to see available commands."
              : helpCard()
        );
        return;
      }

      await runAgentHandler({
        thread,
        ctx,
        userMessage,
        loggerName: "mention",
        lastStreamErrorRef,
        promptIfNotLinked: (reason) => promptUserToLink(thread, message.author, ctx, reason),
        shouldSubscribe: () => true,
        resolveMentions: true,
        persistContext: true,
      });
    },
    {
      postError: safePost,
      logContext: "handling mention",
      getCustomErrorMessage: agentStreamErrorMessage(lastStreamErrorRef),
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

  // Telegram slash commands should use the dedicated handler, not the agent.
  // In DMs the thread becomes subscribed after the first interaction, so commands
  // like /availability would otherwise fall through to the agent.
  if (ctx.platform === "telegram") {
    const handled = await handleTelegramCommand(thread, message, {
      withBotErrorHandling,
      extractContext,
    });
    if (handled) return;
  }

  if (ctx.platform === "sendblue") {
    if (isSendblueGroupThread(thread.id)) return;
    if (await handleSendblueCommand(thread, message, { withBotErrorHandling, extractContext }))
      return;
    if (await handleSendblueFlowInput(thread, message, { withBotErrorHandling, extractContext }))
      return;
  }

  // For Slack: reconstruct <@USER_ID> mentions from raw blocks (the SDK resolves
  // them to display names in message.text, losing the user ID lookup_platform_user needs).
  // Also handles mailto: email links. Falls back to normalizeSlackText if no blocks.
  // For Telegram: strip the leading @botname the adapter doesn't strip automatically.
  const userMessage =
    ctx.platform === "telegram"
      ? message.text.replace(/^@\S+\s*/, "").trim()
      : ctx.platform === "sendblue"
        ? message.text.trim()
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
    () =>
      runAgentHandler({
        thread,
        ctx,
        userMessage,
        loggerName: "thread-follow-up",
        lastStreamErrorRef,
        promptIfNotLinked: (reason) => promptUserToLink(thread, message.author, ctx, reason),
        shouldSubscribe: () => !!message.isMention,
        resolveMentions: true,
        persistContext: false,
      }),
    {
      postError: safePost,
      logContext: "thread follow-up",
      getCustomErrorMessage: agentStreamErrorMessage(lastStreamErrorRef),
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
  friendlyCalcomError,
});
