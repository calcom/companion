import { getRedisClient } from "./redis";
import { getLogger } from "./logger";

const logger = getLogger("user-linking");

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

export async function linkUser(
  teamId: string,
  userId: string,
  data: LinkedUser
): Promise<void> {
  const client = getRedisClient();
  const key = userKey(teamId, userId);

  // On re-link with a different Cal.com email, remove the old reverse-lookup entry so
  // booking-notification routing via getLinkedUserByEmail doesn't resolve stale results.
  const existing = await getLinkedUser(teamId, userId);
  if (existing && existing.calcomEmail !== data.calcomEmail) {
    await client.del(emailIndexKey(existing.calcomEmail));
  }

  await client.set(key, JSON.stringify(data), {
    EX: 60 * 60 * 24 * 365,
  });
  await client.set(emailIndexKey(data.calcomEmail), JSON.stringify({ teamId, userId }), {
    EX: 60 * 60 * 24 * 365,
  });
  logger.info("User linked", { teamId, userId, calcomEmail: data.calcomEmail });
}

export async function getLinkedUser(
  teamId: string,
  userId: string
): Promise<LinkedUser | null> {
  const client = getRedisClient();
  const raw = await client.get(userKey(teamId, userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LinkedUser;
  } catch {
    return null;
  }
}

export async function unlinkUser(teamId: string, userId: string): Promise<void> {
  const client = getRedisClient();
  const linked = await getLinkedUser(teamId, userId);
  if (linked) {
    await client.del(emailIndexKey(linked.calcomEmail));
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
export async function getValidAccessToken(
  teamId: string,
  userId: string
): Promise<string | null> {
  const linked = await getLinkedUser(teamId, userId);
  if (!linked) return null;

  if (Date.now() < linked.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
    return linked.accessToken;
  }

  const client = getRedisClient();
  const lockKey = `calcom:refresh_lock:${teamId}:${userId}`;

  const acquired = await client.set(lockKey, "1", { NX: true, EX: REFRESH_LOCK_TTL });

  if (!acquired) {
    // Another process is refreshing — wait briefly and read the updated token
    await new Promise((r) => setTimeout(r, 2000));
    const updated = await getLinkedUser(teamId, userId);
    return updated?.accessToken ?? null;
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
    await client.del(lockKey);
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
