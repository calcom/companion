#!/usr/bin/env bash
# Copy RealtimeKit's ReplayKit handler sources into the ScreenShare extension target.
# Run after upgrading @cloudflare/realtimekit-react-native. See targets/screenshare/README.md.
set -euo pipefail
cd "$(dirname "$0")/.."

src="$(node -e 'process.stdout.write(require("path").dirname(require.resolve("@cloudflare/realtimekit-react-native/package.json")))')/ios/screenshare"
dest="targets/screenshare"

if [[ ! -d "$src" ]]; then
  echo "RealtimeKit screenshare sources not found at $src" >&2
  exit 1
fi

cp "$src"/*.swift "$dest"/
echo "Synced $(ls "$src"/*.swift | wc -l | tr -d ' ') files into $dest"
