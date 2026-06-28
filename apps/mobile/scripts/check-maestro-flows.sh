#!/usr/bin/env bash
set -euo pipefail

found=false
failed=false

while IFS= read -r flow_file; do
  found=true
  if ! maestro check-syntax "$flow_file"; then
    echo "Maestro syntax check failed for $flow_file" >&2
    failed=true
  fi
done < <(
  find maestro -type f \( -name "*.yaml" -o -name "*.yml" \) \
    ! -name "config.yaml" \
    ! -name "config.yml" |
    sort
)

if [ "$found" = false ]; then
  echo "No Maestro YAML files found under apps/mobile/maestro."
  exit 1
fi

if [ "$failed" = true ]; then
  echo "One or more Maestro flow files failed syntax validation." >&2
  exit 1
fi
