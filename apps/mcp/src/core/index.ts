/**
 * Cal.com MCP Server Core
 *
 * This module exports all core functionality:
 * - types.ts: Shared types and configuration
 * - executor.ts: API execution logic
 * - generated.ts: Tool definitions from OpenAPI
 * - toolsets.ts: Tool grouping and filtering
 */

// Types and configuration
export type { JsonObject, McpToolDefinition } from "./types.js";
export { SERVER_NAME, SERVER_VERSION, API_BASE_URL } from "./types.js";

// Executor
export { executeApiTool, type ExecuteApiToolOptions } from "./executor.js";

// Generated tool definitions
export { toolDefinitionMap, securitySchemes } from "./generated.js";

// Toolsets
export {
  TOOLSETS,
  TOOLSET_DESCRIPTIONS,
  PROFILES,
  PROFILES_CORE,
  DEFAULT_PROFILE,
  type CliArgs,
  parseCliArgs,
  resolveActiveToolsets,
  filterToolsByToolsets,
  getToolsetToolCount,
  printToolsetsList,
  isMetaTool,
  getMetaToolDefinitions,
  handleMetaTool,
  type MetaToolName,
} from "./toolsets.js";
