#!/bin/bash
# Instance profile loader. Source this, do not execute it:
#
#   source "$(dirname "$0")/instance.sh"
#
# One checkout serves several deployments — a local test board, a staging
# server, the production host. An "instance" is a name plus the values that
# point at one: its data directory, its tenant, its base domain, its SSH host.
#
#   RAUMBOARD_INSTANCE       name of the profile to load (unset = none)
#   RAUMBOARD_INSTANCE_DIR   where profiles live (default ~/.config/raumboard/instances)
#
# The profile is a plain shell env file at <dir>/<name>.env. It lives outside
# the repo so that no deployment's configuration is ever a file in the working
# tree, and so switching instances is one exported variable rather than an edit.
#
# Values already set in the environment win, so a one-off override works:
#   RAUMBOARD_INSTANCE=staging RAUMBOARD_PORT=3299 npm run dev
#
# Unset RAUMBOARD_INSTANCE is the normal single-deployment case: nothing outside
# the repo is read, which is what a fresh clone and the systemd unit both do
# (the unit gets its environment from EnvironmentFile instead).

__raumboard_load_instance() {
  local name="${RAUMBOARD_INSTANCE:-}"
  [ -n "$name" ] || return 0

  # The name addresses a file, so it stays a single safe path segment: a stray
  # value can then only miss, never reach somewhere else on disk.
  if ! [[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
    echo "instance.sh: ignoring invalid RAUMBOARD_INSTANCE '$name'" >&2
    return 0
  fi

  local dir="${RAUMBOARD_INSTANCE_DIR:-$HOME/.config/raumboard/instances}"
  local file="$dir/$name.env"
  if [ ! -f "$file" ]; then
    echo "instance.sh: no profile at $file" >&2
    return 1
  fi

  # Read into the environment without letting the file win over an explicit
  # override: collect what it sets, then export only the unset ones.
  local key value
  while IFS= read -r line || [ -n "$line" ]; do
    [[ "$line" =~ ^[[:space:]]*(#|$) ]] && continue
    [[ "$line" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    # Strip one matching pair of surrounding quotes.
    if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi
    [ -n "${!key+x}" ] && continue
    export "$key=$value"
  done < "$file"

  echo "instance: $name ($file)" >&2
}

__raumboard_load_instance
