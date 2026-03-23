#!/usr/bin/env npx ts-node
/**
 * MCP Tools Generator
 *
 * Reads OpenAPI spec and generates src/generated.ts with:
 * - Tool definitions (name, description, inputSchema, method, path)
 * - Execution parameters (path, query, header params)
 * - Security schemes
 *
 * Usage: npx ts-node scripts/generate.ts
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

interface OpenAPISpec {
  info: { title: string; version: string };
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    schemas?: Record<string, unknown>;
    securitySchemes?: Record<string, unknown>;
  };
}

interface OpenAPIOperation {
  operationId: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema: unknown }>;
  };
  security?: Array<Record<string, string[]>>;
}

interface OpenAPIParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: unknown;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: unknown;
  method: string;
  pathTemplate: string;
  executionParameters: Array<{ name: string; in: string }>;
  requestBodyContentType?: string;
  securityRequirements: unknown[];
}

// Skip deprecated endpoints
function isDeprecated(operation: OpenAPIOperation): boolean {
  return (
    operation.tags?.some((tag) => tag.toLowerCase().includes("deprecated")) ?? false
  );
}

// Build inputSchema from parameters and requestBody
function buildInputSchema(
  parameters: OpenAPIParameter[] = [],
  requestBody?: OpenAPIOperation["requestBody"]
): { schema: unknown; executionParameters: Array<{ name: string; in: string }> } {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const executionParameters: Array<{ name: string; in: string }> = [];

  // Process parameters (path, query, header)
  for (const param of parameters) {
    // Skip Authorization header - we inject it from env
    if (param.name.toLowerCase() === "authorization") continue;

    const paramSchema: Record<string, unknown> = { ...(param.schema as Record<string, unknown>) };
    if (param.description) {
      paramSchema.description = param.description;
    }

    properties[param.name] = paramSchema;
    executionParameters.push({ name: param.name, in: param.in });

    if (param.required) {
      required.push(param.name);
    }
  }

  // Process requestBody
  if (requestBody?.content) {
    const contentType = Object.keys(requestBody.content)[0];
    if (contentType && requestBody.content[contentType]?.schema) {
      properties.requestBody = {
        ...requestBody.content[contentType].schema,
        description: "The JSON request body.",
      };
      if (requestBody.required) {
        required.push("requestBody");
      }
    }
  }

  return {
    schema: {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    },
    executionParameters,
  };
}

// Get request body content type
function getRequestBodyContentType(
  requestBody?: OpenAPIOperation["requestBody"]
): string | undefined {
  if (!requestBody?.content) return undefined;
  return Object.keys(requestBody.content)[0];
}

// Generate tool definitions from OpenAPI spec
function generateTools(spec: OpenAPISpec): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      // Skip non-operation fields like 'parameters'
      if (!operation.operationId) continue;

      // Skip deprecated
      if (isDeprecated(operation)) {
        console.log(`Skipping deprecated: ${operation.operationId}`);
        continue;
      }

      const { schema, executionParameters } = buildInputSchema(
        operation.parameters,
        operation.requestBody
      );

      tools.push({
        name: operation.operationId,
        description: operation.summary || operation.description || "",
        inputSchema: schema,
        method: method.toLowerCase(),
        pathTemplate: path,
        executionParameters,
        requestBodyContentType: getRequestBodyContentType(operation.requestBody),
        securityRequirements: operation.security || [],
      });
    }
  }

  return tools;
}

// Generate TypeScript code
function generateCode(tools: ToolDefinition[], spec: OpenAPISpec): string {
  const securitySchemes = spec.components?.securitySchemes || {};

  return `/**
 * MCP Server generated from OpenAPI spec for @calcom/mcp v1.0.0
 * Generated on: ${new Date().toISOString()}
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
export const securitySchemes: Record<string, unknown> = ${JSON.stringify(securitySchemes, null, 2)};

/**
 * Formats API errors for better readability
 */
function formatApiError(error: AxiosError): string {
  let message = "API request failed.";
  if (error.response) {
    message = \`API Error: Status \${error.response.status} (\${error.response.statusText || "Status text not available"}). \`;
    const responseData = error.response.data;
    const MAX_LEN = 200;
    if (typeof responseData === "string") {
      message += \`Response: \${responseData.substring(0, MAX_LEN)}\${responseData.length > MAX_LEN ? "..." : ""}\`;
    } else if (responseData) {
      try {
        const jsonString = JSON.stringify(responseData);
        message += \`Response: \${jsonString.substring(0, MAX_LEN)}\${jsonString.length > MAX_LEN ? "..." : ""}\`;
      } catch {
        message += "Response: [Could not serialize data]";
      }
    } else {
      message += "No response body received.";
    }
  } else if (error.request) {
    message = "API Network Error: No response received from server.";
    if (error.code) message += \` (Code: \${error.code})\`;
  } else {
    message += \`API Request Setup Error: \${error.message}\`;
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
    console.error(\`Failed to generate/evaluate Zod schema for '\${toolName}':\`, err);
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
        const validationErrorMessage = \`Invalid arguments for tool '\${toolName}': \${error.errors.map((e) => \`\${e.path.join(".")} (\${e.code}): \${e.message}\`).join(", ")}\`;
        return { content: [{ type: "text", text: validationErrorMessage }] };
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            { type: "text", text: \`Internal error during validation setup: \${errorMessage}\` },
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
        : \`Bearer \${calApiKey}\`;
    }

    // Apply parameters to the URL path, query, or headers
    definition.executionParameters.forEach((param) => {
      const value = validatedArgs[param.name];
      if (typeof value !== "undefined" && value !== null) {
        if (param.in === "path") {
          urlPath = urlPath.replace(\`{\${param.name}}\`, encodeURIComponent(String(value)));
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
    const fullUrl = \`\${API_BASE_URL}\${urlPath}\`;

    // Configure request
    const axiosConfig: AxiosRequestConfig = {
      method: definition.method as AxiosRequestConfig["method"],
      url: fullUrl,
      headers,
      params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      data: requestBodyData,
    };

    console.error(\`Executing \${definition.method.toUpperCase()} \${fullUrl}\`);

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
          text: \`API Response (Status: \${response.status}):\\n\${responseText}\`,
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
    console.error(\`Error during execution of tool '\${toolName}':\`, errorMessage);
    return { content: [{ type: "text", text: errorMessage }] };
  }
}

/**
 * Map of tool definitions by name
 */
export const toolDefinitionMap: Map<string, McpToolDefinition> = new Map([
${tools
  .map(
    (tool) => `  [
    "${tool.name}",
    ${JSON.stringify(tool, null, 4).split("\n").join("\n    ")},
  ],`
  )
  .join("\n")}
]);
`;
}

// Main
function main() {
  const specPath = resolve(__dirname, "../openapi.json");
  const outputPath = resolve(__dirname, "../src/generated.ts");

  console.log("Reading OpenAPI spec from:", specPath);
  const specContent = readFileSync(specPath, "utf-8");
  const spec: OpenAPISpec = JSON.parse(specContent);

  console.log("Generating tool definitions...");
  const tools = generateTools(spec);
  console.log(`Generated ${tools.length} tools`);

  console.log("Writing output to:", outputPath);
  const code = generateCode(tools, spec);
  writeFileSync(outputPath, code);

  console.log("Done!");
}

main();
