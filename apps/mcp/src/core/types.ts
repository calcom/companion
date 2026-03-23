// biome-ignore lint/suspicious/noExplicitAny: JSON objects can have any structure
export type JsonObject = Record<string, any>;

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

export const SERVER_NAME = "@calcom/mcp";
export const SERVER_VERSION = "1.0.0";
export const API_BASE_URL = process.env.API_BASE_URL || "https://api.cal.com";
