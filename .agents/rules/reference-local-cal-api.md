---
title: Locating the Cal.com API v2 OpenAPI Spec
impact: LOW
impactDescription: Reference guide for finding the source-of-truth API v2 contract
tags: reference, api, openapi
---

# Locating the Cal.com API v2 OpenAPI Spec

`packages/cli` generates its client from the Cal.com Platform API v2. This repo
vendors that contract at:

```
docs/api-reference/v2/openapi.json
```

It is the exact file `packages/cli/openapi-ts.config.ts` reads, as
`../../docs/api-reference/v2/openapi.json`, so regenerating the client needs no
checkout of another repo. The document is auto-generated from the API v2 NestJS
decorators and is large (~1MB+).

## Do not hand-edit the spec

`openapi.json` is generated. If the contract itself is wrong, fix it in the
**`calcom/cal`** repo by changing the API v2 decorators and regenerating it there,
then copy the result over the vendored file. Never hand-edit the JSON on either
side.
