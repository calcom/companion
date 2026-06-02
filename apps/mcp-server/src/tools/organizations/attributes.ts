import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

// ── Read: Org Attributes ──

export const getOrgAttributesSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  skip: z.number().int().optional().describe("Results to skip (offset)"),
  take: z.number().int().optional().describe("Max results to return"),
};

export async function getOrgAttributes(params: {
  orgId: number;
  skip?: number;
  take?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.skip !== undefined) qp.skip = params.skip;
    if (params.take !== undefined) qp.take = params.take;
    const data = await calApi(`organizations/${params.orgId}/attributes`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_attributes", err);
  }
}

export const getOrgAttributeSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  attributeId: z.string().describe("Attribute ID. Use get_org_attributes to find this."),
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

// ── Read: User Attributes ──

export const getUserAttributesSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  userId: z.number().int().describe("User ID whose attributes to retrieve."),
};

export async function getUserAttributes(params: {
  orgId: number;
  userId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/attributes/options/${params.userId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_user_attributes", err);
  }
}

// ── Write: Assign / Update / Unassign ──

export const assignAttributeToUserSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  userId: z.number().int().describe("User ID to assign the attribute to."),
  attributeId: z.string().describe("Attribute ID. Use get_org_attributes to find this."),
  attributeOptionId: z.string().optional().describe("Existing attribute option ID to assign. Use get_org_attributes to find option IDs. Provide this OR value, not both."),
  value: z.string().optional().describe("Value for TEXT/NUMBER attributes (creates an option on the fly). Provide this OR attributeOptionId, not both."),
  weight: z.number().int().min(0).optional().describe("Weight of this attribute assignment for the user (used in round-robin)."),
};

export async function assignAttributeToUser(params: {
  orgId: number;
  userId: number;
  attributeId: string;
  attributeOptionId?: string;
  value?: string;
  weight?: number;
}) {
  try {
    const body: Record<string, unknown> = { attributeId: params.attributeId };
    if (params.attributeOptionId !== undefined) body.attributeOptionId = params.attributeOptionId;
    if (params.value !== undefined) body.value = params.value;
    if (params.weight !== undefined) body.weight = params.weight;
    const data = await calApi(`organizations/${params.orgId}/attributes/options/${params.userId}`, {
      method: "POST",
      body,
    });
    return ok(data);
  } catch (err) {
    return handleError("assign_attribute_to_user", err);
  }
}

export const updateUserAttributeSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  userId: z.number().int().describe("User ID whose attribute assignment to update."),
  attributeOptionId: z.string().describe("Attribute option ID of the assignment to update. Use get_user_attributes to find this."),
  weight: z.number().int().min(0).optional().describe("New weight for this attribute assignment."),
};

export async function updateUserAttribute(params: {
  orgId: number;
  userId: number;
  attributeOptionId: string;
  weight?: number;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.weight !== undefined) body.weight = params.weight;
    const data = await calApi(
      `organizations/${params.orgId}/attributes/options/${params.userId}/${params.attributeOptionId}`,
      { method: "PATCH", body },
    );
    return ok(data);
  } catch (err) {
    return handleError("update_user_attribute", err);
  }
}

export const unassignAttributeFromUserSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  userId: z.number().int().describe("User ID to unassign the attribute from."),
  attributeOptionId: z.string().describe("Attribute option ID to unassign. Use get_user_attributes to find this."),
};

export async function unassignAttributeFromUser(params: {
  orgId: number;
  userId: number;
  attributeOptionId: string;
}) {
  try {
    const data = await calApi(
      `organizations/${params.orgId}/attributes/options/${params.userId}/${params.attributeOptionId}`,
      { method: "DELETE" },
    );
    return ok(data);
  } catch (err) {
    return handleError("unassign_attribute_from_user", err);
  }
}
