#!/bin/bash
# Deploy Raumboard to a server over SSH: build the frontend locally, rsync the
# app files, install prod deps, restart the systemd service. Tenant data
# (the server's data/ dir) is never touched.
#
# Configure via environment (or an untracked deploy/deploy.env that is sourced):
#   DEPLOY_HOST     SSH host or alias of the target server      (required)
#   DEPLOY_PATH     app directory on the server                 (default /opt/raumboard/app)
#   DEPLOY_USER     service user for chown                      (default raumboard)
#   DEPLOY_SERVICE  systemd service name                        (default raumboard)
#   DEPLOY_DOMAIN   a domain the server serves, for healthcheck (default raumboard.de)
set -euo pipefail

HERE="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$HERE/deploy/deploy.env" ] && source "$HERE/deploy/deploy.env"

HOST="${DEPLOY_HOST:?set DEPLOY_HOST (SSH host or alias of the target server)}"
APP="${DEPLOY_PATH:-/opt/raumboard/app}"
SVC_USER="${DEPLOY_USER:-raumboard}"
SERVICE="${DEPLOY_SERVICE:-raumboard}"
DOMAIN="${DEPLOY_DOMAIN:-raumboard.de}"
cd "$HERE"

npm run build

rsync -az --delete \
  --exclude node_modules --exclude data \
  package.json package-lock.json tsconfig.json tsconfig.server.json \
  dist server src \
  "$HOST:$APP/"

ssh "$HOST" "cd $APP && npm ci --omit=dev --no-audit --no-fund && chown -R $SVC_USER:$SVC_USER $APP && systemctl restart $SERVICE && sleep 2 && systemctl is-active $SERVICE && curl -sf -o /dev/null http://127.0.0.1:3211/ask?domain=$DOMAIN && echo 'deploy ok'"
