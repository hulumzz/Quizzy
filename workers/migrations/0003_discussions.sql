CREATE TABLE discussions (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('teacher', 'student')),
  content TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  answer_id TEXT,
  resolved_at TEXT,
  resolved_by TEXT,
  edited_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);
CREATE INDEX idx_discussions_material_created ON discussions(material_id, created_at DESC);

CREATE TABLE discussion_replies (
  id TEXT PRIMARY KEY,
  discussion_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('teacher', 'student')),
  content TEXT,
  edited_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);
CREATE INDEX idx_discussion_replies_discussion_created ON discussion_replies(discussion_id, created_at ASC);
