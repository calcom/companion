---
title: Locating the Cal.com API v2 OpenAPI Spec
impact: LOW
impactDescription: Reference guide for finding the source-of-truth API v2 contract
tags: reference, api, openapi, mcp
---

# Locating the Cal.com API v2 OpenAPI Spec

`apps/mcp-server` wraps the Cal.com Platform API v2. The source of truth for the
API contract is the OpenAPI document that lives in the **`calcom/cal`** repo at:

```
docs/api-reference/v2/openapi.json
```

It is auto-generated from the API v2 NestJS decorators and is large (~1MB+).
Companion does **not** vendor a copy of it, so agents resolve it from a local
checkout of `calcom/cal`.

## How to find it

Look for the file in this order and use the first that exists:

1. `$CALCOM_CAL_REPO/docs/api-reference/v2/openapi.json`
   — set the `CALCOM_CAL_REPO` env var to your local `calcom/cal` checkout.
2. `../cal/docs/api-reference/v2/openapi.json`
   — the common layout where `companion` and `cal` are sibling directories.

```bash
# Resolve the spec path (first match wins)
SPEC="${CALCOM_CAL_REPO:+$CALCOM_CAL_REPO/docs/api-reference/v2/openapi.json}"
[ -f "$SPEC" ] || SPEC="../cal/docs/api-reference/v2/openapi.json"
[ -f "$SPEC" ] && echo "Using $SPEC" || echo "openapi.json not found — clone calcom/cal"
```

If neither path exists, ask for a `calcom/cal` checkout (or its location) rather
than guessing the contract.

## Do not hand-edit the spec

`openapi.json` is generated. If the spec itself is wrong, fix or regenerate it in
the `calcom/cal` repo (by changing the API v2 decorators and rebooting the API),
**not** by editing the JSON. Never hand-edit `cal`'s `openapi.json` from Companion.
