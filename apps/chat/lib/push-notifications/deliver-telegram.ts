import type { ChatElement } from "chat";
import { bot } from "@/lib/bot";
import { getLogger } from "@/lib/logger";
import type { DeliverResult } from "./types";

const logger = getLogger("deliver-telegram");

const TELEGRAM_NOT_FOUND_PHRASES = [
  "chat not found",
  "user not found",
  "bot was blocked by the user",
];

export async function deliverTelegram(
  identifier: string,
  card: ChatElement
): Promise<DeliverResult> {
  try {
    await bot.channel(`telegram:${identifier}`).post(card);
    return { identifier, success: true };
  } catch (err) {
    const msg = String(err).toLowerCase();
    const isInvalid = TELEGRAM_NOT_FOUND_PHRASES.some((phrase) => msg.includes(phrase));
    if (isInvalid) {
      logger.warn("Invalid Telegram identifier", { identifier, error: msg });
      return { identifier, success: false, invalidIdentifier: true, error: msg };
    }
    logger.error("Telegram delivery error", { identifier, error: msg });
    return { identifier, success: false, error: msg };
  }
}
