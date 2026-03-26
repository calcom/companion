import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { CalApiError } from "../../utils/errors.js";

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

export const getOrgRoutingFormsSchema = {
  orgId: z.number().int().describe("orgId"),
  skip: z.number().describe("Number of responses to skip").optional(),
  take: z.number().describe("Number of responses to take").optional(),
  sortCreatedAt: z.enum(["asc", "desc"]).describe("Sort by creation time").optional(),
  sortUpdatedAt: z.enum(["asc", "desc"]).describe("Sort by update time").optional(),
  afterCreatedAt: z.string().describe("Filter by responses created after this date").optional(),
  beforeCreatedAt: z.string().describe("Filter by responses created before this date").optional(),
  afterUpdatedAt: z.string().describe("Filter by responses created after this date").optional(),
  beforeUpdatedAt: z.string().describe("Filter by responses updated before this date").optional(),
  routedToBookingUid: z.string().describe("Filter by responses routed to a specific booking").optional(),
  teamIds: z.array(z.number()).describe("Filter by teamIds. Team ids must be separated by a comma.").optional(),
};

export async function getOrgRoutingForms(params: {
  orgId: number;
  skip?: number;
  take?: number;
  sortCreatedAt?: "asc" | "desc";
  sortUpdatedAt?: "asc" | "desc";
  afterCreatedAt?: string;
  beforeCreatedAt?: string;
  afterUpdatedAt?: string;
  beforeUpdatedAt?: string;
  routedToBookingUid?: string;
  teamIds?: number[];
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.take !== undefined) qp.take = params.take;
    if (params.sortCreatedAt !== undefined) qp.sortCreatedAt = params.sortCreatedAt;
    if (params.sortUpdatedAt !== undefined) qp.sortUpdatedAt = params.sortUpdatedAt;
    if (params.afterCreatedAt !== undefined) qp.afterCreatedAt = params.afterCreatedAt;
    if (params.beforeCreatedAt !== undefined) qp.beforeCreatedAt = params.beforeCreatedAt;
    if (params.afterUpdatedAt !== undefined) qp.afterUpdatedAt = params.afterUpdatedAt;
    if (params.beforeUpdatedAt !== undefined) qp.beforeUpdatedAt = params.beforeUpdatedAt;
    if (params.routedToBookingUid !== undefined) qp.routedToBookingUid = params.routedToBookingUid;
    if (params.teamIds !== undefined) qp.teamIds = params.teamIds.join(",");
    const data = await calApi(`organizations/${params.orgId}/routing-forms`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_routing_forms", err);
  }
}

export const getOrgRoutingFormResponsesSchema = {
  orgId: z.number().int().describe("orgId"),
  routingFormId: z.string().describe("routingFormId"),
  skip: z.number().describe("Number of responses to skip").optional(),
  take: z.number().describe("Number of responses to take").optional(),
  sortCreatedAt: z.enum(["asc", "desc"]).describe("Sort by creation time").optional(),
  sortUpdatedAt: z.enum(["asc", "desc"]).describe("Sort by update time").optional(),
  afterCreatedAt: z.string().describe("Filter by responses created after this date").optional(),
  beforeCreatedAt: z.string().describe("Filter by responses created before this date").optional(),
  afterUpdatedAt: z.string().describe("Filter by responses created after this date").optional(),
  beforeUpdatedAt: z.string().describe("Filter by responses updated before this date").optional(),
  routedToBookingUid: z.string().describe("Filter by responses routed to a specific booking").optional(),
};

export async function getOrgRoutingFormResponses(params: {
  orgId: number;
  routingFormId: string;
  skip?: number;
  take?: number;
  sortCreatedAt?: "asc" | "desc";
  sortUpdatedAt?: "asc" | "desc";
  afterCreatedAt?: string;
  beforeCreatedAt?: string;
  afterUpdatedAt?: string;
  beforeUpdatedAt?: string;
  routedToBookingUid?: string;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.take !== undefined) qp.take = params.take;
    if (params.sortCreatedAt !== undefined) qp.sortCreatedAt = params.sortCreatedAt;
    if (params.sortUpdatedAt !== undefined) qp.sortUpdatedAt = params.sortUpdatedAt;
    if (params.afterCreatedAt !== undefined) qp.afterCreatedAt = params.afterCreatedAt;
    if (params.beforeCreatedAt !== undefined) qp.beforeCreatedAt = params.beforeCreatedAt;
    if (params.afterUpdatedAt !== undefined) qp.afterUpdatedAt = params.afterUpdatedAt;
    if (params.beforeUpdatedAt !== undefined) qp.beforeUpdatedAt = params.beforeUpdatedAt;
    if (params.routedToBookingUid !== undefined) qp.routedToBookingUid = params.routedToBookingUid;
    const data = await calApi(`organizations/${params.orgId}/routing-forms/${params.routingFormId}/responses`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_routing_form_responses", err);
  }
}

export const createOrgRoutingFormResponseSchema = {
  orgId: z.number().int().describe("orgId"),
  routingFormId: z.string().describe("routingFormId"),
  start: z.string().describe("Time starting from which available slots should be checked.            Must be in UTC timezone as ISO 8601 datestring.              You can pass date without hours which defaults to start of day or sp"),
  end: z.string().describe("Time until which available slots should be checked.              Must be in UTC timezone as ISO 8601 datestring.              You can pass date without hours which defaults to end of day or specify ho"),
  timeZone: z.string().describe("Time zone in which the available slots should be returned. Defaults to UTC.").optional(),
  duration: z.number().describe("If event type has multiple possible durations then you can specify the desired duration here. Also, if you are fetching slots for a dynamic event then you can specify the duration her which defaults t").optional(),
  format: z.enum(["range", "time"]).describe("Format of slot times in response. Use 'range' to get start and end times.").optional(),
  bookingUidToReschedule: z.string().describe("The unique identifier of the booking being rescheduled. When provided will ensure that the original booking time appears within the returned available slots when rescheduling.").optional(),
  queueResponse: z.boolean().describe("Whether to queue the form response.").optional(),
};

export async function createOrgRoutingFormResponse(params: {
  orgId: number;
  routingFormId: string;
  start: string;
  end: string;
  timeZone?: string;
  duration?: number;
  format?: "range" | "time";
  bookingUidToReschedule?: string;
  queueResponse?: boolean;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/routing-forms/${params.routingFormId}/responses`, { method: "POST", body: {} });
    return ok(data);
  } catch (err) {
    return handleError("create_org_routing_form_response", err);
  }
}

export const updateOrgRoutingFormResponseSchema = {
  orgId: z.number().int().describe("orgId"),
  routingFormId: z.string().describe("routingFormId"),
  responseId: z.number().int().describe("responseId"),
  response: z.record(z.unknown()).describe("The updated response data").optional(),
};

export async function updateOrgRoutingFormResponse(params: {
  orgId: number;
  routingFormId: string;
  responseId: number;
  response?: Record<string, unknown>;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.response !== undefined) body.response = params.response;
    const data = await calApi(`organizations/${params.orgId}/routing-forms/${params.routingFormId}/responses/${params.responseId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_routing_form_response", err);
  }
}
