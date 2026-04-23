#!/usr/bin/env bash
# Fail if any file under apps/mobile inlines a literal `cal.com` or `cal.eu`
# hostname in code. Region-aware construction must go through the helpers in
# `apps/mobile/utils/region.ts` so EU users get routed to `app.cal.eu` /
# `api.cal.eu` / `cal.eu`.
#
# Scope: scans the entire `apps/mobile` tree. `rg` honors `.gitignore` so
# `node_modules/`, build artifacts, and other ignored paths are skipped
# automatically — no manual directory list to drift out of sync.
#
# Filters applied on top of the raw matches:
# - Word boundaries in `PATTERN` so incidental substrings like
#   `group.com.cal.companion` (an iOS app-group id) are not flagged.
# - Lines whose content starts with `//`, `*`, or `/*` are filtered, since
#   documentation prose / docstring @example URLs don't cause runtime bugs.
# - `ALLOWLIST` exempts files that legitimately reference the bare hostnames:
#   the region helpers themselves, the env template, the hostname match-set
#   used for video-call URL detection, and this script.
set -euo pipefail
cd "$(dirname "$0")/.."

PATTERN='\bcal\.(com|eu)\b'
ALLOWLIST='^(\./)?(utils/region\.ts|utils/booking\.ts|\.env\.example|scripts/check-no-cal-hostnames\.sh):'

raw=$(rg -n --no-heading "$PATTERN" . 2>/dev/null || true)
hits=$(echo "$raw" | grep -Ev "$ALLOWLIST" | grep -Ev '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' || true)

if [[ -n "$hits" ]]; then
  {
    echo "Hardcoded Cal hostname found. Use helpers from utils/region.ts:"
    echo "  getCalAppUrl(), getCalApiUrl(), getCalWebUrl()"
    echo "  getCalSupportUrl(), getCalHelpUrl(slug)"
    echo ""
    echo "$hits"
  } >&2
  exit 1
fi
