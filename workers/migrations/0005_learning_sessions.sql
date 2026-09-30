CREATE TABLE learning_sessions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  meeting_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL,
  published_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE INDEX idx_learning_sessions_class_order ON learning_sessions(class_id, sort_order ASC, meeting_date ASC, created_at ASC);
