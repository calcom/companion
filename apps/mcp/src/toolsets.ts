/**
 * Toolsets configuration for Cal.com MCP Server
 *
 * Toolsets group API tools by domain (controller prefix). Users select which
 * toolsets to load via CLI flags or runtime meta-tools, reducing LLM context
 * window consumption.
 *
 * When new endpoints are added to existing controllers, they automatically
 * land in the correct toolset (prefix-based matching). Only brand-new
 * controllers require a manual one-line addition here.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Interface for MCP Tool Definition (must match index.ts)
 */
interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  method: string;
  pathTemplate: string;
  executionParameters: { name: string; in: string }[];
  requestBodyContentType?: string;
  securityRequirements: Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Toolset Definitions — maps toolset names to controller prefixes
// ---------------------------------------------------------------------------

export const TOOLSETS: Record<string, string[]> = {
  // === Personal toolsets ===
  bookings: [
    "BookingsController",
    "BookingAttendeesController",
    "BookingGuestsController",
    "BookingLocationController",
  ],
  "event-types": ["EventTypesController", "EventTypesPrivateLinksController"],
  schedules: ["SchedulesController"],
  slots: ["SlotsController"],
  me: ["MeController"],
  calendars: [
    "CalendarsController",
    "CalUnifiedCalendarsController",
    "SelectedCalendarsController",
    "DestinationCalendarsController",
  ],
  conferencing: ["ConferencingController"],
  webhooks: ["WebhooksController", "EventTypeWebhooksController"],
  "routing-forms": ["RoutingFormsController"],
  ooo: ["UserOOOController"],
  "verified-resources": ["UserVerifiedResourcesController"],
  "api-keys": ["ApiKeysController"],
  stripe: ["StripeController"],

  // === Team toolsets ===
  teams: ["TeamsController"],
  "teams-members": ["TeamsMembershipsController", "TeamsInviteController"],
  "teams-event-types": ["TeamsEventTypesController", "TeamsEventTypesWebhooksController"],
  "teams-bookings": ["TeamsBookingsController"],
  "teams-schedules": ["TeamsSchedulesController"],
  "teams-ooo": ["TeamsOOOController"],
  "teams-verified-resources": ["TeamsVerifiedResourcesController"],

  // === Organization toolsets ===
  oauth: ["OAuth2Controller"],
  orgs: ["OrganizationsOrganizationsController"],
  "orgs-members": ["OrganizationsMembershipsController"],
  "orgs-users": [
    "OrganizationsUsersController",
    "OrganizationsUsersOOOController",
    "OrganizationsUsersBookingsController",
  ],
  "orgs-teams": [
    "OrganizationsTeamsController",
    "OrganizationsTeamsInviteController",
    "OrganizationsTeamsMembershipsController",
    "OrganizationsTeamsBookingsController",
    "OrganizationsTeamsSchedulesController",
    "OrgTeamsVerifiedResourcesController",
  ],
  "orgs-event-types": [
    "OrganizationsEventTypesController",
    "OrganizationsEventTypesPrivateLinksController",
  ],
  "orgs-attributes": [
    "OrganizationsAttributesController",
    "OrganizationsAttributesOptionsController",
  ],
  "orgs-webhooks": ["OrganizationsWebhooksController"],
  "orgs-schedules": ["OrganizationsSchedulesController"],
  "orgs-roles": [
    "OrganizationsRolesController",
    "OrganizationsRolesPermissionsController",
    "OrganizationsTeamsRolesController",
    "OrganizationsTeamsRolesPermissionsController",
  ],
  "orgs-routing-forms": [
    "OrganizationsRoutingFormsController",
    "OrganizationsRoutingFormsResponsesController",
    "OrganizationsTeamsRoutingFormsController",
    "OrganizationsTeamsRoutingFormsResponsesController",
  ],
  "orgs-conferencing": ["OrganizationsConferencingController"],
  "orgs-stripe": ["OrganizationsStripeController"],
  "orgs-bookings": ["OrganizationsBookingsController"],
  "orgs-delegation": ["OrganizationsDelegationCredentialController"],
  "orgs-workflows": ["OrganizationTeamWorkflowsController"],
};

