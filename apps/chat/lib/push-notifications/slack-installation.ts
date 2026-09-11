import { createSlackAdapter } from "@chat-adapter/slack";
import { createIoRedisState } from "@chat-adapter/state-ioredis";
import { createRedisState } from "@chat-adapter/state-redis";
import { Chat, ConsoleLogger } from "chat";

let installationClient: Promise<ReturnType<typeof createSlackAdapter>> | undefined;

export async function getNotificationSlackToken(teamId: string): Promise<string | null> {
  if (!installationClient) {
    installationClient = (async () => {
      if (!process.env.REDIS_URL) throw new Error("REDIS_URL is required");
      const logger = new ConsoleLogger("silent");
      const slack = createSlackAdapter({
        clientId: process.env.SLACK_CLIENT_ID ?? "",
        clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
        encryptionKey: process.env.SLACK_ENCRYPTION_KEY,
        logger,
      });
      const options = {
        url: process.env.REDIS_URL,
        keyPrefix: process.env.REDIS_KEY_PREFIX ?? "chat-sdk",
        logger,
      };
      const chat = new Chat({
        userName: "calcom-notifications",
        adapters: { slack },
        logger,
        state:
          process.env.REDIS_USE_IOREDIS === "true"
            ? createIoRedisState(options)
            : createRedisState(options),
      });
      await chat.initialize();
      return slack;
    })().catch((error) => {
      installationClient = undefined;
      throw error;
    });
  }
  return (await (await installationClient).getInstallation(teamId))?.botToken ?? null;
}
