#!/bin/bash
# Prüft den Vite-Port; fragt bei Konflikt nach, ob bestehende Prozesse
# gekillt werden sollen.

set -e

HERE="$(cd "$(dirname "$0")/.." && pwd)"
source "$HERE/scripts/instance.sh"

# Only this instance's own ports. A second instance from the same checkout
# (RAUMBOARD_INSTANCE) listens elsewhere and must not be killed from here.
PORTS="${RAUMBOARD_WEB_PORT:-3210} ${RAUMBOARD_PORT:-3211}"  # web, API
# Only a real *listener* blocks binding to the port. Match `-sTCP:LISTEN` so we
# don't trip over leftover client sockets in CLOSED/TIME_WAIT state — those
# don't prevent a new server from listening, and killing their owner would take
# down the wrong process.
PIDS=""
for p in $PORTS; do
  PIDS="$PIDS $(lsof -ti:$p -sTCP:LISTEN 2>/dev/null || true)"
done
PIDS=$(echo $PIDS | xargs 2>/dev/null || true)

if [ -n "$PIDS" ]; then
  echo "Port $PORTS ist belegt:"
  ps -p $PIDS -o pid,command 2>/dev/null | sed 's/^/  /'
  echo
  # Under PM2 / any non-interactive run there is no TTY to prompt on; auto-kill
  # the stale listener instead of hanging on `read` (which would EOF and, with
  # `set -e`, abort the whole dev command into a crash loop).
  if [ -t 0 ]; then
    read -p "Bestehende Prozesse killen? [Y/n] " -n 1 -r REPLY
    echo
  else
    REPLY="Y"
    echo "Kein TTY — bestehende Prozesse werden automatisch beendet."
  fi
  if [[ -z "$REPLY" || $REPLY =~ ^[Yy]$ ]]; then
    kill $PIDS 2>/dev/null || true
    for i in 1 2 3 4 5; do
      sleep 0.2
      still=""
      for p in $PORTS; do still="$still$(lsof -ti:$p -sTCP:LISTEN 2>/dev/null || true)"; done
      [ -z "$still" ] && break
    done
    echo "Gekillt."
  else
    echo "Abgebrochen. Prozesse manuell beenden mit:"
    echo "  kill $PIDS"
    exit 1
  fi
fi
