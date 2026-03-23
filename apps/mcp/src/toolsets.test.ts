import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE,
  PROFILES,
  TOOLSETS,
  TOOLSET_DESCRIPTIONS,
  filterToolsByToolsets,
  getToolsetToolCount,
  isMetaTool,
  parseCliArgs,
  resolveActiveToolsets,
} from "./toolsets.js";

const SERVER_PATH = resolve(import.meta.dirname, "../build/index.js");

// ---------------------------------------------------------------------------
// Unit tests for toolsets.ts pure functions
// ---------------------------------------------------------------------------

describe("parseCliArgs", () => {
  it("returns defaults when no args provided", () => {
    const result = parseCliArgs([]);
    expect(result).toEqual({
      profile: null,
      toolsets: null,
      allTools: false,
      listToolsets: false,
    });
  });

  it("parses --profile flag", () => {
    const result = parseCliArgs(["--profile", "team"]);
    expect(result.profile).toBe("team");
    expect(result.allTools).toBe(false);
  });

  it("parses --toolsets flag", () => {
    const result = parseCliArgs(["--toolsets", "bookings,slots,me"]);
    expect(result.toolsets).toEqual(["bookings", "slots", "me"]);
  });

  it("parses --all-tools flag", () => {
    const result = parseCliArgs(["--all-tools"]);
    expect(result.allTools).toBe(true);
  });

  it("parses -a shorthand for --all-tools", () => {
    const result = parseCliArgs(["-a"]);
    expect(result.allTools).toBe(true);
  });

  it("parses --list-toolsets flag", () => {
    const result = parseCliArgs(["--list-toolsets"]);
    expect(result.listToolsets).toBe(true);
  });

  it("ignores unrecognized flags", () => {
    const result = parseCliArgs(["node", "index.js", "--unknown", "value"]);
    expect(result.profile).toBeNull();
    expect(result.toolsets).toBeNull();
  });

  it("handles mixed flags", () => {
    const result = parseCliArgs(["--profile", "org", "--list-toolsets"]);
    expect(result.profile).toBe("org");
    expect(result.listToolsets).toBe(true);
  });
});

describe("resolveActiveToolsets", () => {
  it("defaults to personal profile when no args", () => {
    const result = resolveActiveToolsets({
      profile: null,
      toolsets: null,
      allTools: false,
      listToolsets: false,
    });
    expect(result).toEqual(new Set(PROFILES.personal));
  });

  it("resolves personal profile", () => {
    const result = resolveActiveToolsets({
      profile: "personal",
      toolsets: null,
      allTools: false,
      listToolsets: false,
    });
    expect(result).toEqual(new Set(PROFILES.personal));
    expect(result.size).toBe(13);
  });

  it("resolves team profile", () => {
    const result = resolveActiveToolsets({
      profile: "team",
      toolsets: null,
      allTools: false,
      listToolsets: false,
    });
    expect(result).toEqual(new Set(PROFILES.team));
    expect(result.size).toBe(20);
  });

  it("resolves org profile", () => {
    const result = resolveActiveToolsets({
      profile: "org",
      toolsets: null,
      allTools: false,
      listToolsets: false,
    });
    expect(result).toEqual(new Set(PROFILES.org));
    expect(result.size).toBe(36);
  });

  it("--all-tools returns all toolsets", () => {
    const result = resolveActiveToolsets({
      profile: null,
      toolsets: null,
      allTools: true,
      listToolsets: false,
    });
    expect(result.size).toBe(Object.keys(TOOLSETS).length);
  });

  it("--toolsets overrides profile", () => {
    const result = resolveActiveToolsets({
      profile: "org",
      toolsets: ["bookings", "slots"],
      allTools: false,
      listToolsets: false,
    });
    expect(result).toEqual(new Set(["bookings", "slots"]));
  });

  it("--all-tools overrides --toolsets", () => {
    const result = resolveActiveToolsets({
      profile: null,
      toolsets: ["bookings"],
      allTools: true,
      listToolsets: false,
    });
    expect(result.size).toBe(Object.keys(TOOLSETS).length);
  });

  it("falls back to default profile for unknown profile", () => {
    const result = resolveActiveToolsets({
      profile: "nonexistent",
      toolsets: null,
      allTools: false,
      listToolsets: false,
    });
    expect(result).toEqual(new Set(PROFILES[DEFAULT_PROFILE]));
  });

  it("ignores unknown toolset names in --toolsets", () => {
    const result = resolveActiveToolsets({
      profile: null,
      toolsets: ["bookings", "fake_toolset"],
      allTools: false,
      listToolsets: false,
    });
    expect(result).toEqual(new Set(["bookings"]));
  });
});

