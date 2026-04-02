import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

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
