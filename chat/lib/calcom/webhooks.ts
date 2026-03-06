import crypto from "crypto";
import type { CalcomWebhookPayload } from "./types";

export function verifyCalcomWebhook(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function parseCalcomWebhook(body: string): CalcomWebhookPayload {
  return JSON.parse(body) as CalcomWebhookPayload;
}

export function formatBookingTime(start: string, end: string, timeZone = "UTC"): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
  return `${fmt.format(startDate)} – ${timeFmt.format(endDate)}`;
}