describe("filterToolsByToolsets", () => {
  // Create a small mock toolDefinitionMap for unit testing
  const mockTools = new Map([
    [
      "BookingsController_getBookings",
      {
        name: "BookingsController_getBookings",
        description: "Get bookings",
        inputSchema: { type: "object", properties: {} },
        method: "get",
        pathTemplate: "/v2/bookings",
        executionParameters: [],
        securityRequirements: [],
      },
    ],
    [
      "BookingsController_createBooking",
      {
        name: "BookingsController_createBooking",
        description: "Create booking",
        inputSchema: { type: "object", properties: {} },
        method: "post",
        pathTemplate: "/v2/bookings",
        executionParameters: [],
        securityRequirements: [],
      },
    ],
    [
      "SlotsController_getSlots",
      {
        name: "SlotsController_getSlots",
        description: "Get slots",
        inputSchema: { type: "object", properties: {} },
        method: "get",
        pathTemplate: "/v2/slots",
        executionParameters: [],
        securityRequirements: [],
      },
    ],
    [
      "TeamsController_getTeams",
      {
        name: "TeamsController_getTeams",
        description: "Get teams",
        inputSchema: { type: "object", properties: {} },
        method: "get",
        pathTemplate: "/v2/teams",
        executionParameters: [],
        securityRequirements: [],
      },
    ],
  ]);

  it("filters to only matching toolsets", () => {
    const result = filterToolsByToolsets(mockTools, new Set(["bookings"]), TOOLSETS);
    expect(result.size).toBe(2);
    expect(result.has("BookingsController_getBookings")).toBe(true);
    expect(result.has("BookingsController_createBooking")).toBe(true);
    expect(result.has("SlotsController_getSlots")).toBe(false);
  });

  it("returns empty map for empty toolset set", () => {
    const result = filterToolsByToolsets(mockTools, new Set(), TOOLSETS);
    expect(result.size).toBe(0);
  });

  it("combines multiple toolsets", () => {
    const result = filterToolsByToolsets(mockTools, new Set(["bookings", "slots"]), TOOLSETS);
    expect(result.size).toBe(3);
  });
});

describe("getToolsetToolCount", () => {
  const mockTools = new Map([
    ["BookingsController_a", { name: "BookingsController_a" }],
    ["BookingsController_b", { name: "BookingsController_b" }],
    ["SlotsController_a", { name: "SlotsController_a" }],
  ]) as Map<string, { name: string; description: string; inputSchema: Record<string, unknown>; method: string; pathTemplate: string; executionParameters: { name: string; in: string }[]; requestBodyContentType?: string; securityRequirements: Record<string, unknown>[]; }>;

  it("counts tools for a toolset", () => {
    expect(getToolsetToolCount(mockTools, "bookings", TOOLSETS)).toBe(2);
  });

  it("returns 0 for unknown toolset", () => {
    expect(getToolsetToolCount(mockTools, "nonexistent", TOOLSETS)).toBe(0);
  });
});

describe("isMetaTool", () => {
  it("recognizes meta-tools", () => {
    expect(isMetaTool("list_toolsets")).toBe(true);
    expect(isMetaTool("add_toolsets")).toBe(true);
    expect(isMetaTool("remove_toolsets")).toBe(true);
  });

  it("rejects non-meta-tools", () => {
    expect(isMetaTool("BookingsController_getBookings")).toBe(false);
    expect(isMetaTool("")).toBe(false);
  });
});

describe("toolset configuration integrity", () => {
  it("every toolset has a description", () => {
    for (const name of Object.keys(TOOLSETS)) {
      expect(TOOLSET_DESCRIPTIONS[name]).toBeTruthy();
    }
  });

  it("every profile references only valid toolsets", () => {
    const allToolsetNames = Object.keys(TOOLSETS);
    for (const [_profileName, toolsets] of Object.entries(PROFILES)) {
      for (const t of toolsets) {
        expect(allToolsetNames).toContain(t);
      }
    }
  });

  it("personal profile is a subset of team profile", () => {
    for (const t of PROFILES.personal) {
      expect(PROFILES.team).toContain(t);
    }
  });

  it("team profile is a subset of org profile", () => {
    for (const t of PROFILES.team) {
      expect(PROFILES.org).toContain(t);
    }
  });

  it("org profile contains all toolsets", () => {
    const allToolsetNames = Object.keys(TOOLSETS);
    expect(PROFILES.org.length).toBe(allToolsetNames.length);
    for (const name of allToolsetNames) {
      expect(PROFILES.org).toContain(name);
    }
  });

  it("default profile is valid", () => {
    expect(PROFILES[DEFAULT_PROFILE]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Integration tests — spawn actual MCP server with different profiles
// ---------------------------------------------------------------------------

describe("toolsets integration — default profile (personal)", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH],
      env: {
        ...process.env,
        API_BASE_URL: "https://api.cal.com",
        CAL_API_KEY: "cal_test_key",
      },
    });
    client = new Client({ name: "profile-test", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    await client.close();
  });

  it("loads personal profile by default (90 API tools + 3 meta-tools)", async () => {
    const result = await client.listTools();
    expect(result.tools.length).toBe(93);
  });

  it("only contains personal toolset tools", async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name);

    // Should have booking tools
    expect(toolNames.some((n) => n.startsWith("BookingsController"))).toBe(true);
    // Should NOT have team tools
    expect(toolNames.some((n) => n.startsWith("TeamsController"))).toBe(false);
    // Should NOT have org tools
    expect(toolNames.some((n) => n.startsWith("OrganizationsOrganizationsController"))).toBe(
      false
    );
  });

  it("meta-tools are always present", async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("list_toolsets");
    expect(toolNames).toContain("add_toolsets");
    expect(toolNames).toContain("remove_toolsets");
  });
});

