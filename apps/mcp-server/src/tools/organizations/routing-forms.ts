import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { sanitizePathSegment } from "../../utils/path-sanitizer.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

export const getOrgRoutingFormsSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  skip: z.number().optional().describe("Results to skip"),
  take: z.number().optional().describe("Max results"),
  sortCreatedAt: z.enum(["asc", "desc"]).optional().describe("Sort by created"),
  sortUpdatedAt: z.enum(["asc", "desc"]).optional().describe("Sort by updated"),
  afterCreatedAt: z.string().optional().describe("Created after (ISO 8601)"),
  beforeCreatedAt: z.string().optional().describe("Created before (ISO 8601)"),
  afterUpdatedAt: z.string().optional().describe("Updated after (ISO 8601)"),
  beforeUpdatedAt: z.string().optional().describe("Updated before (ISO 8601)"),
  routedToBookingUid: z.string().optional().describe("Filter by routed booking UID"),
  teamIds: z.array(z.number()).optional().describe("Filter by team IDs"),
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
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  routingFormId: z.string().describe("Routing form ID. Use get_org_routing_forms to find this — never guess."),
  skip: z.number().optional().describe("Results to skip"),
  take: z.number().optional().describe("Max results"),
  sortCreatedAt: z.enum(["asc", "desc"]).optional().describe("Sort by created"),
  sortUpdatedAt: z.enum(["asc", "desc"]).optional().describe("Sort by updated"),
  afterCreatedAt: z.string().optional().describe("Created after (ISO 8601)"),
  beforeCreatedAt: z.string().optional().describe("Created before (ISO 8601)"),
  afterUpdatedAt: z.string().optional().describe("Updated after (ISO 8601)"),
  beforeUpdatedAt: z.string().optional().describe("Updated before (ISO 8601)"),
  routedToBookingUid: z.string().optional().describe("Filter by routed booking UID"),
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
    const formId = sanitizePathSegment(params.routingFormId);
    const data = await calApi(`organizations/${params.orgId}/routing-forms/${formId}/responses`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_routing_form_responses", err);
  }
}
