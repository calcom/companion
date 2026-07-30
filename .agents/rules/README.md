# Companion Engineering Rules

This directory contains modular, machine-readable engineering rules for the
Companion monorepo. The scaffold mirrors the format used in
[`calcom/cal`](https://github.com/calcom/cal), kept intentionally lean — rules are
added as needs arise rather than copied wholesale.

## Structure

Rules are grouped by a section prefix, defined in `_sections.md`:

| Prefix | Section | Impact |
|--------|---------|--------|
| `api-` | API / Contract | HIGH |
| `testing-` | Testing | MEDIUM-HIGH |
| `quality-` | Code Quality | MEDIUM |
| `reference-` | Reference | LOW |

## Files

- `_sections.md` — defines sections, ordering, and impact levels.
- `_template.md` — template for creating new rules.
- `{section}-{rule-name}.md` — individual rule files.

## Rule Format

Each rule file uses YAML frontmatter followed by a clear explanation:

```markdown
---
title: Rule Title Here
impact: CRITICAL | HIGH | MEDIUM | LOW
impactDescription: Optional description
tags: tag1, tag2
---

## Rule Title Here

**Impact: LEVEL (optional description)**

Brief explanation of the rule and why it matters, with concrete examples.
```

## Adding New Rules

1. Copy `_template.md` to `{section}-{rule-name}.md`.
2. Fill in the frontmatter (title, impact, tags).
3. Write a clear explanation with incorrect/correct examples where useful.
4. Add the rule to [`../README.md`](../README.md) under the right section.

## Scope

Keep rules narrowly scoped. The MCP/OpenAPI rules apply only to `apps/mcp-server`
and other code that wraps Cal.com API v2 — they do not apply to `apps/chat`,
`apps/mobile`, `apps/extension`, or `packages/cli`.