describe("toolsets integration — team profile", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "--profile", "team"],
      env: {
        ...process.env,
        API_BASE_URL: "https://api.cal.com",
        CAL_API_KEY: "cal_test_key",
      },
    });
    client = new Client({ name: "team-test", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    await client.close();
  });

  it("loads team profile (127 API tools + 3 meta-tools)", async () => {
    const result = await client.listTools();
    expect(result.tools.length).toBe(130);
  });

  it("contains both personal and team tools", async () => {
    const result = await client.listTools();
    const toolNames = result.tools.map((t) => t.name);

    // Personal tools present
    expect(toolNames.some((n) => n.startsWith("BookingsController"))).toBe(true);
    // Team tools present
    expect(toolNames.some((n) => n.startsWith("TeamsController"))).toBe(true);
    // Org tools NOT present
    expect(toolNames.some((n) => n.startsWith("OrganizationsOrganizationsController"))).toBe(
      false
    );
  });
});

describe("toolsets integration — specific toolsets via --toolsets", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "--toolsets", "bookings,slots"],
      env: {
        ...process.env,
        API_BASE_URL: "https://api.cal.com",
        CAL_API_KEY: "cal_test_key",
      },
    });
    client = new Client({ name: "toolsets-test", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    await client.close();
  });

  it("loads only specified toolsets (bookings=19 + slots=5 + 3 meta = 27)", async () => {
    const result = await client.listTools();
    expect(result.tools.length).toBe(27);
  });

  it("contains only bookings and slots tools", async () => {
    const result = await client.listTools();
    const apiTools = result.tools.filter(
      (t) => !["list_toolsets", "add_toolsets", "remove_toolsets"].includes(t.name)
    );
    for (const tool of apiTools) {
      const isBooking = tool.name.startsWith("BookingsController") ||
        tool.name.startsWith("BookingAttendeesController") ||
        tool.name.startsWith("BookingGuestsController") ||
        tool.name.startsWith("BookingLocationController");
      const isSlot = tool.name.startsWith("SlotsController");
      expect(isBooking || isSlot).toBe(true);
    }
  });
});

describe("toolsets integration — runtime add/remove", () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: "node",
      args: [SERVER_PATH, "--toolsets", "bookings"],
      env: {
        ...process.env,
        API_BASE_URL: "https://api.cal.com",
        CAL_API_KEY: "cal_test_key",
      },
    });
    client = new Client(
      { name: "runtime-test", version: "1.0.0" },
      { capabilities: {} }
    );
    await client.connect(transport);
  }, 15000);

  afterAll(async () => {
    await client.close();
  });

  it("starts with bookings only (19 + 3 meta = 22)", async () => {
    const result = await client.listTools();
    expect(result.tools.length).toBe(22);
  });

  it("add_toolsets adds slots tools", async () => {
    const addResult = await client.callTool({
      name: "add_toolsets",
      arguments: { toolsets: ["slots"] },
    });
    const parsed = JSON.parse(
      (addResult.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(parsed.added).toEqual(["slots"]);
    expect(parsed.active_tool_count).toBe(24); // 19 bookings + 5 slots

    // Verify tools list updated
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(27); // 24 API + 3 meta
  });

  it("remove_toolsets removes bookings tools", async () => {
    const removeResult = await client.callTool({
      name: "remove_toolsets",
      arguments: { toolsets: ["bookings"] },
    });
    const parsed = JSON.parse(
      (removeResult.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(parsed.removed).toEqual(["bookings"]);
    expect(parsed.active_tool_count).toBe(5); // only slots remain

    // Verify tools list updated
    const tools = await client.listTools();
    expect(tools.tools.length).toBe(8); // 5 API + 3 meta
  });

  it("add_toolsets returns error for unknown toolset", async () => {
    const result = await client.callTool({
      name: "add_toolsets",
      arguments: { toolsets: ["nonexistent"] },
    });
    const text = (result.content as Array<{ type: string; text: string }>)[0].text;
    expect(text).toContain("Error");
    expect(text).toContain("nonexistent");
  });

  it("remove_toolsets handles already-removed toolset", async () => {
    const result = await client.callTool({
      name: "remove_toolsets",
      arguments: { toolsets: ["bookings"] },
    });
    const parsed = JSON.parse(
      (result.content as Array<{ type: string; text: string }>)[0].text
    );
    expect(parsed.removed).toEqual([]);
    expect(parsed.not_active).toEqual(["bookings"]);
  });
});