// ---------------------------------------------------------------------------
// Toolset Descriptions — used by list_toolsets meta-tool
// ---------------------------------------------------------------------------

export const TOOLSET_DESCRIPTIONS: Record<string, string> = {
  // Personal
  bookings: "Create, get, cancel, reschedule bookings and manage attendees/guests/location",
  "event-types": "CRUD for event types and private links",
  schedules: "Manage user availability schedules",
  slots: "Query available slots and manage reservations",
  me: "Get and update current user profile",
  calendars: "Calendar connections, busy times, ICS feeds, destination calendars",
  conferencing: "Connect/disconnect conferencing apps, set defaults",
  webhooks: "Manage user and event-type level webhooks",
  "routing-forms": "Calculate slots based on routing form responses",
  ooo: "Manage out-of-office entries",
  "verified-resources": "Verify emails and phone numbers",
  "api-keys": "Refresh API keys",
  stripe: "Stripe payment connection",

  // Teams
  teams: "Create, get, update, delete teams",
  "teams-members": "Team memberships and invitations",
  "teams-event-types": "Team event types and their webhooks",
  "teams-bookings": "Get all team bookings",
  "teams-schedules": "Get team schedules",
  "teams-ooo": "Team member out-of-office",
  "teams-verified-resources": "Team verified emails and phone numbers",

  // Organizations
  oauth: "OAuth2 client info and token exchange",
  orgs: "CRUD for organizations",
  "orgs-members": "Organization memberships",
  "orgs-users": "Manage org users, their OOO, and bookings",
  "orgs-teams":
    "Org-level team management, memberships, bookings, schedules, verified resources",
  "orgs-event-types": "Org team event types and private links",
  "orgs-attributes": "Organization-level custom attributes and attribute options",
  "orgs-webhooks": "Organization-level webhooks",
  "orgs-schedules": "Manage user schedules within an org",
  "orgs-roles": "Org and team roles with permissions (RBAC)",
  "orgs-routing-forms": "Org and team routing forms and responses",
  "orgs-conferencing": "Org team conferencing app management",
  "orgs-stripe": "Org team Stripe connections",
  "orgs-bookings": "Get all org team bookings",
  "orgs-delegation": "Delegation credentials",
  "orgs-workflows": "Org team workflows for event types and routing forms",
};

// ---------------------------------------------------------------------------
// Profiles — named bundles of toolsets mapping to Cal.com user types
// ---------------------------------------------------------------------------

const PERSONAL_TOOLSETS = [
  "bookings",
  "event-types",
  "schedules",
  "slots",
  "me",
  "calendars",
  "conferencing",
  "webhooks",
  "routing-forms",
  "ooo",
  "verified-resources",
  "api-keys",
  "stripe",
];

const TEAM_TOOLSETS = [
  ...PERSONAL_TOOLSETS,
  "teams",
  "teams-members",
  "teams-event-types",
  "teams-bookings",
  "teams-schedules",
  "teams-ooo",
  "teams-verified-resources",
];

const ORG_TOOLSETS = [
  ...TEAM_TOOLSETS,
  "oauth",
  "orgs",
  "orgs-members",
  "orgs-users",
  "orgs-teams",
  "orgs-event-types",
  "orgs-attributes",
  "orgs-webhooks",
  "orgs-schedules",
  "orgs-roles",
  "orgs-routing-forms",
  "orgs-conferencing",
  "orgs-stripe",
  "orgs-bookings",
  "orgs-delegation",
  "orgs-workflows",
];

export const PROFILES: Record<string, string[]> = {
  personal: PERSONAL_TOOLSETS,
  team: TEAM_TOOLSETS,
  org: ORG_TOOLSETS,
};

export const DEFAULT_PROFILE = "personal";

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

