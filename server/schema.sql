CREATE TABLE klasses (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  emoji TEXT
);

CREATE TABLE kids (
  id              TEXT PRIMARY KEY,
  klass_id        TEXT NOT NULL REFERENCES klasses(id) ON DELETE CASCADE,
  symbol          TEXT NOT NULL DEFAULT '⭐',
  name            TEXT NOT NULL,
  current_room_id TEXT
);

CREATE TABLE rooms (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  emoji    TEXT NOT NULL DEFAULT '🚪',
  capacity INTEGER NOT NULL DEFAULT 0,
  is_open  INTEGER NOT NULL DEFAULT 1,
  scope    TEXT NOT NULL DEFAULT 'all'
);

-- keys: school_name, admin_email, admin_hash, pin_hash
CREATE TABLE config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
