#!/bin/bash
# Publish the current tree of a branch to the public repo.
#
# The public history has NO common ancestor with the development history, and
# that is deliberate: old development commits carry the pilot school's name and
# slug, a named contact with their work address, and the operator's server
# alias. All of it was removed from the tree, which does not remove it from the
# commits. So publishing copies the *tree* and never the history: one commit on
# `publish`, parented to the previously published one, carrying the source
# branch's tree verbatim.
#
# Because it reads a ref's tree rather than the working directory, an unrelated
# work-in-progress in the checkout cannot leak into a release.
#
#   bash scripts/publish.sh [--dry-run] [<source-ref>]   (default: main)
#
# Nothing is ever pushed. The script prints the push command and stops.
set -euo pipefail

GUARD="${RAUMBOARD_PUBLISH_GUARD:-$HOME/.config/raumboard/publish-guard.txt}"
BRANCH="${RAUMBOARD_PUBLISH_BRANCH:-publish}"
REMOTE="${RAUMBOARD_PUBLISH_REMOTE:-public}"
TRAILER='Raumboard-source'

DRY=0
SRC=main
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    -*) echo "unknown option: $arg" >&2; exit 2 ;;
    *) SRC="$arg" ;;
  esac
done

cd "$(cd "$(dirname "$0")/.." && pwd)"

git rev-parse --verify --quiet "$SRC^{commit}" >/dev/null || {
  echo "no such ref: $SRC" >&2; exit 1; }
git rev-parse --verify --quiet "$BRANCH^{commit}" >/dev/null || {
  echo "no such branch: $BRANCH" >&2; exit 1; }

# Fail closed: without the pattern list there is no check, and "no check" must
# never look like "check passed".
[ -r "$GUARD" ] || {
  echo "publish guard not readable: $GUARD" >&2
  echo "It lists the strings that must not become public, one regex per line." >&2
  exit 1; }

echo "source:  $SRC ($(git rev-parse --short "$SRC"))"
echo "target:  $BRANCH -> $REMOTE"
echo "guard:   $GUARD"
echo

hits=0
while IFS= read -r pattern; do
  [ -z "$pattern" ] && continue
  case "$pattern" in \#*) continue ;; esac
  if out=$(git grep -I -n -i -E -e "$pattern" "$SRC" -- . 2>/dev/null); then
    echo "REFUSED — '$pattern' appears in the tree to be published:"
    echo "$out" | sed 's/^/    /' | head -10
    hits=$((hits + 1))
  fi
done < "$GUARD"

if [ "$hits" -gt 0 ]; then
  echo
  echo "$hits pattern(s) matched. Nothing was written." >&2
  exit 1
fi
echo "guard: clean ($(grep -vce '^[[:space:]]*#\|^[[:space:]]*$' "$GUARD") patterns checked)"

# Which development commit was published last: recorded as a trailer, so the
# public repo carries its own record and no state lives outside git.
LAST=$(git log -1 --format='%(trailers:key='"$TRAILER"',valueonly)' "$BRANCH" | head -1 | tr -d '[:space:]')

if [ -n "$LAST" ] && git rev-parse --verify --quiet "$LAST^{commit}" >/dev/null; then
  RANGE="$LAST..$SRC"
  echo "last published: $(git rev-parse --short "$LAST") ($(git log -1 --format=%ad --date=short "$LAST"))"
else
  RANGE=""
  echo "last published: unknown (no $TRAILER trailer on $BRANCH)"
fi

TREE=$(git rev-parse "$SRC^{tree}")
PARENT=$(git rev-parse "$BRANCH")
if [ "$TREE" = "$(git rev-parse "$BRANCH^{tree}")" ]; then
  echo
  echo "nothing to publish: $BRANCH already carries this exact tree."
  exit 0
fi

echo
echo "changes against the published tree:"
git diff --stat "$BRANCH" "$SRC" | tail -30

MSG=$(mktemp)
trap 'rm -f "$MSG"' EXIT
{
  if [ -n "$RANGE" ]; then
    n=$(git rev-list --count "$RANGE")
    echo "release: $n commits since $(git rev-parse --short "$LAST")"
    echo
    git log --reverse --format='- %s' "$RANGE"
  else
    echo "release: tree of $SRC at $(git rev-parse --short "$SRC")"
  fi
  echo
  echo "$TRAILER: $(git rev-parse "$SRC")"
} > "$MSG"

echo
echo "commit message:"
sed 's/^/    /' "$MSG"

if [ "$DRY" = 1 ]; then
  echo
  echo "dry run — no commit written."
  exit 0
fi

NEW=$(git commit-tree "$TREE" -p "$PARENT" -F "$MSG")
git update-ref "refs/heads/$BRANCH" "$NEW" "$PARENT"

echo
echo "wrote $(git rev-parse --short "$NEW") on $BRANCH"
echo "push:  git push $REMOTE $BRANCH:main"
echo "undo:  git update-ref refs/heads/$BRANCH $PARENT"
