#!/usr/bin/env node
/**
 * Cal.com MCP Server entry point
 *
 * This file wires together:
 * - generated.ts: Auto-generated tool definitions from OpenAPI spec
 * - toolsets.ts: Tool grouping and filtering for context optimization
 *
 * When regenerating from OpenAPI, only generated.ts needs to be updated.
 */

import dotenv from "dotenv";
dotenv.config();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  type CallToolRequest,
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

// Import from generated (auto-generated from OpenAPI)
import {
  toolDefinitionMap,
  securitySchemes,
  executeApiTool,
  SERVER_NAME,
  SERVER_VERSION,
  API_BASE_URL,
  type McpToolDefinition,
} from "./generated.js";

// Import from toolsets (hand-maintained)
import {
  TOOLSETS,
  DEFAULT_PROFILE,
  parseCliArgs,
  resolveActiveToolsets,
  filterToolsByToolsets,
  printToolsetsList,
  isMetaTool,
  getMetaToolDefinitions,
  handleMetaTool,
  type MetaToolName,
} from "./toolsets.js";

console.error("API_BASE_URL is set to:", API_BASE_URL);

/**
 * MCP Server instance with listChanged capability for dynamic toolsets
 */
const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: { listChanged: true } } }
);

/**
 * CLI argument parsing
 */
const cliArgs = parseCliArgs(process.argv);

// Handle --list-toolsets flag
if (cliArgs.listToolsets) {
  printToolsetsList(toolDefinitionMap);
  process.exit(0);
}

const initialProfile = cliArgs.profile || DEFAULT_PROFILE;

/**
 * Active toolsets and filtered tool map (mutable — changed by meta-tools at runtime)
 */
const activeToolsets: Set<string> = resolveActiveToolsets(cliArgs);
let activeToolMap: Map<string, McpToolDefinition> = filterToolsByToolsets(
  toolDefinitionMap,
  activeToolsets,
  TOOLSETS
);

console.error(
  `Toolsets: profile="${initialProfile}", active=${activeToolsets.size} toolsets, ${activeToolMap.size} tools loaded (of ${toolDefinitionMap.size} total)`
);

/**
 * Shared state object passed to meta-tool handlers
 */
const toolsetState = {
  activeToolsets,
  activeToolMap,
  allTools: toolDefinitionMap,
  initialProfile,
  server,
};

/**
 * List tools handler — returns meta-tools + active API tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const metaTools = getMetaToolDefinitions();
  const apiTools: Tool[] = Array.from(activeToolMap.values()).map((def) => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
  }));
  return { tools: [...metaTools, ...apiTools] };
});

/**
 * Call tool handler — routes to meta-tools or API execution
 */
server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest): Promise<CallToolResult> => {
    const { name: toolName, arguments: toolArgs } = request.params;

    // Handle meta-tools (list_toolsets, add_toolsets, remove_toolsets)
    if (isMetaTool(toolName)) {
      const result = await handleMetaTool(
        toolName as MetaToolName,
        toolArgs ?? {},
        toolsetState
      );
      // Update local reference in case meta-tool rebuilt the map
      activeToolMap = toolsetState.activeToolMap;
      return result;
    }

    // Handle API tools
    const toolDefinition = activeToolMap.get(toolName);
    if (!toolDefinition) {
      console.error(`Error: Unknown tool requested: ${toolName}`);
      return {
        content: [
          {
            type: "text",
            text: `Error: Unknown tool "${toolName}". It may not be in the active toolsets. Use list_toolsets to see available toolsets, then add_toolsets to load more.`,
          },
        ],
      };
    }

    return await executeApiTool(toolName, toolDefinition, toolArgs ?? {}, securitySchemes);
  }
);

/**
 * Main function to start the server
 */
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(
      `${SERVER_NAME} MCP Server (v${SERVER_VERSION}) running on stdio${API_BASE_URL ? `, proxying API at ${API_BASE_URL}` : ""}`
    );
  } catch (error) {
    console.error("Error during server startup:", error);
    process.exit(1);
  }
}

/**
 * Cleanup function for graceful shutdown
 */
async function cleanup() {
  console.error("Shutting down MCP server...");
  process.exit(0);
}

// Register signal handlers
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Start the server
main().catch((error) => {
  console.error("Fatal error in main execution:", error);
  process.exit(1);
});