export interface CliArgs {
  profile: string | null;
  toolsets: string[] | null;
  allTools: boolean;
  listToolsets: boolean;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    profile: null,
    toolsets: null,
    allTools: false,
    listToolsets: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all-tools" || arg === "-a") {
      result.allTools = true;
    } else if (arg === "--list-toolsets") {
      result.listToolsets = true;
    } else if (arg === "--profile" && i + 1 < argv.length) {
      result.profile = argv[i + 1];
      i++;
    } else if (arg === "--toolsets" && i + 1 < argv.length) {
      result.toolsets = argv[i + 1].split(",").map((s) => s.trim());
      i++;
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Toolset Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves which toolsets should be active based on CLI args.
 *
 * Priority: --all-tools > --toolsets > --profile > DEFAULT_PROFILE
 */
export function resolveActiveToolsets(args: CliArgs): Set<string> {
  const allToolsetNames = Object.keys(TOOLSETS);

  if (args.allTools) {
    return new Set(allToolsetNames);
  }

  if (args.toolsets) {
    const valid = args.toolsets.filter((t) => allToolsetNames.includes(t));
    const invalid = args.toolsets.filter((t) => !allToolsetNames.includes(t));
    if (invalid.length > 0) {
      console.error(`Warning: Unknown toolsets ignored: ${invalid.join(", ")}`);
    }
    return new Set(valid);
  }

  const profileName = args.profile || DEFAULT_PROFILE;
  const profileToolsets = PROFILES[profileName];
  if (!profileToolsets) {
    console.error(
      `Warning: Unknown profile "${profileName}", falling back to "${DEFAULT_PROFILE}"`
    );
    return new Set(PROFILES[DEFAULT_PROFILE]);
  }

  return new Set(profileToolsets);
}

// ---------------------------------------------------------------------------
// Tool Filtering
// ---------------------------------------------------------------------------

/**
 * Filters toolDefinitionMap to only include tools belonging to active toolsets.
 * A tool belongs to a toolset if its name starts with any of the toolset's
 * controller prefixes.
 */
export function filterToolsByToolsets(
  allTools: Map<string, McpToolDefinition>,
  activeToolsets: Set<string>,
  toolsetConfig: Record<string, string[]>
): Map<string, McpToolDefinition> {
  // Collect all active controller prefixes
  const activePrefixes: string[] = [];
  for (const toolsetName of activeToolsets) {
    const prefixes = toolsetConfig[toolsetName];
    if (prefixes) {
      activePrefixes.push(...prefixes);
    }
  }

  const filtered = new Map<string, McpToolDefinition>();
  for (const [name, def] of allTools) {
    if (activePrefixes.some((prefix) => name.startsWith(prefix))) {
      filtered.set(name, def);
    }
  }

  return filtered;
}

/**
 * Counts how many tools belong to a specific toolset.
 */
export function getToolsetToolCount(
  allTools: Map<string, McpToolDefinition>,
  toolsetName: string,
  toolsetConfig: Record<string, string[]>
): number {
  const prefixes = toolsetConfig[toolsetName];
  if (!prefixes) return 0;

  let count = 0;
  for (const name of allTools.keys()) {
    if (prefixes.some((prefix) => name.startsWith(prefix))) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// --list-toolsets Output
// ---------------------------------------------------------------------------

/**
 * Prints available toolsets and profiles to stdout, then exits.
 */
export function printToolsetsList(allTools: Map<string, McpToolDefinition>): void {
  const lines: string[] = [];
  lines.push("Cal.com MCP — Available Toolsets");
  lines.push("");

  const sections: { label: string; toolsets: string[] }[] = [
    { label: "PERSONAL TOOLSETS", toolsets: PERSONAL_TOOLSETS },
    {
      label: "TEAM TOOLSETS",
      toolsets: TEAM_TOOLSETS.filter((t) => !PERSONAL_TOOLSETS.includes(t)),
    },
    { label: "ORGANIZATION TOOLSETS", toolsets: ORG_TOOLSETS.filter((t) => !TEAM_TOOLSETS.includes(t)) },
  ];

  for (const section of sections) {
    const sectionToolCount = section.toolsets.reduce(
      (sum, t) => sum + getToolsetToolCount(allTools, t, TOOLSETS),
      0
    );
    lines.push(`${section.label} (${section.toolsets.length} toolsets, ${sectionToolCount} tools):`);
    for (const name of section.toolsets) {
      const count = getToolsetToolCount(allTools, name, TOOLSETS);
      const desc = TOOLSET_DESCRIPTIONS[name] || "";
      const toolWord = count === 1 ? "tool " : "tools";
      lines.push(`  ${name.padEnd(26)} ${String(count).padStart(3)} ${toolWord}   ${desc}`);
    }
    lines.push("");
  }

  lines.push("PROFILES:");
  for (const [profileName, profileToolsets] of Object.entries(PROFILES)) {
    const toolCount = profileToolsets.reduce(
      (sum, t) => sum + getToolsetToolCount(allTools, t, TOOLSETS),
      0
    );
    const isDefault = profileName === DEFAULT_PROFILE ? " (default)" : "";
    lines.push(
      `  ${profileName.padEnd(12)} ${String(profileToolsets.length).padStart(2)} toolsets  ${String(toolCount).padStart(3)} tools${isDefault}`
    );
  }
  lines.push("");
  lines.push("Usage:");
  lines.push("  npx @calcom/mcp --profile personal          # Load personal profile (default)");
  lines.push("  npx @calcom/mcp --profile team               # Load team profile");
  lines.push("  npx @calcom/mcp --profile org                # Load org profile (all tools)");
  lines.push("  npx @calcom/mcp --toolsets bookings,slots,me  # Load specific toolsets");
  lines.push("  npx @calcom/mcp --all-tools                  # Load all tools");

  process.stdout.write(`${lines.join("\n")}\n`);
}

// ---------------------------------------------------------------------------
// Meta-Tool Definitions (always registered, regardless of profile)
// ---------------------------------------------------------------------------

const META_TOOL_NAMES = ["list_toolsets", "add_toolsets", "remove_toolsets"] as const;
export type MetaToolName = (typeof META_TOOL_NAMES)[number];

export function isMetaTool(name: string): name is MetaToolName {
  return (META_TOOL_NAMES as readonly string[]).includes(name);
}

export function getMetaToolDefinitions(): Tool[] {
  return [
    {
      name: "list_toolsets",
      description:
        "List all available toolsets, their descriptions, tool counts, and which are currently active. Call this to discover what toolsets can be added or removed.",
      inputSchema: {
        type: "object" as const,
        properties: {},
      },
    },
    {
      name: "add_toolsets",
      description:
        "Add one or more toolsets to the active set, making their tools available. Call list_toolsets first to see available toolsets.",
      inputSchema: {
        type: "object" as const,
        properties: {
          toolsets: {
            type: "array",
            items: { type: "string" },
            description: "Array of toolset names to add (e.g. [\"teams\", \"teams-members\"])",
          },
        },
        required: ["toolsets"],
      },
    },
    {
      name: "remove_toolsets",
      description:
        "Remove one or more toolsets from the active set, freeing context window space. The removed tools will no longer be available until added back.",
      inputSchema: {
        type: "object" as const,
        properties: {
          toolsets: {
            type: "array",
            items: { type: "string" },
            description: "Array of toolset names to remove (e.g. [\"webhooks\"])",
          },
        },
        required: ["toolsets"],
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Meta-Tool Execution
// ---------------------------------------------------------------------------

interface ToolsetState {
  activeToolsets: Set<string>;
  activeToolMap: Map<string, McpToolDefinition>;
  allTools: Map<string, McpToolDefinition>;
  initialProfile: string;
  server: Server;
}

export async function handleMetaTool(
  toolName: MetaToolName,
  args: Record<string, unknown>,
  state: ToolsetState
): Promise<{ content: { type: "text"; text: string }[] }> {
  switch (toolName) {
    case "list_toolsets":
      return handleListToolsets(state);
    case "add_toolsets":
      return handleAddToolsets(args, state);
    case "remove_toolsets":
      return handleRemoveToolsets(args, state);
    default:
      return { content: [{ type: "text", text: `Unknown meta-tool: ${toolName}` }] };
  }
}

function handleListToolsets(state: ToolsetState): {
  content: { type: "text"; text: string }[];
} {
  const allToolsetNames = Object.keys(TOOLSETS);
  const available: Record<
    string,
    { description: string; tool_count: number; active: boolean }
  > = {};

  for (const name of allToolsetNames) {
    available[name] = {
      description: TOOLSET_DESCRIPTIONS[name] || "",
      tool_count: getToolsetToolCount(state.allTools, name, TOOLSETS),
      active: state.activeToolsets.has(name),
    };
  }

  const result = {
    current_profile: state.initialProfile,
    active_toolsets: Array.from(state.activeToolsets),
    active_tool_count: state.activeToolMap.size,
    available_toolsets: available,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

async function handleAddToolsets(
  args: Record<string, unknown>,
  state: ToolsetState
): Promise<{ content: { type: "text"; text: string }[] }> {
  const toolsets = args.toolsets;
  if (!Array.isArray(toolsets) || toolsets.length === 0) {
    return {
      content: [
        { type: "text", text: "Error: 'toolsets' must be a non-empty array of toolset names." },
      ],
    };
  }

  const allToolsetNames = Object.keys(TOOLSETS);
  const invalid = toolsets.filter((t) => !allToolsetNames.includes(t));
  if (invalid.length > 0) {
    return {
      content: [
        {
          type: "text",
          text: `Error: Unknown toolsets: ${invalid.join(", ")}. Use list_toolsets to see available toolsets.`,
        },
      ],
    };
  }

  const alreadyActive = toolsets.filter((t) => state.activeToolsets.has(t));
  const added: string[] = [];

  for (const t of toolsets) {
    if (!state.activeToolsets.has(t)) {
      state.activeToolsets.add(t);
      added.push(t);
    }
  }

  if (added.length > 0) {
    // Rebuild active tool map
    const newMap = filterToolsByToolsets(state.allTools, state.activeToolsets, TOOLSETS);
    state.activeToolMap.clear();
    for (const [k, v] of newMap) {
      state.activeToolMap.set(k, v);
    }

    // Notify client that tool list has changed
    await state.server.notification({ method: "notifications/tools/list_changed" });
  }

  const result = {
    added,
    already_active: alreadyActive,
    active_toolsets: Array.from(state.activeToolsets),
    active_tool_count: state.activeToolMap.size,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

async function handleRemoveToolsets(
  args: Record<string, unknown>,
  state: ToolsetState
): Promise<{ content: { type: "text"; text: string }[] }> {
  const toolsets = args.toolsets;
  if (!Array.isArray(toolsets) || toolsets.length === 0) {
    return {
      content: [
        { type: "text", text: "Error: 'toolsets' must be a non-empty array of toolset names." },
      ],
    };
  }

  const allToolsetNames = Object.keys(TOOLSETS);
  const invalid = toolsets.filter((t) => !allToolsetNames.includes(t));
  if (invalid.length > 0) {
    return {
      content: [
        {
          type: "text",
          text: `Error: Unknown toolsets: ${invalid.join(", ")}. Use list_toolsets to see available toolsets.`,
        },
      ],
    };
  }

  const notActive = toolsets.filter((t) => !state.activeToolsets.has(t));
  const removed: string[] = [];

  for (const t of toolsets) {
    if (state.activeToolsets.has(t)) {
      state.activeToolsets.delete(t);
      removed.push(t);
    }
  }

  if (removed.length > 0) {
    // Rebuild active tool map
    const newMap = filterToolsByToolsets(state.allTools, state.activeToolsets, TOOLSETS);
    state.activeToolMap.clear();
    for (const [k, v] of newMap) {
      state.activeToolMap.set(k, v);
    }

    // Notify client that tool list has changed
    await state.server.notification({ method: "notifications/tools/list_changed" });
  }

  const result = {
    removed,
    not_active: notActive,
    active_toolsets: Array.from(state.activeToolsets),
    active_tool_count: state.activeToolMap.size,
  };

  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
