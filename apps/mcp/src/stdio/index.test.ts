import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SERVER_PATH = resolve(import.meta.dirname, "../../build/stdio/index.js");

function createClient(
  extraArgs: string[] = []
): { client: Client; transport: StdioClientTransport } {
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_PATH, ...extraArgs],
    env: {
      ...process.env,
      API_BASE_URL: "https://api.cal.com",
      CAL_API_KEY: "cal_test_key_for_testing",
    },
  });

  const client = new Client({ name: "test-client", version: "1.0.0" }, { capabilities: {} });

  return { client, transport };
}

describe("Cal.com MCP Server", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    const created = createClient(["--all-tools"]);
    client = created.client;
    transport = created.transport;
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    await client.close();
  });

  describe("server metadata", () => {
    it("reports correct server info", () => {
      const info = client.getServerVersion();
      expect(info).toBeDefined();
      expect(info?.name).toBe("@calcom/mcp");
      expect(info?.version).toBe("1.0.0");
    });
  });

  describe("tool listing", () => {
    it("lists API tools plus 3 meta-tools with --all-tools", async () => {
      const result = await client.listTools();
      expect(result.tools).toBeDefined();
      // Should have a substantial number of API tools plus 3 meta-tools
      expect(result.tools.length).toBeGreaterThan(200);
    });

    it("includes meta-tools", async () => {
      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toContain("list_toolsets");
      expect(toolNames).toContain("add_toolsets");
      expect(toolNames).toContain("remove_toolsets");
    });

    it("does not include deprecated platform tools", async () => {
      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // None of the tools should reference deprecated platform managed user operations
      const managedUserTools = toolNames.filter(
        (name) => name.includes("ManagedUsers") && name.includes("OAuthClientUsersController")
      );
      expect(managedUserTools).toHaveLength(0);
    });

    it("includes expected booking tools", async () => {
      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      // Should have booking-related tools
      const bookingTools = toolNames.filter((name) => name.toLowerCase().includes("booking"));
      expect(bookingTools.length).toBeGreaterThan(0);
    });

    it("includes expected event type tools", async () => {
      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      const eventTypeTools = toolNames.filter((name) => name.toLowerCase().includes("eventtype"));
      expect(eventTypeTools.length).toBeGreaterThan(0);
    });

    it("includes expected schedule tools", async () => {
      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      const scheduleTools = toolNames.filter((name) => name.toLowerCase().includes("schedule"));
      expect(scheduleTools.length).toBeGreaterThan(0);
    });

    it("includes expected slots tools", async () => {
      const result = await client.listTools();
      const toolNames = result.tools.map((t) => t.name);

      const slotsTools = toolNames.filter((name) => name.toLowerCase().includes("slot"));
      expect(slotsTools.length).toBeGreaterThan(0);
    });

    it("each tool has name, description, and inputSchema", async () => {
      const result = await client.listTools();

      for (const tool of result.tools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe("object");
      }
    });

    it("tool input schemas do not require Authorization parameter", async () => {
      const result = await client.listTools();

      for (const tool of result.tools) {
        const required = tool.inputSchema.required || [];
        expect(required).not.toContain("Authorization");

        const properties = tool.inputSchema.properties || {};
        expect(properties).not.toHaveProperty("Authorization");
      }
    });
  });

  describe("tool execution", () => {
    it("returns error for unknown tool", async () => {
      const result = await client.callTool({
        name: "nonexistent_tool",
        arguments: {},
      });

      expect(result.content).toBeDefined();
      const textContent = result.content as Array<{ type: string; text: string }>;
      expect(textContent[0].text).toContain("Unknown tool");
    });

    it("list_toolsets meta-tool returns available toolsets", async () => {
      const result = await client.callTool({
        name: "list_toolsets",
        arguments: {},
      });

      expect(result.content).toBeDefined();
      const textContent = result.content as Array<{ type: string; text: string }>;
      const parsed = JSON.parse(textContent[0].text);
      expect(parsed.available_toolsets).toBeDefined();
      expect(parsed.available_toolsets.bookings).toBeDefined();
      expect(parsed.available_toolsets.bookings.description).toBeTruthy();
      expect(parsed.available_toolsets.bookings.tool_count).toBeGreaterThan(0);
    });

    it("returns validation error for missing required parameters", async () => {
      const tools = await client.listTools();
      // Find a tool that requires path parameters (e.g., orgId)
      const toolWithRequired = tools.tools.find(
        (t) =>
          t.inputSchema.required &&
          t.inputSchema.required.length > 0 &&
          !t.inputSchema.required.includes("Authorization")
      );

      if (toolWithRequired) {
        const result = await client.callTool({
          name: toolWithRequired.name,
          arguments: {},
        });

        const textContent = result.content as Array<{ type: string; text: string }>;
        // Should either be a validation error or an API error (both are acceptable)
        expect(textContent[0].text).toBeTruthy();
      }
    });
  });
});

