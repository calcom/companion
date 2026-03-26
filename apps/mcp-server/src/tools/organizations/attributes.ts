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

export const getOrgAttributesSchema = {
  orgId: z.number().int().describe("orgId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgAttributes(params: {
  orgId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/attributes`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_attributes", err);
  }
}

export const createOrgAttributeSchema = {
  orgId: z.number().int().describe("orgId"),
  name: z.string(),
  slug: z.string(),
  type: z.enum(["TEXT", "NUMBER", "SINGLE_SELECT", "MULTI_SELECT"]),
  options: z.array(z.object({
    value: z.string(),
    slug: z.string(),
  })),
  enabled: z.boolean().optional(),
};

export async function createOrgAttribute(params: {
  orgId: number;
  name: string;
  slug: string;
  type: "TEXT" | "NUMBER" | "SINGLE_SELECT" | "MULTI_SELECT";
  options: { value: string; slug: string }[];
  enabled?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.name = params.name;
    body.slug = params.slug;
    body.type = params.type;
    body.options = params.options;
    if (params.enabled !== undefined) body.enabled = params.enabled;
    const data = await calApi(`organizations/${params.orgId}/attributes`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_attribute", err);
  }
}

export const getOrgAttributeSchema = {
  orgId: z.number().int().describe("orgId"),
  attributeId: z.string().describe("attributeId"),
};

export async function getOrgAttribute(params: {
  orgId: number;
  attributeId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/attributes/${params.attributeId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_attribute", err);
  }
}

export const updateOrgAttributeSchema = {
  orgId: z.number().int().describe("orgId"),
  attributeId: z.string().describe("attributeId"),
  name: z.string().optional(),
  slug: z.string().optional(),
  type: z.enum(["TEXT", "NUMBER", "SINGLE_SELECT", "MULTI_SELECT"]).optional(),
  enabled: z.boolean().optional(),
};

export async function updateOrgAttribute(params: {
  orgId: number;
  attributeId: string;
  name?: string;
  slug?: string;
  type?: "TEXT" | "NUMBER" | "SINGLE_SELECT" | "MULTI_SELECT";
  enabled?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.slug !== undefined) body.slug = params.slug;
    if (params.type !== undefined) body.type = params.type;
    if (params.enabled !== undefined) body.enabled = params.enabled;
    const data = await calApi(`organizations/${params.orgId}/attributes/${params.attributeId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_attribute", err);
  }
}

export const deleteOrgAttributeSchema = {
  orgId: z.number().int().describe("orgId"),
  attributeId: z.string().describe("attributeId"),
};

export async function deleteOrgAttribute(params: {
  orgId: number;
  attributeId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/attributes/${params.attributeId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_attribute", err);
  }
}

export const createOrgAttributeOptionSchema = {
  orgId: z.number().int().describe("orgId"),
  attributeId: z.string().describe("attributeId"),
  value: z.string(),
  slug: z.string(),
};

export async function createOrgAttributeOption(params: {
  orgId: number;
  attributeId: string;
  value: string;
  slug: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.value = params.value;
    body.slug = params.slug;
    const data = await calApi(`organizations/${params.orgId}/attributes/${params.attributeId}/options`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_attribute_option", err);
  }
}

export const getOrgAttributeOptionsSchema = {
  orgId: z.number().int().describe("orgId"),
  attributeId: z.string().describe("attributeId"),
};

export async function getOrgAttributeOptions(params: {
  orgId: number;
  attributeId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/attributes/${params.attributeId}/options`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_attribute_options", err);
  }
}

export const deleteOrgAttributeOptionSchema = {
  orgId: z.number().int().describe("orgId"),
  attributeId: z.string().describe("attributeId"),
  optionId: z.string().describe("optionId"),
};

export async function deleteOrgAttributeOption(params: {
  orgId: number;
  attributeId: string;
  optionId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/attributes/${params.attributeId}/options/${params.optionId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_attribute_option", err);
  }
}

export const updateOrgAttributeOptionSchema = {
  orgId: z.number().int().describe("orgId"),
  attributeId: z.string().describe("attributeId"),
  optionId: z.string().describe("optionId"),
  value: z.string().optional(),
  slug: z.string().optional(),
};

export async function updateOrgAttributeOption(params: {
  orgId: number;
  attributeId: string;
  optionId: string;
  value?: string;
  slug?: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.value !== undefined) body.value = params.value;
    if (params.slug !== undefined) body.slug = params.slug;
    const data = await calApi(`organizations/${params.orgId}/attributes/${params.attributeId}/options/${params.optionId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_attribute_option", err);
  }
}

export const getOrgAttributeAssignedOptionsSchema = {
  orgId: z.number().int().describe("orgId"),
  attributeId: z.string().describe("attributeId"),
  skip: z.number().describe("Number of responses to skip").optional(),
  take: z.number().describe("Number of responses to take").optional(),
  assignedOptionIds: z.array(z.string()).describe("Filter by assigned attribute option ids. ids must be separated by a comma.").optional(),
  teamIds: z.array(z.number()).describe("Filter by teamIds. Team ids must be separated by a comma.").optional(),
};

export async function getOrgAttributeAssignedOptions(params: {
  orgId: number;
  attributeId: string;
  skip?: number;
  take?: number;
  assignedOptionIds?: string[];
  teamIds?: number[];
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.take !== undefined) qp.take = params.take;
    if (params.assignedOptionIds !== undefined) qp.assignedOptionIds = params.assignedOptionIds;
    if (params.teamIds !== undefined) qp.teamIds = params.teamIds;
    const data = await calApi(`organizations/${params.orgId}/attributes/${params.attributeId}/options/assigned`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_attribute_assigned_options", err);
  }
}

export const getOrgAttributeOptionsBySlugSchema = {
  orgId: z.number().int().describe("orgId"),
  attributeSlug: z.string().describe("attributeSlug"),
  skip: z.number().describe("Number of responses to skip").optional(),
  take: z.number().describe("Number of responses to take").optional(),
  assignedOptionIds: z.array(z.string()).describe("Filter by assigned attribute option ids. ids must be separated by a comma.").optional(),
  teamIds: z.array(z.number()).describe("Filter by teamIds. Team ids must be separated by a comma.").optional(),
};

export async function getOrgAttributeOptionsBySlug(params: {
  orgId: number;
  attributeSlug: string;
  skip?: number;
  take?: number;
  assignedOptionIds?: string[];
  teamIds?: number[];
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.take !== undefined) qp.take = params.take;
    if (params.assignedOptionIds !== undefined) qp.assignedOptionIds = params.assignedOptionIds;
    if (params.teamIds !== undefined) qp.teamIds = params.teamIds;
    const data = await calApi(`organizations/${params.orgId}/attributes/slugs/${params.attributeSlug}/options/assigned`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_attribute_options_by_slug", err);
  }
}

export const assignOrgAttributeToUserSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  value: z.string().optional(),
  attributeOptionId: z.string().optional(),
  attributeId: z.string(),
};

export async function assignOrgAttributeToUser(params: {
  orgId: number;
  userId: number;
  value?: string;
  attributeOptionId?: string;
  attributeId: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.value !== undefined) body.value = params.value;
    if (params.attributeOptionId !== undefined) body.attributeOptionId = params.attributeOptionId;
    body.attributeId = params.attributeId;
    const data = await calApi(`organizations/${params.orgId}/attributes/options/${params.userId}`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("assign_org_attribute_to_user", err);
  }
}

export const getOrgUserAttributeOptionsSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
};

export async function getOrgUserAttributeOptions(params: {
  orgId: number;
  userId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/attributes/options/${params.userId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_user_attribute_options", err);
  }
}

export const unassignOrgAttributeFromUserSchema = {
  orgId: z.number().int().describe("orgId"),
  userId: z.number().int().describe("userId"),
  attributeOptionId: z.string().describe("attributeOptionId"),
};

export async function unassignOrgAttributeFromUser(params: {
  orgId: number;
  userId: number;
  attributeOptionId: string;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/attributes/options/${params.userId}/${params.attributeOptionId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("unassign_org_attribute_from_user", err);
  }
}
