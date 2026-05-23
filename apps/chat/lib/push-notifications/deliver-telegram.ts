import type { ChatElement } from "chat";
import { bot } from "@/lib/bot";
import type { DeliverResult } from "./deliver-slack";

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
      return { identifier, success: false, invalidIdentifier: true };
    }
    return { identifier, success: false };
  }
}
