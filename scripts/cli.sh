#!/bin/bash
# Tenant administration against a named instance.
#
#   RAUMBOARD_INSTANCE=hosted bash scripts/cli.sh list
#   RAUMBOARD_INSTANCE=hosted bash scripts/cli.sh create-school demo "Demoschule" admin@example.org --seed
#
# Without RAUMBOARD_INSTANCE it acts on the checkout's own data/ directory, which
# is what a single self-hosted install does on its server.
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
source "$HERE/scripts/instance.sh"

exec npx tsx "$HERE/server/cli.ts" "$@"
