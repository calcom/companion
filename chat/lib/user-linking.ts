import { createClient } from "redis";

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

let _client: ReturnType<typeof createClient> | null = null;

function getRedisClient() {
  if (!_client) {
    _client = createClient({ url: process.env.REDIS_URL });
    _client.on("error", (err) => console.error("Redis client error:", err));
    _client.connect().catch(console.error);
  }
  return _client;
}

function userKey(teamId: string, slackUserId: string): string {
  return `calcom:user:${teamId}:${slackUserId}`;
}

export async function linkUser(
  teamId: string,
  slackUserId: string,
  data: LinkedUser
): Promise<void> {
  const client = getRedisClient();
  await client.set(userKey(teamId, slackUserId), JSON.stringify(data), {
    EX: 60 * 60 * 24 * 365,
  });
}

export async function getLinkedUser(
  teamId: string,
  slackUserId: string
): Promise<LinkedUser | null> {
  const client = getRedisClient();
  const raw = await client.get(userKey(teamId, slackUserId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LinkedUser;
  } catch {
    return null;
  }
}

export async function unlinkUser(teamId: string, slackUserId: string): Promise<void> {
  const client = getRedisClient();
  await client.del(userKey(teamId, slackUserId));
}

export async function isUserLinked(teamId: string, slackUserId: string): Promise<boolean> {
  const user = await getLinkedUser(teamId, slackUserId);
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
  slackUserId: string
): Promise<string | null> {
  const linked = await getLinkedUser(teamId, slackUserId);
  if (!linked) return null;

  if (Date.now() < linked.tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
    return linked.accessToken;
  }

  const client = getRedisClient();
  const lockKey = `calcom:refresh_lock:${teamId}:${slackUserId}`;

  const acquired = await client.set(lockKey, "1", { NX: true, EX: REFRESH_LOCK_TTL });

  if (!acquired) {
    // Another process is refreshing — wait briefly and read the updated token
    await new Promise((r) => setTimeout(r, 2000));
    const updated = await getLinkedUser(teamId, slackUserId);
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
    await linkUser(teamId, slackUserId, updatedUser);

    return tokens.access_token;
  } catch (err) {
    console.error("[OAuth] Token refresh failed:", err);
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
  slackUserId: string,
  state: BookingFlowState
): Promise<void> {
  const client = getRedisClient();
  const key = `calcom:booking_flow:${teamId}:${slackUserId}`;
  await client.set(key, JSON.stringify(state), { EX: 60 * 30 });
}

export async function getBookingFlow(
  teamId: string,
  slackUserId: string
): Promise<BookingFlowState | null> {
  const client = getRedisClient();
  const key = `calcom:booking_flow:${teamId}:${slackUserId}`;
  const raw = await client.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BookingFlowState;
  } catch {
    return null;
  }
}

export async function clearBookingFlow(teamId: string, slackUserId: string): Promise<void> {
  const client = getRedisClient();
  await client.del(`calcom:booking_flow:${teamId}:${slackUserId}`);
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
