#!/bin/bash
# Start the API server for local development.
#
# Loads the instance profile first (RAUMBOARD_INSTANCE, see instance.sh), then
# fills in the local defaults for anything the profile did not set. So:
#
#   npm run dev                            → seeded `dev` tenant in ./data
#   RAUMBOARD_INSTANCE=test npm run dev    → whatever that profile points at
#
# RAUMBOARD_DEV=1 makes the server auto-provision the default tenant with seed
# data and fixed local credentials. It is guarded by !PROD on the server side,
# so it cannot take effect in a production install.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
source "$HERE/scripts/instance.sh"

export RAUMBOARD_DEV=1
# `-` rather than `:-`: a profile may set this to the empty string on purpose to
# select platform mode (many schools, tenant resolved from the Host header). An
# empty default tenant also disables the auto-seed, which is what that mode wants.
export RAUMBOARD_DEFAULT_TENANT="${RAUMBOARD_DEFAULT_TENANT-dev}"

exec npx tsx watch "$HERE/server/index.ts"
