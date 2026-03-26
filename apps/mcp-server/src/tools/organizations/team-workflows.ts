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

export const getOrgTeamWorkflowsSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgTeamWorkflows(params: {
  orgId: number;
  teamId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/workflows`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_workflows", err);
  }
}

export const createOrgTeamWorkflowSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  name: z.string().describe("Name of the workflow"),
  activation: z.object({
    isActiveOnAllEventTypes: z.boolean().describe("Whether the workflow is active for all the event-types"),
    activeOnEventTypeIds: z.array(z.number()).optional().describe("List of event-types IDs the workflow applies to, required if isActiveOnAllEventTypes is false"),
  }),
  trigger: z.object({
    offset: z.object({
    value: z.number().describe("Time value for offset before/after event trigger"),
    unit: z.enum(["hour", "minute", "day"]).describe("Unit for the offset time"),
  }),
    type: z.enum(["beforeEvent"]).describe("Trigger type for the workflow"),
  }),
  steps: z.array(z.object({
    action: z.enum(["email_host", "email_attendee", "email_address", "sms_attendee", "sms_number", "whatsapp_attendee", "whatsapp_number", "cal_ai_phone_call"]).describe("Action to perform, send an email to a specific email address"),
    stepNumber: z.number().describe("Step number in the workflow sequence"),
    recipient: z.enum(["const", "attendee", "email", "phone_number"]).describe("Recipient type"),
    template: z.enum(["reminder", "custom", "rescheduled", "completed", "rating", "cancelled"]).describe("Template type for the step"),
    sender: z.string().describe("Displayed sender name."),
    verifiedEmailId: z.number().describe("Email address if recipient is EMAIL, required for action EMAIL_ADDRESS"),
    includeCalendarEvent: z.record(z.unknown()).describe("Whether to include a calendar event in the notification, can be included with actions email_host, email_attendee, email_address"),
    message: z.object({
    subject: z.string().describe("Subject of the message"),
    html: z.string().describe("HTML content of the message (used for Emails)"),
  }),
  })),
};

export async function createOrgTeamWorkflow(params: {
  orgId: number;
  teamId: number;
  name: string;
  activation: { isActiveOnAllEventTypes: boolean; activeOnEventTypeIds?: number[] };
  trigger: { offset: { value: number; unit: "hour" | "minute" | "day" }; type: "beforeEvent" };
  steps: { action: "email_host" | "email_attendee" | "email_address" | "sms_attendee" | "sms_number" | "whatsapp_attendee" | "whatsapp_number" | "cal_ai_phone_call"; stepNumber: number; recipient: "const" | "attendee" | "email" | "phone_number"; template: "reminder" | "custom" | "rescheduled" | "completed" | "rating" | "cancelled"; sender: string; verifiedEmailId: number; includeCalendarEvent: Record<string, unknown>; message: { subject: string; html: string } }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    body.name = params.name;
    body.activation = params.activation;
    body.trigger = params.trigger;
    body.steps = params.steps;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/workflows`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_team_workflow", err);
  }
}

export const getOrgTeamRfWorkflowsSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  take: z.number().describe("Maximum number of items to return").optional(),
  skip: z.number().describe("Number of items to skip").optional(),
};

