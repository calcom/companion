import { z } from "zod";
import { calApi } from "../../utils/api-client.js";
import { sanitizePathSegment } from "../../utils/path-sanitizer.js";
import { handleError, ok } from "../../utils/tool-helpers.js";

// ── List all attributes ──

export const getOrgAttributesSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  take: z.number().optional().describe("Max results to return"),
  skip: z.number().optional().describe("Results to skip (offset)"),
};

export async function getOrgAttributes(params: { orgId: number; take?: number; skip?: number }) {
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

// ── Get single attribute ──

export const getOrgAttributeSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  attributeId: z
    .string()
    .describe("Attribute ID. Use get_org_attributes to find this — never guess."),
};

export async function getOrgAttribute(params: { orgId: number; attributeId: string }) {
  try {
    const attrId = sanitizePathSegment(params.attributeId);
    const data = await calApi(`organizations/${params.orgId}/attributes/${attrId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_attribute", err);
  }
}

// ── Create attribute ──

export const createOrgAttributeSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  name: z.string().describe("Name of the attribute"),
  slug: z.string().describe("URL-friendly slug for the attribute"),
  type: z.enum(["TEXT", "NUMBER", "SINGLE_SELECT", "MULTI_SELECT"]).describe("Attribute type"),
  options: z
    .array(
      z.object({
        value: z.string().describe("Option value"),
        slug: z.string().optional().describe("Option slug"),
      })
    )
    .optional()
    .describe("Options for SELECT-type attributes"),
  enabled: z.boolean().optional().describe("Whether the attribute is enabled"),
};

export async function createOrgAttribute(params: {
  orgId: number;
  name: string;
  slug: string;
  type: "TEXT" | "NUMBER" | "SINGLE_SELECT" | "MULTI_SELECT";
  options?: { value: string; slug?: string }[];
  enabled?: boolean;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.name = params.name;
    body.slug = params.slug;
    body.type = params.type;
    if (params.options !== undefined) body.options = params.options;
    if (params.enabled !== undefined) body.enabled = params.enabled;
    const data = await calApi(`organizations/${params.orgId}/attributes`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_attribute", err);
  }
}

// ── Update attribute ──

export const updateOrgAttributeSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  attributeId: z
    .string()
    .describe("Attribute ID. Use get_org_attributes to find this — never guess."),
  name: z.string().optional().describe("Updated name"),
  slug: z.string().optional().describe("Updated slug"),
  type: z
    .enum(["TEXT", "NUMBER", "SINGLE_SELECT", "MULTI_SELECT"])
    .optional()
    .describe("Updated attribute type"),
  enabled: z.boolean().optional().describe("Whether the attribute is enabled"),
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
    const attrId = sanitizePathSegment(params.attributeId);
    const data = await calApi(`organizations/${params.orgId}/attributes/${attrId}`, {
      method: "PATCH",
      body,
    });
    return ok(data);
  } catch (err) {
    return handleError("update_org_attribute", err);
  }
}

// ── Delete attribute ──

export const deleteOrgAttributeSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  attributeId: z
    .string()
    .describe("Attribute ID. Use get_org_attributes to find this — never guess."),
};

export async function deleteOrgAttribute(params: { orgId: number; attributeId: string }) {
  try {
    const attrId = sanitizePathSegment(params.attributeId);
    const data = await calApi(`organizations/${params.orgId}/attributes/${attrId}`, {
      method: "DELETE",
    });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_attribute", err);
  }
}

// ── List options for an attribute ──

export const getOrgAttributeOptionsSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  attributeId: z
    .string()
    .describe("Attribute ID. Use get_org_attributes to find this — never guess."),
  take: z.number().optional().describe("Max results to return"),
  skip: z.number().optional().describe("Results to skip (offset)"),
};

export async function getOrgAttributeOptions(params: {
  orgId: number;
  attributeId: string;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const attrId = sanitizePathSegment(params.attributeId);
    const data = await calApi(`organizations/${params.orgId}/attributes/${attrId}/options`, {
      params: qp,
    });
    return ok(data);
  } catch (err) {
    return handleError("get_org_attribute_options", err);
  }
}

// ── List assigned options for an attribute ──

export const getAssignedAttributeOptionsSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  attributeId: z
    .string()
    .describe("Attribute ID. Use get_org_attributes to find this — never guess."),
};

export async function getAssignedAttributeOptions(params: { orgId: number; attributeId: string }) {
  try {
    const attrId = sanitizePathSegment(params.attributeId);
    const data = await calApi(
      `organizations/${params.orgId}/attributes/${attrId}/options/assigned`
    );
    return ok(data);
  } catch (err) {
    return handleError("get_assigned_attribute_options", err);
  }
}

// ── List assigned options by attribute slug ──

export const getAssignedAttributeOptionsBySlugSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  attributeSlug: z
    .string()
    .describe("Attribute slug. Use get_org_attributes to find this — never guess."),
};

export async function getAssignedAttributeOptionsBySlug(params: {
  orgId: number;
  attributeSlug: string;
}) {
  try {
    const slug = sanitizePathSegment(params.attributeSlug);
    const data = await calApi(
      `organizations/${params.orgId}/attributes/slugs/${slug}/options/assigned`
    );
    return ok(data);
  } catch (err) {
    return handleError("get_assigned_attribute_options_by_slug", err);
  }
}

// ── Create attribute option ──

export const createOrgAttributeOptionSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  attributeId: z
    .string()
    .describe("Attribute ID. Use get_org_attributes to find this — never guess."),
  value: z.string().describe("Value for the new option"),
  slug: z.string().optional().describe("URL-friendly slug for the option"),
};

export async function createOrgAttributeOption(params: {
  orgId: number;
  attributeId: string;
  value: string;
  slug?: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.value = params.value;
    if (params.slug !== undefined) body.slug = params.slug;
    const attrId = sanitizePathSegment(params.attributeId);
    const data = await calApi(`organizations/${params.orgId}/attributes/${attrId}/options`, {
      method: "POST",
      body,
    });
    return ok(data);
  } catch (err) {
    return handleError("create_org_attribute_option", err);
  }
}

// ── Update attribute option ──

export const updateOrgAttributeOptionSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  attributeId: z
    .string()
    .describe("Attribute ID. Use get_org_attributes to find this — never guess."),
  optionId: z
    .string()
    .describe("Option ID. Use get_org_attribute_options to find this — never guess."),
  value: z.string().optional().describe("Updated option value"),
  slug: z.string().optional().describe("Updated option slug"),
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
    const attrId = sanitizePathSegment(params.attributeId);
    const optId = sanitizePathSegment(params.optionId);
    const data = await calApi(
      `organizations/${params.orgId}/attributes/${attrId}/options/${optId}`,
      {
        method: "PATCH",
        body,
      }
    );
    return ok(data);
  } catch (err) {
    return handleError("update_org_attribute_option", err);
  }
}

// ── Delete attribute option ──

export const deleteOrgAttributeOptionSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  attributeId: z
    .string()
    .describe("Attribute ID. Use get_org_attributes to find this — never guess."),
  optionId: z
    .string()
    .describe("Option ID. Use get_org_attribute_options to find this — never guess."),
};

export async function deleteOrgAttributeOption(params: {
  orgId: number;
  attributeId: string;
  optionId: string;
}) {
  try {
    const attrId = sanitizePathSegment(params.attributeId);
    const optId = sanitizePathSegment(params.optionId);
    const data = await calApi(
      `organizations/${params.orgId}/attributes/${attrId}/options/${optId}`,
      {
        method: "DELETE",
      }
    );
    return ok(data);
  } catch (err) {
    return handleError("delete_org_attribute_option", err);
  }
}

// ── Get attributes assigned to a user ──

export const getUserAttributeOptionsSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  userId: z
    .number()
    .int()
    .describe("User ID. Use get_org_memberships or get_me to find this — never guess."),
};

export async function getUserAttributeOptions(params: { orgId: number; userId: number }) {
  try {
    const data = await calApi(`organizations/${params.orgId}/attributes/options/${params.userId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_user_attribute_options", err);
  }
}

// ── Assign attribute option to user ──

export const assignAttributeToUserSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  userId: z
    .number()
    .int()
    .describe("User ID. Use get_org_memberships or get_me to find this — never guess."),
  attributeOptionId: z
    .string()
    .describe(
      "Attribute option ID to assign. Use get_org_attribute_options to find this — never guess."
    ),
  value: z.string().optional().describe("Value for TEXT/NUMBER attributes"),
};

export async function assignAttributeToUser(params: {
  orgId: number;
  userId: number;
  attributeOptionId: string;
  value?: string;
}) {
  try {
    const body: Record<string, unknown> = {};
    body.attributeOptionId = params.attributeOptionId;
    if (params.value !== undefined) body.value = params.value;
    const data = await calApi(`organizations/${params.orgId}/attributes/options/${params.userId}`, {
      method: "POST",
      body,
    });
    return ok(data);
  } catch (err) {
    return handleError("assign_attribute_to_user", err);
  }
}

// ── Update user attribute assignment ──

export const updateUserAttributeAssignmentSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  userId: z
    .number()
    .int()
    .describe("User ID. Use get_org_memberships or get_me to find this — never guess."),
  attributeOptionId: z
    .string()
    .describe(
      "Attribute option ID of the assignment to update. Use get_user_attribute_options to find this — never guess."
    ),
  weight: z.number().optional().describe("New weight for round-robin routing"),
};

