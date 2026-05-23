import crypto from "node:crypto";
import { getLogger } from "@/lib/logger";
import { type DeliverRequest, deliverNotifications } from "@/lib/push-notifications/service";

const logger = getLogger("deliver-route");

const secretHmac = process.env.CALCOM_DELIVERY_SECRET
  ? crypto
      .createHmac("sha256", "delivery-verify")
      .update(process.env.CALCOM_DELIVERY_SECRET)
      .digest()
  : null;

function verifyDeliverySecret(header: string | null): boolean {
  if (!secretHmac || !header) return false;
  try {
    const headerHmac = crypto.createHmac("sha256", "delivery-verify").update(header).digest();
    return crypto.timingSafeEqual(headerHmac, secretHmac);
  } catch {
    return false;
  }
}

function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parseDeliverRequest(body: unknown): DeliverRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.platform !== "SLACK" && b.platform !== "TELEGRAM") return null;
  if (!Array.isArray(b.subscriptions) || b.subscriptions.length === 0) return null;
  if (typeof b.payload !== "object" || b.payload === null) return null;

  const p = b.payload as Record<string, unknown>;
  if (typeof p.title !== "string" || typeof p.timeZone !== "string") return null;
  if (typeof p.start !== "string" || typeof p.end !== "string") return null;
  if (!Array.isArray(p.hosts) || !Array.isArray(p.attendees)) return null;
  if (!isValidTimeZone(p.timeZone)) return null;

  if (b.platform === "SLACK") {
    const valid = b.subscriptions.every(
      (s: unknown) =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as Record<string, unknown>).identifier === "string" &&
        typeof (s as Record<string, unknown>).teamId === "string"
    );
    if (!valid) return null;
  }

  return body as DeliverRequest;
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-cal-delivery-secret");
  if (!verifyDeliverySecret(secret)) {
    logger.warn("Delivery auth rejected");
    return new Response(null, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = parseDeliverRequest(body);
  if (!parsed) {
    logger.warn("Invalid delivery request body", {
      platform: (body as Record<string, unknown>)?.platform,
    });
    return new Response(null, { status: 400 });
  }

  let results;
  try {
    results = await deliverNotifications(parsed);
  } catch (err) {
    logger.error("deliverNotifications threw", { error: String(err) });
    return new Response(null, { status: 422 });
  }

  const failed = results.filter((r) => !r.success).length;
  const invalid = results.filter((r) => r.invalidIdentifier).length;
  logger.info("Delivery complete", {
    platform: parsed.platform,
    total: results.length,
    failed,
    invalidIdentifiers: invalid,
  });

  return Response.json({ results });
}
