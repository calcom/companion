import { NextResponse } from "next/server";
import { getLogger } from "@/lib/logger";

const logger = getLogger("calcom-auth");

import { exchangeCodeForTokens, verifyState } from "@/lib/calcom/oauth";
import type { LinkedUser } from "@/lib/user-linking";
import { linkUser } from "@/lib/user-linking";

const CALCOM_API_URL = process.env.CALCOM_API_URL ?? "https://api.cal.com";

// Derive the app base URL at request time so redirects always use an absolute URL.
// NEXT_PUBLIC_APP_URL is preferred (canonical domain); request.url is the fallback
// for local dev or misconfigured deployments where the env var is absent.
function getAppUrl(request: Request): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return raw.replace(/\/+$/, "");
}

interface CalcomMe {
  id: number;
  username: string;
  email: string;
  name: string;
  timeZone: string;
  organizationId: number | null;
  organization?: { isPlatform: boolean; id: number };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    const desc = url.searchParams.get("error_description") ?? error;
    return redirectWithError(request, `Authorization denied: ${desc}`);
  }

  if (!code || !state) {
    return redirectWithError(request, "Missing authorization code or state parameter.");
  }

  const payload = verifyState(state);
  if (!payload) {
    return redirectWithError(
      request,
      "Invalid or expired authorization link. Please return to your chat app and run the link command again."
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const meRes = await fetch(`${CALCOM_API_URL}/v2/me`, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "cal-api-version": "2024-08-13",
      },
    });

    if (!meRes.ok) {
      throw new Error(`Failed to fetch Cal.com profile (${meRes.status})`);
    }

    const meBody = (await meRes.json()) as { status: string; data: CalcomMe };
    const me = meBody.data;

    const linkedUser: LinkedUser = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      calcomUserId: me.id,
      calcomEmail: me.email,
      calcomUsername: me.username,
      calcomTimeZone: me.timeZone,
      linkedAt: new Date().toISOString(),
      calcomOrganizationId: me.organizationId ?? null,
      calcomOrgIsPlatform: me.organization?.isPlatform ?? null,
    };

    await linkUser(payload.teamId, payload.userId, linkedUser);

    logger.info("Cal.com account linked", {
      teamId: payload.teamId,
      userId: payload.userId,
      platform: payload.platform,
      calcomEmail: me.email,
    });

    return redirectWithSuccess(request, me.name, me.email, payload.teamId, payload.platform);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during authorization.";
    logger.error("Cal.com OAuth callback error", { err });
    // payload is in scope here — pass platform/teamId so the complete page shows correct retry instructions.
    return redirectWithError(request, message, payload.platform, payload.teamId);
  }
}

function redirectWithSuccess(
  request: Request,
  name: string,
  email: string,
  teamId: string,
  platform: string
) {
  const appUrl = getAppUrl(request);
  const params = new URLSearchParams({
    calcom_linked: `Connected as ${name} (${email}).`,
    team: teamId,
    platform,
  });
  if (platform === "telegram" && process.env.TELEGRAM_BOT_USERNAME) {
    params.set("telegram_bot", process.env.TELEGRAM_BOT_USERNAME);
  }
  return NextResponse.redirect(`${appUrl}/auth/calcom/complete?${params}`);
}

function redirectWithError(request: Request, message: string, platform?: string, teamId?: string) {
  const appUrl = getAppUrl(request);
  const params = new URLSearchParams({ error: message });
  if (platform) params.set("platform", platform);
  if (teamId) params.set("team", teamId);
  return NextResponse.redirect(`${appUrl}/auth/calcom/complete?${params}`);
}
