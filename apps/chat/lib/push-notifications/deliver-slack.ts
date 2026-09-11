import { z } from "zod";
import type { ProviderDeliveryResult } from "./contract";
import type { FormattedNotification } from "./formatter";

const slackResponseSchema = z.object({ ok: z.boolean(), error: z.string().optional() });
const invalidRecipientErrors = new Set(["channel_not_found", "user_not_found", "user_not_visible"]);

function buildSlackMessage(identifier: string, message: FormattedNotification) {
  const content = { type: "section", text: { type: "plain_text", text: message.text } };
  const bookingAction = {
    type: "actions",
    elements: [
      {
        type: "button",
        text: { type: "plain_text", text: "View booking" },
        url: message.bookingUrl,
      },
    ],
  };

  return {
    channel: identifier,
    text: message.text,
    mrkdwn: false,
    parse: "none",
    unfurl_links: false,
    unfurl_media: false,
    blocks: message.bookingUrl ? [content, bookingAction] : [content],
  };
}

async function readSlackOutcome(response: Response): Promise<ProviderDeliveryResult> {
  if (response.status === 429) {
    const seconds = Number(response.headers.get("retry-after"));
    return {
      outcome: "retryable",
      retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 60,
    };
  }

  const parsed = slackResponseSchema.safeParse(await response.json());
  if (!parsed.success) return { outcome: "unknown" };
  if (response.ok && parsed.data.ok) return { outcome: "delivered" };
  if (parsed.data.ok) return { outcome: "unknown" };

  const error = parsed.data.error ?? "";
  if (invalidRecipientErrors.has(error)) return { outcome: "invalid" };
  if (error === "ratelimited" || error === "rate_limited") {
    return { outcome: "retryable", retryAfterSeconds: 60 };
  }
  return { outcome: "unknown" };
}

export async function deliverSlackNotification(
  token: string,
  identifier: string,
  message: FormattedNotification,
  fetcher: typeof fetch = fetch
): Promise<ProviderDeliveryResult> {
  try {
    // A single HTTP attempt lets the delivery ledger prevent resends after a lost response.
    const response = await fetcher("https://slack.com/api/chat.postMessage", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(4000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(buildSlackMessage(identifier, message)),
    });
    return await readSlackOutcome(response);
  } catch {
    return { outcome: "unknown" };
  }
}
