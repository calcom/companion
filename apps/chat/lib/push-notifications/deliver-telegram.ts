import { z } from "zod";
import type { ProviderDeliveryResult } from "./contract";
import type { FormattedNotification } from "./formatter";

const telegramResponseSchema = z.object({
  ok: z.boolean(),
  error_code: z.number().int().optional(),
  description: z.string().optional(),
  parameters: z.object({ retry_after: z.number().int().positive().optional() }).optional(),
});

function buildTelegramMessage(identifier: string, message: FormattedNotification) {
  return {
    chat_id: identifier,
    text: message.text,
    link_preview_options: { is_disabled: true },
    ...(message.bookingUrl
      ? {
          reply_markup: { inline_keyboard: [[{ text: "View booking", url: message.bookingUrl }]] },
        }
      : {}),
  };
}

async function readTelegramOutcome(response: Response): Promise<ProviderDeliveryResult> {
  const parsed = telegramResponseSchema.safeParse(await response.json().catch(() => null));
  if (response.status === 429) {
    return {
      outcome: "retryable",
      retryAfterSeconds: parsed.success ? (parsed.data.parameters?.retry_after ?? 60) : 60,
    };
  }
  if (!parsed.success) return { outcome: "unknown" };
  const data = parsed.data;
  if (response.ok && data.ok) return { outcome: "delivered" };
  if (data.ok) return { outcome: "unknown" };
  if (data.error_code === 429) {
    return { outcome: "retryable", retryAfterSeconds: data.parameters?.retry_after ?? 60 };
  }
  if (
    data.error_code === 403 ||
    (data.error_code === 400 && data.description === "Bad Request: chat not found")
  ) {
    return { outcome: "invalid" };
  }
  return { outcome: "unknown" };
}

export async function deliverTelegramNotification(
  token: string,
  identifier: string,
  message: FormattedNotification,
  fetcher: typeof fetch = fetch
): Promise<ProviderDeliveryResult> {
  const baseUrl = process.env.TELEGRAM_API_BASE_URL ?? "https://api.telegram.org";
  try {
    const response = await fetcher(`${baseUrl}/bot${token}/sendMessage`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(4000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildTelegramMessage(identifier, message)),
    });
    return await readTelegramOutcome(response);
  } catch {
    return { outcome: "unknown" };
  }
}
