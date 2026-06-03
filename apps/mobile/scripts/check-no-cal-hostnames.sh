#!/usr/bin/env bash
# Fail if any file under apps/mobile or apps/extension inlines a literal
# `cal.com` / `cal.eu` hostname in code. Region-aware construction must go
# through the helpers in:
#   - apps/mobile/utils/region.ts        (mobile + web build)
#   - apps/extension/lib/region.ts       (Chrome extension)
#
# Scope: scans both `apps/mobile` and `apps/extension`. `rg` honors
# `.gitignore` so build artifacts and `node_modules/` are skipped.
#
# Filters applied on top of the raw matches:
#  - PATTERN uses word boundaries so incidental substrings like
#    `group.com.cal.companion` (iOS app-group id) and `companion.cal.com`
#    (extension OAuth/iframe origin) ARE captured by the pattern and then
#    filtered out below — see CONTENT_ALLOWLIST.
#  - FILE_ALLOWLIST exempts files that legitimately reference Cal hostnames:
#    the region helpers, env templates, manifests / build configs that must
#    stay static, and the hostname match-sets used for detection.
#  - CONTENT_ALLOWLIST exempts the `companion.cal.com` token (the extension's
#    OAuth landing / iframe origin — it matches the pattern but is not a Cal
#    app URL).
#  - Comment lines (starting with //, *, /*) are filtered.
set -euo pipefail
cd "$(dirname "$0")/../../.."  # repo root

PATTERN='\b(app\.)?cal\.(com|eu)\b'

FILE_ALLOWLIST='^(apps/mobile/utils/region\.ts|apps/mobile/utils/booking\.ts|apps/mobile/\.env\.example|apps/mobile/scripts/check-no-cal-hostnames\.sh|apps/extension/lib/region\.ts|apps/extension/\.env\.example|apps/extension/wxt\.config\.ts|apps/extension/public/manifest\.json):'

# Match-anywhere allowlist for tokens that aren't Cal app URLs but happen to
# contain a substring matching PATTERN.
CONTENT_ALLOWLIST='companion\.cal\.com'

raw=$(rg -n --no-heading "$PATTERN" apps/mobile apps/extension 2>/dev/null || true)
hits=$(echo "$raw" \
  | grep -Ev "$FILE_ALLOWLIST" \
  | grep -Ev "$CONTENT_ALLOWLIST" \
  | grep -Ev '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' \
  || true)

if [[ -n "$hits" ]]; then
  {
    echo "Hardcoded Cal hostname found. Use region helpers:"
    echo "  apps/mobile/**:     import from utils/region.ts"
    echo "  apps/extension/**:  import from lib/region.ts"
    echo ""
    echo "$hits"
  } >&2
  exit 1
fi
