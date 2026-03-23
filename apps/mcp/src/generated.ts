/**
 * MCP Server generated from OpenAPI spec for @calcom/mcp v1.0.0
 * Generated on: 2026-03-23T10:58:17.628Z
 *
 * DO NOT MANUALLY EDIT THIS FILE.
 * Regenerate using: bun run generate
 */

import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { jsonSchemaToZod } from "json-schema-to-zod";
import { ZodError, z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Type definition for JSON objects
 */
// biome-ignore lint/suspicious/noExplicitAny: JSON objects
export type JsonObject = Record<string, any>;

/**
 * Interface for MCP Tool Definition
 */
export interface McpToolDefinition {
  name: string;
  description: string;
  // biome-ignore lint/suspicious/noExplicitAny: JSON Schema
  inputSchema: any;
  method: string;
  pathTemplate: string;
  executionParameters: { name: string; in: string }[];
  requestBodyContentType?: string;
  // biome-ignore lint/suspicious/noExplicitAny: Security requirements
  securityRequirements: any[];
}

/**
 * Server configuration
 */
export const SERVER_NAME = "@calcom/mcp";
export const SERVER_VERSION = "1.0.0";
export const API_BASE_URL = process.env.API_BASE_URL || "https://api.cal.com";

/**
 * Security schemes from OpenAPI spec
 */
export const securitySchemes: Record<string, unknown> = {};

/**
 * Formats API errors for better readability
 */
function formatApiError(error: AxiosError): string {
  let message = "API request failed.";
  if (error.response) {
    message = `API Error: Status ${error.response.status} (${error.response.statusText || "Status text not available"}). `;
    const responseData = error.response.data;
    const MAX_LEN = 200;
    if (typeof responseData === "string") {
      message += `Response: ${responseData.substring(0, MAX_LEN)}${responseData.length > MAX_LEN ? "..." : ""}`;
    } else if (responseData) {
      try {
        const jsonString = JSON.stringify(responseData);
        message += `Response: ${jsonString.substring(0, MAX_LEN)}${jsonString.length > MAX_LEN ? "..." : ""}`;
      } catch {
        message += "Response: [Could not serialize data]";
      }
    } else {
      message += "No response body received.";
    }
  } else if (error.request) {
    message = "API Network Error: No response received from server.";
    if (error.code) message += ` (Code: ${error.code})`;
  } else {
    message += `API Request Setup Error: ${error.message}`;
  }
  return message;
}

/**
 * Converts a JSON Schema to a Zod schema for runtime validation
 */
function getZodSchemaFromJsonSchema(jsonSchema: unknown, toolName: string): z.ZodTypeAny {
  if (typeof jsonSchema !== "object" || jsonSchema === null) {
    return z.object({}).passthrough();
  }
  try {
    const zodSchemaString = jsonSchemaToZod(jsonSchema);
    const zodSchema = eval(zodSchemaString);
    if (typeof zodSchema?.parse !== "function") {
      throw new Error("Eval did not produce a valid Zod schema.");
    }
    return zodSchema as z.ZodTypeAny;
  } catch (err) {
    console.error(`Failed to generate/evaluate Zod schema for '${toolName}':`, err);
    return z.object({}).passthrough();
  }
}

/**
 * Executes an API tool with the provided arguments
 */
export async function executeApiTool(
  toolName: string,
  definition: McpToolDefinition,
  toolArgs: JsonObject,
  allSecuritySchemes: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    // Validate arguments against the input schema
    let validatedArgs: JsonObject;
    try {
      const zodSchema = getZodSchemaFromJsonSchema(definition.inputSchema, toolName);
      const argsToParse = typeof toolArgs === "object" && toolArgs !== null ? toolArgs : {};
      validatedArgs = zodSchema.parse(argsToParse) as JsonObject;
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const validationErrorMessage = `Invalid arguments for tool '${toolName}': ${error.errors.map((e) => `${e.path.join(".")} (${e.code}): ${e.message}`).join(", ")}`;
        return { content: [{ type: "text", text: validationErrorMessage }] };
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            { type: "text", text: `Internal error during validation setup: ${errorMessage}` },
          ],
        };
      }
    }

    // Prepare URL, query parameters, headers, and request body
    let urlPath = definition.pathTemplate;
    const queryParams: Record<string, unknown> = {};
    const headers: Record<string, string> = { Accept: "application/json" };
    let requestBodyData: unknown;

    // Auto-inject Authorization header from CAL_API_KEY env var
    const calApiKey = process.env.CAL_API_KEY;
    if (calApiKey) {
      headers["authorization"] = calApiKey.startsWith("Bearer ")
        ? calApiKey
        : `Bearer ${calApiKey}`;
    }

    // Apply parameters to the URL path, query, or headers
    definition.executionParameters.forEach((param) => {
      const value = validatedArgs[param.name];
      if (typeof value !== "undefined" && value !== null) {
        if (param.in === "path") {
          urlPath = urlPath.replace(`{${param.name}}`, encodeURIComponent(String(value)));
        } else if (param.in === "query") {
          queryParams[param.name] = value;
        } else if (param.in === "header") {
          headers[param.name.toLowerCase()] = String(value);
        }
      }
    });

    // Handle request body
    if (validatedArgs.requestBody !== undefined) {
      requestBodyData = validatedArgs.requestBody;
      if (definition.requestBodyContentType) {
        headers["content-type"] = definition.requestBodyContentType;
      }
    }

    // Build full URL
    const fullUrl = `${API_BASE_URL}${urlPath}`;

    // Configure request
    const axiosConfig: AxiosRequestConfig = {
      method: definition.method as AxiosRequestConfig["method"],
      url: fullUrl,
      headers,
      params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      data: requestBodyData,
    };

    console.error(`Executing ${definition.method.toUpperCase()} ${fullUrl}`);

    // Execute request
    const response = await axios(axiosConfig);

    // Format response
    let responseText: string;
    if (typeof response.data === "string") {
      responseText = response.data;
    } else {
      responseText = JSON.stringify(response.data, null, 2);
    }

    return {
      content: [
        {
          type: "text",
          text: `API Response (Status: ${response.status}):\n${responseText}`,
        },
      ],
    };
  } catch (error: unknown) {
    let errorMessage: string;
    if (axios.isAxiosError(error)) {
      errorMessage = formatApiError(error);
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = "Unexpected error: " + String(error);
    }
    console.error(`Error during execution of tool '${toolName}':`, errorMessage);
    return { content: [{ type: "text", text: errorMessage }] };
  }
}

/**
 * Map of tool definitions by name
 */
