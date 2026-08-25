#!/bin/bash
# Scan a ref's whole history — every blob and every commit message — for strings
# that must not be public.
#
# The repo publishes as a single history, so `git push` is all there is between
# a local commit and the world. This is the check that used to be welded onto a
# publishing script; it earns its place because it has caught the same class of
# mistake twice: a file removed from the tree while its old versions kept it,
# and a test fixture fixed in one commit but wrong in the three before it.
#
#   bash scripts/check-private.sh [<ref>]        (default: HEAD)
#
# As a pre-push hook:
#   printf '#!/bin/bash\nexec bash scripts/check-private.sh\n' > .git/hooks/pre-push
#   chmod +x .git/hooks/pre-push
set -euo pipefail

GUARD="${RAUMBOARD_PRIVATE_PATTERNS:-$HOME/.config/raumboard/publish-guard.txt}"
REF="${1:-HEAD}"

cd "$(cd "$(dirname "$0")/.." && pwd)"

# Fail closed. A missing list means no check ran, and that must never read like
# a check that passed.
[ -r "$GUARD" ] || {
  echo "pattern list not readable: $GUARD" >&2
  echo "One case-insensitive extended regex per line, # for comments." >&2
  echo "It lives outside the repo because it names the private things." >&2
  exit 1
}

git rev-parse --verify --quiet "$REF^{commit}" >/dev/null || {
  echo "no such ref: $REF" >&2; exit 1; }

echo "checking $REF ($(git rev-list --count "$REF") commits) against $GUARD"

hits=0
while IFS= read -r pattern; do
  [ -z "$pattern" ] && continue
  case "$pattern" in \#*) continue ;; esac

  # `git grep` exits 1 when a revision has no match, which under pipefail would
  # abort the run exactly where the expected result is "clean".
  blobs=$(git rev-list "$REF" | while read -r rev; do
    git grep -l -i -E -e "$pattern" "$rev" -- . 2>/dev/null || true
  done | wc -l | tr -d ' ')
  msgs=$(git log "$REF" --format='%s%n%b' | grep -icE "$pattern" || true)

  if [ $((blobs + msgs)) -gt 0 ]; then
    echo "FOUND — '$pattern': $blobs file version(s), $msgs message line(s)"
    git rev-list "$REF" | while read -r rev; do
      git grep -l -i -E -e "$pattern" "$rev" -- . 2>/dev/null || true
    done | sed 's/^/    /' | head -5
    hits=$((hits + blobs + msgs))
  fi
done < "$GUARD"

if [ "$hits" -gt 0 ]; then
  echo
  echo "$hits match(es). Do not push this." >&2
  echo "Removing it from the tree is not enough — the old versions keep it." >&2
  exit 1
fi

echo "clean: no pattern matches any blob or message in $REF"