export async function updateUserAttributeAssignment(params: {
  orgId: number;
  userId: number;
  attributeOptionId: string;
  weight?: number;
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.weight !== undefined) body.weight = params.weight;
    const optId = sanitizePathSegment(params.attributeOptionId);
    const data = await calApi(
      `organizations/${params.orgId}/attributes/options/${params.userId}/${optId}`,
      {
        method: "PATCH",
        body,
      }
    );
    return ok(data);
  } catch (err) {
    return handleError("update_user_attribute_assignment", err);
  }
}

// ── Remove attribute from user ──

export const removeAttributeFromUserSchema = {
  orgId: z
    .number()
    .int()
    .describe("Organization ID. Use get_me to obtain your organizationId — never guess."),
  userId: z
    .number()
    .int()
    .describe("User ID. Use get_org_memberships or get_me to find this — never guess."),
  attributeOptionId: z
    .string()
    .describe(
      "Attribute option ID to remove. Use get_user_attribute_options to find this — never guess."
    ),
};

export async function removeAttributeFromUser(params: {
  orgId: number;
  userId: number;
  attributeOptionId: string;
}) {
  try {
    const optId = sanitizePathSegment(params.attributeOptionId);
    const data = await calApi(
      `organizations/${params.orgId}/attributes/options/${params.userId}/${optId}`,
      {
        method: "DELETE",
      }
    );
    return ok(data);
  } catch (err) {
    return handleError("remove_attribute_from_user", err);
  }
}
