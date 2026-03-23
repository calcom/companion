#!/usr/bin/env node
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

import {
  toolDefinitionMap,
  executeApiTool,
  SERVER_NAME,
  SERVER_VERSION,
  API_BASE_URL,
  type McpToolDefinition,
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
} from "../core/index.js";

console.error("API_BASE_URL is set to:", API_BASE_URL);

const server = new Server(
  { name: SERVER_NAME, version: SERVER_VERSION },
  { capabilities: { tools: { listChanged: true } } }
);

const cliArgs = parseCliArgs(process.argv);

if (cliArgs.listToolsets) {
  printToolsetsList(toolDefinitionMap);
  process.exit(0);
}

const initialProfile = cliArgs.profile || DEFAULT_PROFILE;
const activeToolsets: Set<string> = resolveActiveToolsets(cliArgs);
let activeToolMap: Map<string, McpToolDefinition> = filterToolsByToolsets(toolDefinitionMap, activeToolsets, TOOLSETS);

console.error(
  `Toolsets: profile="${initialProfile}", active=${activeToolsets.size} toolsets, ${activeToolMap.size} tools loaded (of ${toolDefinitionMap.size} total)`
);

const toolsetState = {
  activeToolsets,
  activeToolMap,
  allTools: toolDefinitionMap,
  initialProfile,
  server,
};

const apiKey = process.env.CAL_API_KEY;

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const metaTools = getMetaToolDefinitions();
  const apiTools: Tool[] = Array.from(activeToolMap.values()).map((def) => ({
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
  }));
  return { tools: [...metaTools, ...apiTools] };
});

server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest): Promise<CallToolResult> => {
    const { name: toolName, arguments: toolArgs } = request.params;

    if (isMetaTool(toolName)) {
      const result = await handleMetaTool(toolName as MetaToolName, toolArgs ?? {}, toolsetState);
      activeToolMap = toolsetState.activeToolMap;
      return result;
    }

    const toolDefinition = activeToolMap.get(toolName);
    if (!toolDefinition) {
      console.error(`Error: Unknown tool requested: ${toolName}`);
      return {
        content: [{
          type: "text",
          text: `Error: Unknown tool "${toolName}". It may not be in the active toolsets. Use list_toolsets to see available toolsets, then add_toolsets to load more.`,
        }],
      };
    }

    return await executeApiTool(toolName, toolDefinition, toolArgs ?? {}, { apiKey });
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} MCP Server (v${SERVER_VERSION}) running on stdio, proxying API at ${API_BASE_URL}`);
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
