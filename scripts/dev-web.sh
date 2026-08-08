#!/bin/bash
# Start the Vite dev server for local development, in API mode.
#
# Loads the instance profile first (RAUMBOARD_INSTANCE, see instance.sh) so the
# web server picks up this instance's ports and proxies to its own API server.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
source "$HERE/scripts/instance.sh"

export VITE_API=true

exec npx vite --config "$HERE/vite.config.ts" "$HERE"
