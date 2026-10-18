CREATE TABLE usage_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  kind       TEXT NOT NULL CHECK (kind IN ('app_open', 'activity')),
  board_hash TEXT
);

CREATE INDEX usage_events_window ON usage_events(occurred_at, kind);
