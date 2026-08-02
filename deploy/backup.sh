#!/bin/bash
# Nightly backup: consistent SQLite copies of every tenant DB, encrypted at rest
# (AES-256) before they leave the server, uploaded to object storage. Old daily
# generations are pruned by the storage retention policy.
#
# Configure via environment. The systemd unit has no EnvironmentFile, so this
# script sources RAUMBOARD_ENV (the app's server-side .env) to pick up the vars:
#   RAUMBOARD_ENV          env file to source        (default /opt/raumboard/.env)
#   BACKUP_DATA            dir holding <slug>.db      (default /opt/raumboard/data)
#   BACKUP_WORK            scratch dir                (default /opt/raumboard/backups)
#   BACKUP_STORAGE_ZONE    object-storage zone/bucket (required)
#   BACKUP_STORAGE_HOST    storage endpoint host      (default storage.bunnycdn.com)
#   BACKUP_STORAGE_KEY     storage access key         (required — secret)
#   BACKUP_ENC_KEY         AES-256 passphrase         (required — secret; no key, no upload)
#
# Restore:  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
#             -pass "pass:$BACKUP_ENC_KEY" -in <file>.db.gz.enc | gunzip > restored.db
set -euo pipefail

ENV_FILE="${RAUMBOARD_ENV:-/opt/raumboard/.env}"
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

DATA="${BACKUP_DATA:-/opt/raumboard/data}"
WORK="${BACKUP_WORK:-/opt/raumboard/backups}"
STAMP=$(date +%F)
ZONE="${BACKUP_STORAGE_ZONE:?set BACKUP_STORAGE_ZONE (object-storage zone/bucket)}"
STORAGE_HOST="${BACKUP_STORAGE_HOST:-storage.bunnycdn.com}"

# Never upload unencrypted school data: without a key, stop.
if [ -z "${BACKUP_ENC_KEY:-}" ]; then
  echo "FEHLER: BACKUP_ENC_KEY fehlt — Abbruch (kein Klartext-Upload)." >&2
  exit 1
fi
: "${BACKUP_STORAGE_KEY:?set BACKUP_STORAGE_KEY (storage access key)}"

mkdir -p "$WORK"
shopt -s nullglob
for db in "$DATA"/*.db; do
  slug=$(basename "$db" .db)
  out="$WORK/${slug}-${STAMP}.db"
  sqlite3 "$db" ".backup '$out'"
  gzip -f "$out"
  # encrypt at rest before it ever leaves the server
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
    -pass "pass:$BACKUP_ENC_KEY" -in "$out.gz" -out "$out.gz.enc"
  curl -sf -X PUT "https://$STORAGE_HOST/$ZONE/$STAMP/${slug}.db.gz.enc" \
    -H "AccessKey: $BACKUP_STORAGE_KEY" \
    --data-binary @"$out.gz.enc"
  rm -f "$out.gz" "$out.gz.enc"
  echo "backup ok (verschlüsselt): $slug ($STAMP)"
done

# prune local leftovers older than 2 days (uploads are the real archive)
find "$WORK" \( -name '*.gz' -o -name '*.enc' \) -mtime +2 -delete 2>/dev/null || true
