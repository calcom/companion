/**
 * API execution logic for Cal.com MCP Server
 *
 * This module handles the actual HTTP requests to the Cal.com API.
 * It accepts apiKey as a parameter to support both:
 * - stdio transport (API key from env var)
 * - HTTP transport (OAuth token from session)
 */

import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { jsonSchemaToZod } from "json-schema-to-zod";
import { ZodError, z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { type JsonObject, type McpToolDefinition, API_BASE_URL } from "./types.js";

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
    // biome-ignore lint/security/noGlobalEval: json-schema-to-zod outputs executable code
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
 * Options for API tool execution
 */
export interface ExecuteApiToolOptions {
  /** API key or OAuth token for authentication */
  apiKey?: string;
  /** Base URL for API requests (defaults to API_BASE_URL from env) */
  baseUrl?: string;
}

/**
 * Executes an API tool with the provided arguments
 *
 * @param toolName - Name of the tool being executed
 * @param definition - Tool definition containing method, path, parameters
 * @param toolArgs - Arguments passed to the tool
 * @param options - Execution options including apiKey and baseUrl
 */
export async function executeApiTool(
  toolName: string,
  definition: McpToolDefinition,
  toolArgs: JsonObject,
  options: ExecuteApiToolOptions = {}
): Promise<CallToolResult> {
  const { apiKey, baseUrl = API_BASE_URL } = options;

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

    // Inject Authorization header if apiKey is provided
    if (apiKey) {
      headers.authorization = apiKey.startsWith("Bearer ")
        ? apiKey
        : `Bearer ${apiKey}`;
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
    const fullUrl = `${baseUrl}${urlPath}`;

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
      errorMessage = `Unexpected error: ${String(error)}`;
    }
    console.error(`Error during execution of tool '${toolName}':`, errorMessage);
    return { content: [{ type: "text", text: errorMessage }] };
  }
}
