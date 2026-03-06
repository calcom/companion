import { createHmac, timingSafeEqual } from "crypto";

const CALCOM_APP_URL = process.env.CALCOM_APP_URL ?? "https://app.cal.com";
const CALCOM_API_URL = process.env.CALCOM_API_URL ?? "https://api.cal.com";
const CLIENT_ID = () => process.env.CALCOM_OAUTH_CLIENT_ID ?? "";
const CLIENT_SECRET = () => process.env.CALCOM_OAUTH_CLIENT_SECRET ?? "";
const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? "";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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
