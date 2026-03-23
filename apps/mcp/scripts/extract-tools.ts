#!/usr/bin/env npx ts-node
/**
 * MCP Tools Extractor
 *
 * Runs openapi-mcp-generator and extracts toolDefinitionMap for our modular architecture.
 * The library handles OpenAPI parsing; we just extract and transform the output.
 *
 * Usage: bun run generate
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const TEMP_DIR = "/tmp/calcom-mcp-gen";
const OPENAPI_PATH = resolve(__dirname, "../../../docs/api-reference/v2/openapi.json");
const OUTPUT_PATH = resolve(__dirname, "../src/generated.ts");

// Step 1: Run openapi-mcp-generator
console.log("Running openapi-mcp-generator...");
rmSync(TEMP_DIR, { recursive: true, force: true });
mkdirSync(TEMP_DIR, { recursive: true });

execSync(
  `npx openapi-mcp-generator -i "${OPENAPI_PATH}" -o "${TEMP_DIR}" --force`,
  { stdio: "inherit" }
);

// Step 2: Read the generated file
console.log("Extracting tool definitions...");
const generatedContent = readFileSync(`${TEMP_DIR}/src/index.ts`, "utf-8");

// Step 3: Extract toolDefinitionMap
const mapStartMarker = "const toolDefinitionMap: Map<string, McpToolDefinition> = new Map([";
const mapStart = generatedContent.indexOf(mapStartMarker);
if (mapStart === -1) {
  throw new Error("Could not find toolDefinitionMap in generated output");
}

// Find the matching closing bracket
let depth = 0;
let mapEnd = mapStart + mapStartMarker.length;
for (let i = mapEnd; i < generatedContent.length; i++) {
  if (generatedContent[i] === "[") depth++;
  if (generatedContent[i] === "]") {
    depth--;
    if (depth === -1) {
      mapEnd = i + 1;
      break;
    }
  }
}

// Get the map entries (the content between new Map([ and ]))
const mapEntriesStart = mapStart + mapStartMarker.length;
const mapEntriesEnd = mapEnd - 2; // Exclude ])
let mapEntries = generatedContent.slice(mapEntriesStart, mapEntriesEnd);

// Step 4: Transform - remove Authorization from schemas
// Remove Authorization from required arrays
mapEntries = mapEntries.replace(/"required":\s*\["Authorization"(?:,"[^"]+"|,"[^"]+")*\]/g, (match) => {
  // Parse the required array, remove Authorization
  const parsed = match.match(/"required":\s*(\[.*?\])/);
  if (!parsed) return match;
  try {
    const arr = JSON.parse(parsed[1]) as string[];
    const filtered = arr.filter((s: string) => s !== "Authorization");
    if (filtered.length === 0) return "";
    return `"required":${JSON.stringify(filtered)}`;
  } catch {
    return match;
  }
});

// Also handle cases where Authorization is not first
mapEntries = mapEntries.replace(/"required":\s*\[([^\]]+)\]/g, (match, content) => {
  try {
    const arr = JSON.parse(`[${content}]`) as string[];
    const filtered = arr.filter((s: string) => s !== "Authorization");
    if (filtered.length === 0) return "";
    return `"required":${JSON.stringify(filtered)}`;
  } catch {
    return match;
  }
});

// Remove Authorization property from properties objects
mapEntries = mapEntries.replace(/"Authorization":\s*\{[^}]+\},?\s*/g, "");

// Remove Authorization from executionParameters
mapEntries = mapEntries.replace(
  /\{"name":"Authorization","in":"header"\},?\s*/g,
  ""
);

// Clean up any trailing commas in arrays
mapEntries = mapEntries.replace(/,(\s*\])/g, "$1");
mapEntries = mapEntries.replace(/,(\s*\})/g, "$1");

// Count tools (excluding deprecated)
const toolCount = (mapEntries.match(/\["[A-Za-z]+Controller_/g) || []).length;
console.log(`Extracted ${toolCount} tools`);

// Step 5: Generate output file
const output = `/**
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
// biome-ignore lint/suspicious/noExplicitAny: JSON objects can have any structure
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
  // biome-ignore lint/suspicious/noExplicitAny: Security requirements vary
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
    // Use Function constructor to evaluate the generated Zod schema string
    const zodSchema = new Function("z", \\\`return \\\${zodSchemaString}\\\`)(z);
    if (typeof zodSchema?.parse !== "function") {
      throw new Error("Schema evaluation did not produce a valid Zod schema.");
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
  _allSecuritySchemes: Record<string, unknown>
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
        return { content: [{ type: "text", text: validationErrorMessage }], isError: true };
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            { type: "text", text: \`Internal error during validation setup: \${errorMessage}\` },
          ],
          isError: true,
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
    return { content: [{ type: "text", text: errorMessage }], isError: true };
  }
}

/**
 * Map of tool definitions by name
 */
export const toolDefinitionMap: Map<string, McpToolDefinition> = new Map([
${mapEntries}
]);
`;

// Step 6: Write output
writeFileSync(OUTPUT_PATH, output);
console.log(`Written to: ${OUTPUT_PATH}`);

// Cleanup
rmSync(TEMP_DIR, { recursive: true, force: true });
console.log("Done!");
