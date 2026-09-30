CREATE TABLE materials (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'deleted')),
  blocks_json TEXT NOT NULL,
  session_id TEXT,
  published_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE INDEX idx_materials_class_updated ON materials(class_id, updated_at DESC);
CREATE INDEX idx_materials_class_published ON materials(class_id, status, updated_at DESC);

CREATE TABLE material_progress (
  class_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  percent INTEGER NOT NULL CHECK (percent BETWEEN 0 AND 100),
  status TEXT NOT NULL CHECK (status IN ('started', 'completed')),
  last_read_at TEXT NOT NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (class_id, material_id, user_id),
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_material_progress_user_read ON material_progress(user_id, last_read_at DESC);

CREATE TABLE material_bookmarks (
  class_id TEXT NOT NULL,
  material_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  PRIMARY KEY (class_id, material_id, user_id),
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_material_bookmarks_user_saved ON material_bookmarks(user_id, saved_at DESC);
