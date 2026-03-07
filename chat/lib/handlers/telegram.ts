import { Actions, Card, LinkButton } from "chat";
import type { Chat } from "chat";
import {
  getLinkedUser,
  unlinkUser,
} from "../user-linking";
import { helpCard } from "../notifications";
import { generateAuthUrl } from "../calcom/oauth";
import { getLogger } from "../logger";

const logger = getLogger("telegram-handlers");

export interface RegisterTelegramHandlersDeps {
  withBotErrorHandling: (
    fn: () => Promise<void>,
    options: {
      postError: (message: string) => Promise<unknown>;
      logContext?: string;
    }
  ) => Promise<void>;
  extractContext: (
    thread: { adapter: { name: string } },
    message: { author: { userId: string }; raw: unknown }
  ) => { platform: string; teamId: string; userId: string };
}

function oauthLinkMessage(platform: string, teamId: string, userId: string) {
  const authUrl = generateAuthUrl(platform, teamId, userId);
  return Card({
    title: "Connect Your Cal.com Account",
    children: [
      Actions([LinkButton({ url: authUrl, label: "Continue with Cal.com" })]),
    ],
  });
}

export function registerTelegramHandlers(
  bot: Chat,
  deps: RegisterTelegramHandlersDeps
): void {
  const { withBotErrorHandling, extractContext } = deps;

  bot.onNewMessage(/^\/(cal\s+)?(start|help|link|unlink)/i, async (thread, message) => {
    if (thread.adapter.name !== "telegram") return;

    const ctx = extractContext(thread, message);
    const parts = message.text.trim().split(/\s+/);
    const first = parts[0]?.replace(/@\w+$/, "").toLowerCase();
    const cmd = first === "/cal" ? parts[1]?.toLowerCase() : first?.replace(/^\//, "") ?? "";

    logger.info("Telegram command received", { command: cmd, chatId: ctx.userId });

    await withBotErrorHandling(
      async () => {
        if (cmd === "start" || cmd === "help") {
          await thread.post(helpCard());
          return;
        }
        if (cmd === "link") {
          const existing = await getLinkedUser(ctx.teamId, ctx.userId);
          if (existing) {
            await thread.post(`Your Cal.com account (**${existing.calcomUsername}**) is already connected.`);
            return;
          }
          await thread.post(oauthLinkMessage(ctx.platform, ctx.teamId, ctx.userId));
          return;
        }
        if (cmd === "unlink") {
          const linked = await getLinkedUser(ctx.teamId, ctx.userId);
          if (!linked) {
            await thread.post("Your Cal.com account is not connected.");
            return;
          }
          await unlinkUser(ctx.teamId, ctx.userId);
          await thread.post(`Your Cal.com account (**${linked.calcomUsername}**) has been disconnected.`);
          return;
        }
      },
      {
        postError: (msg) => thread.post(msg).catch(() => {}),
        logContext: "telegram command",
      }
    );
  });
}
