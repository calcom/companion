import { createHash, randomUUID } from "node:crypto";
import { linkedUserKey } from "../linked-user-key";
import { getRedisClient } from "../redis";
import type { DeliveryRequest, Outcome, Platform, Subscription } from "./contract";

const RETENTION_SECONDS = 8 * 24 * 60 * 60;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export interface NotificationBinding {
  calcomUserId: number;
  oauthLinkedAt: string;
  enabledAfter: number;
  active: boolean;
  pending: boolean;
  generation: string;
}

export function bindingKey(platform: Platform, identifier: string, teamId?: string): string {
  return `calcom:notification_binding:${digest([platform, teamId ?? "", identifier])}`;
}

export async function getBinding(
  platform: Platform,
  sub: Pick<Subscription, "identifier" | "teamId">
): Promise<NotificationBinding | null> {
  const raw = await getRedisClient().get(bindingKey(platform, sub.identifier, sub.teamId));
  return raw ? JSON.parse(raw) : null;
}

export async function forgetBinding(
  platform: Platform,
  identifier: string,
  teamId?: string
): Promise<void> {
  // Delete OAuth and fence binding activation atomically; an in-flight enable cannot undo unlink.
  const disabled: NotificationBinding = {
    active: false,
    pending: false,
    calcomUserId: 0,
    oauthLinkedAt: "",
    enabledAfter: 0,
    generation: "",
  };
  await getRedisClient().eval(
    `
    redis.call('DEL', KEYS[2])
    if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
    redis.call('SET', KEYS[1], ARGV[1])
    return 1
  `,
    {
      keys: [
        bindingKey(platform, identifier, teamId),
        linkedUserKey(platform === "SLACK" ? (teamId ?? "") : "telegram", identifier),
      ],
      arguments: [JSON.stringify(disabled)],
    }
  );
}

export async function beginBinding(
  platform: Platform,
  sub: Pick<Subscription, "identifier" | "teamId">,
  data: Omit<NotificationBinding, "active" | "generation">
) {
  const key = bindingKey(platform, sub.identifier, sub.teamId);
  const binding: NotificationBinding = { ...data, active: false, generation: randomUUID() };
  const userKey = linkedUserKey(
    platform === "SLACK" ? (sub.teamId ?? "") : "telegram",
    sub.identifier
  );
  const result = await getRedisClient().eval(
    `
    local previous = redis.call('GET', KEYS[1]) or ''
    if previous ~= '' then
      local record = cjson.decode(previous)
      if record.pending then previous = record.rollbackValue or '' end
    end
    local binding = cjson.decode(ARGV[1])
    if binding.pending then binding.rollbackValue = previous end
    local pending = cjson.encode(binding)
    redis.call('SET', KEYS[1], pending)
    return {pending, previous, redis.call('GET', KEYS[2]) or ''}
  `,
    { keys: [key, userKey], arguments: [JSON.stringify(binding)] }
  );
  const [pending, previous, userSnapshot] = result as [string, string, string];
  return { key, pending, binding, previous, userKey, userSnapshot };
}

export async function rollbackBinding(
  attempt: Awaited<ReturnType<typeof beginBinding>>
): Promise<void> {
  await getRedisClient().eval(
    `
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
    if (redis.call('GET', KEYS[2]) or '') ~= ARGV[3] then return 0 end
    if ARGV[2] == '' then redis.call('DEL', KEYS[1])
    else redis.call('SET', KEYS[1], ARGV[2]) end
    return 1
  `,
    {
      keys: [attempt.key, attempt.userKey],
      arguments: [attempt.pending, attempt.previous, attempt.userSnapshot],
    }
  );
}

export async function activateBinding(
  attempt: Awaited<ReturnType<typeof beginBinding>>
): Promise<boolean> {
  const result = await getRedisClient().eval(
    `
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
    if ARGV[3] == '' or redis.call('GET', KEYS[2]) ~= ARGV[3] then return 0 end
    redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
    return 1
  `,
    {
      keys: [attempt.key, attempt.userKey],
      arguments: [
        attempt.pending,
        JSON.stringify({ ...attempt.binding, active: true, pending: false }),
        attempt.userSnapshot,
      ],
    }
  );
  return result === 1;
}

export function isCurrentBinding(
  binding: NotificationBinding | null,
  linked: { calcomUserId: number; linkedAt: string } | null,
  sub: Subscription
): boolean {
  return Boolean(
    binding?.active &&
      linked &&
      binding.calcomUserId === sub.calcomUserId &&
      linked.calcomUserId === sub.calcomUserId &&
      binding.oauthLinkedAt === linked.linkedAt &&
      Date.parse(sub.linkedAt) >= binding.enabledAfter
  );
}

export async function claimDelivery(request: DeliveryRequest, sub: Subscription) {
  const key = `calcom:notification_delivery:${digest([request.idempotencyKey, request.platform, sub.subscriptionId, sub.calcomUserId])}`;
  const fingerprint = digest([request.occurredAt, request.platform, sub, request.payload]);
  const pending = JSON.stringify({ fingerprint, outcome: "unknown", owner: randomUUID() });
  const acquire = () =>
    getRedisClient().eval(
      `
    local value = redis.call('GET', KEYS[1])
    if value == ARGV[1] then return 'claimed' end
    if value then
      local record = cjson.decode(value)
      if record.fingerprint ~= ARGV[2] then return 'unknown' end
      if record.outcome ~= 'retryable' then return record.outcome end
      if record.retryAt > tonumber(ARGV[3]) then return 'retryable' end
    end
    redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[4])
    return 'claimed'
  `,
      {
        keys: [key],
        arguments: [pending, fingerprint, String(Date.now()), String(RETENTION_SECONDS)],
      }
    );
  let existing: unknown;
  try {
    existing = await acquire();
  } catch {
    // Replay only this owner's atomic claim when its response is lost, never another sender's claim.
    existing = await acquire();
  }
  return { key, pending, fingerprint, outcome: existing as Outcome | "claimed" };
}

export async function finishDelivery(
  claim: Awaited<ReturnType<typeof claimDelivery>>,
  outcome: Outcome,
  retryAfterSeconds = 0
): Promise<void> {
  await getRedisClient().eval(
    `
    if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
    redis.call('SET', KEYS[1], ARGV[2], 'KEEPTTL')
    return 1
  `,
    {
      keys: [claim.key],
      arguments: [
        claim.pending,
        JSON.stringify({
          fingerprint: claim.fingerprint,
          outcome,
          retryAt: Date.now() + retryAfterSeconds * 1000,
        }),
      ],
    }
  );
}