export async function getOrgTeamRfWorkflows(params: {
  orgId: number;
  teamId: number;
  take?: number;
  skip?: number;
}) {
  try {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params.take !== undefined) qp.take = params.take;
    if (params.skip !== undefined) qp.skip = params.skip;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/workflows/routing-form`, { params: qp });
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_rf_workflows", err);
  }
}

export const createOrgTeamRfWorkflowSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  name: z.string().describe("Name of the workflow"),
  activation: z.object({
    isActiveOnAllRoutingForms: z.boolean().describe("Whether the workflow is active for all the routing forms"),
    activeOnRoutingFormIds: z.array(z.number()).optional().describe("List of routing form IDs the workflow applies to"),
  }),
  trigger: z.object({
    type: z.enum(["formSubmitted"]).describe("Trigger type for the workflow"),
  }),
  steps: z.array(z.object({
    action: z.enum(["email_host", "email_attendee", "email_address", "sms_attendee", "sms_number", "whatsapp_attendee", "whatsapp_number", "cal_ai_phone_call"]).describe("Action to perform, send an email to a specific email address"),
    stepNumber: z.number().describe("Step number in the workflow sequence"),
    recipient: z.enum(["const", "attendee", "email", "phone_number"]).describe("Recipient type"),
    template: z.enum(["reminder", "custom", "rescheduled", "completed", "rating", "cancelled"]).describe("Template type for the step"),
    sender: z.string().describe("Displayed sender name."),
    verifiedEmailId: z.number().describe("Email address if recipient is EMAIL, required for action EMAIL_ADDRESS"),
    includeCalendarEvent: z.record(z.unknown()).describe("Whether to include a calendar event in the notification, can be included with actions email_host, email_attendee, email_address"),
    message: z.object({
    subject: z.string().describe("Subject of the message"),
    html: z.string().describe("HTML content of the message (used for Emails)"),
  }),
  })),
};

export async function createOrgTeamRfWorkflow(params: {
  orgId: number;
  teamId: number;
  name: string;
  activation: { isActiveOnAllRoutingForms: boolean; activeOnRoutingFormIds?: number[] };
  trigger: { type: "formSubmitted" };
  steps: { action: "email_host" | "email_attendee" | "email_address" | "sms_attendee" | "sms_number" | "whatsapp_attendee" | "whatsapp_number" | "cal_ai_phone_call"; stepNumber: number; recipient: "const" | "attendee" | "email" | "phone_number"; template: "reminder" | "custom" | "rescheduled" | "completed" | "rating" | "cancelled"; sender: string; verifiedEmailId: number; includeCalendarEvent: Record<string, unknown>; message: { subject: string; html: string } }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    body.name = params.name;
    body.activation = params.activation;
    body.trigger = params.trigger;
    body.steps = params.steps;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/workflows/routing-form`, { method: "POST", body });
    return ok(data);
  } catch (err) {
    return handleError("create_org_team_rf_workflow", err);
  }
}

export const getOrgTeamWorkflowSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  workflowId: z.number().int().describe("workflowId"),
};

export async function getOrgTeamWorkflow(params: {
  orgId: number;
  teamId: number;
  workflowId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/workflows/${params.workflowId}`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_workflow", err);
  }
}

export const updateOrgTeamWorkflowSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  workflowId: z.number().int().describe("workflowId"),
  name: z.string().describe("Name of the workflow").optional(),
  activation: z.object({
    isActiveOnAllEventTypes: z.boolean().describe("Whether the workflow is active for all the event-types"),
    activeOnEventTypeIds: z.array(z.number()).optional().describe("List of event-types IDs the workflow applies to, required if isActiveOnAllEventTypes is false"),
  }),
  trigger: z.object({
    offset: z.object({
    value: z.number().describe("Time value for offset before/after event trigger"),
    unit: z.enum(["hour", "minute", "day"]).describe("Unit for the offset time"),
  }),
    type: z.enum(["beforeEvent"]).describe("Trigger type for the workflow"),
  }).optional(),
  steps: z.array(z.object({
    action: z.enum(["email_host", "email_attendee", "email_address", "sms_attendee", "sms_number", "whatsapp_attendee", "whatsapp_number", "cal_ai_phone_call"]).describe("Action to perform, send an email to a specific email address"),
    stepNumber: z.number().describe("Step number in the workflow sequence"),
    recipient: z.enum(["const", "attendee", "email", "phone_number"]).describe("Recipient type"),
    template: z.enum(["reminder", "custom", "rescheduled", "completed", "rating", "cancelled"]).describe("Template type for the step"),
    sender: z.string().describe("Displayed sender name."),
    verifiedEmailId: z.number().describe("Email address if recipient is EMAIL, required for action EMAIL_ADDRESS"),
    includeCalendarEvent: z.record(z.unknown()).describe("Whether to include a calendar event in the notification, can be included with actions email_host, email_attendee, email_address"),
    message: z.object({
    subject: z.string().describe("Subject of the message"),
    html: z.string().describe("HTML content of the message (used for Emails)"),
  }),
    id: z.number().optional().describe("Unique identifier of the step you want to update, if adding a new step do not provide this id"),
  })),
};

export async function updateOrgTeamWorkflow(params: {
  orgId: number;
  teamId: number;
  workflowId: number;
  name?: string;
  activation?: { isActiveOnAllEventTypes: boolean; activeOnEventTypeIds?: number[] };
  trigger?: { offset: { value: number; unit: "hour" | "minute" | "day" }; type: "beforeEvent" };
  steps?: { action: "email_host" | "email_attendee" | "email_address" | "sms_attendee" | "sms_number" | "whatsapp_attendee" | "whatsapp_number" | "cal_ai_phone_call"; stepNumber: number; recipient: "const" | "attendee" | "email" | "phone_number"; template: "reminder" | "custom" | "rescheduled" | "completed" | "rating" | "cancelled"; sender: string; verifiedEmailId: number; includeCalendarEvent: Record<string, unknown>; message: { subject: string; html: string }; id?: number }[];
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.activation !== undefined) body.activation = params.activation;
    if (params.trigger !== undefined) body.trigger = params.trigger;
    if (params.steps !== undefined) body.steps = params.steps;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/workflows/${params.workflowId}`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_team_workflow", err);
  }
}

export const deleteOrgTeamWorkflowSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  workflowId: z.number().int().describe("workflowId"),
};

export async function deleteOrgTeamWorkflow(params: {
  orgId: number;
  teamId: number;
  workflowId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/workflows/${params.workflowId}`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_team_workflow", err);
  }
}

export const getOrgTeamRfWorkflowSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  workflowId: z.number().int().describe("workflowId"),
};

export async function getOrgTeamRfWorkflow(params: {
  orgId: number;
  teamId: number;
  workflowId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/workflows/${params.workflowId}/routing-form`);
    return ok(data);
  } catch (err) {
    return handleError("get_org_team_rf_workflow", err);
  }
}

export const updateOrgTeamRfWorkflowSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  workflowId: z.number().int().describe("workflowId"),
  name: z.string().describe("Name of the workflow").optional(),
  trigger: z.object({
    type: z.enum(["formSubmitted"]).describe("Trigger type for the workflow"),
  }).optional(),
  steps: z.array(z.object({
    action: z.enum(["email_host", "email_attendee", "email_address", "sms_attendee", "sms_number", "whatsapp_attendee", "whatsapp_number", "cal_ai_phone_call"]).describe("Action to perform, send an email to a specific email address"),
    stepNumber: z.number().describe("Step number in the workflow sequence"),
    recipient: z.enum(["const", "attendee", "email", "phone_number"]).describe("Recipient type"),
    template: z.enum(["reminder", "custom", "rescheduled", "completed", "rating", "cancelled"]).describe("Template type for the step"),
    sender: z.string().describe("Displayed sender name."),
    verifiedEmailId: z.number().describe("Email address if recipient is EMAIL, required for action EMAIL_ADDRESS"),
    includeCalendarEvent: z.record(z.unknown()).describe("Whether to include a calendar event in the notification, can be included with actions email_host, email_attendee, email_address"),
    message: z.object({
    subject: z.string().describe("Subject of the message"),
    html: z.string().describe("HTML content of the message (used for Emails)"),
  }),
    id: z.number().optional().describe("Unique identifier of the step you want to update, if adding a new step do not provide this id"),
  })),
  activation: z.object({
    isActiveOnAllRoutingForms: z.boolean().describe("Whether the workflow is active for all the routing forms"),
    activeOnRoutingFormIds: z.array(z.number()).optional().describe("List of routing form IDs the workflow applies to"),
  }),
};

export async function updateOrgTeamRfWorkflow(params: {
  orgId: number;
  teamId: number;
  workflowId: number;
  name?: string;
  trigger?: { type: "formSubmitted" };
  steps?: { action: "email_host" | "email_attendee" | "email_address" | "sms_attendee" | "sms_number" | "whatsapp_attendee" | "whatsapp_number" | "cal_ai_phone_call"; stepNumber: number; recipient: "const" | "attendee" | "email" | "phone_number"; template: "reminder" | "custom" | "rescheduled" | "completed" | "rating" | "cancelled"; sender: string; verifiedEmailId: number; includeCalendarEvent: Record<string, unknown>; message: { subject: string; html: string }; id?: number }[];
  activation?: { isActiveOnAllRoutingForms: boolean; activeOnRoutingFormIds?: number[] };
}) {
  try {
    const body: Record<string, unknown> = {};
    if (params.name !== undefined) body.name = params.name;
    if (params.trigger !== undefined) body.trigger = params.trigger;
    if (params.steps !== undefined) body.steps = params.steps;
    if (params.activation !== undefined) body.activation = params.activation;
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/workflows/${params.workflowId}/routing-form`, { method: "PATCH", body });
    return ok(data);
  } catch (err) {
    return handleError("update_org_team_rf_workflow", err);
  }
}

export const deleteOrgTeamRfWorkflowSchema = {
  orgId: z.number().int().describe("orgId"),
  teamId: z.number().int().describe("teamId"),
  workflowId: z.number().int().describe("workflowId"),
};

export async function deleteOrgTeamRfWorkflow(params: {
  orgId: number;
  teamId: number;
  workflowId: number;
}) {
  try {
    const data = await calApi(`organizations/${params.orgId}/teams/${params.teamId}/workflows/${params.workflowId}/routing-form`, { method: "DELETE" });
    return ok(data);
  } catch (err) {
    return handleError("delete_org_team_rf_workflow", err);
  }
}
