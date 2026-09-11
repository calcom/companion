import { z } from "zod";

const text = z.string().max(4000);
const date = z.iso.datetime({ offset: true });
const person = z.object({ name: text, email: text });
const subscription = z.object({
  identifier: z.string().min(1).max(128),
  subscriptionId: z.number().int().positive(),
  calcomUserId: z.number().int().positive(),
  linkedAt: date,
  teamId: z
    .string()
    .regex(/^T[A-Z0-9]+$/)
    .optional(),
});

export const deliverySchema = z
  .object({
    contractVersion: z.literal(2),
    occurredAt: date,
    idempotencyKey: z.string().min(1).max(512),
    platform: z.enum(["SLACK", "TELEGRAM"]),
    subscriptions: z.array(subscription).min(1).max(100),
    payload: z.object({
      title: text,
      body: text,
      data: z.object({ url: z.string().max(2048).optional() }).optional(),
      notificationType: z.enum([
        "BOOKING_REQUESTED",
        "BOOKING_CONFIRMED",
        "BOOKING_RESCHEDULED",
        "BOOKING_CANCELLED",
        "BOOKING_REJECTED",
        "BOOKING_LOCATION_CHANGED",
        "PAYMENT_RECEIVED",
      ]),
      hosts: z.array(person).max(20),
      attendees: z.array(person).max(20),
      attendeeCount: z.number().int().nonnegative().optional(),
      start: date,
      end: date,
      timeZone: z
        .string()
        .max(100)
        .refine((value) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: value });
            return true;
          } catch {
            return false;
          }
        }),
      location: text.optional(),
      meetingUrl: z.string().max(2048).optional(),
      cancellationReason: text.optional(),
      bookingTitle: text.optional(),
      bookingStatus: text.optional(),
      timeFormat: z.union([z.literal(12), z.literal(24)]).optional(),
      seatEvent: z.boolean().optional(),
      payment: z
        .object({
          amount: z.number().int().nonnegative(),
          currency: z.string().regex(/^[A-Za-z]{3}$/),
        })
        .optional(),
    }),
  })
  .superRefine((request, ctx) => {
    const identities = new Set<string>();
    for (const sub of request.subscriptions) {
      const valid =
        request.platform === "SLACK"
          ? Boolean(sub.teamId) && /^[UW][A-Z0-9]+$/.test(sub.identifier)
          : sub.teamId === undefined && /^[1-9]\d{0,15}$/.test(sub.identifier);
      const identity = JSON.stringify([sub.identifier, sub.teamId]);
      if (!valid || identities.has(identity))
        ctx.addIssue({ code: "custom", message: "Invalid or duplicate destination" });
      identities.add(identity);
    }
  });

export type DeliveryRequest = z.infer<typeof deliverySchema>;
export type Subscription = z.infer<typeof subscription>;
export type Platform = DeliveryRequest["platform"];
export type Outcome = "delivered" | "retryable" | "invalid" | "unknown";
export type ProviderDeliveryResult = { outcome: Outcome; retryAfterSeconds?: number };
export type DeliveryResult = Pick<Subscription, "identifier" | "teamId"> & {
  outcome: Outcome;
  success: boolean;
  invalidIdentifier: boolean;
};

export function resultFor(sub: Subscription, outcome: Outcome): DeliveryResult {
  return {
    identifier: sub.identifier,
    ...(sub.teamId ? { teamId: sub.teamId } : {}),
    outcome,
    success: outcome === "delivered",
    invalidIdentifier: outcome === "invalid",
  };
}
