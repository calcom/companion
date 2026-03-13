import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { getLogger } from "./logger";
import { getRedisClient } from "./redis";

// ─── At-rest encryption for Redis values ────────────────────────────────────
//
// LinkedUser contains Cal.com OAuth tokens (accessToken, refreshToken) and PII.
// We encrypt the full JSON blob with AES-256-GCM before writing to Redis, using
// SLACK_ENCRYPTION_KEY (already required by env.ts) as the master secret.
// Key is derived via SHA-256 so any string length becomes a valid 32-byte key.
//
// Stored format:  enc:<iv_b64url>:<authTag_b64url>:<ciphertext_b64url>
// The "enc:" prefix lets us detect and transparently read legacy plaintext
// entries written before encryption was introduced (backward compatibility).

function getEncryptionKey(): Buffer {
  const raw = process.env.SLACK_ENCRYPTION_KEY;
  if (!raw) throw new Error("SLACK_ENCRYPTION_KEY is required for at-rest encryption");
  return createHash("sha256").update(raw).digest(); // always 32 bytes → AES-256
}

function encryptData(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12); // 96-bit IV — recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:${iv.toString("base64url")}:${authTag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptData(stored: string): string {
  // Legacy plaintext entries are returned as-is so existing sessions survive the rollover.
  if (!stored.startsWith("enc:")) return stored;

  const parts = stored.slice(4).split(":");
  if (parts.length !== 3) throw new Error("Malformed encrypted Redis value");
  const [ivB64, authTagB64, ciphertextB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(authTagB64, "base64url");
  const ciphertext = Buffer.from(ciphertextB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

const logger = getLogger("user-linking");

// Atomically deletes an email index key only if its current value matches the expected owner.
// Using a Lua script ensures the GET + conditional DEL are a single atomic operation,
// preventing a TOCTOU race where a concurrent relink overwrites the index between the
// ownership check and the delete.
const CAS_DEL_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  else
    return 0
  end
`;

async function deleteEmailIndexIfOwned(
  email: string,
  teamId: string,
  userId: string
): Promise<void> {
  const client = getRedisClient();
  await client.eval(CAS_DEL_SCRIPT, {
    keys: [emailIndexKey(email)],
    arguments: [JSON.stringify({ teamId, userId })],
  });
}

export interface LinkedUser {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number; // Unix timestamp in ms
  calcomUserId: number;
  calcomEmail: string;
  calcomUsername: string;
  calcomTimeZone: string;
  linkedAt: string;
}

function userKey(teamId: string, userId: string): string {
  return `calcom:user:${teamId}:${userId}`;
}

function emailIndexKey(email: string): string {
  return `calcom:email_index:${email.toLowerCase().trim()}`;
}

export async function linkUser(teamId: string, userId: string, data: LinkedUser): Promise<void> {
  const client = getRedisClient();
  const key = userKey(teamId, userId);

  // On re-link with a different Cal.com email, remove the old reverse-lookup entry so
  // booking-notification routing via getLinkedUserByEmail doesn't resolve stale results.
  // The delete is atomic (Lua CAS): if another user has since overwritten the index with
  // their own mapping, the script is a no-op and their entry is preserved.
  const existing = await getLinkedUser(teamId, userId);
  if (existing && existing.calcomEmail !== data.calcomEmail) {
    await deleteEmailIndexIfOwned(existing.calcomEmail, teamId, userId);
  }

  await client.set(key, encryptData(JSON.stringify(data)), {
    EX: 60 * 60 * 24 * 365,
  });
  await client.set(emailIndexKey(data.calcomEmail), JSON.stringify({ teamId, userId }), {
    EX: 60 * 60 * 24 * 365,
  });
  logger.info("User linked", { teamId, userId, calcomEmail: data.calcomEmail });
}

export async function getLinkedUser(teamId: string, userId: string): Promise<LinkedUser | null> {
  const client = getRedisClient();
  const raw = await client.get(userKey(teamId, userId));
  if (!raw) return null;
  try {
    return JSON.parse(decryptData(raw)) as LinkedUser;
  } catch {
    return null;
  }
}

export async function unlinkUser(teamId: string, userId: string): Promise<void> {
  const client = getRedisClient();
  const linked = await getLinkedUser(teamId, userId);
  if (linked) {
    // Atomic CAS delete: only removes the index if it still points to this user.
    await deleteEmailIndexIfOwned(linked.calcomEmail, teamId, userId);
  }
  await client.del(userKey(teamId, userId));
  logger.info("User unlinked", { teamId, userId });
}

export interface LinkedUserByEmail {
  teamId: string;
  userId: string;
}

export async function getLinkedUserByEmail(email: string): Promise<LinkedUserByEmail | null> {
  const client = getRedisClient();
  const raw = await client.get(emailIndexKey(email));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LinkedUserByEmail;
  } catch {
    return null;
  }
}

export async function isUserLinked(teamId: string, userId: string): Promise<boolean> {
  const user = await getLinkedUser(teamId, userId);
  return user !== null;
}

const TOKEN_REFRESH_BUFFER_MS = 2 * 60 * 1000; // refresh 2 min before expiry
const REFRESH_LOCK_TTL = 10; // seconds

/**
 * Returns a valid access token for the user, auto-refreshing if expired.
 * Uses a Redis lock to prevent concurrent refresh races across serverless invocations.
 */
export async function getValidAccessToken(teamId: string, userId: string): Promise<string | null> {
  const linked = await getLinkedUser(teamId, userId);
  if (!linked) return null;

  if (Date.now() < linked.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
    return linked.accessToken;
  }

  const client = getRedisClient();
  const lockKey = `calcom:refresh_lock:${teamId}:${userId}`;
  const lockValue = randomUUID();

  const acquired = await client.set(lockKey, lockValue, { NX: true, EX: REFRESH_LOCK_TTL });

  if (!acquired) {
    // Another process is refreshing — wait briefly and read the updated token.
    // After waiting, validate freshness: if the token is still expired (the other
    // process failed or didn't finish in time) return null rather than a stale token.
    await new Promise((r) => setTimeout(r, 2000));
    const updated = await getLinkedUser(teamId, userId);
    if (!updated) return null;
    if (Date.now() < updated.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
      return updated.accessToken;
    }
    return null;
  }

  try {
    const { refreshAccessToken } = await import("./calcom/oauth");
    const tokens = await refreshAccessToken(linked.refreshToken);

    const updatedUser: LinkedUser = {
      ...linked,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
    };
    await linkUser(teamId, userId, updatedUser);

    logger.info("Token refreshed", { teamId, userId });
    return tokens.access_token;
  } catch (err) {
    logger.error("Token refresh failed", { err, teamId, userId });
    return null;
  } finally {
    // Only release the lock if we still own it. If the refresh exceeded the TTL,
    // another process may have re-acquired it — deleting unconditionally would
    // invalidate that process's lock. Reuse the same CAS Lua script used elsewhere.
    await client.eval(CAS_DEL_SCRIPT, {
      keys: [lockKey],
      arguments: [lockValue],
    });
  }
}

// ─── Booking flow state (unchanged) ─────────────────────────────────────────

export interface BookingFlowState {
  eventTypeId: number;
  eventTypeTitle: string;
  targetUserSlackId?: string;
  targetName?: string;
  targetEmail?: string;
  step: "awaiting_slot" | "awaiting_confirmation";
  slots?: Array<{ time: string; label: string }>;
  selectedSlot?: string;
}

export async function setBookingFlow(
  teamId: string,
  userId: string,
  state: BookingFlowState
): Promise<void> {
  const client = getRedisClient();
  const key = `calcom:booking_flow:${teamId}:${userId}`;
  await client.set(key, JSON.stringify(state), { EX: 60 * 30 });
}

export async function getBookingFlow(
  teamId: string,
  userId: string
): Promise<BookingFlowState | null> {
  const client = getRedisClient();
  const key = `calcom:booking_flow:${teamId}:${userId}`;
  const raw = await client.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BookingFlowState;
  } catch {
    return null;
  }
}

export async function clearBookingFlow(teamId: string, userId: string): Promise<void> {
  const client = getRedisClient();
  await client.del(`calcom:booking_flow:${teamId}:${userId}`);
}

// ─── Tool context persistence (per-thread, survives across webhook invocations) ─

export interface ToolContextEntry {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: number;
}

function toolContextKey(threadId: string): string {
  return `calcom:tool_context:${threadId}`;
}

export async function getToolContext(threadId: string): Promise<ToolContextEntry[]> {
  const client = getRedisClient();
  const raw = await client.get(toolContextKey(threadId));
  if (!raw) return [];
  try {
    return JSON.parse(decryptData(raw)) as ToolContextEntry[];
  } catch {
    return [];
  }
}

export async function setToolContext(
  threadId: string,
  entries: ToolContextEntry[]
): Promise<void> {
  const client = getRedisClient();
  await client.set(toolContextKey(threadId), encryptData(JSON.stringify(entries)), {
    EX: 60 * 30, // 30 minutes TTL
  });
}

// ─── Workspace notification config (unchanged) ──────────────────────────────

export interface WorkspaceNotificationConfig {
  defaultChannelId?: string;
  notifyOnBookingCreated: boolean;
  notifyOnBookingCancelled: boolean;
  notifyOnBookingRescheduled: boolean;
}

export async function setWorkspaceNotificationConfig(
  teamId: string,
  config: WorkspaceNotificationConfig
): Promise<void> {
  const client = getRedisClient();
  await client.set(`calcom:workspace_config:${teamId}`, JSON.stringify(config));
}

export async function getWorkspaceNotificationConfig(
  teamId: string
): Promise<WorkspaceNotificationConfig | null> {
  const client = getRedisClient();
  const raw = await client.get(`calcom:workspace_config:${teamId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkspaceNotificationConfig;
  } catch {
    return null;
  }
}
