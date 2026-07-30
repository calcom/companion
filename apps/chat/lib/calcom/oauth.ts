import { createHmac, timingSafeEqual } from "node:crypto";

const CALCOM_APP_URL = process.env.CALCOM_APP_URL ?? "https://app.cal.com";
const CALCOM_API_URL = process.env.CALCOM_API_URL ?? "https://api.cal.com";
const CLIENT_ID = () => process.env.CALCOM_OAUTH_CLIENT_ID ?? "";
const CLIENT_SECRET = () => process.env.CALCOM_OAUTH_CLIENT_SECRET ?? "";
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export const CALCOM_OAUTH_SCOPES = [
  "EVENT_TYPE_READ",
  "EVENT_TYPE_WRITE",
  "BOOKING_READ",
  "BOOKING_WRITE",
  "SCHEDULE_READ",
  "SCHEDULE_WRITE",
  "APPS_READ",
  "APPS_WRITE",
  "PROFILE_READ",
  "PROFILE_WRITE",
  "WEBHOOK_READ",
  "WEBHOOK_WRITE",
  "VERIFIED_RESOURCES_READ",
  "VERIFIED_RESOURCES_WRITE",
  "CREDITS_READ",
  "CREDITS_WRITE",
  "INSIGHTS_READ",
  "TEAM_EVENT_TYPE_READ",
  "TEAM_EVENT_TYPE_WRITE",
  "TEAM_BOOKING_READ",
  "TEAM_BOOKING_WRITE",
  "TEAM_SCHEDULE_READ",
  "TEAM_SCHEDULE_WRITE",
  "TEAM_PROFILE_READ",
  "TEAM_PROFILE_WRITE",
  "TEAM_MEMBERSHIP_READ",
  "TEAM_MEMBERSHIP_WRITE",
  "TEAM_APPS_READ",
  "TEAM_APPS_WRITE",
  "TEAM_ROUTING_FORM_READ",
  "TEAM_ROUTING_FORM_WRITE",
  "TEAM_WORKFLOW_READ",
  "TEAM_WORKFLOW_WRITE",
  "TEAM_VERIFIED_RESOURCES_READ",
  "TEAM_VERIFIED_RESOURCES_WRITE",
  "TEAM_INSIGHTS_READ",
  "ORG_EVENT_TYPE_READ",
  "ORG_EVENT_TYPE_WRITE",
  "ORG_BOOKING_READ",
  "ORG_BOOKING_WRITE",
  "ORG_SCHEDULE_READ",
  "ORG_SCHEDULE_WRITE",
  "ORG_PROFILE_READ",
  "ORG_PROFILE_WRITE",
  "ORG_MEMBERSHIP_READ",
  "ORG_MEMBERSHIP_WRITE",
  "ORG_ROUTING_FORM_READ",
  "ORG_ROUTING_FORM_WRITE",
  "ORG_WEBHOOK_READ",
  "ORG_WEBHOOK_WRITE",
  "ORG_INSIGHTS_READ",
  "ORG_ATTRIBUTES_READ",
  "ORG_ATTRIBUTES_WRITE",
] as const;

function getSigningKey(): string {
  const key = process.env.SLACK_ENCRYPTION_KEY;
  if (!key) throw new Error("SLACK_ENCRYPTION_KEY is required for OAuth state signing");
  return key;
}

// ─── State parameter: signed payload with HMAC-SHA256 ────────────────────────

interface StatePayload {
  platform: string;
  teamId: string;
  userId: string;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", getSigningKey()).update(payload).digest("hex");
}

export function generateState(platform: string, teamId: string, userId: string): string {
  const payload: StatePayload = {
    platform,
    teamId,
    userId,
    exp: Date.now() + STATE_TTL_MS,
  };
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(json);
  return `${json}.${signature}`;
}

export function verifyState(state: string): StatePayload | null {
  const dotIdx = state.indexOf(".");
  if (dotIdx === -1) return null;

  const json = state.slice(0, dotIdx);
  const signature = state.slice(dotIdx + 1);

  const expected = sign(json);
  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString()) as StatePayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// ─── OAuth URLs ──────────────────────────────────────────────────────────────

export function getCalcomOAuthRedirectUri(): string {
  return `${APP_URL()}/api/auth/calcom/callback`;
}

export function generateAuthUrl(platform: string, teamId: string, userId: string): string {
  const state = generateState(platform, teamId, userId);
  const params = new URLSearchParams({
    client_id: CLIENT_ID(),
    redirect_uri: getCalcomOAuthRedirectUri(),
    state,
    scope: CALCOM_OAUTH_SCOPES.join(" "),
  });
  return `${CALCOM_APP_URL}/auth/oauth2/authorize?${params}`;
}

// ─── Token exchange ──────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(`${CALCOM_API_URL}/v2/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      grant_type: "authorization_code",
      code,
      redirect_uri: getCalcomOAuthRedirectUri(),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }

  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${CALCOM_API_URL}/v2/auth/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: CLIENT_ID(),
      client_secret: CLIENT_SECRET(),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  return (await res.json()) as TokenResponse;
}
