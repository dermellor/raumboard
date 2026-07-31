#!/bin/bash
# Nightly backup: consistent SQLite copies of every tenant DB, encrypted at rest
# (AES-256), uploaded to Bunny Storage (zone raumboard-backups), 14 daily
# generations retained. Reads BUNNY_BACKUP_PASSWORD and BUNNY_BACKUP_ENC_KEY
# from /opt/raumboard/.env.
#
# Restore:  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
#             -pass "pass:$BUNNY_BACKUP_ENC_KEY" -in <file>.db.gz.enc | gunzip > restored.db
set -euo pipefail

source /opt/raumboard/.env
DATA=/opt/raumboard/data
WORK=/opt/raumboard/backups
STAMP=$(date +%F)
ZONE=raumboard-backups

# Never upload unencrypted school data: without a key, stop.
if [ -z "${BUNNY_BACKUP_ENC_KEY:-}" ]; then
  echo "FEHLER: BUNNY_BACKUP_ENC_KEY fehlt in /opt/raumboard/.env — Abbruch (kein Klartext-Upload)." >&2
  exit 1
fi

mkdir -p "$WORK"
shopt -s nullglob
for db in "$DATA"/*.db; do
  slug=$(basename "$db" .db)
  out="$WORK/${slug}-${STAMP}.db"
  sqlite3 "$db" ".backup '$out'"
  gzip -f "$out"
  # encrypt at rest before it ever leaves the server
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -pass "pass:$BUNNY_BACKUP_ENC_KEY" -in "$out.gz" -out "$out.gz.enc"
  curl -sf -X PUT "https://storage.bunnycdn.com/$ZONE/$STAMP/${slug}.db.gz.enc" \
    -H "AccessKey: $BUNNY_BACKUP_PASSWORD" \
    --data-binary @"$out.gz.enc"
  rm -f "$out.gz" "$out.gz.enc"
  echo "backup ok (verschlüsselt): $slug ($STAMP)"
done

# prune local leftovers older than 2 days (uploads are the real archive)
find "$WORK" \( -name '*.gz' -o -name '*.enc' \) -mtime +2 -delete 2>/dev/null || true
