import { createClient } from "redis";

export interface LinkedUser {
  calcomApiKey: string;
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
    EX: 60 * 60 * 24 * 365, // 1 year TTL
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

// Store a pending booking flow state (e.g., awaiting slot selection)
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
  await client.set(key, JSON.stringify(state), { EX: 60 * 30 }); // 30 min TTL
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

// Store the Slack notification channel preference per workspace
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