export const toolDefinitionMap: Map<string, McpToolDefinition> = new Map([
  [
    "OrganizationsAttributesController_getOrganizationAttributes",
    {
        "name": "OrganizationsAttributesController_getOrganizationAttributes",
        "description": "Get all attributes",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/attributes",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesController_createOrganizationAttribute",
    {
        "name": "OrganizationsAttributesController_createOrganizationAttribute",
        "description": "Create an attribute",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOrganizationAttributeInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/attributes",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesController_getOrganizationAttribute",
    {
        "name": "OrganizationsAttributesController_getOrganizationAttribute",
        "description": "Get an attribute",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "attributeId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "attributeId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/{attributeId}",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "attributeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesController_updateOrganizationAttribute",
    {
        "name": "OrganizationsAttributesController_updateOrganizationAttribute",
        "description": "Update an attribute",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "attributeId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateOrganizationAttributeInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "attributeId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/{attributeId}",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "attributeId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesController_deleteOrganizationAttribute",
    {
        "name": "OrganizationsAttributesController_deleteOrganizationAttribute",
        "description": "Delete an attribute",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "attributeId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "attributeId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/{attributeId}",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "attributeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesOptionsController_createOrganizationAttributeOption",
    {
        "name": "OrganizationsAttributesOptionsController_createOrganizationAttributeOption",
        "description": "Create an attribute option",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "attributeId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOrganizationAttributeOptionInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "attributeId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/{attributeId}/options",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "attributeId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesOptionsController_getOrganizationAttributeOptions",
    {
        "name": "OrganizationsAttributesOptionsController_getOrganizationAttributeOptions",
        "description": "Get all attribute options",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "attributeId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "attributeId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/{attributeId}/options",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "attributeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesOptionsController_deleteOrganizationAttributeOption",
    {
        "name": "OrganizationsAttributesOptionsController_deleteOrganizationAttributeOption",
        "description": "Delete an attribute option",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "attributeId": {
                    "type": "string"
                },
                "optionId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "attributeId",
                "optionId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/{attributeId}/options/{optionId}",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "attributeId",
                "in": "path"
            },
            {
                "name": "optionId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesOptionsController_updateOrganizationAttributeOption",
    {
        "name": "OrganizationsAttributesOptionsController_updateOrganizationAttributeOption",
        "description": "Update an attribute option",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "attributeId": {
                    "type": "string"
                },
                "optionId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateOrganizationAttributeOptionInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "attributeId",
                "optionId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/{attributeId}/options/{optionId}",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "attributeId",
                "in": "path"
            },
            {
                "name": "optionId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesOptionsController_getOrganizationAttributeAssignedOptions",
    {
        "name": "OrganizationsAttributesOptionsController_getOrganizationAttributeAssignedOptions",
        "description": "Get all assigned attribute options by attribute ID",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "attributeId": {
                    "type": "string"
                },
                "skip": {
                    "type": "number",
                    "description": "Number of responses to skip"
                },
                "take": {
                    "type": "number",
                    "description": "Number of responses to take"
                },
                "assignedOptionIds": {
                    "example": "?assignedOptionIds=aaaaaaaa-bbbb-cccc-dddd-eeeeee1eee,aaaaaaaa-bbbb-cccc-dddd-eeeeee2eee",
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Filter by assigned attribute option ids. ids must be separated by a comma."
                },
                "teamIds": {
                    "example": "?teamIds=100,200",
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Filter by teamIds. Team ids must be separated by a comma."
                }
            },
            "required": [
                "orgId",
                "attributeId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/{attributeId}/options/assigned",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "attributeId",
                "in": "path"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "assignedOptionIds",
                "in": "query"
            },
            {
                "name": "teamIds",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesOptionsController_getOrganizationAttributeAssignedOptionsBySlug",
    {
        "name": "OrganizationsAttributesOptionsController_getOrganizationAttributeAssignedOptionsBySlug",
        "description": "Get all assigned attribute options by attribute slug",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "attributeSlug": {
                    "type": "string"
                },
                "skip": {
                    "type": "number",
                    "description": "Number of responses to skip"
                },
                "take": {
                    "type": "number",
                    "description": "Number of responses to take"
                },
                "assignedOptionIds": {
                    "example": "?assignedOptionIds=aaaaaaaa-bbbb-cccc-dddd-eeeeee1eee,aaaaaaaa-bbbb-cccc-dddd-eeeeee2eee",
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Filter by assigned attribute option ids. ids must be separated by a comma."
                },
                "teamIds": {
                    "example": "?teamIds=100,200",
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Filter by teamIds. Team ids must be separated by a comma."
                }
            },
            "required": [
                "orgId",
                "attributeSlug"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/slugs/{attributeSlug}/options/assigned",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "attributeSlug",
                "in": "path"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "assignedOptionIds",
                "in": "query"
            },
            {
                "name": "teamIds",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesOptionsController_assignOrganizationAttributeOptionToUser",
    {
        "name": "OrganizationsAttributesOptionsController_assignOrganizationAttributeOptionToUser",
        "description": "Assign an attribute to a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "userId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/AssignOrganizationAttributeOptionToUserInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "userId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/options/{userId}",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "userId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesOptionsController_getOrganizationAttributeOptionsForUser",
    {
        "name": "OrganizationsAttributesOptionsController_getOrganizationAttributeOptionsForUser",
        "description": "Get all attribute options for a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "userId": {
                    "type": "number"
                }
            },
            "required": [
                "orgId",
                "userId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/options/{userId}",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "userId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsAttributesOptionsController_unassignOrganizationAttributeOptionFromUser",
    {
        "name": "OrganizationsAttributesOptionsController_unassignOrganizationAttributeOptionFromUser",
        "description": "Unassign an attribute from a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "userId": {
                    "type": "number"
                },
                "attributeOptionId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "userId",
                "attributeOptionId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/attributes/options/{userId}/{attributeOptionId}",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "attributeOptionId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsBookingsController_getAllOrgTeamBookings",
    {
        "name": "OrganizationsBookingsController_getAllOrgTeamBookings",
        "description": "Get organization bookings",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "status": {
                    "example": "?status=upcoming,past",
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": [
                            "upcoming",
                            "recurring",
                            "past",
                            "cancelled",
                            "unconfirmed"
                        ]
                    },
                    "description": "Filter bookings by status. If you want to filter by multiple statuses, separate them with a comma."
                },
                "attendeeEmail": {
                    "example": "example@domain.com",
                    "type": "string",
                    "description": "Filter bookings by the attendee's email address."
                },
                "attendeeName": {
                    "example": "John Doe",
                    "type": "string",
                    "description": "Filter bookings by the attendee's name."
                },
                "bookingUid": {
                    "example": "2NtaeaVcKfpmSZ4CthFdfk",
                    "type": "string",
                    "description": "Filter bookings by the booking Uid."
                },
                "eventTypeIds": {
                    "example": "?eventTypeIds=100,200",
                    "type": "string",
                    "description": "Filter bookings by event type ids belonging to the user. Event type ids must be separated by a comma."
                },
                "eventTypeId": {
                    "example": "?eventTypeId=100",
                    "type": "string",
                    "description": "Filter bookings by event type id belonging to the user."
                },
                "teamsIds": {
                    "example": "?teamIds=50,60",
                    "type": "string",
                    "description": "Filter bookings by team ids that user is part of. Team ids must be separated by a comma."
                },
                "teamId": {
                    "example": "?teamId=50",
                    "type": "string",
                    "description": "Filter bookings by team id that user is part of"
                },
                "afterStart": {
                    "example": "?afterStart=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings with start after this date string."
                },
                "beforeEnd": {
                    "example": "?beforeEnd=2025-03-07T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings with end before this date string."
                },
                "afterCreatedAt": {
                    "example": "?afterCreatedAt=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been created after this date string."
                },
                "beforeCreatedAt": {
                    "example": "?beforeCreatedAt=2025-03-14T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been created before this date string."
                },
                "afterUpdatedAt": {
                    "example": "?afterUpdatedAt=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been updated after this date string."
                },
                "beforeUpdatedAt": {
                    "example": "?beforeUpdatedAt=2025-03-14T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been updated before this date string."
                },
                "sortStart": {
                    "example": "?sortStart=asc OR ?sortStart=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their start time in ascending or descending order."
                },
                "sortEnd": {
                    "example": "?sortEnd=asc OR ?sortEnd=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their end time in ascending or descending order."
                },
                "sortCreated": {
                    "example": "?sortCreated=asc OR ?sortCreated=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their creation time (when booking was made) in ascending or descending order."
                },
                "sortUpdatedAt": {
                    "example": "?sortUpdated=asc OR ?sortUpdated=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their updated time (for example when booking status changes) in ascending or descending order."
                },
                "take": {
                    "default": 100,
                    "example": 10,
                    "type": "number",
                    "description": "The number of items to return"
                },
                "skip": {
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "The number of items to skip"
                },
                "userIds": {
                    "example": "?userIds=100,200",
                    "type": "string",
                    "description": "Filter bookings by ids of users within your organization."
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/bookings",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "status",
                "in": "query"
            },
            {
                "name": "attendeeEmail",
                "in": "query"
            },
            {
                "name": "attendeeName",
                "in": "query"
            },
            {
                "name": "bookingUid",
                "in": "query"
            },
            {
                "name": "eventTypeIds",
                "in": "query"
            },
            {
                "name": "eventTypeId",
                "in": "query"
            },
            {
                "name": "teamsIds",
                "in": "query"
            },
            {
                "name": "teamId",
                "in": "query"
            },
            {
                "name": "afterStart",
                "in": "query"
            },
            {
                "name": "beforeEnd",
                "in": "query"
            },
            {
                "name": "afterCreatedAt",
                "in": "query"
            },
            {
                "name": "beforeCreatedAt",
                "in": "query"
            },
            {
                "name": "afterUpdatedAt",
                "in": "query"
            },
            {
                "name": "beforeUpdatedAt",
                "in": "query"
            },
            {
                "name": "sortStart",
                "in": "query"
            },
            {
                "name": "sortEnd",
                "in": "query"
            },
            {
                "name": "sortCreated",
                "in": "query"
            },
            {
                "name": "sortUpdatedAt",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "userIds",
                "in": "query"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsDelegationCredentialController_createDelegationCredential",
    {
        "name": "OrganizationsDelegationCredentialController_createDelegationCredential",
        "description": "Save delegation credentials for your organization",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateDelegationCredentialInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/delegation-credentials",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsDelegationCredentialController_updateDelegationCredential",
    {
        "name": "OrganizationsDelegationCredentialController_updateDelegationCredential",
        "description": "Update delegation credentials of your organization",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "credentialId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateDelegationCredentialInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "credentialId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/delegation-credentials/{credentialId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "credentialId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsMembershipsController_getAllMemberships",
    {
        "name": "OrganizationsMembershipsController_getAllMemberships",
        "description": "Get all memberships",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/memberships",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsMembershipsController_createMembership",
    {
        "name": "OrganizationsMembershipsController_createMembership",
        "description": "Create a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOrgMembershipDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/memberships",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsMembershipsController_getOrgMembership",
    {
        "name": "OrganizationsMembershipsController_getOrgMembership",
        "description": "Get a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "membershipId": {
                    "type": "number"
                }
            },
            "required": [
                "orgId",
                "membershipId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/memberships/{membershipId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "membershipId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsMembershipsController_deleteMembership",
    {
        "name": "OrganizationsMembershipsController_deleteMembership",
        "description": "Delete a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "membershipId": {
                    "type": "number"
                }
            },
            "required": [
                "orgId",
                "membershipId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/memberships/{membershipId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "membershipId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsMembershipsController_updateMembership",
    {
        "name": "OrganizationsMembershipsController_updateMembership",
        "description": "Update a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "membershipId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateOrgMembershipDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "membershipId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/memberships/{membershipId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "membershipId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRolesController_createRole",
    {
        "name": "OrganizationsRolesController_createRole",
        "description": "Create a new organization role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOrgRoleInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/roles",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRolesController_getAllRoles",
    {
        "name": "OrganizationsRolesController_getAllRoles",
        "description": "Get all organization roles",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/roles",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRolesController_getRole",
    {
        "name": "OrganizationsRolesController_getRole",
        "description": "Get a specific organization role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "roleId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/roles/{roleId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRolesController_updateRole",
    {
        "name": "OrganizationsRolesController_updateRole",
        "description": "Update an organization role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateOrgRoleInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "roleId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/roles/{roleId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRolesController_deleteRole",
    {
        "name": "OrganizationsRolesController_deleteRole",
        "description": "Delete an organization role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "roleId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/roles/{roleId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRolesPermissionsController_addPermissions",
    {
        "name": "OrganizationsRolesPermissionsController_addPermissions",
        "description": "Add permissions to an organization role (single or batch)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOrgRolePermissionsInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "roleId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/roles/{roleId}/permissions",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRolesPermissionsController_listPermissions",
    {
        "name": "OrganizationsRolesPermissionsController_listPermissions",
        "description": "List permissions for an organization role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "roleId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/roles/{roleId}/permissions",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRolesPermissionsController_setPermissions",
    {
        "name": "OrganizationsRolesPermissionsController_setPermissions",
        "description": "Replace all permissions for an organization role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOrgRolePermissionsInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "roleId",
                "requestBody"
            ]
        },
        "method": "put",
        "pathTemplate": "/v2/organizations/{orgId}/roles/{roleId}/permissions",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRolesPermissionsController_removePermissions",
    {
        "name": "OrganizationsRolesPermissionsController_removePermissions",
        "description": "Remove multiple permissions from an organization role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                },
                "permissions": {
                    "example": "?permissions=eventType.read,booking.read",
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": [
                            "*.*",
                            "role.create",
                            "role.read",
                            "role.update",
                            "role.delete",
                            "eventType.create",
                            "eventType.read",
                            "eventType.update",
                            "eventType.delete",
                            "team.create",
                            "team.read",
                            "team.update",
                            "team.delete",
                            "team.invite",
                            "team.remove",
                            "team.listMembers",
                            "team.listMembersPrivate",
                            "team.changeMemberRole",
                            "team.impersonate",
                            "organization.create",
                            "organization.read",
                            "organization.listMembers",
                            "organization.listMembersPrivate",
                            "organization.invite",
                            "organization.remove",
                            "organization.manageBilling",
                            "organization.changeMemberRole",
                            "organization.impersonate",
                            "organization.passwordReset",
                            "organization.update",
                            "booking.read",
                            "booking.readOrgBookings",
                            "booking.readRecordings",
                            "booking.update",
                            "booking.readOrgAuditLogs",
                            "insights.read",
                            "workflow.create",
                            "workflow.read",
                            "workflow.update",
                            "workflow.delete",
                            "organization.attributes.read",
                            "organization.attributes.update",
                            "organization.attributes.delete",
                            "organization.attributes.create",
                            "organization.attributes.editUsers",
                            "routingForm.create",
                            "routingForm.read",
                            "routingForm.update",
                            "routingForm.delete",
                            "webhook.create",
                            "webhook.read",
                            "webhook.update",
                            "webhook.delete",
                            "watchlist.create",
                            "watchlist.read",
                            "watchlist.update",
                            "watchlist.delete",
                            "featureOptIn.read",
                            "featureOptIn.update"
                        ]
                    },
                    "description": "Permissions to remove (format: resource.action). Supports comma-separated values as well as repeated query params."
                }
            },
            "required": [
                "orgId",
                "roleId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/roles/{roleId}/permissions",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            },
            {
                "name": "permissions",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRolesPermissionsController_removePermission",
    {
        "name": "OrganizationsRolesPermissionsController_removePermission",
        "description": "Remove a permission from an organization role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                },
                "permission": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "roleId",
                "permission"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/roles/{roleId}/permissions/{permission}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            },
            {
                "name": "permission",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRoutingFormsController_getOrganizationRoutingForms",
    {
        "name": "OrganizationsRoutingFormsController_getOrganizationRoutingForms",
        "description": "Get organization routing forms",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "skip": {
                    "type": "number",
                    "description": "Number of responses to skip"
                },
                "take": {
                    "type": "number",
                    "description": "Number of responses to take"
                },
                "sortCreatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort by creation time"
                },
                "sortUpdatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort by update time"
                },
                "afterCreatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created after this date"
                },
                "beforeCreatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created before this date"
                },
                "afterUpdatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created after this date"
                },
                "beforeUpdatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses updated before this date"
                },
                "routedToBookingUid": {
                    "type": "string",
                    "description": "Filter by responses routed to a specific booking"
                },
                "teamIds": {
                    "example": "?teamIds=100,200",
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Filter by teamIds. Team ids must be separated by a comma."
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/routing-forms",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "sortCreatedAt",
                "in": "query"
            },
            {
                "name": "sortUpdatedAt",
                "in": "query"
            },
            {
                "name": "afterCreatedAt",
                "in": "query"
            },
            {
                "name": "beforeCreatedAt",
                "in": "query"
            },
            {
                "name": "afterUpdatedAt",
                "in": "query"
            },
            {
                "name": "beforeUpdatedAt",
                "in": "query"
            },
            {
                "name": "routedToBookingUid",
                "in": "query"
            },
            {
                "name": "teamIds",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRoutingFormsResponsesController_getRoutingFormResponses",
    {
        "name": "OrganizationsRoutingFormsResponsesController_getRoutingFormResponses",
        "description": "Get routing form responses",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "routingFormId": {
                    "type": "string"
                },
                "skip": {
                    "type": "number",
                    "description": "Number of responses to skip"
                },
                "take": {
                    "type": "number",
                    "description": "Number of responses to take"
                },
                "sortCreatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort by creation time"
                },
                "sortUpdatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort by update time"
                },
                "afterCreatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created after this date"
                },
                "beforeCreatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created before this date"
                },
                "afterUpdatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created after this date"
                },
                "beforeUpdatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses updated before this date"
                },
                "routedToBookingUid": {
                    "type": "string",
                    "description": "Filter by responses routed to a specific booking"
                }
            },
            "required": [
                "orgId",
                "routingFormId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/routing-forms/{routingFormId}/responses",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "routingFormId",
                "in": "path"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "sortCreatedAt",
                "in": "query"
            },
            {
                "name": "sortUpdatedAt",
                "in": "query"
            },
            {
                "name": "afterCreatedAt",
                "in": "query"
            },
            {
                "name": "beforeCreatedAt",
                "in": "query"
            },
            {
                "name": "afterUpdatedAt",
                "in": "query"
            },
            {
                "name": "beforeUpdatedAt",
                "in": "query"
            },
            {
                "name": "routedToBookingUid",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRoutingFormsResponsesController_createRoutingFormResponse",
    {
        "name": "OrganizationsRoutingFormsResponsesController_createRoutingFormResponse",
        "description": "Create routing form response and get available slots",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "routingFormId": {
                    "type": "string"
                },
                "start": {
                    "example": "2050-09-05",
                    "type": "string",
                    "description": "\n      Time starting from which available slots should be checked.\n    \n      Must be in UTC timezone as ISO 8601 datestring.\n      \n      You can pass date without hours which defaults to start of day or specify hours:\n      2024-08-13 (will have hours 00:00:00 aka at very beginning of the date) or you can specify hours manually like 2024-08-13T09:00:00Z\n      "
                },
                "end": {
                    "example": "2050-09-06",
                    "type": "string",
                    "description": "\n      Time until which available slots should be checked.\n      \n      Must be in UTC timezone as ISO 8601 datestring.\n      \n      You can pass date without hours which defaults to end of day or specify hours:\n      2024-08-20 (will have hours 23:59:59 aka at the very end of the date) or you can specify hours manually like 2024-08-20T18:00:00Z"
                },
                "timeZone": {
                    "example": "Europe/Rome",
                    "type": "string",
                    "description": "Time zone in which the available slots should be returned. Defaults to UTC."
                },
                "duration": {
                    "example": "60",
                    "type": "number",
                    "description": "If event type has multiple possible durations then you can specify the desired duration here. Also, if you are fetching slots for a dynamic event then you can specify the duration her which defaults to 30, meaning that returned slots will be each 30 minutes long."
                },
                "format": {
                    "example": "range",
                    "enum": [
                        "range",
                        "time"
                    ],
                    "type": "string",
                    "description": "Format of slot times in response. Use 'range' to get start and end times."
                },
                "bookingUidToReschedule": {
                    "example": "abc123def456",
                    "type": "string",
                    "description": "The unique identifier of the booking being rescheduled. When provided will ensure that the original booking time appears within the returned available slots when rescheduling."
                },
                "queueResponse": {
                    "example": true,
                    "type": "boolean",
                    "description": "Whether to queue the form response."
                }
            },
            "required": [
                "orgId",
                "routingFormId",
                "start",
                "end"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/routing-forms/{routingFormId}/responses",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "routingFormId",
                "in": "path"
            },
            {
                "name": "start",
                "in": "query"
            },
            {
                "name": "end",
                "in": "query"
            },
            {
                "name": "timeZone",
                "in": "query"
            },
            {
                "name": "duration",
                "in": "query"
            },
            {
                "name": "format",
                "in": "query"
            },
            {
                "name": "bookingUidToReschedule",
                "in": "query"
            },
            {
                "name": "queueResponse",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsRoutingFormsResponsesController_updateRoutingFormResponse",
    {
        "name": "OrganizationsRoutingFormsResponsesController_updateRoutingFormResponse",
        "description": "Update routing form response",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "routingFormId": {
                    "type": "string"
                },
                "responseId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateRoutingFormResponseInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "routingFormId",
                "responseId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/routing-forms/{routingFormId}/responses/{responseId}",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "routingFormId",
                "in": "path"
            },
            {
                "name": "responseId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsSchedulesController_getOrganizationSchedules",
    {
        "name": "OrganizationsSchedulesController_getOrganizationSchedules",
        "description": "Get all schedules",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/schedules",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsController_getAllTeams",
    {
        "name": "OrganizationsTeamsController_getAllTeams",
        "description": "Get all teams",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsController_createTeam",
    {
        "name": "OrganizationsTeamsController_createTeam",
        "description": "Create a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOrgTeamDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsController_getMyTeams",
    {
        "name": "OrganizationsTeamsController_getMyTeams",
        "description": "Get teams membership for user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/me",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsController_getTeam",
    {
        "name": "OrganizationsTeamsController_getTeam",
        "description": "Get a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsController_deleteTeam",
    {
        "name": "OrganizationsTeamsController_deleteTeam",
        "description": "Delete a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "orgId",
                "teamId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsController_updateTeam",
    {
        "name": "OrganizationsTeamsController_updateTeam",
        "description": "Update a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateOrgTeamDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "teamId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsBookingsController_getAllOrgTeamBookings",
    {
        "name": "OrganizationsTeamsBookingsController_getAllOrgTeamBookings",
        "description": "Get organization team bookings",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "status": {
                    "example": "?status=upcoming,past",
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": [
                            "upcoming",
                            "recurring",
                            "past",
                            "cancelled",
                            "unconfirmed"
                        ]
                    },
                    "description": "Filter bookings by status. If you want to filter by multiple statuses, separate them with a comma."
                },
                "attendeeEmail": {
                    "example": "example@domain.com",
                    "type": "string",
                    "description": "Filter bookings by the attendee's email address."
                },
                "attendeeName": {
                    "example": "John Doe",
                    "type": "string",
                    "description": "Filter bookings by the attendee's name."
                },
                "bookingUid": {
                    "example": "2NtaeaVcKfpmSZ4CthFdfk",
                    "type": "string",
                    "description": "Filter bookings by the booking Uid."
                },
                "eventTypeIds": {
                    "example": "?eventTypeIds=100,200",
                    "type": "string",
                    "description": "Filter bookings by event type ids belonging to the team. Event type ids must be separated by a comma."
                },
                "eventTypeId": {
                    "example": "?eventTypeId=100",
                    "type": "string",
                    "description": "Filter bookings by event type id belonging to the team."
                },
                "afterStart": {
                    "example": "?afterStart=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings with start after this date string."
                },
                "beforeEnd": {
                    "example": "?beforeEnd=2025-03-07T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings with end before this date string."
                },
                "sortStart": {
                    "example": "?sortStart=asc OR ?sortStart=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their start time in ascending or descending order."
                },
                "sortEnd": {
                    "example": "?sortEnd=asc OR ?sortEnd=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their end time in ascending or descending order."
                },
                "sortCreated": {
                    "example": "?sortCreated=asc OR ?sortCreated=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their creation time (when booking was made) in ascending or descending order."
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "example": 10,
                    "type": "number",
                    "description": "The number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "example": 0,
                    "type": "number",
                    "description": "The number of items to skip"
                },
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/bookings",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "status",
                "in": "query"
            },
            {
                "name": "attendeeEmail",
                "in": "query"
            },
            {
                "name": "attendeeName",
                "in": "query"
            },
            {
                "name": "bookingUid",
                "in": "query"
            },
            {
                "name": "eventTypeIds",
                "in": "query"
            },
            {
                "name": "eventTypeId",
                "in": "query"
            },
            {
                "name": "afterStart",
                "in": "query"
            },
            {
                "name": "beforeEnd",
                "in": "query"
            },
            {
                "name": "sortStart",
                "in": "query"
            },
            {
                "name": "sortEnd",
                "in": "query"
            },
            {
                "name": "sortCreated",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsBookingsController_getBookingReferences",
    {
        "name": "OrganizationsTeamsBookingsController_getBookingReferences",
        "description": "Get booking references",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "bookingUid": {
                    "type": "string"
                },
                "type": {
                    "example": "google_calendar",
                    "enum": [
                        "google_calendar",
                        "office365_calendar",
                        "daily_video",
                        "google_video",
                        "office365_video",
                        "zoom_video"
                    ],
                    "type": "string",
                    "description": "Filter booking references by type"
                },
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "bookingUid",
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/bookings/{bookingUid}/references",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            },
            {
                "name": "type",
                "in": "query"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsConferencingController_connectTeamApp",
    {
        "name": "OrganizationsConferencingController_connectTeamApp",
        "description": "Connect your conferencing application to a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "app": {
                    "enum": [
                        "google-meet"
                    ],
                    "type": "string",
                    "description": "Conferencing application type"
                }
            },
            "required": [
                "teamId",
                "orgId",
                "app"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/conferencing/{app}/connect",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "app",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsConferencingController_getTeamOAuthUrl",
    {
        "name": "OrganizationsConferencingController_getTeamOAuthUrl",
        "description": "Get OAuth conferencing app's auth URL for a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "string"
                },
                "orgId": {
                    "type": "number"
                },
                "app": {
                    "enum": [
                        "zoom",
                        "msteams"
                    ],
                    "type": "string",
                    "description": "Conferencing application type"
                },
                "returnTo": {
                    "type": "string"
                },
                "onErrorReturnTo": {
                    "type": "string"
                }
            },
            "required": [
                "teamId",
                "orgId",
                "app",
                "returnTo",
                "onErrorReturnTo"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/conferencing/{app}/oauth/auth-url",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "app",
                "in": "path"
            },
            {
                "name": "returnTo",
                "in": "query"
            },
            {
                "name": "onErrorReturnTo",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsConferencingController_listTeamConferencingApps",
    {
        "name": "OrganizationsConferencingController_listTeamConferencingApps",
        "description": "List team conferencing applications",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/conferencing",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsConferencingController_setTeamDefaultApp",
    {
        "name": "OrganizationsConferencingController_setTeamDefaultApp",
        "description": "Set team default conferencing application",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "app": {
                    "enum": [
                        "google-meet",
                        "zoom",
                        "msteams",
                        "daily-video"
                    ],
                    "type": "string",
                    "description": "Conferencing application type"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "app",
                "orgId"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/conferencing/{app}/default",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "app",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsConferencingController_getTeamDefaultApp",
    {
        "name": "OrganizationsConferencingController_getTeamDefaultApp",
        "description": "Get team default conferencing application",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/conferencing/default",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsConferencingController_disconnectTeamApp",
    {
        "name": "OrganizationsConferencingController_disconnectTeamApp",
        "description": "Disconnect team conferencing application",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "app": {
                    "enum": [
                        "google-meet",
                        "zoom",
                        "msteams"
                    ],
                    "type": "string",
                    "description": "Conferencing application type"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "app",
                "orgId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/conferencing/{app}/disconnect",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "app",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsConferencingController_saveTeamOauthCredentials",
    {
        "name": "OrganizationsConferencingController_saveTeamOauthCredentials",
        "description": "Save conferencing app OAuth credentials",
        "inputSchema": {
            "type": "object",
            "properties": {
                "state": {
                    "type": "string"
                },
                "code": {
                    "type": "string"
                },
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "app": {
                    "type": "string"
                }
            },
            "required": [
                "state",
                "code",
                "teamId",
                "orgId",
                "app"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/conferencing/{app}/oauth/callback",
        "executionParameters": [
            {
                "name": "state",
                "in": "query"
            },
            {
                "name": "code",
                "in": "query"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "app",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesController_createTeamEventType",
    {
        "name": "OrganizationsEventTypesController_createTeamEventType",
        "description": "Create an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateTeamEventTypeInput_2024_06_14",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/event-types",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesController_getTeamEventTypes",
    {
        "name": "OrganizationsEventTypesController_getTeamEventTypes",
        "description": "Get team event types",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "eventSlug": {
                    "type": "string",
                    "description": "Slug of team event type to return."
                },
                "hostsLimit": {
                    "type": "number",
                    "description": "Specifies the maximum number of hosts to include in the response. This limit helps optimize performance. If not provided, all Hosts will be fetched."
                },
                "sortCreatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort event types by creation date. When not provided, no explicit ordering is applied."
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/event-types",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventSlug",
                "in": "query"
            },
            {
                "name": "hostsLimit",
                "in": "query"
            },
            {
                "name": "sortCreatedAt",
                "in": "query"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesController_getTeamEventType",
    {
        "name": "OrganizationsEventTypesController_getTeamEventType",
        "description": "Get an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "eventTypeId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesController_updateTeamEventType",
    {
        "name": "OrganizationsEventTypesController_updateTeamEventType",
        "description": "Update a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateTeamEventTypeInput_2024_06_14",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "eventTypeId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesController_deleteTeamEventType",
    {
        "name": "OrganizationsEventTypesController_deleteTeamEventType",
        "description": "Delete a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "eventTypeId",
                "orgId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesController_createPhoneCall",
    {
        "name": "OrganizationsEventTypesController_createPhoneCall",
        "description": "Create a phone call",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreatePhoneCallInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "eventTypeId",
                "orgId",
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}/create-phone-call",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesController_getTeamsEventTypes",
    {
        "name": "OrganizationsEventTypesController_getTeamsEventTypes",
        "description": "Get all team event types",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                },
                "sortCreatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort event types by creation date. When not provided, no explicit ordering is applied."
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/event-types",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "sortCreatedAt",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesPrivateLinksController_createPrivateLink",
    {
        "name": "OrganizationsEventTypesPrivateLinksController_createPrivateLink",
        "description": "Create a private link for a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreatePrivateLinkInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "eventTypeId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}/private-links",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesPrivateLinksController_getPrivateLinks",
    {
        "name": "OrganizationsEventTypesPrivateLinksController_getPrivateLinks",
        "description": "Get all private links for a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "eventTypeId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}/private-links",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesPrivateLinksController_updatePrivateLink",
    {
        "name": "OrganizationsEventTypesPrivateLinksController_updatePrivateLink",
        "description": "Update a private link for a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "linkId": {
                    "type": "string"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "eventTypeId",
                "linkId",
                "orgId"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}/private-links/{linkId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "linkId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsEventTypesPrivateLinksController_deletePrivateLink",
    {
        "name": "OrganizationsEventTypesPrivateLinksController_deletePrivateLink",
        "description": "Delete a private link for a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "linkId": {
                    "type": "string"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "eventTypeId",
                "linkId",
                "orgId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/event-types/{eventTypeId}/private-links/{linkId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "linkId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsInviteController_createInvite",
    {
        "name": "OrganizationsTeamsInviteController_createInvite",
        "description": "Create team invite link",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "orgId",
                "teamId"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/invite",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsMembershipsController_getAllOrgTeamMemberships",
    {
        "name": "OrganizationsTeamsMembershipsController_getAllOrgTeamMemberships",
        "description": "Get all memberships",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId",
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/memberships",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsMembershipsController_createOrgTeamMembership",
    {
        "name": "OrganizationsTeamsMembershipsController_createOrgTeamMembership",
        "description": "Create a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOrgTeamMembershipDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/memberships",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsMembershipsController_getOrgTeamMembership",
    {
        "name": "OrganizationsTeamsMembershipsController_getOrgTeamMembership",
        "description": "Get a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "membershipId": {
                    "type": "number"
                }
            },
            "required": [
                "orgId",
                "teamId",
                "membershipId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/memberships/{membershipId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "membershipId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsMembershipsController_deleteOrgTeamMembership",
    {
        "name": "OrganizationsTeamsMembershipsController_deleteOrgTeamMembership",
        "description": "Delete a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "membershipId": {
                    "type": "number"
                }
            },
            "required": [
                "orgId",
                "teamId",
                "membershipId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/memberships/{membershipId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "membershipId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsMembershipsController_updateOrgTeamMembership",
    {
        "name": "OrganizationsTeamsMembershipsController_updateOrgTeamMembership",
        "description": "Update a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "membershipId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateOrgTeamMembershipDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "teamId",
                "membershipId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/memberships/{membershipId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "membershipId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRolesController_createRole",
    {
        "name": "OrganizationsTeamsRolesController_createRole",
        "description": "Create a new organization team role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateTeamRoleInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/roles",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRolesController_getAllRoles",
    {
        "name": "OrganizationsTeamsRolesController_getAllRoles",
        "description": "Get all organization team roles",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId",
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/roles",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRolesController_getRole",
    {
        "name": "OrganizationsTeamsRolesController_getRole",
        "description": "Get a specific organization team role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "teamId",
                "roleId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRolesController_updateRole",
    {
        "name": "OrganizationsTeamsRolesController_updateRole",
        "description": "Update an organization team role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateTeamRoleInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "teamId",
                "roleId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRolesController_deleteRole",
    {
        "name": "OrganizationsTeamsRolesController_deleteRole",
        "description": "Delete an organization team role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "teamId",
                "roleId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRolesPermissionsController_addPermissions",
    {
        "name": "OrganizationsTeamsRolesPermissionsController_addPermissions",
        "description": "Add permissions to an organization team role (single or batch)",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateTeamRolePermissionsInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "teamId",
                "roleId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}/permissions",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRolesPermissionsController_listPermissions",
    {
        "name": "OrganizationsTeamsRolesPermissionsController_listPermissions",
        "description": "List permissions for an organization team role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "teamId",
                "roleId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}/permissions",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRolesPermissionsController_setPermissions",
    {
        "name": "OrganizationsTeamsRolesPermissionsController_setPermissions",
        "description": "Replace all permissions for an organization team role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateTeamRolePermissionsInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "teamId",
                "roleId",
                "requestBody"
            ]
        },
        "method": "put",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}/permissions",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRolesPermissionsController_removePermissions",
    {
        "name": "OrganizationsTeamsRolesPermissionsController_removePermissions",
        "description": "Remove multiple permissions from an organization team role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                },
                "permissions": {
                    "example": "?permissions=eventType.read,booking.read",
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": [
                            "role.create",
                            "role.read",
                            "role.update",
                            "role.delete",
                            "eventType.create",
                            "eventType.read",
                            "eventType.update",
                            "eventType.delete",
                            "team.read",
                            "team.update",
                            "team.delete",
                            "team.invite",
                            "team.remove",
                            "team.listMembers",
                            "team.listMembersPrivate",
                            "team.changeMemberRole",
                            "team.impersonate",
                            "booking.read",
                            "booking.readTeamBookings",
                            "booking.readRecordings",
                            "booking.update",
                            "booking.readTeamAuditLogs",
                            "insights.read",
                            "workflow.create",
                            "workflow.read",
                            "workflow.update",
                            "workflow.delete",
                            "routingForm.create",
                            "routingForm.read",
                            "routingForm.update",
                            "routingForm.delete",
                            "webhook.create",
                            "webhook.read",
                            "webhook.update",
                            "webhook.delete",
                            "featureOptIn.read",
                            "featureOptIn.update"
                        ]
                    },
                    "description": "Permissions to remove (format: resource.action). Supports comma-separated values as well as repeated query params."
                }
            },
            "required": [
                "orgId",
                "teamId",
                "roleId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}/permissions",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            },
            {
                "name": "permissions",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRolesPermissionsController_removePermission",
    {
        "name": "OrganizationsTeamsRolesPermissionsController_removePermission",
        "description": "Remove a permission from an organization team role",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "roleId": {
                    "type": "string"
                },
                "permission": {
                    "type": "string"
                }
            },
            "required": [
                "orgId",
                "teamId",
                "roleId",
                "permission"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/roles/{roleId}/permissions/{permission}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "roleId",
                "in": "path"
            },
            {
                "name": "permission",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRoutingFormsController_getTeamRoutingForms",
    {
        "name": "OrganizationsTeamsRoutingFormsController_getTeamRoutingForms",
        "description": "Get team routing forms",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "skip": {
                    "type": "number",
                    "description": "Number of responses to skip"
                },
                "take": {
                    "type": "number",
                    "description": "Number of responses to take"
                },
                "sortCreatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort by creation time"
                },
                "sortUpdatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort by update time"
                },
                "afterCreatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created after this date"
                },
                "beforeCreatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created before this date"
                },
                "afterUpdatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created after this date"
                },
                "beforeUpdatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses updated before this date"
                },
                "routedToBookingUid": {
                    "type": "string",
                    "description": "Filter by responses routed to a specific booking"
                }
            },
            "required": [
                "orgId",
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/routing-forms",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "sortCreatedAt",
                "in": "query"
            },
            {
                "name": "sortUpdatedAt",
                "in": "query"
            },
            {
                "name": "afterCreatedAt",
                "in": "query"
            },
            {
                "name": "beforeCreatedAt",
                "in": "query"
            },
            {
                "name": "afterUpdatedAt",
                "in": "query"
            },
            {
                "name": "beforeUpdatedAt",
                "in": "query"
            },
            {
                "name": "routedToBookingUid",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRoutingFormsResponsesController_getRoutingFormResponses",
    {
        "name": "OrganizationsTeamsRoutingFormsResponsesController_getRoutingFormResponses",
        "description": "Get organization team routing form responses",
        "inputSchema": {
            "type": "object",
            "properties": {
                "routingFormId": {
                    "type": "string"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "skip": {
                    "type": "number",
                    "description": "Number of responses to skip"
                },
                "take": {
                    "type": "number",
                    "description": "Number of responses to take"
                },
                "sortCreatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort by creation time"
                },
                "sortUpdatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort by update time"
                },
                "afterCreatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created after this date"
                },
                "beforeCreatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created before this date"
                },
                "afterUpdatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses created after this date"
                },
                "beforeUpdatedAt": {
                    "format": "date-time",
                    "type": "string",
                    "description": "Filter by responses updated before this date"
                },
                "routedToBookingUid": {
                    "type": "string",
                    "description": "Filter by responses routed to a specific booking"
                }
            },
            "required": [
                "routingFormId",
                "orgId",
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/routing-forms/{routingFormId}/responses",
        "executionParameters": [
            {
                "name": "routingFormId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "sortCreatedAt",
                "in": "query"
            },
            {
                "name": "sortUpdatedAt",
                "in": "query"
            },
            {
                "name": "afterCreatedAt",
                "in": "query"
            },
            {
                "name": "beforeCreatedAt",
                "in": "query"
            },
            {
                "name": "afterUpdatedAt",
                "in": "query"
            },
            {
                "name": "beforeUpdatedAt",
                "in": "query"
            },
            {
                "name": "routedToBookingUid",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRoutingFormsResponsesController_createRoutingFormResponse",
    {
        "name": "OrganizationsTeamsRoutingFormsResponsesController_createRoutingFormResponse",
        "description": "Create routing form response and get available slots",
        "inputSchema": {
            "type": "object",
            "properties": {
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "routingFormId": {
                    "type": "string"
                },
                "start": {
                    "example": "2050-09-05",
                    "type": "string",
                    "description": "\n      Time starting from which available slots should be checked.\n    \n      Must be in UTC timezone as ISO 8601 datestring.\n      \n      You can pass date without hours which defaults to start of day or specify hours:\n      2024-08-13 (will have hours 00:00:00 aka at very beginning of the date) or you can specify hours manually like 2024-08-13T09:00:00Z\n      "
                },
                "end": {
                    "example": "2050-09-06",
                    "type": "string",
                    "description": "\n      Time until which available slots should be checked.\n      \n      Must be in UTC timezone as ISO 8601 datestring.\n      \n      You can pass date without hours which defaults to end of day or specify hours:\n      2024-08-20 (will have hours 23:59:59 aka at the very end of the date) or you can specify hours manually like 2024-08-20T18:00:00Z"
                },
                "timeZone": {
                    "example": "Europe/Rome",
                    "type": "string",
                    "description": "Time zone in which the available slots should be returned. Defaults to UTC."
                },
                "duration": {
                    "example": "60",
                    "type": "number",
                    "description": "If event type has multiple possible durations then you can specify the desired duration here. Also, if you are fetching slots for a dynamic event then you can specify the duration her which defaults to 30, meaning that returned slots will be each 30 minutes long."
                },
                "format": {
                    "example": "range",
                    "enum": [
                        "range",
                        "time"
                    ],
                    "type": "string",
                    "description": "Format of slot times in response. Use 'range' to get start and end times."
                },
                "bookingUidToReschedule": {
                    "example": "abc123def456",
                    "type": "string",
                    "description": "The unique identifier of the booking being rescheduled. When provided will ensure that the original booking time appears within the returned available slots when rescheduling."
                },
                "queueResponse": {
                    "example": true,
                    "type": "boolean",
                    "description": "Whether to queue the form response."
                }
            },
            "required": [
                "orgId",
                "teamId",
                "routingFormId",
                "start",
                "end"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/routing-forms/{routingFormId}/responses",
        "executionParameters": [
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "routingFormId",
                "in": "path"
            },
            {
                "name": "start",
                "in": "query"
            },
            {
                "name": "end",
                "in": "query"
            },
            {
                "name": "timeZone",
                "in": "query"
            },
            {
                "name": "duration",
                "in": "query"
            },
            {
                "name": "format",
                "in": "query"
            },
            {
                "name": "bookingUidToReschedule",
                "in": "query"
            },
            {
                "name": "queueResponse",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsRoutingFormsResponsesController_updateRoutingFormResponse",
    {
        "name": "OrganizationsTeamsRoutingFormsResponsesController_updateRoutingFormResponse",
        "description": "Update routing form response",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "routingFormId": {
                    "type": "string"
                },
                "responseId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateRoutingFormResponseInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "routingFormId",
                "responseId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/routing-forms/{routingFormId}/responses/{responseId}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "routingFormId",
                "in": "path"
            },
            {
                "name": "responseId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsSchedulesController_getTeamSchedules",
    {
        "name": "OrganizationsTeamsSchedulesController_getTeamSchedules",
        "description": "Get all team member schedules",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                },
                "eventTypeId": {
                    "example": 1,
                    "type": "number",
                    "description": "Filter schedules by event type ID"
                }
            },
            "required": [
                "orgId",
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/schedules",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "eventTypeId",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsStripeController_getTeamStripeConnectUrl",
    {
        "name": "OrganizationsStripeController_getTeamStripeConnectUrl",
        "description": "Get Stripe connect URL for a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "string"
                },
                "orgId": {
                    "type": "number"
                },
                "returnTo": {
                    "type": "string"
                },
                "onErrorReturnTo": {
                    "type": "string"
                }
            },
            "required": [
                "teamId",
                "orgId",
                "returnTo",
                "onErrorReturnTo"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/stripe/connect",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "returnTo",
                "in": "query"
            },
            {
                "name": "onErrorReturnTo",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsStripeController_checkTeamStripeConnection",
    {
        "name": "OrganizationsStripeController_checkTeamStripeConnection",
        "description": "Check team Stripe connection",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/stripe/check",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsStripeController_save",
    {
        "name": "OrganizationsStripeController_save",
        "description": "Save Stripe credentials",
        "inputSchema": {
            "type": "object",
            "properties": {
                "state": {
                    "type": "string"
                },
                "code": {
                    "type": "string"
                },
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "state",
                "code",
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/stripe/save",
        "executionParameters": [
            {
                "name": "state",
                "in": "query"
            },
            {
                "name": "code",
                "in": "query"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsTeamsSchedulesController_getUserSchedules",
    {
        "name": "OrganizationsTeamsSchedulesController_getUserSchedules",
        "description": "Get schedules of a team member",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "userId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "example": 1,
                    "type": "number",
                    "description": "Filter schedules by event type ID"
                }
            },
            "required": [
                "orgId",
                "teamId",
                "userId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/users/{userId}/schedules",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationTeamWorkflowsController_getWorkflows",
    {
        "name": "OrganizationTeamWorkflowsController_getWorkflows",
        "description": "Get organization team workflows",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId",
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/workflows",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationTeamWorkflowsController_createEventTypeWorkflow",
    {
        "name": "OrganizationTeamWorkflowsController_createEventTypeWorkflow",
        "description": "Create organization team workflow for event-types",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateEventTypeWorkflowDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/workflows",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationTeamWorkflowsController_getRoutingFormWorkflows",
    {
        "name": "OrganizationTeamWorkflowsController_getRoutingFormWorkflows",
        "description": "Get organization team workflows",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId",
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/workflows/routing-form",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationTeamWorkflowsController_createFormWorkflow",
    {
        "name": "OrganizationTeamWorkflowsController_createFormWorkflow",
        "description": "Create organization team workflow for routing-forms",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateFormWorkflowDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/workflows/routing-form",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationTeamWorkflowsController_getWorkflowById",
    {
        "name": "OrganizationTeamWorkflowsController_getWorkflowById",
        "description": "Get organization team workflow",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "workflowId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "workflowId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "workflowId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationTeamWorkflowsController_updateWorkflow",
    {
        "name": "OrganizationTeamWorkflowsController_updateWorkflow",
        "description": "Update organization team workflow",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "workflowId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateEventTypeWorkflowDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "workflowId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "workflowId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationTeamWorkflowsController_deleteWorkflow",
    {
        "name": "OrganizationTeamWorkflowsController_deleteWorkflow",
        "description": "Delete organization team workflow",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "workflowId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "workflowId",
                "orgId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "workflowId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationTeamWorkflowsController_getRoutingFormWorkflowById",
    {
        "name": "OrganizationTeamWorkflowsController_getRoutingFormWorkflowById",
        "description": "Get organization team workflow",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "workflowId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "workflowId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}/routing-form",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "workflowId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationTeamWorkflowsController_updateRoutingFormWorkflow",
    {
        "name": "OrganizationTeamWorkflowsController_updateRoutingFormWorkflow",
        "description": "Update organization routing form team workflow",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "workflowId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateFormWorkflowDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "workflowId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}/routing-form",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "workflowId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationTeamWorkflowsController_deleteRoutingFormWorkflow",
    {
        "name": "OrganizationTeamWorkflowsController_deleteRoutingFormWorkflow",
        "description": "Delete organization team routing-form workflow",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "teamId": {
                    "type": "number"
                },
                "workflowId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "workflowId",
                "orgId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/workflows/{workflowId}/routing-form",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "workflowId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsUsersController_getOrganizationsUsers",
    {
        "name": "OrganizationsUsersController_getOrganizationsUsers",
        "description": "Get all users",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 1000,
                    "example": 10,
                    "type": "number",
                    "description": "The number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "example": 0,
                    "type": "number",
                    "description": "The number of items to skip"
                },
                "emails": {
                    "example": [
                        "user1@example.com",
                        "user2@example.com"
                    ],
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "The email address or an array of email addresses to filter by"
                },
                "assignedOptionIds": {
                    "example": "?assignedOptionIds=aaaaaaaa-bbbb-cccc-dddd-eeeeee1eee,aaaaaaaa-bbbb-cccc-dddd-eeeeee2eee",
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Filter by assigned attribute option ids. ids must be separated by a comma."
                },
                "attributeQueryOperator": {
                    "default": "AND",
                    "example": "NONE",
                    "enum": [
                        "OR",
                        "AND",
                        "NONE"
                    ],
                    "type": "string",
                    "description": "Query operator used to filter assigned options, AND by default."
                },
                "teamIds": {
                    "example": "?teamIds=100,200",
                    "type": "array",
                    "items": {
                        "type": "number"
                    },
                    "description": "Filter by teamIds. Team ids must be separated by a comma."
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/users",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "emails",
                "in": "query"
            },
            {
                "name": "assignedOptionIds",
                "in": "query"
            },
            {
                "name": "attributeQueryOperator",
                "in": "query"
            },
            {
                "name": "teamIds",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsUsersController_createOrganizationUser",
    {
        "name": "OrganizationsUsersController_createOrganizationUser",
        "description": "Create a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOrganizationUserInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/users",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsUsersController_updateOrganizationUser",
    {
        "name": "OrganizationsUsersController_updateOrganizationUser",
        "description": "Update a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "userId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateOrganizationUserInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "userId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "userId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsUsersController_deleteOrganizationUser",
    {
        "name": "OrganizationsUsersController_deleteOrganizationUser",
        "description": "Delete a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "userId": {
                    "type": "number"
                }
            },
            "required": [
                "orgId",
                "userId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "userId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsUsersBookingsController_getOrganizationUserBookings",
    {
        "name": "OrganizationsUsersBookingsController_getOrganizationUserBookings",
        "description": "Get all bookings for an organization user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "userId": {
                    "type": "number"
                },
                "status": {
                    "example": "?status=upcoming,past",
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": [
                            "upcoming",
                            "recurring",
                            "past",
                            "cancelled",
                            "unconfirmed"
                        ]
                    },
                    "description": "Filter bookings by status. If you want to filter by multiple statuses, separate them with a comma."
                },
                "attendeeEmail": {
                    "example": "example@domain.com",
                    "type": "string",
                    "description": "Filter bookings by the attendee's email address."
                },
                "attendeeName": {
                    "example": "John Doe",
                    "type": "string",
                    "description": "Filter bookings by the attendee's name."
                },
                "bookingUid": {
                    "example": "2NtaeaVcKfpmSZ4CthFdfk",
                    "type": "string",
                    "description": "Filter bookings by the booking Uid."
                },
                "eventTypeIds": {
                    "example": "?eventTypeIds=100,200",
                    "type": "string",
                    "description": "Filter bookings by event type ids belonging to the user. Event type ids must be separated by a comma."
                },
                "eventTypeId": {
                    "example": "?eventTypeId=100",
                    "type": "string",
                    "description": "Filter bookings by event type id belonging to the user."
                },
                "teamsIds": {
                    "example": "?teamIds=50,60",
                    "type": "string",
                    "description": "Filter bookings by team ids that user is part of. Team ids must be separated by a comma."
                },
                "teamId": {
                    "example": "?teamId=50",
                    "type": "string",
                    "description": "Filter bookings by team id that user is part of"
                },
                "afterStart": {
                    "example": "?afterStart=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings with start after this date string."
                },
                "beforeEnd": {
                    "example": "?beforeEnd=2025-03-07T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings with end before this date string."
                },
                "afterCreatedAt": {
                    "example": "?afterCreatedAt=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been created after this date string."
                },
                "beforeCreatedAt": {
                    "example": "?beforeCreatedAt=2025-03-14T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been created before this date string."
                },
                "afterUpdatedAt": {
                    "example": "?afterUpdatedAt=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been updated after this date string."
                },
                "beforeUpdatedAt": {
                    "example": "?beforeUpdatedAt=2025-03-14T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been updated before this date string."
                },
                "sortStart": {
                    "example": "?sortStart=asc OR ?sortStart=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their start time in ascending or descending order."
                },
                "sortEnd": {
                    "example": "?sortEnd=asc OR ?sortEnd=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their end time in ascending or descending order."
                },
                "sortCreated": {
                    "example": "?sortCreated=asc OR ?sortCreated=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their creation time (when booking was made) in ascending or descending order."
                },
                "sortUpdatedAt": {
                    "example": "?sortUpdated=asc OR ?sortUpdated=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their updated time (for example when booking status changes) in ascending or descending order."
                },
                "take": {
                    "default": 100,
                    "example": 10,
                    "type": "number",
                    "description": "The number of items to return"
                },
                "skip": {
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "The number of items to skip"
                }
            },
            "required": [
                "orgId",
                "userId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}/bookings",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "status",
                "in": "query"
            },
            {
                "name": "attendeeEmail",
                "in": "query"
            },
            {
                "name": "attendeeName",
                "in": "query"
            },
            {
                "name": "bookingUid",
                "in": "query"
            },
            {
                "name": "eventTypeIds",
                "in": "query"
            },
            {
                "name": "eventTypeId",
                "in": "query"
            },
            {
                "name": "teamsIds",
                "in": "query"
            },
            {
                "name": "teamId",
                "in": "query"
            },
            {
                "name": "afterStart",
                "in": "query"
            },
            {
                "name": "beforeEnd",
                "in": "query"
            },
            {
                "name": "afterCreatedAt",
                "in": "query"
            },
            {
                "name": "beforeCreatedAt",
                "in": "query"
            },
            {
                "name": "afterUpdatedAt",
                "in": "query"
            },
            {
                "name": "beforeUpdatedAt",
                "in": "query"
            },
            {
                "name": "sortStart",
                "in": "query"
            },
            {
                "name": "sortEnd",
                "in": "query"
            },
            {
                "name": "sortCreated",
                "in": "query"
            },
            {
                "name": "sortUpdatedAt",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsUsersOOOController_getOrganizationUserOOO",
    {
        "name": "OrganizationsUsersOOOController_getOrganizationUserOOO",
        "description": "Get all out-of-office entries for a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "userId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                },
                "sortStart": {
                    "example": "?sortStart=asc OR ?sortStart=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their start time in ascending or descending order."
                },
                "sortEnd": {
                    "example": "?sortEnd=asc OR ?sortEnd=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their end time in ascending or descending order."
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "userId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}/ooo",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "sortStart",
                "in": "query"
            },
            {
                "name": "sortEnd",
                "in": "query"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsUsersOOOController_createOrganizationUserOOO",
    {
        "name": "OrganizationsUsersOOOController_createOrganizationUserOOO",
        "description": "Create an out-of-office entry for a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "userId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOutOfOfficeEntryDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "userId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}/ooo",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsUsersOOOController_updateOrganizationUserOOO",
    {
        "name": "OrganizationsUsersOOOController_updateOrganizationUserOOO",
        "description": "Update an out-of-office entry for a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "userId": {
                    "type": "number"
                },
                "oooId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateOutOfOfficeEntryDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "userId",
                "oooId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}/ooo/{oooId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "oooId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsUsersOOOController_deleteOrganizationUserOOO",
    {
        "name": "OrganizationsUsersOOOController_deleteOrganizationUserOOO",
        "description": "Delete an out-of-office entry for a user",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "oooId": {
                    "type": "number"
                },
                "userId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "oooId",
                "userId",
                "orgId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}/ooo/{oooId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "oooId",
                "in": "path"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsUsersOOOController_getOrganizationUsersOOO",
    {
        "name": "OrganizationsUsersOOOController_getOrganizationUsersOOO",
        "description": "Get all out-of-office entries for organization users",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                },
                "sortStart": {
                    "example": "?sortStart=asc OR ?sortStart=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their start time in ascending or descending order."
                },
                "sortEnd": {
                    "example": "?sortEnd=asc OR ?sortEnd=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their end time in ascending or descending order."
                },
                "email": {
                    "example": "example@domain.com",
                    "type": "string",
                    "description": "Filter ooo entries by the user email address. user must be within your organization."
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/ooo",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "sortStart",
                "in": "query"
            },
            {
                "name": "sortEnd",
                "in": "query"
            },
            {
                "name": "email",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsSchedulesController_createUserSchedule",
    {
        "name": "OrganizationsSchedulesController_createUserSchedule",
        "description": "Create a schedule",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "userId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateScheduleInput_2024_06_11",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "userId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}/schedules",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsSchedulesController_getUserSchedules",
    {
        "name": "OrganizationsSchedulesController_getUserSchedules",
        "description": "Get all schedules",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "userId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "userId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}/schedules",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsSchedulesController_getUserSchedule",
    {
        "name": "OrganizationsSchedulesController_getUserSchedule",
        "description": "Get a schedule",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "userId": {
                    "type": "number"
                },
                "scheduleId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "userId",
                "scheduleId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}/schedules/{scheduleId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "scheduleId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsSchedulesController_updateUserSchedule",
    {
        "name": "OrganizationsSchedulesController_updateUserSchedule",
        "description": "Update a schedule",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "userId": {
                    "type": "number"
                },
                "scheduleId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateScheduleInput_2024_06_11",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "userId",
                "scheduleId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}/schedules/{scheduleId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "scheduleId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsSchedulesController_deleteUserSchedule",
    {
        "name": "OrganizationsSchedulesController_deleteUserSchedule",
        "description": "Delete a schedule",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "userId": {
                    "type": "number"
                },
                "scheduleId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "userId",
                "scheduleId",
                "orgId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/users/{userId}/schedules/{scheduleId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "userId",
                "in": "path"
            },
            {
                "name": "scheduleId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsWebhooksController_getAllOrganizationWebhooks",
    {
        "name": "OrganizationsWebhooksController_getAllOrganizationWebhooks",
        "description": "Get all webhooks",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/webhooks",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsWebhooksController_createOrganizationWebhook",
    {
        "name": "OrganizationsWebhooksController_createOrganizationWebhook",
        "description": "Create a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateWebhookInputDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/webhooks",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsWebhooksController_getOrganizationWebhook",
    {
        "name": "OrganizationsWebhooksController_getOrganizationWebhook",
        "description": "Get a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "webhookId": {
                    "type": "string"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "webhookId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "webhookId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsWebhooksController_deleteWebhook",
    {
        "name": "OrganizationsWebhooksController_deleteWebhook",
        "description": "Delete a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "webhookId": {
                    "type": "string"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "webhookId",
                "orgId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "webhookId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsWebhooksController_updateOrgWebhook",
    {
        "name": "OrganizationsWebhooksController_updateOrgWebhook",
        "description": "Update a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "webhookId": {
                    "type": "string"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateWebhookInputDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "webhookId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "webhookId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "ApiKeysController_refresh",
    {
        "name": "ApiKeysController_refresh",
        "description": "Refresh API Key",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/RefreshApiKeyInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/api-keys/refresh",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_createBooking",
    {
        "name": "BookingsController_2024_08_13_createBooking",
        "description": "Create a booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "requestBody": {
                    "oneOf": [
                        {
                            "$ref": "#/components/schemas/CreateBookingInput_2024_08_13"
                        },
                        {
                            "$ref": "#/components/schemas/CreateInstantBookingInput_2024_08_13"
                        },
                        {
                            "$ref": "#/components/schemas/CreateRecurringBookingInput_2024_08_13"
                        }
                    ],
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/bookings",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_getBookings",
    {
        "name": "BookingsController_2024_08_13_getBookings",
        "description": "Get all bookings",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "status": {
                    "example": "?status=upcoming,past",
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": [
                            "upcoming",
                            "recurring",
                            "past",
                            "cancelled",
                            "unconfirmed"
                        ]
                    },
                    "description": "Filter bookings by status. If you want to filter by multiple statuses, separate them with a comma."
                },
                "attendeeEmail": {
                    "example": "example@domain.com",
                    "type": "string",
                    "description": "Filter bookings by the attendee's email address."
                },
                "attendeeName": {
                    "example": "John Doe",
                    "type": "string",
                    "description": "Filter bookings by the attendee's name."
                },
                "bookingUid": {
                    "example": "2NtaeaVcKfpmSZ4CthFdfk",
                    "type": "string",
                    "description": "Filter bookings by the booking Uid."
                },
                "eventTypeIds": {
                    "example": "?eventTypeIds=100,200",
                    "type": "string",
                    "description": "Filter bookings by event type ids belonging to the user. Event type ids must be separated by a comma."
                },
                "eventTypeId": {
                    "example": "?eventTypeId=100",
                    "type": "string",
                    "description": "Filter bookings by event type id belonging to the user."
                },
                "teamsIds": {
                    "example": "?teamIds=50,60",
                    "type": "string",
                    "description": "Filter bookings by team ids that user is part of. Team ids must be separated by a comma."
                },
                "teamId": {
                    "example": "?teamId=50",
                    "type": "string",
                    "description": "Filter bookings by team id that user is part of"
                },
                "afterStart": {
                    "example": "?afterStart=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings with start after this date string."
                },
                "beforeEnd": {
                    "example": "?beforeEnd=2025-03-07T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings with end before this date string."
                },
                "afterCreatedAt": {
                    "example": "?afterCreatedAt=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been created after this date string."
                },
                "beforeCreatedAt": {
                    "example": "?beforeCreatedAt=2025-03-14T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been created before this date string."
                },
                "afterUpdatedAt": {
                    "example": "?afterUpdatedAt=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been updated after this date string."
                },
                "beforeUpdatedAt": {
                    "example": "?beforeUpdatedAt=2025-03-14T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings that have been updated before this date string."
                },
                "sortStart": {
                    "example": "?sortStart=asc OR ?sortStart=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their start time in ascending or descending order."
                },
                "sortEnd": {
                    "example": "?sortEnd=asc OR ?sortEnd=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their end time in ascending or descending order."
                },
                "sortCreated": {
                    "example": "?sortCreated=asc OR ?sortCreated=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their creation time (when booking was made) in ascending or descending order."
                },
                "sortUpdatedAt": {
                    "example": "?sortUpdated=asc OR ?sortUpdated=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their updated time (for example when booking status changes) in ascending or descending order."
                },
                "take": {
                    "default": 100,
                    "example": 10,
                    "type": "number",
                    "description": "The number of items to return"
                },
                "skip": {
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "The number of items to skip"
                }
            },
            "required": [
                "cal-api-version"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/bookings",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "status",
                "in": "query"
            },
            {
                "name": "attendeeEmail",
                "in": "query"
            },
            {
                "name": "attendeeName",
                "in": "query"
            },
            {
                "name": "bookingUid",
                "in": "query"
            },
            {
                "name": "eventTypeIds",
                "in": "query"
            },
            {
                "name": "eventTypeId",
                "in": "query"
            },
            {
                "name": "teamsIds",
                "in": "query"
            },
            {
                "name": "teamId",
                "in": "query"
            },
            {
                "name": "afterStart",
                "in": "query"
            },
            {
                "name": "beforeEnd",
                "in": "query"
            },
            {
                "name": "afterCreatedAt",
                "in": "query"
            },
            {
                "name": "beforeCreatedAt",
                "in": "query"
            },
            {
                "name": "afterUpdatedAt",
                "in": "query"
            },
            {
                "name": "beforeUpdatedAt",
                "in": "query"
            },
            {
                "name": "sortStart",
                "in": "query"
            },
            {
                "name": "sortEnd",
                "in": "query"
            },
            {
                "name": "sortCreated",
                "in": "query"
            },
            {
                "name": "sortUpdatedAt",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_getBookingBySeatUid",
    {
        "name": "BookingsController_2024_08_13_getBookingBySeatUid",
        "description": "Get a booking by seat UID",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "seatUid": {
                    "type": "string"
                },
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                }
            },
            "required": [
                "cal-api-version",
                "seatUid"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/bookings/by-seat/{seatUid}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "seatUid",
                "in": "path"
            },
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_getBooking",
    {
        "name": "BookingsController_2024_08_13_getBooking",
        "description": "Get a booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                },
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/bookings/{bookingUid}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            },
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_getBookingRecordings",
    {
        "name": "BookingsController_2024_08_13_getBookingRecordings",
        "description": "Get all the recordings for the booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/bookings/{bookingUid}/recordings",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_getBookingTranscripts",
    {
        "name": "BookingsController_2024_08_13_getBookingTranscripts",
        "description": "Get Cal Video real time transcript download links for the booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/bookings/{bookingUid}/transcripts",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_rescheduleBooking",
    {
        "name": "BookingsController_2024_08_13_rescheduleBooking",
        "description": "Reschedule a booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                },
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "requestBody": {
                    "oneOf": [
                        {
                            "$ref": "#/components/schemas/RescheduleBookingInput_2024_08_13"
                        },
                        {
                            "$ref": "#/components/schemas/RescheduleSeatedBookingInput_2024_08_13"
                        }
                    ],
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/bookings/{bookingUid}/reschedule",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            },
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_cancelBooking",
    {
        "name": "BookingsController_2024_08_13_cancelBooking",
        "description": "Cancel a booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                },
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "requestBody": {
                    "oneOf": [
                        {
                            "$ref": "#/components/schemas/CancelBookingInput_2024_08_13"
                        },
                        {
                            "$ref": "#/components/schemas/CancelSeatedBookingInput_2024_08_13"
                        }
                    ],
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/bookings/{bookingUid}/cancel",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            },
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_markNoShow",
    {
        "name": "BookingsController_2024_08_13_markNoShow",
        "description": "Mark a booking absence",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/MarkAbsentBookingInput_2024_08_13",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/bookings/{bookingUid}/mark-absent",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_reassignBooking",
    {
        "name": "BookingsController_2024_08_13_reassignBooking",
        "description": "Reassign a booking to auto-selected host",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/bookings/{bookingUid}/reassign",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_reassignBookingToUser",
    {
        "name": "BookingsController_2024_08_13_reassignBookingToUser",
        "description": "Reassign a booking to a specific host",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                },
                "userId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/ReassignToUserBookingInput_2024_08_13",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid",
                "userId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/bookings/{bookingUid}/reassign/{userId}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            },
            {
                "name": "userId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_confirmBooking",
    {
        "name": "BookingsController_2024_08_13_confirmBooking",
        "description": "Confirm a booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/bookings/{bookingUid}/confirm",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_declineBooking",
    {
        "name": "BookingsController_2024_08_13_declineBooking",
        "description": "Decline a booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/DeclineBookingInput_2024_08_13",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/bookings/{bookingUid}/decline",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_getCalendarLinks",
    {
        "name": "BookingsController_2024_08_13_getCalendarLinks",
        "description": "Get 'Add to Calendar' links for a booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/bookings/{bookingUid}/calendar-links",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_getBookingReferences",
    {
        "name": "BookingsController_2024_08_13_getBookingReferences",
        "description": "Get booking references",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                },
                "type": {
                    "example": "google_calendar",
                    "enum": [
                        "google_calendar",
                        "office365_calendar",
                        "daily_video",
                        "google_video",
                        "office365_video",
                        "zoom_video"
                    ],
                    "type": "string",
                    "description": "Filter booking references by type"
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/bookings/{bookingUid}/references",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            },
            {
                "name": "type",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingsController_2024_08_13_getVideoSessions",
    {
        "name": "BookingsController_2024_08_13_getVideoSessions",
        "description": "Get Video Meeting Sessions. Only supported for Cal Video",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-08-13",
                    "description": "Must be set to 2024-08-13. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUid": {
                    "type": "string"
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/bookings/{bookingUid}/conferencing-sessions",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingLocationController_2024_08_13_updateBookingLocation",
    {
        "name": "BookingLocationController_2024_08_13_updateBookingLocation",
        "description": "Update booking location for an existing booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "description": "Must be set to 2024-08-13. This header is required as this endpoint does not exist in older API versions."
                },
                "bookingUid": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateBookingLocationInput_2024_08_13",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/bookings/{bookingUid}/location",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "BookingAttendeesController_2024_08_13_getBookingAttendees",
    {
        "name": "BookingAttendeesController_2024_08_13_getBookingAttendees",
        "description": "Get all attendees for a booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "description": "Must be set to 2024-08-13. This header is required as this endpoint does not exist in older API versions."
                },
                "bookingUid": {
                    "type": "string"
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/bookings/{bookingUid}/attendees",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingAttendeesController_2024_08_13_addAttendee",
    {
        "name": "BookingAttendeesController_2024_08_13_addAttendee",
        "description": "Add an attendee to a booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "description": "Must be set to 2024-08-13. This header is required as this endpoint does not exist in older API versions."
                },
                "bookingUid": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/AddAttendeeInput_2024_08_13",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/bookings/{bookingUid}/attendees",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "BookingAttendeesController_2024_08_13_getBookingAttendee",
    {
        "name": "BookingAttendeesController_2024_08_13_getBookingAttendee",
        "description": "Get a specific attendee for a booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "description": "Must be set to 2024-08-13. This header is required as this endpoint does not exist in older API versions."
                },
                "bookingUid": {
                    "type": "string"
                },
                "attendeeId": {
                    "type": "number"
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid",
                "attendeeId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/bookings/{bookingUid}/attendees/{attendeeId}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            },
            {
                "name": "attendeeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "BookingGuestsController_2024_08_13_addGuests",
    {
        "name": "BookingGuestsController_2024_08_13_addGuests",
        "description": "Add guests to an existing booking",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "description": "Must be set to 2024-08-13. This header is required as this endpoint does not exist in older API versions."
                },
                "bookingUid": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/AddGuestsInput_2024_08_13",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "bookingUid",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/bookings/{bookingUid}/guests",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUid",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "CalUnifiedCalendarsController_getCalendarEventDetails",
    {
        "name": "CalUnifiedCalendarsController_getCalendarEventDetails",
        "description": "Get meeting details from calendar",
        "inputSchema": {
            "type": "object",
            "properties": {
                "calendar": {
                    "enum": [
                        "google"
                    ],
                    "type": "string"
                },
                "eventUid": {
                    "type": "string",
                    "description": "The Google Calendar event ID. You can retrieve this by getting booking references from the following endpoints:\n\n- For team events: https://cal.com/docs/api-reference/v2/orgs-teams-bookings/get-booking-references-for-a-booking\n\n- For user events: https://cal.com/docs/api-reference/v2/bookings/get-booking-references-for-a-booking"
                }
            },
            "required": [
                "calendar",
                "eventUid"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/calendars/{calendar}/event/{eventUid}",
        "executionParameters": [
            {
                "name": "calendar",
                "in": "path"
            },
            {
                "name": "eventUid",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "CalUnifiedCalendarsController_updateCalendarEvent",
    {
        "name": "CalUnifiedCalendarsController_updateCalendarEvent",
        "description": "Update meeting details in calendar",
        "inputSchema": {
            "type": "object",
            "properties": {
                "calendar": {
                    "enum": [
                        "google"
                    ],
                    "type": "string"
                },
                "eventUid": {
                    "type": "string",
                    "description": "The Google Calendar event ID. You can retrieve this by getting booking references from the following endpoints:\n\n- For team events: https://cal.com/docs/api-reference/v2/orgs-teams-bookings/get-booking-references-for-a-booking\n\n- For user events: https://cal.com/docs/api-reference/v2/bookings/get-booking-references-for-a-booking"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateUnifiedCalendarEventInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "calendar",
                "eventUid",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/calendars/{calendar}/events/{eventUid}",
        "executionParameters": [
            {
                "name": "calendar",
                "in": "path"
            },
            {
                "name": "eventUid",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "CalendarsController_createIcsFeed",
    {
        "name": "CalendarsController_createIcsFeed",
        "description": "Save an ICS feed",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/CreateIcsFeedInputDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/calendars/ics-feed/save",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "CalendarsController_checkIcsFeed",
    {
        "name": "CalendarsController_checkIcsFeed",
        "description": "Check an ICS feed",
        "inputSchema": {
            "type": "object",
            "properties": {}
        },
        "method": "get",
        "pathTemplate": "/v2/calendars/ics-feed/check",
        "executionParameters": [],
        "securityRequirements": []
    },
  ],
  [
    "CalendarsController_getBusyTimes",
    {
        "name": "CalendarsController_getBusyTimes",
        "description": "Get busy times",
        "inputSchema": {
            "type": "object",
            "properties": {
                "loggedInUsersTz": {
                    "example": "America/New_York",
                    "type": "string",
                    "description": "Deprecated: Use timeZone instead. The timezone of the user represented as a string"
                },
                "timeZone": {
                    "example": "America/New_York",
                    "type": "string",
                    "description": "The timezone for the busy times query represented as a string"
                },
                "dateFrom": {
                    "example": "2023-10-01",
                    "type": "string",
                    "description": "The starting date for the busy times query"
                },
                "dateTo": {
                    "example": "2023-10-31",
                    "type": "string",
                    "description": "The ending date for the busy times query"
                },
                "credentialId": {
                    "type": "number"
                },
                "externalId": {
                    "type": "string"
                }
            },
            "required": [
                "credentialId",
                "externalId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/calendars/busy-times",
        "executionParameters": [
            {
                "name": "loggedInUsersTz",
                "in": "query"
            },
            {
                "name": "timeZone",
                "in": "query"
            },
            {
                "name": "dateFrom",
                "in": "query"
            },
            {
                "name": "dateTo",
                "in": "query"
            },
            {
                "name": "credentialId",
                "in": "query"
            },
            {
                "name": "externalId",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "CalendarsController_getCalendars",
    {
        "name": "CalendarsController_getCalendars",
        "description": "Get all calendars",
        "inputSchema": {
            "type": "object",
            "properties": {}
        },
        "method": "get",
        "pathTemplate": "/v2/calendars",
        "executionParameters": [],
        "securityRequirements": []
    },
  ],
  [
    "CalendarsController_redirect",
    {
        "name": "CalendarsController_redirect",
        "description": "Get OAuth connect URL",
        "inputSchema": {
            "type": "object",
            "properties": {
                "calendar": {
                    "enum": [
                        "office365",
                        "google"
                    ],
                    "type": "string"
                },
                "isDryRun": {
                    "type": "boolean"
                },
                "redir": {
                    "type": "string",
                    "description": "Redirect URL after successful calendar authorization."
                }
            },
            "required": [
                "calendar",
                "isDryRun"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/calendars/{calendar}/connect",
        "executionParameters": [
            {
                "name": "calendar",
                "in": "path"
            },
            {
                "name": "isDryRun",
                "in": "query"
            },
            {
                "name": "redir",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "CalendarsController_save",
    {
        "name": "CalendarsController_save",
        "description": "Save Google or Outlook calendar credentials",
        "inputSchema": {
            "type": "object",
            "properties": {
                "state": {
                    "type": "string"
                },
                "code": {
                    "type": "string"
                },
                "calendar": {
                    "enum": [
                        "office365",
                        "google"
                    ],
                    "type": "string"
                }
            },
            "required": [
                "state",
                "code",
                "calendar"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/calendars/{calendar}/save",
        "executionParameters": [
            {
                "name": "state",
                "in": "query"
            },
            {
                "name": "code",
                "in": "query"
            },
            {
                "name": "calendar",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "CalendarsController_syncCredentials",
    {
        "name": "CalendarsController_syncCredentials",
        "description": "Save Apple calendar credentials",
        "inputSchema": {
            "type": "object",
            "properties": {
                "calendar": {
                    "enum": [
                        "apple"
                    ],
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateCalendarCredentialsInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "calendar",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/calendars/{calendar}/credentials",
        "executionParameters": [
            {
                "name": "calendar",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "CalendarsController_check",
    {
        "name": "CalendarsController_check",
        "description": "Check a calendar connection",
        "inputSchema": {
            "type": "object",
            "properties": {
                "calendar": {
                    "enum": [
                        "apple",
                        "google",
                        "office365"
                    ],
                    "type": "string"
                }
            },
            "required": [
                "calendar"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/calendars/{calendar}/check",
        "executionParameters": [
            {
                "name": "calendar",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "CalendarsController_deleteCalendarCredentials",
    {
        "name": "CalendarsController_deleteCalendarCredentials",
        "description": "Disconnect a calendar",
        "inputSchema": {
            "type": "object",
            "properties": {
                "calendar": {
                    "enum": [
                        "apple",
                        "google",
                        "office365"
                    ],
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/DeleteCalendarCredentialsInputBodyDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "calendar",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/calendars/{calendar}/disconnect",
        "executionParameters": [
            {
                "name": "calendar",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "ConferencingController_connect",
    {
        "name": "ConferencingController_connect",
        "description": "Connect your conferencing application",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {
                    "enum": [
                        "google-meet"
                    ],
                    "type": "string",
                    "description": "Conferencing application type"
                }
            },
            "required": [
                "app"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/conferencing/{app}/connect",
        "executionParameters": [
            {
                "name": "app",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "ConferencingController_redirect",
    {
        "name": "ConferencingController_redirect",
        "description": "Get OAuth conferencing app auth URL",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {
                    "enum": [
                        "zoom",
                        "msteams"
                    ],
                    "type": "string",
                    "description": "Conferencing application type"
                },
                "returnTo": {
                    "type": "string"
                },
                "onErrorReturnTo": {
                    "type": "string"
                }
            },
            "required": [
                "app",
                "returnTo",
                "onErrorReturnTo"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/conferencing/{app}/oauth/auth-url",
        "executionParameters": [
            {
                "name": "app",
                "in": "path"
            },
            {
                "name": "returnTo",
                "in": "query"
            },
            {
                "name": "onErrorReturnTo",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "ConferencingController_save",
    {
        "name": "ConferencingController_save",
        "description": "Conferencing app OAuth callback",
        "inputSchema": {
            "type": "object",
            "properties": {
                "state": {
                    "type": "string"
                },
                "app": {
                    "enum": [
                        "zoom",
                        "msteams"
                    ],
                    "type": "string",
                    "description": "Conferencing application type"
                },
                "code": {
                    "type": "string"
                }
            },
            "required": [
                "state",
                "app",
                "code"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/conferencing/{app}/oauth/callback",
        "executionParameters": [
            {
                "name": "state",
                "in": "query"
            },
            {
                "name": "app",
                "in": "path"
            },
            {
                "name": "code",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "ConferencingController_listInstalledConferencingApps",
    {
        "name": "ConferencingController_listInstalledConferencingApps",
        "description": "List your conferencing applications",
        "inputSchema": {
            "type": "object",
            "properties": {}
        },
        "method": "get",
        "pathTemplate": "/v2/conferencing",
        "executionParameters": [],
        "securityRequirements": []
    },
  ],
  [
    "ConferencingController_default",
    {
        "name": "ConferencingController_default",
        "description": "Set your default conferencing application",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {
                    "enum": [
                        "google-meet",
                        "zoom",
                        "msteams",
                        "daily-video"
                    ],
                    "type": "string",
                    "description": "Conferencing application type"
                }
            },
            "required": [
                "app"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/conferencing/{app}/default",
        "executionParameters": [
            {
                "name": "app",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "ConferencingController_getDefault",
    {
        "name": "ConferencingController_getDefault",
        "description": "Get your default conferencing application",
        "inputSchema": {
            "type": "object",
            "properties": {}
        },
        "method": "get",
        "pathTemplate": "/v2/conferencing/default",
        "executionParameters": [],
        "securityRequirements": []
    },
  ],
  [
    "ConferencingController_disconnect",
    {
        "name": "ConferencingController_disconnect",
        "description": "Disconnect your conferencing application",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app": {
                    "enum": [
                        "google-meet",
                        "zoom",
                        "msteams"
                    ],
                    "type": "string",
                    "description": "Conferencing application type"
                }
            },
            "required": [
                "app"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/conferencing/{app}/disconnect",
        "executionParameters": [
            {
                "name": "app",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "DestinationCalendarsController_updateDestinationCalendars",
    {
        "name": "DestinationCalendarsController_updateDestinationCalendars",
        "description": "Update destination calendars",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/DestinationCalendarsInputBodyDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "put",
        "pathTemplate": "/v2/destination-calendars",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "EventTypesController_2024_06_14_createEventType",
    {
        "name": "EventTypesController_2024_06_14_createEventType",
        "description": "Create an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-14",
                    "description": "Must be set to 2024-06-14. If not set to this value, the endpoint will default to an older version."
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateEventTypeInput_2024_06_14",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/event-types",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "EventTypesController_2024_06_14_getEventTypes",
    {
        "name": "EventTypesController_2024_06_14_getEventTypes",
        "description": "Get all event types",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-14",
                    "description": "Must be set to 2024-06-14. If not set to this value, the endpoint will default to an older version."
                },
                "username": {
                    "type": "string",
                    "description": "The username of the user to get event types for. If only username provided will get all event types."
                },
                "eventSlug": {
                    "type": "string",
                    "description": "Slug of event type to return. Notably, if eventSlug is provided then username must be provided too, because multiple users can have event with same slug."
                },
                "usernames": {
                    "type": "string",
                    "description": "Get dynamic event type for multiple usernames separated by comma. e.g `usernames=alice,bob`"
                },
                "orgSlug": {
                    "type": "string",
                    "description": "slug of the user's organization if he is in one, orgId is not required if using this parameter"
                },
                "orgId": {
                    "type": "number",
                    "description": "ID of the organization of the user you want the get the event-types of, orgSlug is not needed when using this parameter"
                },
                "sortCreatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort event types by creation date. When not provided, no explicit ordering is applied."
                },
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                }
            },
            "required": [
                "cal-api-version"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/event-types",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "username",
                "in": "query"
            },
            {
                "name": "eventSlug",
                "in": "query"
            },
            {
                "name": "usernames",
                "in": "query"
            },
            {
                "name": "orgSlug",
                "in": "query"
            },
            {
                "name": "orgId",
                "in": "query"
            },
            {
                "name": "sortCreatedAt",
                "in": "query"
            },
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "EventTypesController_2024_06_14_getEventTypeById",
    {
        "name": "EventTypesController_2024_06_14_getEventTypeById",
        "description": "Get an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-14",
                    "description": "Must be set to 2024-06-14. If not set to this value, the endpoint will default to an older version."
                },
                "eventTypeId": {
                    "type": "string"
                }
            },
            "required": [
                "cal-api-version",
                "eventTypeId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/event-types/{eventTypeId}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "EventTypesController_2024_06_14_updateEventType",
    {
        "name": "EventTypesController_2024_06_14_updateEventType",
        "description": "Update an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-14",
                    "description": "Must be set to 2024-06-14. If not set to this value, the endpoint will default to an older version."
                },
                "eventTypeId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateEventTypeInput_2024_06_14",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "eventTypeId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/event-types/{eventTypeId}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "EventTypesController_2024_06_14_deleteEventType",
    {
        "name": "EventTypesController_2024_06_14_deleteEventType",
        "description": "Delete an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-14",
                    "description": "Must be set to 2024-06-14. If not set to this value, the endpoint will default to an older version."
                },
                "eventTypeId": {
                    "type": "number"
                }
            },
            "required": [
                "cal-api-version",
                "eventTypeId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/event-types/{eventTypeId}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "EventTypeWebhooksController_createEventTypeWebhook",
    {
        "name": "EventTypeWebhooksController_createEventTypeWebhook",
        "description": "Create a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateWebhookInputDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "eventTypeId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/event-types/{eventTypeId}/webhooks",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "EventTypeWebhooksController_getEventTypeWebhooks",
    {
        "name": "EventTypeWebhooksController_getEventTypeWebhooks",
        "description": "Get all webhooks",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "eventTypeId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/event-types/{eventTypeId}/webhooks",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "EventTypeWebhooksController_deleteAllEventTypeWebhooks",
    {
        "name": "EventTypeWebhooksController_deleteAllEventTypeWebhooks",
        "description": "Delete all webhooks",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                }
            },
            "required": [
                "eventTypeId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/event-types/{eventTypeId}/webhooks",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "EventTypeWebhooksController_updateEventTypeWebhook",
    {
        "name": "EventTypeWebhooksController_updateEventTypeWebhook",
        "description": "Update a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "webhookId": {
                    "type": "string"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateWebhookInputDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "webhookId",
                "eventTypeId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/event-types/{eventTypeId}/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "webhookId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "EventTypeWebhooksController_getEventTypeWebhook",
    {
        "name": "EventTypeWebhooksController_getEventTypeWebhook",
        "description": "Get a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "webhookId": {
                    "type": "string"
                },
                "eventTypeId": {
                    "type": "number"
                }
            },
            "required": [
                "webhookId",
                "eventTypeId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/event-types/{eventTypeId}/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "webhookId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "EventTypeWebhooksController_deleteEventTypeWebhook",
    {
        "name": "EventTypeWebhooksController_deleteEventTypeWebhook",
        "description": "Delete a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "webhookId": {
                    "type": "string"
                },
                "eventTypeId": {
                    "type": "number"
                }
            },
            "required": [
                "webhookId",
                "eventTypeId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/event-types/{eventTypeId}/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "webhookId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "EventTypesPrivateLinksController_createPrivateLink",
    {
        "name": "EventTypesPrivateLinksController_createPrivateLink",
        "description": "Create a private link for an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreatePrivateLinkInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "eventTypeId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/event-types/{eventTypeId}/private-links",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "EventTypesPrivateLinksController_getPrivateLinks",
    {
        "name": "EventTypesPrivateLinksController_getPrivateLinks",
        "description": "Get all private links for an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                }
            },
            "required": [
                "eventTypeId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/event-types/{eventTypeId}/private-links",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "EventTypesPrivateLinksController_updatePrivateLink",
    {
        "name": "EventTypesPrivateLinksController_updatePrivateLink",
        "description": "Update a private link for an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                },
                "linkId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdatePrivateLinkBody",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "eventTypeId",
                "linkId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/event-types/{eventTypeId}/private-links/{linkId}",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "linkId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "EventTypesPrivateLinksController_deletePrivateLink",
    {
        "name": "EventTypesPrivateLinksController_deletePrivateLink",
        "description": "Delete a private link for an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                },
                "linkId": {
                    "type": "string"
                }
            },
            "required": [
                "eventTypeId",
                "linkId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/event-types/{eventTypeId}/private-links/{linkId}",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "linkId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsOrganizationsController_createOrganization",
    {
        "name": "OrganizationsOrganizationsController_createOrganization",
        "description": "Create an organization within an organization",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateOrganizationInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/organizations",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsOrganizationsController_getOrganizations",
    {
        "name": "OrganizationsOrganizationsController_getOrganizations",
        "description": "Get all organizations within an organization",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                },
                "slug": {
                    "example": "organization-slug",
                    "type": "string",
                    "description": "The slug of the managed organization"
                },
                "metadataKey": {
                    "example": "metadata-key",
                    "type": "string",
                    "description": "The key of the metadata - it is case sensitive so provide exactly as stored. If you provide it then you must also provide metadataValue"
                },
                "metadataValue": {
                    "example": "metadata-value",
                    "type": "string",
                    "description": "The value of the metadata - it is case sensitive so provide exactly as stored. If you provide it then you must also provide metadataKey"
                }
            },
            "required": [
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/organizations",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "slug",
                "in": "query"
            },
            {
                "name": "metadataKey",
                "in": "query"
            },
            {
                "name": "metadataValue",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsOrganizationsController_getOrganization",
    {
        "name": "OrganizationsOrganizationsController_getOrganization",
        "description": "Get an organization within an organization",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "managedOrganizationId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "managedOrganizationId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/organizations/{managedOrganizationId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "managedOrganizationId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsOrganizationsController_updateOrganization",
    {
        "name": "OrganizationsOrganizationsController_updateOrganization",
        "description": "Update an organization within an organization",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "orgId": {
                    "type": "number"
                },
                "managedOrganizationId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateOrganizationInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "orgId",
                "managedOrganizationId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/organizations/{orgId}/organizations/{managedOrganizationId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "managedOrganizationId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrganizationsOrganizationsController_deleteOrganization",
    {
        "name": "OrganizationsOrganizationsController_deleteOrganization",
        "description": "Delete an organization within an organization",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x-cal-secret-key": {
                    "type": "string",
                    "description": "For platform customers - OAuth client secret key"
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "managedOrganizationId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "managedOrganizationId",
                "orgId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/organizations/{orgId}/organizations/{managedOrganizationId}",
        "executionParameters": [
            {
                "name": "x-cal-secret-key",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            },
            {
                "name": "managedOrganizationId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "MeController_getMe",
    {
        "name": "MeController_getMe",
        "description": "Get my profile",
        "inputSchema": {
            "type": "object",
            "properties": {}
        },
        "method": "get",
        "pathTemplate": "/v2/me",
        "executionParameters": [],
        "securityRequirements": []
    },
  ],
  [
    "MeController_updateMe",
    {
        "name": "MeController_updateMe",
        "description": "Update my profile",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateManagedUserInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/me",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OAuth2Controller_getClient",
    {
        "name": "OAuth2Controller_getClient",
        "description": "Get OAuth2 client",
        "inputSchema": {
            "type": "object",
            "properties": {
                "clientId": {
                    "type": "string"
                }
            },
            "required": [
                "clientId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/auth/oauth2/clients/{clientId}",
        "executionParameters": [
            {
                "name": "clientId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OAuth2Controller_token",
    {
        "name": "OAuth2Controller_token",
        "description": "Exchange authorization code or refresh token for tokens",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "oneOf": [
                        {
                            "$ref": "#/components/schemas/OAuth2ExchangeConfidentialInput"
                        },
                        {
                            "$ref": "#/components/schemas/OAuth2ExchangePublicInput"
                        },
                        {
                            "$ref": "#/components/schemas/OAuth2RefreshConfidentialInput"
                        },
                        {
                            "$ref": "#/components/schemas/OAuth2RefreshPublicInput"
                        }
                    ],
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/auth/oauth2/token",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrgTeamsVerifiedResourcesController_requestEmailVerificationCode",
    {
        "name": "OrgTeamsVerifiedResourcesController_requestEmailVerificationCode",
        "description": "Request email verification code",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/RequestEmailVerificationInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/verified-resources/emails/verification-code/request",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrgTeamsVerifiedResourcesController_requestPhoneVerificationCode",
    {
        "name": "OrgTeamsVerifiedResourcesController_requestPhoneVerificationCode",
        "description": "Request phone number verification code",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/RequestPhoneVerificationInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/verified-resources/phones/verification-code/request",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrgTeamsVerifiedResourcesController_verifyEmail",
    {
        "name": "OrgTeamsVerifiedResourcesController_verifyEmail",
        "description": "Verify an email for an org team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/VerifyEmailInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/verified-resources/emails/verification-code/verify",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrgTeamsVerifiedResourcesController_verifyPhoneNumber",
    {
        "name": "OrgTeamsVerifiedResourcesController_verifyPhoneNumber",
        "description": "Verify a phone number for an org team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/VerifyPhoneInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "orgId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/verified-resources/phones/verification-code/verify",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "OrgTeamsVerifiedResourcesController_getVerifiedEmails",
    {
        "name": "OrgTeamsVerifiedResourcesController_getVerifiedEmails",
        "description": "Get list of verified emails of an org team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/verified-resources/emails",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrgTeamsVerifiedResourcesController_getVerifiedPhoneNumbers",
    {
        "name": "OrgTeamsVerifiedResourcesController_getVerifiedPhoneNumbers",
        "description": "Get list of verified phone numbers of an org team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/verified-resources/phones",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrgTeamsVerifiedResourcesController_getVerifiedEmailById",
    {
        "name": "OrgTeamsVerifiedResourcesController_getVerifiedEmailById",
        "description": "Get verified email of an org team by id",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "id",
                "teamId",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/verified-resources/emails/{id}",
        "executionParameters": [
            {
                "name": "id",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "OrgTeamsVerifiedResourcesController_getVerifiedPhoneById",
    {
        "name": "OrgTeamsVerifiedResourcesController_getVerifiedPhoneById",
        "description": "Get verified phone number of an org team by id",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "id": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "id",
                "orgId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/organizations/{orgId}/teams/{teamId}/verified-resources/phones/{id}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "id",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "RoutingFormsController_calculateSlotsBasedOnRoutingFormResponse",
    {
        "name": "RoutingFormsController_calculateSlotsBasedOnRoutingFormResponse",
        "description": "Calculate slots based on routing form response",
        "inputSchema": {
            "type": "object",
            "properties": {
                "start": {
                    "example": "2050-09-05",
                    "type": "string",
                    "description": "\n      Time starting from which available slots should be checked.\n    \n      Must be in UTC timezone as ISO 8601 datestring.\n      \n      You can pass date without hours which defaults to start of day or specify hours:\n      2024-08-13 (will have hours 00:00:00 aka at very beginning of the date) or you can specify hours manually like 2024-08-13T09:00:00Z\n      "
                },
                "end": {
                    "example": "2050-09-06",
                    "type": "string",
                    "description": "\n      Time until which available slots should be checked.\n      \n      Must be in UTC timezone as ISO 8601 datestring.\n      \n      You can pass date without hours which defaults to end of day or specify hours:\n      2024-08-20 (will have hours 23:59:59 aka at the very end of the date) or you can specify hours manually like 2024-08-20T18:00:00Z"
                },
                "timeZone": {
                    "example": "Europe/Rome",
                    "type": "string",
                    "description": "Time zone in which the available slots should be returned. Defaults to UTC."
                },
                "duration": {
                    "example": "60",
                    "type": "number",
                    "description": "If event type has multiple possible durations then you can specify the desired duration here. Also, if you are fetching slots for a dynamic event then you can specify the duration her which defaults to 30, meaning that returned slots will be each 30 minutes long."
                },
                "format": {
                    "example": "range",
                    "enum": [
                        "range",
                        "time"
                    ],
                    "type": "string",
                    "description": "Format of slot times in response. Use 'range' to get start and end times."
                },
                "bookingUidToReschedule": {
                    "example": "abc123def456",
                    "type": "string",
                    "description": "The unique identifier of the booking being rescheduled. When provided will ensure that the original booking time appears within the returned available slots when rescheduling."
                },
                "routingFormId": {
                    "type": "string"
                }
            },
            "required": [
                "start",
                "end",
                "routingFormId"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/routing-forms/{routingFormId}/calculate-slots",
        "executionParameters": [
            {
                "name": "start",
                "in": "query"
            },
            {
                "name": "end",
                "in": "query"
            },
            {
                "name": "timeZone",
                "in": "query"
            },
            {
                "name": "duration",
                "in": "query"
            },
            {
                "name": "format",
                "in": "query"
            },
            {
                "name": "bookingUidToReschedule",
                "in": "query"
            },
            {
                "name": "routingFormId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "SchedulesController_2024_06_11_createSchedule",
    {
        "name": "SchedulesController_2024_06_11_createSchedule",
        "description": "Create a schedule",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-11",
                    "description": "Must be set to 2024-06-11. If not set to this value, the endpoint will default to an older version."
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateScheduleInput_2024_06_11",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/schedules",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "SchedulesController_2024_06_11_getSchedules",
    {
        "name": "SchedulesController_2024_06_11_getSchedules",
        "description": "Get all schedules",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-11",
                    "description": "Must be set to 2024-06-11. If not set to this value, the endpoint will default to an older version."
                }
            },
            "required": [
                "cal-api-version"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/schedules",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "SchedulesController_2024_06_11_getDefaultSchedule",
    {
        "name": "SchedulesController_2024_06_11_getDefaultSchedule",
        "description": "Get default schedule",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-11",
                    "description": "Must be set to 2024-06-11. If not set to this value, the endpoint will default to an older version."
                }
            },
            "required": [
                "cal-api-version"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/schedules/default",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "SchedulesController_2024_06_11_getSchedule",
    {
        "name": "SchedulesController_2024_06_11_getSchedule",
        "description": "Get a schedule",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-11",
                    "description": "Must be set to 2024-06-11. If not set to this value, the endpoint will default to an older version."
                },
                "scheduleId": {
                    "type": "number"
                }
            },
            "required": [
                "cal-api-version",
                "scheduleId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/schedules/{scheduleId}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "scheduleId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "SchedulesController_2024_06_11_updateSchedule",
    {
        "name": "SchedulesController_2024_06_11_updateSchedule",
        "description": "Update a schedule",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-11",
                    "description": "Must be set to 2024-06-11. If not set to this value, the endpoint will default to an older version."
                },
                "scheduleId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateScheduleInput_2024_06_11",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "scheduleId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/schedules/{scheduleId}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "scheduleId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "SchedulesController_2024_06_11_deleteSchedule",
    {
        "name": "SchedulesController_2024_06_11_deleteSchedule",
        "description": "Delete a schedule",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-06-11",
                    "description": "Must be set to 2024-06-11. If not set to this value, the endpoint will default to an older version."
                },
                "scheduleId": {
                    "type": "number"
                }
            },
            "required": [
                "cal-api-version",
                "scheduleId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/schedules/{scheduleId}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "scheduleId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "SelectedCalendarsController_addSelectedCalendar",
    {
        "name": "SelectedCalendarsController_addSelectedCalendar",
        "description": "Add a selected calendar",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/SelectedCalendarsInputDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/selected-calendars",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "SelectedCalendarsController_deleteSelectedCalendar",
    {
        "name": "SelectedCalendarsController_deleteSelectedCalendar",
        "description": "Delete a selected calendar",
        "inputSchema": {
            "type": "object",
            "properties": {
                "integration": {
                    "type": "string"
                },
                "externalId": {
                    "type": "string"
                },
                "credentialId": {
                    "type": "string"
                },
                "delegationCredentialId": {
                    "type": "string"
                }
            },
            "required": [
                "integration",
                "externalId",
                "credentialId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/selected-calendars",
        "executionParameters": [
            {
                "name": "integration",
                "in": "query"
            },
            {
                "name": "externalId",
                "in": "query"
            },
            {
                "name": "credentialId",
                "in": "query"
            },
            {
                "name": "delegationCredentialId",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "SlotsController_2024_09_04_getAvailableSlots",
    {
        "name": "SlotsController_2024_09_04_getAvailableSlots",
        "description": "Get available time slots for an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-09-04",
                    "description": "Must be set to 2024-09-04. If not set to this value, the endpoint will default to an older version."
                },
                "bookingUidToReschedule": {
                    "example": "abc123def456",
                    "type": "string",
                    "description": "The unique identifier of the booking being rescheduled. When provided will ensure that the original booking time appears within the returned available slots when rescheduling."
                },
                "start": {
                    "example": "2050-09-05",
                    "type": "string",
                    "description": "\n      Time starting from which available slots should be checked.\n\n      Must be in UTC timezone as ISO 8601 datestring.\n\n      You can pass date without hours which defaults to start of day or specify hours:\n      2024-08-13 (will have hours 00:00:00 aka at very beginning of the date) or you can specify hours manually like 2024-08-13T09:00:00Z."
                },
                "end": {
                    "example": "2050-09-06",
                    "type": "string",
                    "description": "\n    Time until which available slots should be checked.\n\n    Must be in UTC timezone as ISO 8601 datestring.\n\n    You can pass date without hours which defaults to end of day or specify hours:\n    2024-08-20 (will have hours 23:59:59 aka at the very end of the date) or you can specify hours manually like 2024-08-20T18:00:00Z."
                },
                "organizationSlug": {
                    "example": "org-slug",
                    "type": "string",
                    "description": "The slug of the organization to which user with username belongs or team with teamSlug belongs."
                },
                "teamSlug": {
                    "example": "team-slug",
                    "type": "string",
                    "description": "The slug of the team who owns event type with eventTypeSlug - used when slots are checked for team event type."
                },
                "username": {
                    "example": "bob",
                    "type": "string",
                    "description": "The username of the user who owns event type with eventTypeSlug - used when slots are checked for individual user event type."
                },
                "eventTypeSlug": {
                    "example": "event-type-slug",
                    "type": "string",
                    "description": "The slug of the event type for which available slots should be checked. If slug is provided then username or teamSlug must be provided too and if relevant organizationSlug too."
                },
                "eventTypeId": {
                    "example": "100",
                    "type": "number",
                    "description": "The ID of the event type for which available slots should be checked."
                },
                "usernames": {
                    "example": "alice,bob",
                    "type": "string",
                    "description": "The usernames for which available slots should be checked separated by a comma.\n\n    Checking slots by usernames is used mainly for dynamic events where there is no specific event but we just want to know when 2 or more people are available.\n\n    Must contain at least 2 usernames."
                },
                "format": {
                    "example": "range",
                    "type": "string",
                    "description": "Format of slot times in response. Use 'range' to get start and end times. Use 'time' or omit this query parameter to get only start time."
                },
                "duration": {
                    "example": "60",
                    "type": "number",
                    "description": "If event type has multiple possible durations then you can specify the desired duration here. Also, if you are fetching slots for a dynamic event then you can specify the duration her which defaults to 30, meaning that returned slots will be each 30 minutes long."
                },
                "timeZone": {
                    "example": "Europe/Rome",
                    "type": "string",
                    "description": "Time zone in which the available slots should be returned. Defaults to UTC."
                }
            },
            "required": [
                "cal-api-version",
                "start",
                "end"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/slots",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "bookingUidToReschedule",
                "in": "query"
            },
            {
                "name": "start",
                "in": "query"
            },
            {
                "name": "end",
                "in": "query"
            },
            {
                "name": "organizationSlug",
                "in": "query"
            },
            {
                "name": "teamSlug",
                "in": "query"
            },
            {
                "name": "username",
                "in": "query"
            },
            {
                "name": "eventTypeSlug",
                "in": "query"
            },
            {
                "name": "eventTypeId",
                "in": "query"
            },
            {
                "name": "usernames",
                "in": "query"
            },
            {
                "name": "format",
                "in": "query"
            },
            {
                "name": "duration",
                "in": "query"
            },
            {
                "name": "timeZone",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "SlotsController_2024_09_04_reserveSlot",
    {
        "name": "SlotsController_2024_09_04_reserveSlot",
        "description": "Reserve a slot",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-09-04",
                    "description": "Must be set to 2024-09-04. If not set to this value, the endpoint will default to an older version."
                },
                "x-cal-client-id": {
                    "type": "string",
                    "description": "For platform customers - OAuth client ID"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/ReserveSlotInput_2024_09_04",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/slots/reservations",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "x-cal-client-id",
                "in": "header"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "SlotsController_2024_09_04_getReservedSlot",
    {
        "name": "SlotsController_2024_09_04_getReservedSlot",
        "description": "Get reserved slot",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-09-04",
                    "description": "Must be set to 2024-09-04. If not set to this value, the endpoint will default to an older version."
                },
                "uid": {
                    "type": "string"
                }
            },
            "required": [
                "cal-api-version",
                "uid"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/slots/reservations/{uid}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "uid",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "SlotsController_2024_09_04_updateReservedSlot",
    {
        "name": "SlotsController_2024_09_04_updateReservedSlot",
        "description": "Update a reserved slot",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-09-04",
                    "description": "Must be set to 2024-09-04. If not set to this value, the endpoint will default to an older version."
                },
                "uid": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/ReserveSlotInput_2024_09_04",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "cal-api-version",
                "uid",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/slots/reservations/{uid}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "uid",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "SlotsController_2024_09_04_deleteReservedSlot",
    {
        "name": "SlotsController_2024_09_04_deleteReservedSlot",
        "description": "Delete a reserved slot",
        "inputSchema": {
            "type": "object",
            "properties": {
                "cal-api-version": {
                    "type": "string",
                    "default": "2024-09-04",
                    "description": "Must be set to 2024-09-04. If not set to this value, the endpoint will default to an older version."
                },
                "uid": {
                    "type": "string"
                }
            },
            "required": [
                "cal-api-version",
                "uid"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/slots/reservations/{uid}",
        "executionParameters": [
            {
                "name": "cal-api-version",
                "in": "header"
            },
            {
                "name": "uid",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "StripeController_redirect",
    {
        "name": "StripeController_redirect",
        "description": "Get Stripe connect URL",
        "inputSchema": {
            "type": "object",
            "properties": {}
        },
        "method": "get",
        "pathTemplate": "/v2/stripe/connect",
        "executionParameters": [],
        "securityRequirements": []
    },
  ],
  [
    "StripeController_save",
    {
        "name": "StripeController_save",
        "description": "Save Stripe credentials",
        "inputSchema": {
            "type": "object",
            "properties": {
                "state": {
                    "type": "string"
                },
                "code": {
                    "type": "string"
                }
            },
            "required": [
                "state",
                "code"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/stripe/save",
        "executionParameters": [
            {
                "name": "state",
                "in": "query"
            },
            {
                "name": "code",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "StripeController_check",
    {
        "name": "StripeController_check",
        "description": "Check Stripe connection",
        "inputSchema": {
            "type": "object",
            "properties": {}
        },
        "method": "get",
        "pathTemplate": "/v2/stripe/check",
        "executionParameters": [],
        "securityRequirements": []
    },
  ],
  [
    "TeamsController_createTeam",
    {
        "name": "TeamsController_createTeam",
        "description": "Create a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/CreateTeamInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/teams",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsController_getTeams",
    {
        "name": "TeamsController_getTeams",
        "description": "Get teams",
        "inputSchema": {
            "type": "object",
            "properties": {}
        },
        "method": "get",
        "pathTemplate": "/v2/teams",
        "executionParameters": [],
        "securityRequirements": []
    },
  ],
  [
    "TeamsController_getTeam",
    {
        "name": "TeamsController_getTeam",
        "description": "Get a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsController_updateTeam",
    {
        "name": "TeamsController_updateTeam",
        "description": "Update a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateOrgTeamDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/teams/{teamId}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsController_deleteTeam",
    {
        "name": "TeamsController_deleteTeam",
        "description": "Delete a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/teams/{teamId}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsBookingsController_getAllTeamBookings",
    {
        "name": "TeamsBookingsController_getAllTeamBookings",
        "description": "Get team bookings",
        "inputSchema": {
            "type": "object",
            "properties": {
                "status": {
                    "example": "?status=upcoming,past",
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": [
                            "upcoming",
                            "recurring",
                            "past",
                            "cancelled",
                            "unconfirmed"
                        ]
                    },
                    "description": "Filter bookings by status. If you want to filter by multiple statuses, separate them with a comma."
                },
                "attendeeEmail": {
                    "example": "example@domain.com",
                    "type": "string",
                    "description": "Filter bookings by the attendee's email address."
                },
                "attendeeName": {
                    "example": "John Doe",
                    "type": "string",
                    "description": "Filter bookings by the attendee's name."
                },
                "bookingUid": {
                    "example": "2NtaeaVcKfpmSZ4CthFdfk",
                    "type": "string",
                    "description": "Filter bookings by the booking Uid."
                },
                "eventTypeIds": {
                    "example": "?eventTypeIds=100,200",
                    "type": "string",
                    "description": "Filter bookings by event type ids belonging to the team. Event type ids must be separated by a comma."
                },
                "eventTypeId": {
                    "example": "?eventTypeId=100",
                    "type": "string",
                    "description": "Filter bookings by event type id belonging to the team."
                },
                "afterStart": {
                    "example": "?afterStart=2025-03-07T10:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings with start after this date string."
                },
                "beforeEnd": {
                    "example": "?beforeEnd=2025-03-07T11:00:00.000Z",
                    "type": "string",
                    "description": "Filter bookings with end before this date string."
                },
                "sortStart": {
                    "example": "?sortStart=asc OR ?sortStart=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their start time in ascending or descending order."
                },
                "sortEnd": {
                    "example": "?sortEnd=asc OR ?sortEnd=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their end time in ascending or descending order."
                },
                "sortCreated": {
                    "example": "?sortCreated=asc OR ?sortCreated=desc",
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort results by their creation time (when booking was made) in ascending or descending order."
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "example": 10,
                    "type": "number",
                    "description": "The number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "example": 0,
                    "type": "number",
                    "description": "The number of items to skip"
                },
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/bookings",
        "executionParameters": [
            {
                "name": "status",
                "in": "query"
            },
            {
                "name": "attendeeEmail",
                "in": "query"
            },
            {
                "name": "attendeeName",
                "in": "query"
            },
            {
                "name": "bookingUid",
                "in": "query"
            },
            {
                "name": "eventTypeIds",
                "in": "query"
            },
            {
                "name": "eventTypeId",
                "in": "query"
            },
            {
                "name": "afterStart",
                "in": "query"
            },
            {
                "name": "beforeEnd",
                "in": "query"
            },
            {
                "name": "sortStart",
                "in": "query"
            },
            {
                "name": "sortEnd",
                "in": "query"
            },
            {
                "name": "sortCreated",
                "in": "query"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesController_createTeamEventType",
    {
        "name": "TeamsEventTypesController_createTeamEventType",
        "description": "Create an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateTeamEventTypeInput_2024_06_14",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/teams/{teamId}/event-types",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesController_getTeamEventTypes",
    {
        "name": "TeamsEventTypesController_getTeamEventTypes",
        "description": "Get team event types",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "eventSlug": {
                    "type": "string",
                    "description": "Slug of team event type to return."
                },
                "hostsLimit": {
                    "type": "number",
                    "description": "Specifies the maximum number of hosts to include in the response. This limit helps optimize performance. If not provided, all Hosts will be fetched."
                },
                "sortCreatedAt": {
                    "enum": [
                        "asc",
                        "desc"
                    ],
                    "type": "string",
                    "description": "Sort event types by creation date. When not provided, no explicit ordering is applied."
                }
            },
            "required": [
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/event-types",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventSlug",
                "in": "query"
            },
            {
                "name": "hostsLimit",
                "in": "query"
            },
            {
                "name": "sortCreatedAt",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesController_getTeamEventType",
    {
        "name": "TeamsEventTypesController_getTeamEventType",
        "description": "Get an event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "eventTypeId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/event-types/{eventTypeId}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesController_updateTeamEventType",
    {
        "name": "TeamsEventTypesController_updateTeamEventType",
        "description": "Update a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateTeamEventTypeInput_2024_06_14",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "eventTypeId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/teams/{teamId}/event-types/{eventTypeId}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesController_deleteTeamEventType",
    {
        "name": "TeamsEventTypesController_deleteTeamEventType",
        "description": "Delete a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "eventTypeId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "eventTypeId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/teams/{teamId}/event-types/{eventTypeId}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesController_createPhoneCall",
    {
        "name": "TeamsEventTypesController_createPhoneCall",
        "description": "Create a phone call",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                },
                "orgId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreatePhoneCallInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "eventTypeId",
                "orgId",
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/teams/{teamId}/event-types/{eventTypeId}/create-phone-call",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "orgId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesWebhooksController_createTeamEventTypeWebhook",
    {
        "name": "TeamsEventTypesWebhooksController_createTeamEventTypeWebhook",
        "description": "Create a webhook for a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateWebhookInputDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "eventTypeId",
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/teams/{teamId}/event-types/{eventTypeId}/webhooks",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesWebhooksController_getTeamEventTypeWebhooks",
    {
        "name": "TeamsEventTypesWebhooksController_getTeamEventTypeWebhooks",
        "description": "Get all webhooks for a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                },
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "eventTypeId",
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/event-types/{eventTypeId}/webhooks",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesWebhooksController_deleteAllTeamEventTypeWebhooks",
    {
        "name": "TeamsEventTypesWebhooksController_deleteAllTeamEventTypeWebhooks",
        "description": "Delete all webhooks for a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "eventTypeId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "eventTypeId",
                "teamId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/teams/{teamId}/event-types/{eventTypeId}/webhooks",
        "executionParameters": [
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesWebhooksController_updateTeamEventTypeWebhook",
    {
        "name": "TeamsEventTypesWebhooksController_updateTeamEventTypeWebhook",
        "description": "Update a webhook for a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "webhookId": {
                    "type": "string"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateWebhookInputDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "webhookId",
                "eventTypeId",
                "teamId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/teams/{teamId}/event-types/{eventTypeId}/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "webhookId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesWebhooksController_getTeamEventTypeWebhook",
    {
        "name": "TeamsEventTypesWebhooksController_getTeamEventTypeWebhook",
        "description": "Get a webhook for a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "webhookId": {
                    "type": "string"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "webhookId",
                "eventTypeId",
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/event-types/{eventTypeId}/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "webhookId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsEventTypesWebhooksController_deleteTeamEventTypeWebhook",
    {
        "name": "TeamsEventTypesWebhooksController_deleteTeamEventTypeWebhook",
        "description": "Delete a webhook for a team event type",
        "inputSchema": {
            "type": "object",
            "properties": {
                "webhookId": {
                    "type": "string"
                },
                "eventTypeId": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "webhookId",
                "eventTypeId",
                "teamId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/teams/{teamId}/event-types/{eventTypeId}/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "webhookId",
                "in": "path"
            },
            {
                "name": "eventTypeId",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsInviteController_createInvite",
    {
        "name": "TeamsInviteController_createInvite",
        "description": "Create team invite link",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/teams/{teamId}/invite",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsMembershipsController_createTeamMembership",
    {
        "name": "TeamsMembershipsController_createTeamMembership",
        "description": "Create a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/CreateTeamMembershipInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/teams/{teamId}/memberships",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsMembershipsController_getTeamMemberships",
    {
        "name": "TeamsMembershipsController_getTeamMemberships",
        "description": "Get all memberships",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                },
                "emails": {
                    "example": "?emails=user1@example.com,user2@example.com",
                    "type": "array",
                    "items": {
                        "type": "string"
                    },
                    "description": "Filter team memberships by email addresses. If you want to filter by multiple emails, separate them with a comma (max 20 emails for performance)."
                }
            },
            "required": [
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/memberships",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            },
            {
                "name": "emails",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsMembershipsController_getTeamMembership",
    {
        "name": "TeamsMembershipsController_getTeamMembership",
        "description": "Get a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "membershipId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "membershipId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/memberships/{membershipId}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "membershipId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsMembershipsController_updateTeamMembership",
    {
        "name": "TeamsMembershipsController_updateTeamMembership",
        "description": "Update membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "membershipId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateTeamMembershipInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "membershipId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/teams/{teamId}/memberships/{membershipId}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "membershipId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsMembershipsController_deleteTeamMembership",
    {
        "name": "TeamsMembershipsController_deleteTeamMembership",
        "description": "Delete a membership",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "membershipId": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "membershipId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/teams/{teamId}/memberships/{membershipId}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "membershipId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsSchedulesController_getTeamSchedules",
    {
        "name": "TeamsSchedulesController_getTeamSchedules",
        "description": "Get all team member schedules",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/schedules",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsVerifiedResourcesController_requestEmailVerificationCode",
    {
        "name": "TeamsVerifiedResourcesController_requestEmailVerificationCode",
        "description": "Request email verification code",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/RequestEmailVerificationInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/teams/{teamId}/verified-resources/emails/verification-code/request",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsVerifiedResourcesController_requestPhoneVerificationCode",
    {
        "name": "TeamsVerifiedResourcesController_requestPhoneVerificationCode",
        "description": "Request phone number verification code",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/RequestPhoneVerificationInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/teams/{teamId}/verified-resources/phones/verification-code/request",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsVerifiedResourcesController_verifyEmail",
    {
        "name": "TeamsVerifiedResourcesController_verifyEmail",
        "description": "Verify an email for a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/VerifyEmailInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/teams/{teamId}/verified-resources/emails/verification-code/verify",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsVerifiedResourcesController_verifyPhoneNumber",
    {
        "name": "TeamsVerifiedResourcesController_verifyPhoneNumber",
        "description": "Verify a phone number for an org team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/VerifyPhoneInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "teamId",
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/teams/{teamId}/verified-resources/phones/verification-code/verify",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "TeamsVerifiedResourcesController_getVerifiedEmails",
    {
        "name": "TeamsVerifiedResourcesController_getVerifiedEmails",
        "description": "Get list of verified emails of a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/verified-resources/emails",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsVerifiedResourcesController_getVerifiedPhoneNumbers",
    {
        "name": "TeamsVerifiedResourcesController_getVerifiedPhoneNumbers",
        "description": "Get list of verified phone numbers of a team",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            },
            "required": [
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/verified-resources/phones",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsVerifiedResourcesController_getVerifiedEmailById",
    {
        "name": "TeamsVerifiedResourcesController_getVerifiedEmailById",
        "description": "Get verified email of a team by id",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "number"
                },
                "teamId": {
                    "type": "number"
                }
            },
            "required": [
                "id",
                "teamId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/verified-resources/emails/{id}",
        "executionParameters": [
            {
                "name": "id",
                "in": "path"
            },
            {
                "name": "teamId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "TeamsVerifiedResourcesController_getVerifiedPhoneById",
    {
        "name": "TeamsVerifiedResourcesController_getVerifiedPhoneById",
        "description": "Get verified phone number of a team by id",
        "inputSchema": {
            "type": "object",
            "properties": {
                "teamId": {
                    "type": "number"
                },
                "id": {
                    "type": "number"
                }
            },
            "required": [
                "teamId",
                "id"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/teams/{teamId}/verified-resources/phones/{id}",
        "executionParameters": [
            {
                "name": "teamId",
                "in": "path"
            },
            {
                "name": "id",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "UserVerifiedResourcesController_requestEmailVerificationCode",
    {
        "name": "UserVerifiedResourcesController_requestEmailVerificationCode",
        "description": "Request email verification code",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/RequestEmailVerificationInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/verified-resources/emails/verification-code/request",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "UserVerifiedResourcesController_requestPhoneVerificationCode",
    {
        "name": "UserVerifiedResourcesController_requestPhoneVerificationCode",
        "description": "Request phone number verification code",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/RequestPhoneVerificationInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/verified-resources/phones/verification-code/request",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "UserVerifiedResourcesController_verifyEmail",
    {
        "name": "UserVerifiedResourcesController_verifyEmail",
        "description": "Verify an email",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/VerifyEmailInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/verified-resources/emails/verification-code/verify",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "UserVerifiedResourcesController_verifyPhoneNumber",
    {
        "name": "UserVerifiedResourcesController_verifyPhoneNumber",
        "description": "Verify a phone number",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/VerifyPhoneInput",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/verified-resources/phones/verification-code/verify",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "UserVerifiedResourcesController_getVerifiedEmails",
    {
        "name": "UserVerifiedResourcesController_getVerifiedEmails",
        "description": "Get list of verified emails",
        "inputSchema": {
            "type": "object",
            "properties": {
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            }
        },
        "method": "get",
        "pathTemplate": "/v2/verified-resources/emails",
        "executionParameters": [
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "UserVerifiedResourcesController_getVerifiedPhoneNumbers",
    {
        "name": "UserVerifiedResourcesController_getVerifiedPhoneNumbers",
        "description": "Get list of verified phone numbers",
        "inputSchema": {
            "type": "object",
            "properties": {
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            }
        },
        "method": "get",
        "pathTemplate": "/v2/verified-resources/phones",
        "executionParameters": [
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "UserVerifiedResourcesController_getVerifiedEmailById",
    {
        "name": "UserVerifiedResourcesController_getVerifiedEmailById",
        "description": "Get verified email by id",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "number"
                }
            },
            "required": [
                "id"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/verified-resources/emails/{id}",
        "executionParameters": [
            {
                "name": "id",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "UserVerifiedResourcesController_getVerifiedPhoneById",
    {
        "name": "UserVerifiedResourcesController_getVerifiedPhoneById",
        "description": "Get verified phone number by id",
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "number"
                }
            },
            "required": [
                "id"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/verified-resources/phones/{id}",
        "executionParameters": [
            {
                "name": "id",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "WebhooksController_createWebhook",
    {
        "name": "WebhooksController_createWebhook",
        "description": "Create a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "requestBody": {
                    "$ref": "#/components/schemas/CreateWebhookInputDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "requestBody"
            ]
        },
        "method": "post",
        "pathTemplate": "/v2/webhooks",
        "executionParameters": [],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "WebhooksController_getWebhooks",
    {
        "name": "WebhooksController_getWebhooks",
        "description": "Get all webhooks",
        "inputSchema": {
            "type": "object",
            "properties": {
                "take": {
                    "minimum": 1,
                    "maximum": 250,
                    "default": 250,
                    "example": 25,
                    "type": "number",
                    "description": "Maximum number of items to return"
                },
                "skip": {
                    "minimum": 0,
                    "default": 0,
                    "example": 0,
                    "type": "number",
                    "description": "Number of items to skip"
                }
            }
        },
        "method": "get",
        "pathTemplate": "/v2/webhooks",
        "executionParameters": [
            {
                "name": "take",
                "in": "query"
            },
            {
                "name": "skip",
                "in": "query"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "WebhooksController_updateWebhook",
    {
        "name": "WebhooksController_updateWebhook",
        "description": "Update a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "webhookId": {
                    "type": "string"
                },
                "requestBody": {
                    "$ref": "#/components/schemas/UpdateWebhookInputDto",
                    "description": "The JSON request body."
                }
            },
            "required": [
                "webhookId",
                "requestBody"
            ]
        },
        "method": "patch",
        "pathTemplate": "/v2/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "webhookId",
                "in": "path"
            }
        ],
        "requestBodyContentType": "application/json",
        "securityRequirements": []
    },
  ],
  [
    "WebhooksController_getWebhook",
    {
        "name": "WebhooksController_getWebhook",
        "description": "Get a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "webhookId": {
                    "type": "string"
                }
            },
            "required": [
                "webhookId"
            ]
        },
        "method": "get",
        "pathTemplate": "/v2/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "webhookId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
  [
    "WebhooksController_deleteWebhook",
    {
        "name": "WebhooksController_deleteWebhook",
        "description": "Delete a webhook",
        "inputSchema": {
            "type": "object",
            "properties": {
                "webhookId": {
                    "type": "string"
                }
            },
            "required": [
                "webhookId"
            ]
        },
        "method": "delete",
        "pathTemplate": "/v2/webhooks/{webhookId}",
        "executionParameters": [
            {
                "name": "webhookId",
                "in": "path"
            }
        ],
        "securityRequirements": []
    },
  ],
]);
