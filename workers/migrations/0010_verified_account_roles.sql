ALTER TABLE users ADD COLUMN role_verified INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN role_verified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_users_verified_role
  ON users(role_verified, role);
