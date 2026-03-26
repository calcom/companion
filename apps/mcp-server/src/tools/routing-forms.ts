import { z } from "zod";
import { calApi } from "../utils/api-client.js";
import { CalApiError } from "../utils/errors.js";

function handleError(
  tag: string,
  err: unknown
): { content: { type: "text"; text: string }[]; isError: true } {
  if (err instanceof CalApiError) {
    console.error(`[${tag}] ${err.status}: ${err.message}`);
    return {
      content: [{ type: "text", text: `Error ${err.status}: ${err.message}` }],
      isError: true,
    };
  }
  throw err;
}

function ok(data: unknown): { content: { type: "text"; text: string }[] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export const calculateRoutingFormSlotsSchema = {
  routingFormId: z.string().describe("routingFormId"),
  start: z.string().describe("Time starting from which available slots should be checked.            Must be in UTC timezone as ISO 8601 datestring.              You can pass date without hours which defaults to start of day or sp"),
  end: z.string().describe("Time until which available slots should be checked.              Must be in UTC timezone as ISO 8601 datestring.              You can pass date without hours which defaults to end of day or specify ho"),
  timeZone: z.string().describe("Time zone in which the available slots should be returned. Defaults to UTC.").optional(),
  duration: z.number().describe("If event type has multiple possible durations then you can specify the desired duration here. Also, if you are fetching slots for a dynamic event then you can specify the duration her which defaults t").optional(),
  format: z.enum(["range", "time"]).describe("Format of slot times in response. Use 'range' to get start and end times.").optional(),
  bookingUidToReschedule: z.string().describe("The unique identifier of the booking being rescheduled. When provided will ensure that the original booking time appears within the returned available slots when rescheduling.").optional(),
};

export async function calculateRoutingFormSlots(params: {
  routingFormId: string;
  start: string;
  end: string;
  timeZone?: string;
  duration?: number;
  format?: "range" | "time";
  bookingUidToReschedule?: string;
}) {
  try {
    const data = await calApi(`routing-forms/${params.routingFormId}/calculate-slots`, { method: "POST", body: {} });
    return ok(data);
  } catch (err) {
    return handleError("calculate_routing_form_slots", err);
  }
}
