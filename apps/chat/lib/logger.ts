import { ConsoleLogger } from "chat";

const LOG_LEVEL =
  (process.env.LOG_LEVEL as "debug" | "info" | "warn" | "error" | "silent") ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

export const logger = new ConsoleLogger(LOG_LEVEL, "Cal Bot");

export function getLogger(name: string) {
  return logger.child(name);
}
