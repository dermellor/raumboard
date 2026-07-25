#!/bin/bash
# Deploy Raumboard to the Hetzner server (deploy-host). Builds the frontend
# locally, syncs app files, installs prod deps, restarts the service.
# Tenant data (/opt/raumboard/data) is never touched.
set -euo pipefail

HOST=deploy-host
APP=/opt/raumboard/app
cd "$(dirname "$0")/.."

npm run build

rsync -az --delete \
  --exclude node_modules --exclude data \
  package.json package-lock.json tsconfig.json tsconfig.server.json \
  dist server src \
  "$HOST:$APP/"

ssh "$HOST" "cd $APP && npm ci --omit=dev --no-audit --no-fund && chown -R raumboard:raumboard /opt/raumboard/app && systemctl restart raumboard && sleep 2 && systemctl is-active raumboard && curl -sf -o /dev/null http://127.0.0.1:3211/ask?domain=raumboard.de && echo 'deploy ok'"
