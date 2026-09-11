import { createHmac } from "node:crypto";
import { z } from "zod";
import type { Platform } from "../push-notifications/contract";

async function request(
  path: string,
  body: object,
  headers: Record<string, string>,
  method = "POST"
) {
  return fetch(`${process.env.CALCOM_API_URL ?? "https://api.cal.com"}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "cal-api-version": "2024-08-13", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
}

export async function enableChatSubscription(
  accessToken: string,
  platform: Platform,
  identifier: string,
  workspaceId?: string
): Promise<void> {
  const secret = process.env.CALCOM_CHAT_LINK_SECRET;
  if (!secret) throw new Error("Chat linking is not configured");
  const intent = await request(
    `/v2/notifications/subscriptions/${platform.toLowerCase()}/link-intents`,
    {},
    { Authorization: `Bearer ${accessToken}` }
  );
  if (!intent.ok) throw new Error("Could not create chat link");
  const { data } = z
    .object({ status: z.literal("success"), data: z.object({ token: z.string().min(1).max(128) }) })
    .parse(await intent.json());
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = { platform, token: data.token, identifier, ...(workspaceId ? { workspaceId } : {}) };
  const signature = createHmac("sha256", secret)
    .update(
      JSON.stringify({
        timestamp,
        platform,
        token: data.token,
        identifier,
        workspaceId: workspaceId ?? null,
      })
    )
    .digest("hex");
  const completed = await request("/v2/internal/notifications/subscriptions/verified-links", body, {
    "x-cal-chat-link-timestamp": timestamp,
    "x-cal-chat-link-signature": signature,
  });
  if (!completed.ok) throw new Error("Could not complete chat link");
  z.object({ status: z.literal("success") }).parse(await completed.json());
}

export async function disableChatSubscription(
  accessToken: string,
  platform: Platform,
  identifier: string,
  teamId?: string
): Promise<void> {
  const response = await request(
    `/v2/notifications/subscriptions/${platform.toLowerCase()}`,
    {
      identifier,
      ...(teamId ? { teamId } : {}),
    },
    { Authorization: `Bearer ${accessToken}` },
    "DELETE"
  );
  if (!response.ok && response.status !== 404)
    throw new Error("Could not remove chat subscription");
}
