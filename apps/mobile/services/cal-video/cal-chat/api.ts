/**
 * The Cal Video chat endpoints, called against the room's own origin. The caller is identified
 * by the `cvi` identity cookie the join set, which lives in the native cookie jar, so every call
 * goes out with cookies and nothing else.
 */

import { z } from "zod";
import { fetchWithTimeout } from "@/utils/network";
import {
  type CalChatMessage,
  type CalChatParticipant,
  type CalChatPin,
  type CalChatReactionEmoji,
  calChatMessageSchema,
  calChatParticipantSchema,
  calChatPinSchema,
} from "./types";

const TIMEOUT_MS = 15_000;

export type CalChatState = {
  participantId: string;
  locked: boolean;
  muted: boolean;
  readSeq: number;
  members: CalChatParticipant[];
};

export type CalChatHistory = {
  messages: CalChatMessage[];
  hasOlder: boolean;
  hasNewer: boolean;
  pin?: CalChatPin | null;
};

const stateSchema = z.object({
  participantId: z.string(),
  locked: z.boolean(),
  muted: z.boolean(),
  readSeq: z.number().int(),
  members: z.array(calChatParticipantSchema),
});

const historySchema = z.object({
  messages: z.array(calChatMessageSchema),
  hasOlder: z.boolean(),
  hasNewer: z.boolean(),
  pin: calChatPinSchema.nullable().optional(),
});

/** A refused request; `reason` is the server's refusal code, such as `chat_locked` or `chat_muted`. */
export class CalChatRequestError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | null
  ) {
    super(`Cal Video chat request failed: ${status}`);
    this.name = "CalChatRequestError";
  }
}

export interface CalChatApi {
  getState(): Promise<CalChatState>;
  getHistory(input: { beforeSeq?: number; afterSeq?: number }): Promise<CalChatHistory>;
  send(input: {
    body: string;
    clientKey: string;
    replyToMessageId?: string;
  }): Promise<CalChatMessage>;
  react(input: {
    messageId: string;
    emoji: CalChatReactionEmoji;
    active: boolean;
  }): Promise<number>;
  deleteMessage(messageId: string): Promise<void>;
  pin(input: { messageId: string; clientKey: string }): Promise<CalChatPin | null>;
  unpin(): Promise<void>;
  setLocked(locked: boolean): Promise<void>;
  setMuted(input: { participantId: string; muted: boolean }): Promise<void>;
  getSocketToken(): Promise<string>;
}

export function createCalChatApi(input: { origin: string; sessionId: string }): CalChatApi {
  const base = `${input.origin}/api/chat/sessions/${encodeURIComponent(input.sessionId)}`;

  async function request<T>(
    path: string,
    init: RequestInit,
    schema: z.ZodType<T> | null
  ): Promise<T> {
    const response = await fetchWithTimeout(
      `${base}${path}`,
      {
        ...init,
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...init.headers,
        },
      },
      TIMEOUT_MS
    );
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const reason =
        body && typeof body === "object" && "reason" in body && typeof body.reason === "string"
          ? body.reason
          : null;
      throw new CalChatRequestError(response.status, reason);
    }
    const json: unknown = await response.json().catch(() => null);
    if (!schema) return json as T;
    const parsed = schema.safeParse(json);
    if (!parsed.success) throw new CalChatRequestError(response.status, "malformed_response");
    return parsed.data;
  }

  return {
    getState: () => request("/state", { method: "GET" }, stateSchema),
    getHistory: ({ beforeSeq, afterSeq }) => {
      const query = new URLSearchParams();
      if (beforeSeq !== undefined) query.set("beforeSeq", String(beforeSeq));
      if (afterSeq !== undefined) query.set("afterSeq", String(afterSeq));
      const suffix = query.size ? `?${query}` : "";
      return request(`/history${suffix}`, { method: "GET" }, historySchema);
    },
    send: (body) =>
      request("/messages", { method: "POST", body: JSON.stringify(body) }, calChatMessageSchema),
    react: async ({ messageId, emoji, active }) => {
      const result = await request<{ count?: unknown }>(
        `/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}`,
        { method: active ? "PUT" : "DELETE" },
        null
      );
      return typeof result?.count === "number" ? result.count : 0;
    },
    deleteMessage: async (messageId) => {
      await request(`/messages/${encodeURIComponent(messageId)}`, { method: "DELETE" }, null);
    },
    pin: async (body) => {
      const result = await request<{ pin?: unknown }>(
        "/pin",
        { method: "PUT", body: JSON.stringify(body) },
        null
      );
      const pin = calChatPinSchema.nullable().safeParse(result?.pin ?? null);
      return pin.success ? pin.data : null;
    },
    unpin: async () => {
      await request("/pin", { method: "DELETE" }, null);
    },
    setLocked: async (locked) => {
      await request("/lock", { method: locked ? "PUT" : "DELETE" }, null);
    },
    setMuted: async ({ participantId, muted }) => {
      await request(
        `/participants/${encodeURIComponent(participantId)}/mute`,
        { method: muted ? "PUT" : "DELETE" },
        null
      );
    },
    getSocketToken: async () => {
      const result = await request<{ token?: unknown }>("/socket-token", { method: "POST" }, null);
      if (typeof result?.token !== "string")
        throw new CalChatRequestError(200, "malformed_response");
      return result.token;
    },
  };
}