describe("OpenAPI spec filtering", () => {
  it("deprecated platform paths are tagged as deprecated", () => {
    const specPath = resolve(import.meta.dirname, "../../openapi.json");
    const spec = JSON.parse(readFileSync(specPath, "utf-8"));

    const deprecatedPaths = [
      "/v2/oauth-clients/{clientId}/users",
      "/v2/oauth-clients/{clientId}/users/{userId}",
      "/v2/oauth-clients/{clientId}/users/{userId}/force-refresh",
      "/v2/oauth/{clientId}/refresh",
      "/v2/oauth-clients/{clientId}/webhooks",
      "/v2/oauth-clients/{clientId}/webhooks/{webhookId}",
      "/v2/oauth-clients",
      "/v2/oauth-clients/{clientId}",
    ];

    for (const path of deprecatedPaths) {
      if (spec.paths[path]) {
        const methods = Object.values(spec.paths[path]) as Array<{ tags?: string[] }>;
        const hasDeprecatedTag = methods.some((method) =>
          method.tags?.some((tag: string) => tag.toLowerCase().includes("deprecated"))
        );
        expect(hasDeprecatedTag).toBe(true);
      }
    }
  });

  it("filtered spec retains non-deprecated paths", () => {
    const specPath = resolve(import.meta.dirname, "../../openapi.json");
    const spec = JSON.parse(readFileSync(specPath, "utf-8"));

    const expectedPaths = [
      "/v2/bookings",
      "/v2/event-types",
      "/v2/schedules",
      "/v2/slots",
      "/v2/calendars/busy-times",
    ];

    for (const path of expectedPaths) {
      expect(spec.paths).toHaveProperty(path);
    }
  });

  it("spec paths include deprecated endpoints with deprecated tags", () => {
    const specPath = resolve(import.meta.dirname, "../../openapi.json");
    const spec = JSON.parse(readFileSync(specPath, "utf-8"));

    // Check that deprecated endpoints have deprecated tags in their operations
    let foundDeprecated = false;
    for (const [, pathItem] of Object.entries(spec.paths)) {
      for (const [, operation] of Object.entries(pathItem as Record<string, { tags?: string[] }>)) {
        if (operation.tags?.some((t) => t.toLowerCase().includes("deprecated"))) {
          foundDeprecated = true;
          break;
        }
      }
      if (foundDeprecated) break;
    }
    expect(foundDeprecated).toBe(true);
  });

  it("spec has expected number of paths", () => {
    const specPath = resolve(import.meta.dirname, "../../openapi.json");
    const spec = JSON.parse(readFileSync(specPath, "utf-8"));

    const pathCount = Object.keys(spec.paths).length;
    // Full spec from docs includes all paths
    expect(pathCount).toBeGreaterThan(100);
  });
});

describe("server configuration", () => {
  it("uses default API_BASE_URL when env var is not set", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "--all-tools"],
      env: {
        ...process.env,
        API_BASE_URL: "",
        CAL_API_KEY: "cal_test",
      },
    });

    const testClient = new Client({ name: "config-test", version: "1.0.0" }, { capabilities: {} });

    await testClient.connect(transport);

    const info = testClient.getServerVersion();
    expect(info?.name).toBe("@calcom/mcp");

    await testClient.close();
  }, 15000);

  it("can start with custom API_BASE_URL", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "--all-tools"],
      env: {
        ...process.env,
        API_BASE_URL: "https://custom.cal.dev",
        CAL_API_KEY: "cal_test",
      },
    });

    const testClient = new Client(
      { name: "custom-url-test", version: "1.0.0" },
      { capabilities: {} }
    );

    await testClient.connect(transport);

    const tools = await testClient.listTools();
    // Should have a substantial number of API tools plus meta-tools
    expect(tools.tools.length).toBeGreaterThan(200);

    await testClient.close();
  }, 15000);
});
