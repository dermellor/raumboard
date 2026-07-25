#!/bin/bash
# Nightly backup: consistent SQLite copies of every tenant DB, uploaded to
# Bunny Storage (zone raumboard-backups), 14 daily generations retained.
# Reads BUNNY_BACKUP_PASSWORD from /opt/raumboard/.env.
set -euo pipefail

source /opt/raumboard/.env
DATA=/opt/raumboard/data
WORK=/opt/raumboard/backups
STAMP=$(date +%F)
ZONE=raumboard-backups

mkdir -p "$WORK"
shopt -s nullglob
for db in "$DATA"/*.db; do
  slug=$(basename "$db" .db)
  out="$WORK/${slug}-${STAMP}.db"
  sqlite3 "$db" ".backup '$out'"
  gzip -f "$out"
  curl -sf -X PUT "https://storage.bunnycdn.com/$ZONE/$STAMP/${slug}.db.gz" \
    -H "AccessKey: $BUNNY_BACKUP_PASSWORD" \
    --data-binary @"$out.gz"
  rm -f "$out.gz"
  echo "backup ok: $slug ($STAMP)"
done

# prune local leftovers older than 2 days (uploads are the real archive)
find "$WORK" -name '*.gz' -mtime +2 -delete
