---
title: Align MCP Server Tools with the Cal.com API v2 OpenAPI Contract
impact: HIGH
impactDescription: Prevents MCP tool schemas from drifting away from the API they wrap
tags: api, openapi, mcp, mcp-server, zod, api-v2
---

# Align MCP Server Tools with the Cal.com API v2 OpenAPI Contract

**Impact: HIGH (prevents MCP tool schemas from drifting away from the API they wrap)**

`apps/mcp-server` is a Model Context Protocol server that wraps the
[Cal.com Platform API v2](https://cal.com/docs/api-reference/v2). Every tool's
Zod input schema is effectively a re-declaration of part of the API v2 contract.
If the schema drifts from the real endpoint, the LLM sends requests the API
rejects (or, worse, silently malformed ones). Keep the two in sync.

**This rule applies only to `apps/mcp-server`** (and any other code that wraps
API v2). It does not apply to `apps/chat`, `apps/mobile`, `apps/extension`, or
`packages/cli`.

## Before adding or changing a tool

1. **Locate the OpenAPI spec.** Find `docs/api-reference/v2/openapi.json` from a
   local `calcom/cal` checkout — see
   [reference-local-cal-api](reference-local-cal-api.md) for the lookup order.
2. **Read the exact contract** for the endpoint you wrap:
   - HTTP path and method.
   - Path params and query params.
   - Request body schema (follow `$ref`s).
   - Response schema (follow `$ref`s).
   - Enums, `minimum`/`maximum`, `default`, and `required` fields.
3. **Mirror those constraints in the Zod schema**, unless you intentionally
   choose a stricter bound for safety (document why in a comment if non-obvious).

## Mirror constraints in Zod

Schemas live next to each tool in `apps/mcp-server/src/tools/**` and are exported
as `<tool>Schema` objects. Encode the documented bounds directly:

**Incorrect (loose schema that ignores the documented bounds):**

```typescript
export const getOrgMembershipsSchema = {
  orgId: z.number().describe("Organization ID"),
  take: z.number().optional(),
  skip: z.number().optional(),
};
```

**Correct (mirrors path/param types and the OpenAPI min/max + integer bounds):**

```typescript
export const getOrgMembershipsSchema = {
  orgId: z.number().int().describe("Organization ID. Use get_me — never guess."),
  take: z.number().int().min(1).max(250).optional().describe("Max results (1-250)"),
  skip: z.number().int().min(0).optional().describe("Results to skip (offset, min 0)"),
};
```

Match documented enums exactly (e.g. `z.enum(["MEMBER", "OWNER", "ADMIN"])`) and
keep `.describe()` text accurate — the descriptions become the tool's parameter
docs that the LLM reads.

## Update discovery + metadata when behavior changes

When a change affects what a tool can do or how it is discovered, update all of:

- Tool annotations (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`,
  `openWorldHint`) so they still reflect the operation.
- The tool tables in `apps/mcp-server/README.md`.
- Server instructions in `apps/mcp-server/src/server-instructions.ts`.

## Add tests for request shape and validation boundaries

Co-located `*.test.ts` files already assert OpenAPI bounds — extend them. Cover
the schema edges so future edits can't silently loosen them:

```typescript
it("enforces OpenAPI pagination bounds", () => {
  expect(getOrgMembershipsSchema.take.safeParse(0).success).toBe(false);
  expect(getOrgMembershipsSchema.take.safeParse(250).success).toBe(true);
  expect(getOrgMembershipsSchema.take.safeParse(251).success).toBe(false);
  expect(getOrgMembershipsSchema.skip.safeParse(-1).success).toBe(false);
});
```

Run them with `bun --filter @calcom/mcp-server test` (or `vitest run` inside
`apps/mcp-server`).

## Optional: local stdio smoke

For high-confidence MCP PRs, run a local stdio smoke against API v2 when a local
API key/DB is available (see `apps/mcp-server/README.md` for stdio + `CAL_API_KEY`
setup) to confirm the tool actually round-trips against the live contract.

## Do not hand-edit the spec

`docs/api-reference/v2/openapi.json` is generated in `calcom/cal`. If the spec is
wrong, fix/regenerate it in `/cal` separately — never hand-edit that JSON from
Companion.
