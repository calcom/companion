import { createClient, type RedisClientType } from "redis";

let _client: RedisClientType | null = null;

/**
 * Shared Redis client for user-linking, booking flow, workspace config, and
 * optionally the Chat SDK state adapter (when using @chat-adapter/state-redis).
 * Uses different key namespaces: calcom:* for app data, chat-sdk/calcom-bot for state.
 */
export function getRedisClient(): RedisClientType {
  if (!_client) {
    const url = process.env.REDIS_URL;
    if (!url) {
      throw new Error("REDIS_URL is required. Set it in .env for user linking, booking flow, and production state.");
    }
    _client = createClient({ url });
    _client.on("error", (err) => console.error("Redis client error:", err));
    _client.connect().catch(console.error);
  }
  return _client;
}
