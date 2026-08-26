-- Multiple admin accounts per school, on the existing login level. The teacher
-- PIN is untouched (it stays in config). This turns the single `admin_email` /
-- `admin_hash` pair into a `users` table with a role, so a school can have more
-- than one account and one of them (the owner) manages the others.
--
-- Adoption: a school provisioned before this migration carries its one login in
-- `config`. If those keys are present when this runs, the login becomes the
-- first account with role `owner`, and the two config keys are removed in the
-- same transaction so the users table is the single source of truth afterwards.
-- A freshly created school has no `admin_*` in config at migration time (the CLI
-- writes the owner row directly), so the INSERT below simply matches nothing.

CREATE TABLE users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  pass_hash  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'admin',
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO users (id, email, pass_hash, role, active)
SELECT 'owner', lower(e.value), h.value, 'owner', 1
FROM config e
JOIN config h ON h.key = 'admin_hash'
WHERE e.key = 'admin_email';

DELETE FROM config WHERE key IN ('admin_email', 'admin_hash');
