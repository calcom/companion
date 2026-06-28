#!/usr/bin/env bash
set -euo pipefail

found=false

while IFS= read -r flow_file; do
  found=true
  maestro check-syntax "$flow_file"
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
